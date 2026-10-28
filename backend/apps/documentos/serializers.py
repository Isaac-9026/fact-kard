from decimal import Decimal
from rest_framework import serializers

from apps.documentos.afectacion_igv import AFECTACIONES
from apps.documentos.models import Documento, DocumentoDetalle, DocumentoCaptura, CapturaCampo
from apps.documentos.services import crear_documento


class DocumentoDetalleSerializer(serializers.ModelSerializer):
    producto_codigo = serializers.ReadOnlyField(source='producto.codigo_interno')
    producto_descripcion = serializers.ReadOnlyField(source='producto.descripcion')
    unidad_codigo = serializers.ReadOnlyField(source='producto_unidad.unidad_codigo_id')
    almacen_codigo = serializers.ReadOnlyField(source='almacen.codigo')
    almacen_nombre = serializers.ReadOnlyField(source='almacen.nombre')
    tipo_operacion_codigo = serializers.ReadOnlyField(source='tipo_operacion.codigo_interno')
    tipo_operacion_descripcion = serializers.ReadOnlyField(source='tipo_operacion.descripcion')
    tipo_operacion_naturaleza = serializers.ReadOnlyField(source='tipo_operacion.naturaleza')
    # QA-001: para elegir la línea de origen de una NC/ND de devolución: cuánto se devolvió ya
    # (notas confirmadas con movimiento físico) y cuánto queda, en cantidad base.
    cantidad_devuelta = serializers.SerializerMethodField()
    cantidad_disponible_devolucion = serializers.SerializerMethodField()

    def _devuelta(self, obj):
        if not hasattr(obj, '_cantidad_devuelta_cache'):
            from apps.documentos.reglas import cantidad_ya_devuelta
            obj._cantidad_devuelta_cache = cantidad_ya_devuelta(obj.id)
        return obj._cantidad_devuelta_cache

    def get_cantidad_devuelta(self, obj):
        return f'{self._devuelta(obj):.8f}'

    def get_cantidad_disponible_devolucion(self, obj):
        disponible = (obj.cantidad_base or Decimal('0')) - self._devuelta(obj)
        return f'{max(disponible, Decimal("0")):.8f}'

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
            'afectacion_igv',
            'codigo_afectacion_igv',
            'porcentaje_credito_fiscal_aplicado',
            'costo_unitario_pen',
            'es_bonificacion',
            'detalle_origen',
            'tipo_operacion_naturaleza',
            'cantidad_devuelta',
            'cantidad_disponible_devolucion',
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
    # QA-004: documento del tercero (proveedor en compras, cliente en ventas). `ruc_emisor` es
    # el emisor del comprobante: en una venta es la propia empresa, no el cliente.
    tercero_tipo_documento = serializers.ReadOnlyField(source='tercero.tipo_documento')
    tercero_numero_documento = serializers.ReadOnlyField(source='tercero.numero_documento')
    periodo_orden = serializers.ReadOnlyField(source='periodo.orden')
    revisado_por_username = serializers.ReadOnlyField(source='revisado_por.username')
    detalles_count = serializers.SerializerMethodField()

    def get_detalles_count(self, obj):
        # Bloque 6: usa la anotación del listado (sin N+1); fallback para otros usos.
        anotado = getattr(obj, 'num_detalles', None)
        return anotado if anotado is not None else obj.detalles.count()

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
            'tercero_tipo_documento',
            'tercero_numero_documento',
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
    # QA-004: documento del tercero (proveedor en compras, cliente en ventas). `ruc_emisor` es
    # el emisor del comprobante: en una venta es la propia empresa, no el cliente.
    tercero_tipo_documento = serializers.ReadOnlyField(source='tercero.tipo_documento')
    tercero_numero_documento = serializers.ReadOnlyField(source='tercero.numero_documento')
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
            'tercero_tipo_documento',
            'tercero_numero_documento',
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


class DocumentoDetalleEntradaSerializer(serializers.Serializer):
    """
    CON-009: línea de detalle tipada. DecimalField de DRF rechaza texto, NaN e
    Infinity con 400. Las reglas que dependen de la naturaleza de la operación o
    de la tasa de IGV se validan en el servicio (crear_documento).
    """
    linea = serializers.IntegerField(required=False, min_value=1)
    producto = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    producto_unidad = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    almacen = serializers.IntegerField(min_value=1)
    tipo_operacion = serializers.IntegerField(min_value=1)
    equivalencia = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    detalle_origen = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    descripcion_original = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=500)
    cantidad_original = serializers.DecimalField(max_digits=20, decimal_places=8, min_value=Decimal('0'))
    factor_conversion = serializers.DecimalField(
        max_digits=20, decimal_places=8, required=False, allow_null=True, min_value=Decimal('0.00000001'),
    )
    precio_unitario = serializers.DecimalField(
        max_digits=20, decimal_places=8, required=False, default=Decimal('0'), min_value=Decimal('0'),
    )
    igv = serializers.DecimalField(
        max_digits=20, decimal_places=8, required=False, default=Decimal('0'), min_value=Decimal('0'),
    )
    es_bonificacion = serializers.BooleanField(required=False, default=False)
    # Bloque 3: afectación del IGV. Si se omite: GRATUITO para bonificaciones, GRAVADO en otro caso.
    afectacion_igv = serializers.ChoiceField(choices=AFECTACIONES, required=False, allow_null=True)
    codigo_afectacion_igv = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=2)


class DocumentoCreateSerializer(serializers.ModelSerializer):
    ruc_emisor = serializers.CharField(max_length=11, required=False, allow_blank=True, allow_null=True)
    serie = serializers.CharField(max_length=30, required=True)
    numero = serializers.CharField(max_length=50, required=True)
    detalles = DocumentoDetalleEntradaSerializer(many=True, write_only=True, allow_empty=False)

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

    def validate(self, attrs):
        periodo = attrs.get('periodo')
        fecha_emision = attrs.get('fecha_emision')
        if periodo and fecha_emision:
            if not (periodo.fecha_inicio <= fecha_emision <= periodo.fecha_fin):
                raise serializers.ValidationError({
                    'fecha_emision': (
                        f"La fecha de emisión ({fecha_emision}) no corresponde al rango del período "
                        f"contable seleccionado ({periodo.fecha_inicio} al {periodo.fecha_fin})."
                    )
                })
        return attrs

    def create(self, validated_data):
        detalles_data = [dict(linea) for linea in validated_data.pop('detalles', [])]
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
    # QA2-001: estado de homologación de cada línea con la misma regla que el borrador
    # (apps.inventario.homologacion), en cuanto el XML se sube: proveedor, equivalencia aplicada
    # y líneas pendientes.
    homologacion = serializers.SerializerMethodField()

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
            'homologacion',
        ]
        read_only_fields = fields

    def get_homologacion(self, obj):
        from apps.inventario.homologacion import homologacion_de_captura
        return homologacion_de_captura(obj)

    def get_documento_serie_numero(self, obj):
        if obj.documento:
            return f"{obj.documento.serie_normalizada}-{obj.documento.numero_normalizado}"
        return None


class DocumentoCapturaSubirSerializer(serializers.Serializer):
    archivo = serializers.FileField(required=True)
    tipo = serializers.ChoiceField(choices=['XML', 'PDF', 'IMAGEN', 'ESCANER'], required=True)
    texto_ocr = serializers.CharField(required=False, allow_blank=True, default='', max_length=200_000)

    def validate(self, attrs):
        # Bloque 6: tamaño, extensión/MIME, firma del contenido y nombre seguro.
        from apps.documentos.uploads import validar_archivo_captura
        attrs['nombre_seguro'] = validar_archivo_captura(attrs['archivo'], attrs['tipo'])
        return attrs


class CapturaCampoCorregirSerializer(serializers.Serializer):
    campo_id = serializers.IntegerField(required=True)
    valor_corregido = serializers.CharField(required=False, allow_blank=True, default='')


class GenerarBorradorSerializer(serializers.Serializer):
    almacen_id = serializers.IntegerField(required=False, allow_null=True, default=None)
