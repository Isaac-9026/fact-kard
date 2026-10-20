from decimal import Decimal

from rest_framework import serializers
from django.utils import timezone

from apps.catalogos.models import TipoExistencia, UnidadMedida
from apps.empresas.models import Establecimiento
from apps.inventario.models import Almacen, Producto, ProductoUnidad, Tercero


def _empresa_id(serializer):
    empresa_id = serializer.context.get('empresa_id')
    if empresa_id is None:
        raise serializers.ValidationError('No se pudo determinar la empresa activa.')
    return empresa_id


class AlmacenSerializer(serializers.ModelSerializer):
    establecimiento = serializers.PrimaryKeyRelatedField(
        queryset=Establecimiento.objects.none(),
    )
    establecimiento_codigo = serializers.CharField(
        source='establecimiento.codigo_sunat', read_only=True,
    )
    establecimiento_nombre = serializers.CharField(
        source='establecimiento.nombre', read_only=True,
    )

    class Meta:
        model = Almacen
        fields = (
            'id', 'empresa', 'establecimiento', 'establecimiento_codigo',
            'establecimiento_nombre', 'codigo', 'nombre', 'activo',
        )
        read_only_fields = ('id', 'empresa')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        empresa_id = self.context.get('empresa_id')
        if empresa_id is not None:
            self.fields['establecimiento'].queryset = Establecimiento.objects.filter(
                empresa_id=empresa_id,
            )

    def to_internal_value(self, data):
        if 'establecimiento_id' in data and 'establecimiento' not in data:
            data = data.copy()
            data['establecimiento'] = data['establecimiento_id']
        return super().to_internal_value(data)

    def validate(self, attrs):
        empresa_id = _empresa_id(self)
        codigo = attrs.get('codigo', getattr(self.instance, 'codigo', None))
        duplicado = Almacen.objects.filter(empresa_id=empresa_id, codigo=codigo)
        if self.instance is not None:
            duplicado = duplicado.exclude(pk=self.instance.pk)
        if duplicado.exists():
            raise serializers.ValidationError(
                {'codigo': 'Ya existe un almacén con este código en la empresa activa.'}
            )
        return attrs


class TerceroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tercero
        fields = (
            'id', 'empresa', 'tipo_documento', 'numero_documento',
            'razon_social', 'nombre_comercial', 'direccion', 'telefono',
            'correo', 'es_cliente', 'es_proveedor', 'estado', 'creado_en',
            'actualizado_en',
        )
        read_only_fields = ('id', 'empresa', 'creado_en', 'actualizado_en')

    def validate(self, attrs):
        empresa_id = _empresa_id(self)
        es_cliente = attrs.get('es_cliente', getattr(self.instance, 'es_cliente', False))
        es_proveedor = attrs.get('es_proveedor', getattr(self.instance, 'es_proveedor', False))
        if not es_cliente and not es_proveedor:
            raise serializers.ValidationError(
                'El tercero debe ser cliente, proveedor o ambos.'
            )

        tipo_documento = attrs.get(
            'tipo_documento', getattr(self.instance, 'tipo_documento', None)
        )
        numero_documento = attrs.get(
            'numero_documento', getattr(self.instance, 'numero_documento', None)
        )
        duplicado = Tercero.objects.filter(
            empresa_id=empresa_id,
            tipo_documento=tipo_documento,
            numero_documento=numero_documento,
        )
        if self.instance is not None:
            duplicado = duplicado.exclude(pk=self.instance.pk)
        if duplicado.exists():
            raise serializers.ValidationError({
                'numero_documento': (
                    'Ya existe un tercero con este tipo y número de documento '
                    'en la empresa activa.'
                )
            })
        return attrs

    def validate_estado(self, value):
        if value not in ('ACTIVO', 'INACTIVO'):
            raise serializers.ValidationError('El estado debe ser ACTIVO o INACTIVO.')
        return value

    def update(self, instance, validated_data):
        validated_data['actualizado_en'] = timezone.now()
        return super().update(instance, validated_data)


class ProductoSerializer(serializers.ModelSerializer):
    tipo_existencia_codigo = serializers.PrimaryKeyRelatedField(
        queryset=TipoExistencia.objects.all(),
    )
    tipo_existencia_descripcion = serializers.CharField(
        source='tipo_existencia_codigo.descripcion', read_only=True,
    )
    unidad_base_codigo = serializers.PrimaryKeyRelatedField(
        queryset=UnidadMedida.objects.all(),
        write_only=True,
        required=False,
    )
    unidad_base = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = (
            'id', 'empresa', 'codigo_interno', 'descripcion',
            'tipo_existencia_codigo', 'tipo_existencia_descripcion', 'estado',
            'unidad_base_codigo', 'unidad_base',
        )
        read_only_fields = ('id', 'empresa', 'unidad_base')

    def get_unidad_base(self, obj):
        unidad = next((item for item in obj.unidades.all() if item.es_base), None)
        if unidad is None:
            return None
        return {
            'id': unidad.id,
            'codigo': unidad.unidad_codigo_id,
            'descripcion': unidad.unidad_codigo.descripcion,
            'factor_a_base': format(unidad.factor_a_base, '.8f'),
        }

    def validate(self, attrs):
        empresa_id = _empresa_id(self)
        if self.instance is None and 'unidad_base_codigo' not in attrs:
            raise serializers.ValidationError({
                'unidad_base_codigo': 'Debe seleccionar la unidad base del producto.'
            })
        if self.instance is not None and 'unidad_base_codigo' in attrs:
            raise serializers.ValidationError({
                'unidad_base_codigo': 'La unidad base se administra desde el panel de unidades.'
            })

        codigo = attrs.get('codigo_interno', getattr(self.instance, 'codigo_interno', None))
        duplicado = Producto.objects.filter(empresa_id=empresa_id, codigo_interno=codigo)
        if self.instance is not None:
            duplicado = duplicado.exclude(pk=self.instance.pk)
        if duplicado.exists():
            raise serializers.ValidationError({
                'codigo_interno': 'Ya existe un producto con este código en la empresa activa.'
            })
        return attrs

    def validate_estado(self, value):
        if value not in ('ACTIVO', 'INACTIVO'):
            raise serializers.ValidationError('El estado debe ser ACTIVO o INACTIVO.')
        return value

    def create(self, validated_data):
        unidad_base = validated_data.pop('unidad_base_codigo')
        producto = Producto.objects.create(
            empresa_id=_empresa_id(self),
            **validated_data,
        )
        ProductoUnidad.objects.create(
            producto=producto,
            unidad_codigo=unidad_base,
            factor_a_base=Decimal('1.00000000'),
            es_base=True,
        )
        return producto


class ProductoUnidadSerializer(serializers.ModelSerializer):
    unidad_codigo = serializers.PrimaryKeyRelatedField(
        queryset=UnidadMedida.objects.all(),
    )
    unidad_descripcion = serializers.CharField(
        source='unidad_codigo.descripcion', read_only=True,
    )
    factor_a_base = serializers.DecimalField(
        max_digits=20,
        decimal_places=8,
        coerce_to_string=True,
    )

    class Meta:
        model = ProductoUnidad
        fields = (
            'id', 'producto', 'unidad_codigo', 'unidad_descripcion',
            'factor_a_base', 'es_base',
        )
        read_only_fields = ('id', 'producto')

    def validate(self, attrs):
        producto = self.context.get('producto')
        if producto is None:
            raise serializers.ValidationError('No se pudo determinar el producto.')

        unidad = attrs.get('unidad_codigo', getattr(self.instance, 'unidad_codigo', None))
        factor = attrs.get('factor_a_base', getattr(self.instance, 'factor_a_base', None))
        es_base = attrs.get('es_base', getattr(self.instance, 'es_base', False))

        duplicado = ProductoUnidad.objects.filter(
            producto=producto,
            unidad_codigo=unidad,
        )
        if self.instance is not None:
            duplicado = duplicado.exclude(pk=self.instance.pk)
        if duplicado.exists():
            raise serializers.ValidationError({
                'unidad_codigo': 'Esta unidad ya está asociada al producto.'
            })

        if factor is not None and factor <= Decimal('0.00000000'):
            raise serializers.ValidationError({
                'factor_a_base': 'El factor debe ser mayor que cero.'
            })
        if es_base and factor != Decimal('1.00000000'):
            raise serializers.ValidationError({
                'factor_a_base': 'La unidad base debe tener factor 1.00000000.'
            })

        otra_base = ProductoUnidad.objects.filter(producto=producto, es_base=True)
        if self.instance is not None:
            otra_base = otra_base.exclude(pk=self.instance.pk)
        if es_base and otra_base.exists():
            raise serializers.ValidationError({
                'es_base': 'El producto ya tiene una unidad base.'
            })
        if self.instance is not None and self.instance.es_base and not es_base:
            raise serializers.ValidationError({
                'es_base': 'No se puede dejar el producto sin unidad base.'
            })
        if self.instance is None and not es_base and not otra_base.exists():
            raise serializers.ValidationError({
                'es_base': 'El producto debe conservar exactamente una unidad base.'
            })
        return attrs

    def create(self, validated_data):
        return ProductoUnidad.objects.create(
            producto=self.context['producto'],
            **validated_data,
        )


class TipoExistenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoExistencia
        fields = ('codigo', 'descripcion')
        read_only_fields = fields


class UnidadMedidaSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnidadMedida
        fields = ('codigo', 'descripcion')
        read_only_fields = fields
