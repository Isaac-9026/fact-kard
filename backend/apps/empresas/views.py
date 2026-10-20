from decimal import Decimal

from django.db import transaction
from django.db.models import F
from rest_framework import generics, status
from rest_framework.exceptions import NotAuthenticated, NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.empresas.models import ConfigEmpresa, ConfigIgvPeriodo, Empresa, Establecimiento, Periodo
from apps.empresas.serializers import (
    ConfigEmpresaSerializer,
    ConfigIgvPeriodoSerializer,
    EmpresaSerializer,
    EstablecimientoSerializer,
    PeriodoCreateSerializer,
    PeriodoSerializer,
    ReabrirPeriodoSerializer,
)
from apps.usuarios.models import UsuarioEmpresa
from apps.usuarios.permissions import EsAdminEmpresa, TieneEmpresaActiva
from apps.auditoria.services import registrar_auditoria
from django.utils import timezone


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


class PeriodoListCreateView(APIView):
    permission_classes = [TieneEmpresaActiva]

    def get(self, request):
        periodos = Periodo.objects.filter(
            empresa_id=request.empresa_id
        ).prefetch_related('configs_igv').order_by('-orden')
        serializer = PeriodoSerializer(periodos, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = PeriodoCreateSerializer(
            data=request.data,
            context={'empresa_id': request.empresa_id}
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            periodo = serializer.save()
            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion='CREAR',
                entidad='periodo',
                registro_id=periodo.id,
                valor_nuevo={
                    'anio': periodo.anio,
                    'mes': periodo.mes,
                    'orden': periodo.orden,
                    'fecha_inicio': periodo.fecha_inicio.isoformat(),
                    'fecha_fin': periodo.fecha_fin.isoformat(),
                    'estado': periodo.estado,
                },
                motivo=f'Creación de período {periodo.anio}-{periodo.mes:02d}'
            )
        return Response(PeriodoSerializer(periodo).data, status=status.HTTP_201_CREATED)


class PeriodoReabrirView(APIView):
    permission_classes = [TieneEmpresaActiva, EsAdminEmpresa]

    def post(self, request, pk):
        serializer = ReabrirPeriodoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        motivo = serializer.validated_data['motivo_reapertura']

        periodo = Periodo.objects.filter(
            id=pk,
            empresa_id=request.empresa_id
        ).first()
        if not periodo:
            raise NotFound('Período no encontrado en la empresa activa.')

        with transaction.atomic():
            estado_anterior = periodo.estado
            periodo.estado = 'ABIERTO'
            periodo.reabierto_por = request.user
            periodo.reabierto_en = timezone.now()
            periodo.motivo_reapertura = motivo
            periodo.save(update_fields=['estado', 'reabierto_por', 'reabierto_en', 'motivo_reapertura'])

            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion='REABRIR',
                entidad='periodo',
                registro_id=periodo.id,
                valor_anterior={'estado': estado_anterior},
                valor_nuevo={'estado': 'ABIERTO', 'motivo_reapertura': motivo},
                motivo=motivo
            )

            posteriores_cerrados = Periodo.objects.filter(
                empresa_id=request.empresa_id,
                orden__gt=periodo.orden,
                estado='CERRADO'
            ).order_by('orden')

            desactualizados_count = 0
            for post in posteriores_cerrados:
                post_ant_estado = post.estado
                post.estado = 'DESACTUALIZADO'
                post.motivo_desactualizado = f"Reapertura de período anterior {periodo.anio}-{periodo.mes:02d}: {motivo}"
                post.save(update_fields=['estado', 'motivo_desactualizado'])
                desactualizados_count += 1

                registrar_auditoria(
                    empresa_id=request.empresa_id,
                    usuario_id=request.user.id,
                    accion='DESACTUALIZAR',
                    entidad='periodo',
                    registro_id=post.id,
                    valor_anterior={'estado': post_ant_estado},
                    valor_nuevo={'estado': post.estado, 'motivo': post.motivo_desactualizado},
                    motivo=f'Desactualizado por reapertura de período {periodo.anio}-{periodo.mes:02d}'
                )

        return Response({
            'mensaje': 'Período reabierto correctamente.',
            'periodos_desactualizados': desactualizados_count,
            'periodo': PeriodoSerializer(periodo).data,
        }, status=status.HTTP_200_OK)


class PeriodoCerrarView(APIView):
    permission_classes = [TieneEmpresaActiva, EsAdminEmpresa]

    def post(self, request, pk):
        periodo = Periodo.objects.filter(
            id=pk,
            empresa_id=request.empresa_id
        ).first()
        if not periodo:
            raise NotFound('Período no encontrado en la empresa activa.')

        with transaction.atomic():
            estado_anterior = periodo.estado
            periodo.estado = 'CERRADO'
            periodo.cerrado_por = request.user
            periodo.cerrado_en = timezone.now()
            periodo.save(update_fields=['estado', 'cerrado_por', 'cerrado_en'])

            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion='CERRAR',
                entidad='periodo',
                registro_id=periodo.id,
                valor_anterior={'estado': estado_anterior},
                valor_nuevo={'estado': 'CERRADO'},
                motivo=f'Cierre de período {periodo.anio}-{periodo.mes:02d}'
            )

        return Response({
            'mensaje': 'Período cerrado correctamente.',
            'periodo': PeriodoSerializer(periodo).data,
        }, status=status.HTTP_200_OK)


class ConfigIgvPeriodoView(APIView):
    permission_classes = [TieneEmpresaActiva]

    def get_periodo(self, request, periodo_id):
        periodo = Periodo.objects.filter(
            id=periodo_id,
            empresa_id=request.empresa_id
        ).first()
        if not periodo:
            raise NotFound('Período no encontrado.')
        return periodo

    def get(self, request, periodo_id):
        periodo = self.get_periodo(request, periodo_id)
        config = ConfigIgvPeriodo.objects.filter(
            empresa_id=request.empresa_id,
            periodo=periodo
        ).first()
        if not config:
            raise NotFound('Configuración de IGV no establecida para este período.')
        return Response(ConfigIgvPeriodoSerializer(config).data)

    def post(self, request, periodo_id):
        periodo = self.get_periodo(request, periodo_id)
        config = ConfigIgvPeriodo.objects.filter(
            empresa_id=request.empresa_id,
            periodo=periodo
        ).first()

        serializer = ConfigIgvPeriodoSerializer(config, data=request.data, partial=bool(config))
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            if config:
                valor_ant = {
                    'metodo': config.metodo,
                    'porcentaje_recuperable': str(config.porcentaje_recuperable),
                }
                config = serializer.save()
                accion = 'MODIFICAR'
                motivo = f'Actualización de configuración IGV para período {periodo.anio}-{periodo.mes:02d}'
            else:
                valor_ant = None
                config = serializer.save(
                    empresa_id=request.empresa_id,
                    periodo=periodo,
                    creado_por=request.user
                )
                accion = 'CREAR'
                motivo = f'Configuración inicial de IGV para período {periodo.anio}-{periodo.mes:02d}'

            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion=accion,
                entidad='config_igv_periodo',
                registro_id=config.id,
                valor_anterior=valor_ant,
                valor_nuevo={
                    'metodo': config.metodo,
                    'porcentaje_recuperable': str(config.porcentaje_recuperable),
                },
                motivo=motivo
            )

        return Response(
            ConfigIgvPeriodoSerializer(config).data,
            status=status.HTTP_200_OK if valor_ant else status.HTTP_201_CREATED
        )

    def patch(self, request, periodo_id):
        return self.post(request, periodo_id)


class ConfigIgvListCreateView(APIView):
    permission_classes = [TieneEmpresaActiva]

    def get(self, request):
        configs = ConfigIgvPeriodo.objects.filter(
            empresa_id=request.empresa_id
        ).select_related('periodo').order_by('-periodo__orden')
        return Response(ConfigIgvPeriodoSerializer(configs, many=True).data)

    def post(self, request):
        periodo_id = request.data.get('periodo') or request.data.get('periodo_id')
        if not periodo_id:
            raise ValidationError({'periodo': 'El ID del período es obligatorio.'})

        periodo = Periodo.objects.filter(
            id=periodo_id,
            empresa_id=request.empresa_id
        ).first()
        if not periodo:
            raise NotFound('Período no encontrado en la empresa activa.')

        config = ConfigIgvPeriodo.objects.filter(
            empresa_id=request.empresa_id,
            periodo=periodo
        ).first()

        serializer = ConfigIgvPeriodoSerializer(config, data=request.data, partial=bool(config))
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            if config:
                valor_ant = {
                    'metodo': config.metodo,
                    'porcentaje_recuperable': str(config.porcentaje_recuperable),
                }
                config = serializer.save()
                accion = 'MODIFICAR'
                motivo = f'Actualización de configuración IGV para período {periodo.anio}-{periodo.mes:02d}'
            else:
                valor_ant = None
                config = serializer.save(
                    empresa_id=request.empresa_id,
                    periodo=periodo,
                    creado_por=request.user
                )
                accion = 'CREAR'
                motivo = f'Configuración inicial de IGV para período {periodo.anio}-{periodo.mes:02d}'

            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion=accion,
                entidad='config_igv_periodo',
                registro_id=config.id,
                valor_anterior=valor_ant,
                valor_nuevo={
                    'metodo': config.metodo,
                    'porcentaje_recuperable': str(config.porcentaje_recuperable),
                },
                motivo=motivo
            )

        return Response(
            ConfigIgvPeriodoSerializer(config).data,
            status=status.HTTP_200_OK if valor_ant else status.HTTP_201_CREATED
        )


class ConfigIgvDetailView(APIView):
    permission_classes = [TieneEmpresaActiva]

    def get_object(self, request, pk):
        config = ConfigIgvPeriodo.objects.filter(
            id=pk,
            empresa_id=request.empresa_id
        ).first()
        if not config:
            raise NotFound('Configuración de IGV no encontrada.')
        return config

    def get(self, request, pk):
        config = self.get_object(request, pk)
        return Response(ConfigIgvPeriodoSerializer(config).data)

    def patch(self, request, pk):
        config = self.get_object(request, pk)
        serializer = ConfigIgvPeriodoSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        valor_ant = {
            'metodo': config.metodo,
            'porcentaje_recuperable': str(config.porcentaje_recuperable),
        }
        with transaction.atomic():
            config = serializer.save()
            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion='MODIFICAR',
                entidad='config_igv_periodo',
                registro_id=config.id,
                valor_anterior=valor_ant,
                valor_nuevo={
                    'metodo': config.metodo,
                    'porcentaje_recuperable': str(config.porcentaje_recuperable),
                },
                motivo=f'Modificación de configuración IGV de período {config.periodo_id}'
            )
        return Response(ConfigIgvPeriodoSerializer(config).data)
