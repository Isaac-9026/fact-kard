from django.db import models
from django.db.models.functions import Now
from django.utils import timezone


class Almacen(models.Model):
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        db_column='empresa_id',
        related_name='almacenes'
    )
    establecimiento = models.ForeignKey(
        'empresas.Establecimiento',
        on_delete=models.CASCADE,
        db_column='establecimiento_id',
        related_name='almacenes'
    )
    codigo = models.CharField(max_length=50)
    nombre = models.CharField(max_length=150)
    activo = models.BooleanField(default=True, db_default=True)

    class Meta:
        db_table = 'almacen'
        verbose_name = 'Almacén'
        verbose_name_plural = 'Almacenes'
        constraints = [
            models.UniqueConstraint(
                fields=['empresa', 'codigo'],
                name='uq_almacen_empresa_codigo'
            )
        ]

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class Tercero(models.Model):
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        db_column='empresa_id',
        related_name='terceros'
    )
    tipo_documento = models.CharField(max_length=20)
    numero_documento = models.CharField(max_length=20)
    razon_social = models.CharField(max_length=200)
    nombre_comercial = models.CharField(max_length=200, null=True, blank=True)
    direccion = models.CharField(max_length=300, null=True, blank=True)
    telefono = models.CharField(max_length=50, null=True, blank=True)
    correo = models.EmailField(max_length=254, null=True, blank=True)
    es_cliente = models.BooleanField(default=False, db_default=False)
    es_proveedor = models.BooleanField(default=False, db_default=False)
    estado = models.CharField(max_length=20, default='ACTIVO', db_default='ACTIVO')
    creado_en = models.DateTimeField(default=timezone.now, db_default=Now())
    actualizado_en = models.DateTimeField(default=timezone.now, db_default=Now())

    class Meta:
        db_table = 'tercero'
        verbose_name = 'Tercero (Cliente/Proveedor)'
        verbose_name_plural = 'Terceros'
        constraints = [
            models.UniqueConstraint(
                fields=['empresa', 'tipo_documento', 'numero_documento'],
                name='uq_tercero_empresa_tipo_num'
            ),
            models.CheckConstraint(
                condition=models.Q(es_cliente=True) | models.Q(es_proveedor=True),
                name='chk_tercero_cliente_o_proveedor'
            ),
            models.CheckConstraint(
                condition=models.Q(estado__in=['ACTIVO', 'INACTIVO']),
                name='chk_tercero_estado'
            )
        ]

    def __str__(self):
        return f"{self.tipo_documento} {self.numero_documento} - {self.razon_social}"


class Producto(models.Model):
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        db_column='empresa_id',
        related_name='productos'
    )
    codigo_interno = models.CharField(max_length=50)
    descripcion = models.CharField(max_length=250)
    tipo_existencia_codigo = models.ForeignKey(
        'catalogos.TipoExistencia',
        on_delete=models.RESTRICT,
        db_column='tipo_existencia_codigo',
        related_name='productos'
    )
    estado = models.CharField(max_length=20, default='ACTIVO', db_default='ACTIVO')

    class Meta:
        db_table = 'producto'
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        constraints = [
            models.UniqueConstraint(
                fields=['empresa', 'codigo_interno'],
                name='uq_producto_empresa_codigo'
            ),
            models.CheckConstraint(
                condition=models.Q(estado__in=['ACTIVO', 'INACTIVO']),
                name='chk_producto_estado'
            )
        ]

    def __str__(self):
        return f"{self.codigo_interno} - {self.descripcion}"


class ProductoUnidad(models.Model):
    producto = models.ForeignKey(
        'inventario.Producto',
        on_delete=models.CASCADE,
        db_column='producto_id',
        related_name='unidades'
    )
    unidad_codigo = models.ForeignKey(
        'catalogos.UnidadMedida',
        on_delete=models.RESTRICT,
        db_column='unidad_codigo',
        related_name='producto_unidades'
    )
    factor_a_base = models.DecimalField(max_digits=20, decimal_places=8)
    es_base = models.BooleanField(default=False, db_default=False)

    class Meta:
        db_table = 'producto_unidad'
        verbose_name = 'Unidad de Producto'
        verbose_name_plural = 'Unidades de Producto'
        constraints = [
            models.UniqueConstraint(
                fields=['producto', 'unidad_codigo'],
                name='uq_producto_unidad'
            ),
            models.CheckConstraint(
                condition=models.Q(factor_a_base__gt=0),
                name='chk_producto_unidad_factor'
            ),
            models.UniqueConstraint(
                fields=['producto'],
                condition=models.Q(es_base=True),
                name='uq_producto_unidad_base'
            )
        ]

    def __str__(self):
        return f"{self.producto.codigo_interno} en {self.unidad_codigo_id} (Factor: {self.factor_a_base}, Base: {self.es_base})"
