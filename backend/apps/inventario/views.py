from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.auditoria.services import registrar_auditoria
from apps.catalogos.models import TipoExistencia, UnidadMedida
from apps.empresas.models import Empresa
from apps.inventario.models import Almacen, Producto, ProductoUnidad, Tercero
from apps.inventario.serializers import (
    AlmacenSerializer,
    ProductoSerializer,
    ProductoUnidadSerializer,
    TerceroSerializer,
    TipoExistenciaSerializer,
    UnidadMedidaSerializer,
)
from apps.usuarios.authentication import UsuarioTokenAuthentication
from apps.usuarios.permissions import EsAdminEmpresa, TieneEmpresaActiva


class EmpresaActivaMixin:
    authentication_classes = (UsuarioTokenAuthentication,)
    permission_classes = (TieneEmpresaActiva,)
    http_method_names = ('get', 'post', 'patch', 'head', 'options')

    def get_permissions(self):
        permisos = [TieneEmpresaActiva()]
        if self.request.method in ('POST', 'PATCH'):
            permisos.append(EsAdminEmpresa())
        return permisos

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not Empresa.objects.filter(pk=request.empresa_id, estado='ACTIVA').exists():
            raise NotFound('Empresa activa no encontrada.')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['empresa_id'] = self.request.empresa_id
        return context


class AuditoriaMixin:
    entidad_auditoria = ''

    def _registrar(self, accion, instance, anterior, nuevo):
        registrar_auditoria(
            empresa_id=self.request.empresa_id,
            usuario_id=self.request.user.id,
            accion=accion,
            entidad=self.entidad_auditoria,
            registro_id=instance.id,
            valor_anterior=anterior,
            valor_nuevo=nuevo,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            self.perform_create(serializer)
            nuevo = dict(serializer.data)
            self._registrar(f'CREAR_{self.entidad_auditoria}', serializer.instance, None, nuevo)
        return Response(nuevo, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        anterior = dict(self.get_serializer(instance).data)
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            self.perform_update(serializer)
            nuevo = dict(serializer.data)
            self._registrar(
                f'ACTUALIZAR_{self.entidad_auditoria}',
                serializer.instance,
                anterior,
                nuevo,
            )
        return Response(nuevo)


class AlmacenListCreateView(AuditoriaMixin, EmpresaActivaMixin, generics.ListCreateAPIView):
    serializer_class = AlmacenSerializer
    entidad_auditoria = 'ALMACEN'

    def get_queryset(self):
        return (
            Almacen.objects.filter(empresa_id=self.request.empresa_id)
            .select_related('establecimiento')
            .order_by('codigo')
        )

    def perform_create(self, serializer):
        serializer.save(empresa_id=self.request.empresa_id)


class AlmacenDetailView(AuditoriaMixin, EmpresaActivaMixin, generics.UpdateAPIView):
    serializer_class = AlmacenSerializer
    entidad_auditoria = 'ALMACEN'

    def get_queryset(self):
        return Almacen.objects.filter(
            empresa_id=self.request.empresa_id,
        ).select_related('establecimiento')


class TerceroListCreateView(AuditoriaMixin, EmpresaActivaMixin, generics.ListCreateAPIView):
    serializer_class = TerceroSerializer
    entidad_auditoria = 'TERCERO'

    def get_queryset(self):
        queryset = Tercero.objects.filter(empresa_id=self.request.empresa_id)
        tipo = self.request.query_params.get('tipo', '').lower()
        if tipo == 'cliente':
            queryset = queryset.filter(es_cliente=True)
        elif tipo == 'proveedor':
            queryset = queryset.filter(es_proveedor=True)

        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(numero_documento__icontains=search)
                | Q(razon_social__icontains=search)
                | Q(nombre_comercial__icontains=search)
            )
        return queryset.order_by('razon_social', 'numero_documento')

    def perform_create(self, serializer):
        serializer.save(empresa_id=self.request.empresa_id)


class TerceroDetailView(AuditoriaMixin, EmpresaActivaMixin, generics.UpdateAPIView):
    serializer_class = TerceroSerializer
    entidad_auditoria = 'TERCERO'

    def get_queryset(self):
        return Tercero.objects.filter(empresa_id=self.request.empresa_id)


class ProductoListCreateView(AuditoriaMixin, EmpresaActivaMixin, generics.ListCreateAPIView):
    serializer_class = ProductoSerializer
    entidad_auditoria = 'PRODUCTO'

    def get_queryset(self):
        return (
            Producto.objects.filter(empresa_id=self.request.empresa_id)
            .select_related('tipo_existencia_codigo')
            .prefetch_related('unidades__unidad_codigo')
            .order_by('codigo_interno')
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            producto = serializer.save()
            producto = self.get_queryset().get(pk=producto.pk)
            serializer = self.get_serializer(producto)
            nuevo = dict(serializer.data)
            self._registrar('CREAR_PRODUCTO', producto, None, nuevo)
            unidad_base = producto.unidades.get(es_base=True)
            registrar_auditoria(
                empresa_id=request.empresa_id,
                usuario_id=request.user.id,
                accion='CREAR_PRODUCTO_UNIDAD',
                entidad='PRODUCTO_UNIDAD',
                registro_id=unidad_base.id,
                valor_anterior=None,
                valor_nuevo={
                    'producto': producto.id,
                    'unidad_codigo': unidad_base.unidad_codigo_id,
                    'factor_a_base': format(unidad_base.factor_a_base, '.8f'),
                    'es_base': True,
                },
                motivo='Creación automática de la unidad base del producto.',
            )
        return Response(nuevo, status=status.HTTP_201_CREATED)


class ProductoDetailView(AuditoriaMixin, EmpresaActivaMixin, generics.UpdateAPIView):
    serializer_class = ProductoSerializer
    entidad_auditoria = 'PRODUCTO'

    def get_queryset(self):
        return (
            Producto.objects.filter(empresa_id=self.request.empresa_id)
            .select_related('tipo_existencia_codigo')
            .prefetch_related('unidades__unidad_codigo')
        )


class ProductoScopedMixin(EmpresaActivaMixin):
    producto = None

    def get_producto(self):
        if self.producto is None:
            self.producto = get_object_or_404(
                Producto.objects.filter(empresa_id=self.request.empresa_id),
                pk=self.kwargs['producto_id'],
            )
        return self.producto

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['producto'] = self.get_producto()
        return context


class ProductoUnidadListCreateView(AuditoriaMixin, ProductoScopedMixin, generics.ListCreateAPIView):
    serializer_class = ProductoUnidadSerializer
    entidad_auditoria = 'PRODUCTO_UNIDAD'

    def get_queryset(self):
        return (
            ProductoUnidad.objects.filter(producto=self.get_producto())
            .select_related('unidad_codigo')
            .order_by('-es_base', 'unidad_codigo_id')
        )


class ProductoUnidadDetailView(AuditoriaMixin, ProductoScopedMixin, generics.UpdateAPIView):
    serializer_class = ProductoUnidadSerializer
    entidad_auditoria = 'PRODUCTO_UNIDAD'
    lookup_url_kwarg = 'unidad_id'

    def get_queryset(self):
        return ProductoUnidad.objects.filter(
            producto=self.get_producto(),
        ).select_related('unidad_codigo')


class TipoExistenciaListView(EmpresaActivaMixin, generics.ListAPIView):
    serializer_class = TipoExistenciaSerializer
    queryset = TipoExistencia.objects.all().order_by('codigo')


class UnidadMedidaListView(EmpresaActivaMixin, generics.ListAPIView):
    serializer_class = UnidadMedidaSerializer
    queryset = UnidadMedida.objects.all().order_by('codigo')
