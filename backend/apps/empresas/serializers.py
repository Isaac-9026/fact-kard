from decimal import Decimal

from rest_framework import serializers

from apps.catalogos.models import Moneda
from apps.empresas.models import CierrePeriodo, CierrePeriodoDetalle, ConfigEmpresa, ConfigIgvPeriodo, Empresa, Establecimiento, Periodo


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


class ConfigIgvPeriodoSerializer(serializers.ModelSerializer):
    periodo = serializers.PrimaryKeyRelatedField(
        queryset=Periodo.objects.all(),
        required=False,
    )
    porcentaje_recuperable = serializers.DecimalField(
        max_digits=7,
        decimal_places=4,
        required=False,
        allow_null=True,
        coerce_to_string=True,
    )

    class Meta:
        model = ConfigIgvPeriodo
        fields = (
            'id', 'empresa', 'periodo', 'metodo',
            'porcentaje_recuperable', 'creado_por', 'creado_en',
        )
        read_only_fields = ('id', 'empresa', 'creado_por', 'creado_en')

    def validate_periodo(self, value):
        empresa_id = self.context.get('empresa_id')
        if empresa_id and value.empresa_id != empresa_id:
            raise serializers.ValidationError("El período no pertenece a la empresa activa.")
        if self.instance and self.instance.periodo_id != value.id:
            raise serializers.ValidationError("No se puede cambiar el período asignado a esta configuración.")
        if value.estado != 'ABIERTO':
            raise serializers.ValidationError("No se puede configurar el IGV de un período cerrado.")
        return value

    def validate(self, attrs):
        periodo = attrs.get('periodo') or (self.instance.periodo if self.instance else None)
        if periodo and periodo.estado != 'ABIERTO':
            raise serializers.ValidationError({
                'periodo': 'No se puede configurar ni modificar el IGV de un período cerrado.'
            })

        metodo = attrs.get('metodo')
        if not metodo and self.instance:
            metodo = self.instance.metodo

        if metodo == 'TOTAL':
            attrs['porcentaje_recuperable'] = Decimal('100.0000')
        elif metodo == 'NULO':
            attrs['porcentaje_recuperable'] = Decimal('0.0000')
        elif metodo == 'PRORRATA':
            porcentaje = attrs.get('porcentaje_recuperable')
            if porcentaje is None and self.instance:
                porcentaje = self.instance.porcentaje_recuperable
            if porcentaje is None:
                raise serializers.ValidationError(
                    {'porcentaje_recuperable': 'El porcentaje recuperable es obligatorio para el método PRORRATA.'}
                )
            if not isinstance(porcentaje, Decimal):
                porcentaje = Decimal(str(porcentaje))
            if not (Decimal('0.0000') <= porcentaje <= Decimal('100.0000')):
                raise serializers.ValidationError(
                    {'porcentaje_recuperable': 'El porcentaje recuperable debe estar entre 0.0000 y 100.0000.'}
                )
            attrs['porcentaje_recuperable'] = porcentaje
        elif metodo is not None:
            raise serializers.ValidationError(
                {'metodo': f"Método '{metodo}' no válido. Opciones: TOTAL, NULO, PRORRATA."}
            )

        return attrs


class PeriodoSerializer(serializers.ModelSerializer):
    config_igv = serializers.SerializerMethodField()

    class Meta:
        model = Periodo
        fields = (
            'id', 'empresa', 'anio', 'mes', 'orden',
            'fecha_inicio', 'fecha_fin', 'estado',
            'motivo_desactualizado', 'cerrado_por', 'cerrado_en',
            'reabierto_por', 'reabierto_en', 'motivo_reapertura',
            'config_igv',
        )
        read_only_fields = (
            'id', 'empresa', 'orden', 'estado',
            'motivo_desactualizado', 'cerrado_por', 'cerrado_en',
            'reabierto_por', 'reabierto_en', 'motivo_reapertura',
            'config_igv',
        )

    def get_config_igv(self, obj):
        cfg = obj.configs_igv.first()
        if cfg:
            return {
                'id': cfg.id,
                'metodo': cfg.metodo,
                'porcentaje_recuperable': str(cfg.porcentaje_recuperable),
                'creado_en': cfg.creado_en.isoformat() if cfg.creado_en else None,
            }
        return None


class PeriodoCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Periodo
        fields = ('id', 'anio', 'mes', 'fecha_inicio', 'fecha_fin')
        read_only_fields = ('id',)

    def validate_mes(self, value):
        if not 1 <= value <= 12:
            raise serializers.ValidationError('El mes debe estar comprendido entre 1 y 12.')
        return value

    def validate(self, attrs):
        fecha_inicio = attrs.get('fecha_inicio')
        fecha_fin = attrs.get('fecha_fin')
        if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
            raise serializers.ValidationError(
                {'fecha_fin': 'La fecha de fin debe ser posterior o igual a la fecha de inicio.'}
            )

        empresa_id = self.context.get('empresa_id')
        anio = attrs.get('anio')
        mes = attrs.get('mes')
        if empresa_id and anio and mes:
            if Periodo.objects.filter(empresa_id=empresa_id, anio=anio, mes=mes).exists():
                raise serializers.ValidationError(
                    {'non_field_errors': [f'Ya existe un período registrado para {anio}-{mes:02d}.']}
                )

        return attrs

    def create(self, validated_data):
        empresa_id = self.context['empresa_id']
        validated_data['empresa_id'] = empresa_id
        validated_data['orden'] = validated_data['anio'] * 100 + validated_data['mes']
        validated_data['estado'] = 'ABIERTO'
        return super().create(validated_data)


class ReabrirPeriodoSerializer(serializers.Serializer):
    motivo_reapertura = serializers.CharField(
        min_length=3,
        max_length=500,
        required=True,
        error_messages={'required': 'El motivo de reapertura es obligatorio.'}
    )


class CierrePeriodoDetalleSerializer(serializers.ModelSerializer):
    producto_codigo = serializers.CharField(source='producto.codigo_interno', read_only=True)
    producto_descripcion = serializers.CharField(source='producto.descripcion', read_only=True)
    establecimiento_nombre = serializers.CharField(source='establecimiento.nombre', read_only=True)

    class Meta:
        model = CierrePeriodoDetalle
        fields = ('id', 'producto', 'producto_codigo', 'producto_descripcion', 'establecimiento', 'establecimiento_nombre', 'saldo_cantidad', 'saldo_valor_pen', 'cpp_pen')


class CierrePeriodoSerializer(serializers.ModelSerializer):
    detalles = CierrePeriodoDetalleSerializer(many=True, read_only=True)
    periodo_info = serializers.SerializerMethodField()
    cerrado_por_username = serializers.CharField(source='cerrado_por.username', read_only=True)

    class Meta:
        model = CierrePeriodo
        fields = ('id', 'periodo', 'periodo_info', 'version_calculo', 'cerrado_por', 'cerrado_por_username', 'cerrado_en', 'archivo_excel', 'hash_resultado', 'snapshot_resumen', 'vigente', 'detalles')

    def get_periodo_info(self, obj):
        return {'anio': obj.periodo.anio, 'mes': obj.periodo.mes, 'estado': obj.periodo.estado}
