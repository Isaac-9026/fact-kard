from decimal import Decimal
from rest_framework import serializers

from apps.documentos.models import Documento, DocumentoDetalle, DocumentoCaptura, CapturaCampo
from apps.documentos.services import crear_documento, revisar_documento, anular_documento


class DocumentoDetalleSerializer(serializers.ModelSerializer):
    producto_codigo = serializers.ReadOnlyField(source='producto.codigo_interno')
    producto_descripcion = serializers.ReadOnlyField(source='producto.descripcion')
    unidad_codigo = serializers.ReadOnlyField(source='producto_unidad.unidad_codigo_id')
    almacen_codigo = serializers.ReadOnlyField(source='almacen.codigo')
    almacen_nombre = serializers.ReadOnlyField(source='almacen.nombre')
    tipo_operacion_codigo = serializers.ReadOnlyField(source='tipo_operacion.codigo_interno')
    tipo_operacion_descripcion = serializers.ReadOnlyField(source='tipo_operacion.descripcion')

    class Meta:
        model = DocumentoDetalle
        fields = [
            'id',
            'linea',
            'producto',
            'producto_codigo',
            'producto_descripcion',
            'producto_unidad',
            'unidad_codigo',
            'almacen',
            'almacen_codigo',
            'almacen_nombre',
            'tipo_operacion',
            'tipo_operacion_codigo',
            'tipo_operacion_descripcion',
            'afecta_kardex_aplicado',
            'equivalencia',
            'descripcion_original',
            'cantidad_original',
            'factor_conversion',
            'cantidad_base',
            'precio_unitario',
            'igv',
            'porcentaje_credito_fiscal_aplicado',
            'costo_unitario_pen',
            'es_bonificacion',
            'detalle_origen',
        ]
        read_only_fields = [
            'id',
            'afecta_kardex_aplicado',
            'factor_conversion',
            'cantidad_base',
            'porcentaje_credito_fiscal_aplicado',
            'costo_unitario_pen',
        ]


class DocumentoListSerializer(serializers.ModelSerializer):
    tipo_comprobante_codigo = serializers.ReadOnlyField(source='tipo_comprobante.codigo_sunat')
    tipo_comprobante_descripcion = serializers.ReadOnlyField(source='tipo_comprobante.descripcion')
    es_nota = serializers.ReadOnlyField(source='tipo_comprobante.es_nota')
    tercero_razon_social = serializers.ReadOnlyField(source='tercero.razon_social')
    periodo_orden = serializers.ReadOnlyField(source='periodo.orden')
    revisado_por_username = serializers.ReadOnlyField(source='revisado_por.username')
    detalles_count = serializers.IntegerField(source='detalles.count', read_only=True)

    class Meta:
        model = Documento
        fields = [
            'id',
            'empresa_id',
            'clase',
            'periodo',
            'periodo_orden',
            'tercero',
            'tercero_razon_social',
            'ruc_emisor',
            'tipo_comprobante',
            'tipo_comprobante_codigo',
            'tipo_comprobante_descripcion',
            'es_nota',
            'serie',
            'serie_normalizada',
            'numero',
            'numero_normalizado',
            'fecha_emision',
            'moneda_codigo',
            'tipo_cambio',
            'fecha_tc',
            'monto_tc',
            'fuente_tc',
            'subtotal',
            'igv',
            'total',
            'documento_origen',
            'origen_captura',
            'estado',
            'estado_revision',
            'revisado_por_username',
            'revisado_en',
            'confirmado_en',
            'detalles_count',
        ]


class DocumentoDetailSerializer(serializers.ModelSerializer):
    detalles = DocumentoDetalleSerializer(many=True, read_only=True)
    tipo_comprobante_codigo = serializers.ReadOnlyField(source='tipo_comprobante.codigo_sunat')
    tipo_comprobante_descripcion = serializers.ReadOnlyField(source='tipo_comprobante.descripcion')
    es_nota = serializers.ReadOnlyField(source='tipo_comprobante.es_nota')
    tercero_razon_social = serializers.ReadOnlyField(source='tercero.razon_social')
    periodo_orden = serializers.ReadOnlyField(source='periodo.orden')
    revisado_por_username = serializers.ReadOnlyField(source='revisado_por.username')
    confirmado_por_username = serializers.ReadOnlyField(source='confirmado_por.username')
    creado_por_username = serializers.ReadOnlyField(source='creado_por.username')
    documento_origen_comprobante = serializers.SerializerMethodField()

    class Meta:
        model = Documento
        fields = [
            'id',
            'empresa_id',
            'clase',
            'periodo',
            'periodo_orden',
            'tercero',
            'tercero_razon_social',
            'ruc_emisor',
            'tipo_comprobante',
            'tipo_comprobante_codigo',
            'tipo_comprobante_descripcion',
            'es_nota',
            'serie',
            'serie_normalizada',
            'numero',
            'numero_normalizado',
            'fecha_emision',
            'moneda_codigo',
            'tipo_cambio',
            'fecha_tc',
            'monto_tc',
            'fuente_tc',
            'subtotal',
            'igv',
            'total',
            'documento_origen',
            'documento_origen_comprobante',
            'origen_captura',
            'estado',
            'estado_revision',
            'revisado_por',
            'revisado_por_username',
            'revisado_en',
            'creado_por',
            'creado_por_username',
            'confirmado_por',
            'confirmado_por_username',
            'confirmado_en',
            'detalles',
        ]

    def get_documento_origen_comprobante(self, obj):
        if obj.documento_origen:
            return f"{obj.documento_origen.serie_normalizada}-{obj.documento_origen.numero_normalizado}"
        return None


class DocumentoCreateSerializer(serializers.ModelSerializer):
    ruc_emisor = serializers.CharField(max_length=11, required=False, allow_blank=True, allow_null=True)
    serie = serializers.CharField(max_length=30, required=True)
    numero = serializers.CharField(max_length=50, required=True)
    detalles = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=True
    )

    class Meta:
        model = Documento
        fields = [
            'id',
            'clase',
            'periodo',
            'tercero',
            'ruc_emisor',
            'tipo_comprobante',
            'serie',
            'numero',
            'fecha_emision',
            'moneda_codigo',
            'documento_origen',
            'origen_captura',
            'detalles',
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles', [])
        empresa_id = self.context['request'].empresa_id
        usuario_id = self.context['request'].user.id

        return crear_documento(
            empresa_id=empresa_id,
            usuario_id=usuario_id,
            datos_cabecera=validated_data,
            detalles_datos=detalles_data
        )


class DocumentoRevisarSerializer(serializers.Serializer):
    estado_revision = serializers.ChoiceField(
        choices=['EN_REVISION', 'REVISADO', 'OBSERVADO'],
        required=True
    )
    motivo = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default=""
    )


class DocumentoAnularSerializer(serializers.Serializer):
    motivo = serializers.CharField(
        max_length=500,
        required=True
    )


class CapturaCampoSerializer(serializers.ModelSerializer):
    corregido_por_username = serializers.ReadOnlyField(source='corregido_por.username')

    class Meta:
        model = CapturaCampo
        fields = [
            'id',
            'seccion',
            'numero_linea',
            'nombre_campo',
            'valor_extraido',
            'confianza',
            'valor_corregido',
            'corregido_por',
            'corregido_por_username',
        ]
        read_only_fields = ['id', 'seccion', 'numero_linea', 'nombre_campo', 'valor_extraido', 'confianza', 'corregido_por']


class DocumentoCapturaListSerializer(serializers.ModelSerializer):
    subido_por_username = serializers.ReadOnlyField(source='subido_por.username')
    total_campos = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoCaptura
        fields = [
            'id',
            'tipo',
            'ruta_archivo',
            'hash_sha256',
            'estado_proceso',
            'documento_id',
            'subido_por',
            'subido_por_username',
            'creado_en',
            'total_campos',
        ]
        read_only_fields = fields

    def get_total_campos(self, obj):
        return obj.campos.count()


class DocumentoCapturaDetailSerializer(serializers.ModelSerializer):
    subido_por_username = serializers.ReadOnlyField(source='subido_por.username')
    campos = CapturaCampoSerializer(many=True, read_only=True)
    documento_serie_numero = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoCaptura
        fields = [
            'id',
            'tipo',
            'ruta_archivo',
            'hash_sha256',
            'estado_proceso',
            'documento_id',
            'documento_serie_numero',
            'subido_por',
            'subido_por_username',
            'creado_en',
            'campos',
        ]
        read_only_fields = fields

    def get_documento_serie_numero(self, obj):
        if obj.documento:
            return f"{obj.documento.serie_normalizada}-{obj.documento.numero_normalizado}"
        return None


class DocumentoCapturaSubirSerializer(serializers.Serializer):
    archivo = serializers.FileField(required=True)
    tipo = serializers.ChoiceField(choices=['XML', 'PDF', 'IMAGEN', 'ESCANER'], required=True)
    texto_ocr = serializers.CharField(required=False, allow_blank=True, default='')


class CapturaCampoCorregirSerializer(serializers.Serializer):
    campo_id = serializers.IntegerField(required=True)
    valor_corregido = serializers.CharField(required=False, allow_blank=True, default='')


class GenerarBorradorSerializer(serializers.Serializer):
    almacen_id = serializers.IntegerField(required=False, allow_null=True, default=None)
