from decimal import Decimal

from rest_framework import serializers

from apps.catalogos.models import Moneda
from apps.empresas.models import ConfigEmpresa, Empresa, Establecimiento


class EmpresaSerializer(serializers.ModelSerializer):
    moneda_base_codigo = serializers.PrimaryKeyRelatedField(
        queryset=Moneda.objects.all()
    )
    rol = serializers.SerializerMethodField()

    class Meta:
        model = Empresa
        fields = (
            'id', 'ruc', 'razon_social', 'nombre_comercial', 'direccion',
            'moneda_base_codigo', 'estado', 'creado_en', 'rol',
        )
        read_only_fields = ('id', 'estado', 'creado_en', 'rol')

    def get_rol(self, obj):
        return getattr(obj, 'rol_usuario', None)


class EstablecimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Establecimiento
        fields = ('id', 'codigo_sunat', 'nombre', 'activo')
        read_only_fields = ('id',)


class ConfigEmpresaSerializer(serializers.ModelSerializer):
    tolerancia_residuo_pen = serializers.DecimalField(
        max_digits=20,
        decimal_places=8,
        coerce_to_string=True,
    )
    establecimiento_principal = serializers.PrimaryKeyRelatedField(
        queryset=Establecimiento.objects.none(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = ConfigEmpresa
        fields = (
            'id', 'empresa', 'tolerancia_residuo_pen', 'decimales_calculo',
            'regla_redondeo', 'metodo_valuacion', 'establecimiento_principal',
        )
        read_only_fields = ('id', 'empresa', 'regla_redondeo', 'metodo_valuacion')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        empresa_id = self.context.get('empresa_id')
        if empresa_id:
            self.fields['establecimiento_principal'].queryset = (
                Establecimiento.objects.filter(empresa_id=empresa_id)
            )

    def validate_tolerancia_residuo_pen(self, value):
        if not isinstance(value, Decimal):
            value = Decimal(value)
        if value < Decimal('0.00000000'):
            raise serializers.ValidationError('La tolerancia no puede ser negativa.')
        return value

    def validate_decimales_calculo(self, value):
        if not 2 <= value <= 8:
            raise serializers.ValidationError('Debe estar entre 2 y 8.')
        return value

    def update(self, instance, validated_data):
        instance.tolerancia_residuo_pen = validated_data.get(
            'tolerancia_residuo_pen', instance.tolerancia_residuo_pen
        )
        instance.decimales_calculo = validated_data.get(
            'decimales_calculo', instance.decimales_calculo
        )
        if 'establecimiento_principal' in validated_data:
            instance.establecimiento_principal = validated_data['establecimiento_principal']
        instance.regla_redondeo = 'ROUND_HALF_UP'
        instance.metodo_valuacion = 'CPP'
        instance.save(update_fields=(
            'tolerancia_residuo_pen', 'decimales_calculo',
            'establecimiento_principal', 'regla_redondeo', 'metodo_valuacion',
        ))
        return instance
