from django.db import models


class Documento(models.Model):
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        db_column='empresa_id',
        related_name='documentos'
    )
    clase = models.CharField(max_length=20)
    periodo = models.ForeignKey(
        'empresas.Periodo',
        on_delete=models.PROTECT,
        db_column='periodo_id',
        related_name='documentos'
    )
    tercero = models.ForeignKey(
        'inventario.Tercero',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='tercero_id',
        related_name='documentos'
    )
    ruc_emisor = models.CharField(max_length=11)
    tipo_comprobante = models.ForeignKey(
        'catalogos.TipoComprobante',
        on_delete=models.PROTECT,
        db_column='tipo_comprobante_id',
        related_name='documentos'
    )

    serie = models.CharField(max_length=30, null=True, blank=True)
    serie_normalizada = models.CharField(max_length=30)
    numero = models.CharField(max_length=50, null=True, blank=True)
    numero_normalizado = models.CharField(max_length=50)

    fecha_emision = models.DateField()

    moneda_codigo = models.ForeignKey(
        'catalogos.Moneda',
        on_delete=models.PROTECT,
        db_column='moneda_codigo',
        related_name='documentos'
    )
    tipo_cambio = models.ForeignKey(
        'catalogos.TipoCambio',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='tipo_cambio_id',
        related_name='documentos'
    )
    fecha_tc = models.DateField(null=True, blank=True)
    monto_tc = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    fuente_tc = models.CharField(max_length=50, null=True, blank=True)

    subtotal = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    igv = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    total = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)

    documento_origen = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='documento_origen_id',
        related_name='documentos_derivados'
    )

    origen_captura = models.CharField(max_length=20, default='MANUAL', db_default='MANUAL')
    estado = models.CharField(max_length=20, default='BORRADOR', db_default='BORRADOR')
    estado_revision = models.CharField(max_length=20, default='PENDIENTE', db_default='PENDIENTE')

    revisado_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='revisado_por',
        related_name='+'
    )
    revisado_en = models.DateTimeField(null=True, blank=True)
    creado_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='creado_por',
        related_name='+'
    )
    confirmado_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='confirmado_por',
        related_name='+'
    )
    confirmado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'documento'
        verbose_name = 'Documento Comercial'
        verbose_name_plural = 'Documentos Comerciales'
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'empresa',
                    'ruc_emisor',
                    'tipo_comprobante',
                    'serie_normalizada',
                    'numero_normalizado',
                ],
                name='uq_documento_emisor_comprobante'
            ),
            models.CheckConstraint(
                condition=models.Q(clase__in=['COMPRA', 'VENTA']),
                name='chk_documento_clase'
            ),
            models.CheckConstraint(
                condition=models.Q(origen_captura__in=['MANUAL', 'XML', 'PDF', 'IMAGEN', 'ESCANER']),
                name='chk_documento_origen_captura'
            ),
            models.CheckConstraint(
                condition=models.Q(estado__in=['BORRADOR', 'CONFIRMADO', 'ANULADO']),
                name='chk_documento_estado'
            ),
            models.CheckConstraint(
                condition=models.Q(estado_revision__in=['PENDIENTE', 'EN_REVISION', 'REVISADO', 'OBSERVADO']),
                name='chk_documento_estado_revision'
            ),
        ]
        indexes = [
            models.Index(fields=['empresa', 'fecha_emision'], name='idx_documento_empresa_fecha'),
            models.Index(fields=['periodo'], name='idx_documento_periodo'),
            models.Index(fields=['tercero'], name='idx_documento_tercero'),
            models.Index(fields=['documento_origen'], name='idx_documento_origen'),
        ]

    def __str__(self):
        return f"{self.clase} {self.serie_normalizada}-{self.numero_normalizado} ({self.ruc_emisor})"


class DocumentoDetalle(models.Model):
    documento = models.ForeignKey(
        'documentos.Documento',
        on_delete=models.CASCADE,
        db_column='documento_id',
        related_name='detalles'
    )
    linea = models.IntegerField()

    producto = models.ForeignKey(
        'inventario.Producto',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='producto_id',
        related_name='documento_detalles'
    )
    producto_unidad = models.ForeignKey(
        'inventario.ProductoUnidad',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='producto_unidad_id',
        related_name='documento_detalles'
    )
    almacen = models.ForeignKey(
        'inventario.Almacen',
        on_delete=models.RESTRICT,
        db_column='almacen_id',
        related_name='documento_detalles'
    )

    tipo_operacion = models.ForeignKey(
        'catalogos.TipoOperacion',
        on_delete=models.RESTRICT,
        db_column='tipo_operacion_id',
        related_name='documento_detalles'
    )
    afecta_kardex_aplicado = models.BooleanField(default=True, db_default=True)
    equivalencia = models.ForeignKey(
        'inventario.ProductoEquivalencia',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='equivalencia_id',
        related_name='documento_detalles'
    )

    descripcion_original = models.CharField(max_length=500, null=True, blank=True)
    cantidad_original = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    factor_conversion = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    cantidad_base = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)

    precio_unitario = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    igv = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    porcentaje_credito_fiscal_aplicado = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    costo_unitario_pen = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)

    es_bonificacion = models.BooleanField(default=False, db_default=False)
    detalle_origen = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='detalle_origen_id',
        related_name='detalles_derivados'
    )

    class Meta:
        db_table = 'documento_detalle'
        verbose_name = 'Detalle de Documento'
        verbose_name_plural = 'Detalles de Documento'
        constraints = [
            models.UniqueConstraint(
                fields=['documento', 'linea'],
                name='uq_documento_detalle_linea'
            ),
            models.CheckConstraint(
                condition=models.Q(cantidad_original__isnull=True) | models.Q(cantidad_original__gte=0),
                name='chk_doc_det_cantidad_original'
            ),
            models.CheckConstraint(
                condition=models.Q(factor_conversion__isnull=True) | models.Q(factor_conversion__gt=0),
                name='chk_doc_det_factor_conversion'
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(porcentaje_credito_fiscal_aplicado__isnull=True) |
                    models.Q(
                        porcentaje_credito_fiscal_aplicado__gte=0,
                        porcentaje_credito_fiscal_aplicado__lte=100
                    )
                ),
                name='chk_doc_det_porcentaje_cf'
            ),
        ]
        indexes = [
            models.Index(fields=['producto'], name='idx_doc_det_producto'),
            models.Index(fields=['almacen'], name='idx_doc_det_almacen'),
            models.Index(fields=['detalle_origen'], name='idx_doc_det_origen'),
        ]

    def __str__(self):
        return f"Doc #{self.documento_id} Línea {self.linea} (Prod: {self.producto_id})"
