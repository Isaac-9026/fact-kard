from decimal import Decimal

from django.db import transaction
from django.db.models import F
from rest_framework import generics, status
from rest_framework.exceptions import NotAuthenticated, NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.empresas.models import ConfigEmpresa, Empresa, Establecimiento
from apps.empresas.serializers import (
    ConfigEmpresaSerializer,
    EmpresaSerializer,
    EstablecimientoSerializer,
)
from apps.usuarios.models import UsuarioEmpresa


def _usuario_actual(request):
    usuario = getattr(request, 'user', None)
    if usuario is None or getattr(usuario, 'pk', None) is None:
        raise NotAuthenticated('Se requiere un usuario autenticado.')
    return usuario


def _empresa_activa(request):
    usuario = _usuario_actual(request)
    raw_empresa_id = request.headers.get('X-Empresa-Id')
    if not raw_empresa_id:
        raise ValidationError({'X-Empresa-Id': 'Este header es obligatorio.'})
    try:
        empresa_id = int(raw_empresa_id)
    except (TypeError, ValueError):
        raise ValidationError({'X-Empresa-Id': 'Debe ser un identificador válido.'})

    asignacion = UsuarioEmpresa.objects.filter(
        usuario_id=usuario.pk,
        empresa_id=empresa_id,
        activo=True,
    ).select_related('empresa').first()
    if asignacion is None:
        raise NotFound('Empresa no encontrada.')
    return asignacion.empresa


class EmpresaListCreateView(APIView):
    def get(self, request):
        usuario = _usuario_actual(request)
        empresas = Empresa.objects.filter(
            usuarios_asignados__usuario_id=usuario.pk,
            usuarios_asignados__activo=True,
        ).annotate(
            rol_usuario=F('usuarios_asignados__rol')
        ).order_by('razon_social')
        return Response(EmpresaSerializer(empresas, many=True).data)

    def post(self, request):
        usuario = _usuario_actual(request)
        serializer = EmpresaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            empresa = serializer.save()
            ConfigEmpresa.objects.create(
                empresa=empresa,
                tolerancia_residuo_pen=Decimal('0.05000000'),
                decimales_calculo=6,
                regla_redondeo='ROUND_HALF_UP',
                metodo_valuacion='CPP',
            )
            UsuarioEmpresa.objects.create(
                usuario_id=usuario.pk,
                empresa=empresa,
                rol='ADMIN',
            )
        empresa.rol_usuario = 'ADMIN'
        return Response(EmpresaSerializer(empresa).data, status=status.HTTP_201_CREATED)


class ConfigEmpresaView(APIView):
    def get_object(self, request):
        empresa = _empresa_activa(request)
        try:
            return empresa.configuracion
        except ConfigEmpresa.DoesNotExist as exc:
            raise NotFound('Configuración no encontrada.') from exc

    def get(self, request):
        config = self.get_object(request)
        serializer = ConfigEmpresaSerializer(
            config,
            context={'empresa_id': config.empresa_id},
        )
        return Response(serializer.data)

    def patch(self, request):
        config = self.get_object(request)
        serializer = ConfigEmpresaSerializer(
            config,
            data=request.data,
            partial=True,
            context={'empresa_id': config.empresa_id},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class EstablecimientoListCreateView(generics.ListCreateAPIView):
    serializer_class = EstablecimientoSerializer

    def get_queryset(self):
        empresa = _empresa_activa(self.request)
        return Establecimiento.objects.filter(empresa_id=empresa.id).order_by('codigo_sunat')

    def perform_create(self, serializer):
        serializer.save(empresa=_empresa_activa(self.request))


class EstablecimientoDetailView(generics.UpdateAPIView):
    serializer_class = EstablecimientoSerializer
    http_method_names = ('patch', 'options')

    def get_queryset(self):
        empresa = _empresa_activa(self.request)
        return Establecimiento.objects.filter(empresa_id=empresa.id)
