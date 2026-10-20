from decimal import Decimal
from django.db import models
from django.db.models.functions import Now
from django.utils import timezone


class Empresa(models.Model):
    ruc = models.CharField(max_length=11, unique=True)
    razon_social = models.CharField(max_length=200)
    nombre_comercial = models.CharField(max_length=200, null=True, blank=True)
    direccion = models.CharField(max_length=300, null=True, blank=True)
    moneda_base_codigo = models.ForeignKey(
        'catalogos.Moneda',
        on_delete=models.RESTRICT,
        db_column='moneda_base_codigo',
        related_name='empresas'
    )
    estado = models.CharField(max_length=20, default='ACTIVA', db_default='ACTIVA')
    creado_en = models.DateTimeField(default=timezone.now, db_default=Now())

    class Meta:
        db_table = 'empresa'
        verbose_name = 'Empresa'
        verbose_name_plural = 'Empresas'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(estado__in=['ACTIVA', 'INACTIVA']),
                name='chk_empresa_estado'
            )
        ]

    def __str__(self):
        return f"{self.ruc} - {self.razon_social}"


class Establecimiento(models.Model):
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        db_column='empresa_id',
        related_name='establecimientos'
    )
    codigo_sunat = models.CharField(max_length=20)
    nombre = models.CharField(max_length=150)
    activo = models.BooleanField(default=True, db_default=True)

    class Meta:
        db_table = 'establecimiento'
        verbose_name = 'Establecimiento'
        verbose_name_plural = 'Establecimientos'
        constraints = [
            models.UniqueConstraint(
                fields=['empresa', 'codigo_sunat'],
                name='uq_establecimiento_empresa_codigo'
            )
        ]

    def __str__(self):
        return f"{self.codigo_sunat} - {self.nombre}"


class ConfigEmpresa(models.Model):
    empresa = models.OneToOneField(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        db_column='empresa_id',
        related_name='configuracion'
    )
    tolerancia_residuo_pen = models.DecimalField(
        max_digits=20,
        decimal_places=8,
        default=Decimal('0.05'),
        db_default=Decimal('0.05')
    )
    decimales_calculo = models.SmallIntegerField(default=6, db_default=6)
    regla_redondeo = models.CharField(max_length=30, default='ROUND_HALF_UP', db_default='ROUND_HALF_UP')
    metodo_valuacion = models.CharField(max_length=20, default='CPP', db_default='CPP')
    establecimiento_principal = models.ForeignKey(
        'empresas.Establecimiento',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='establecimiento_principal_id',
        related_name='+'
    )

    class Meta:
        db_table = 'config_empresa'
        verbose_name = 'Configuración de Empresa'
        verbose_name_plural = 'Configuraciones de Empresa'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(decimales_calculo__range=(2, 8)),
                name='chk_config_empresa_decimales'
            )
        ]

    def __str__(self):
        return f"Configuración de {self.empresa.razon_social}"


class Periodo(models.Model):
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        db_column='empresa_id',
        related_name='periodos'
    )
    anio = models.SmallIntegerField()
    mes = models.SmallIntegerField()
    orden = models.IntegerField()
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    estado = models.CharField(max_length=20, default='ABIERTO', db_default='ABIERTO')
    motivo_desactualizado = models.CharField(max_length=500, null=True, blank=True)
    cerrado_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='cerrado_por',
        related_name='+'
    )
    cerrado_en = models.DateTimeField(null=True, blank=True)
    reabierto_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='reabierto_por',
        related_name='+'
    )
    reabierto_en = models.DateTimeField(null=True, blank=True)
    motivo_reapertura = models.CharField(max_length=500, null=True, blank=True)

    class Meta:
        db_table = 'periodo'
        verbose_name = 'Período'
        verbose_name_plural = 'Períodos'
        constraints = [
            models.UniqueConstraint(
                fields=['empresa', 'anio', 'mes'],
                name='uq_periodo_empresa_anio_mes'
            ),
            models.CheckConstraint(
                condition=models.Q(mes__range=(1, 12)),
                name='chk_periodo_mes'
            ),
            models.CheckConstraint(
                condition=models.Q(estado__in=['ABIERTO', 'CERRADO', 'DESACTUALIZADO']),
                name='chk_periodo_estado'
            ),
            models.CheckConstraint(
                condition=models.Q(fecha_fin__gte=models.F('fecha_inicio')),
                name='chk_periodo_fechas'
            )
        ]

    def __str__(self):
        return f"{self.empresa.razon_social} - {self.anio}/{self.mes:02d} ({self.estado})"


class ConfigIgvPeriodo(models.Model):
    empresa = models.ForeignKey(
        'empresas.Empresa',
        on_delete=models.CASCADE,
        db_column='empresa_id',
        related_name='configs_igv'
    )
    periodo = models.ForeignKey(
        'empresas.Periodo',
        on_delete=models.CASCADE,
        db_column='periodo_id',
        related_name='configs_igv'
    )
    metodo = models.CharField(max_length=20)
    porcentaje_recuperable = models.DecimalField(max_digits=7, decimal_places=4)
    creado_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='creado_por',
        related_name='+'
    )
    creado_en = models.DateTimeField(default=timezone.now, db_default=Now())

    class Meta:
        db_table = 'config_igv_periodo'
        verbose_name = 'Configuración IGV de Período'
        verbose_name_plural = 'Configuraciones IGV de Período'
        constraints = [
            models.UniqueConstraint(
                fields=['empresa', 'periodo'],
                name='uq_config_igv_periodo_empresa_periodo'
            ),
            models.CheckConstraint(
                condition=models.Q(metodo__in=['TOTAL', 'NULO', 'PRORRATA']),
                name='chk_config_igv_periodo_metodo'
            ),
            models.CheckConstraint(
                condition=models.Q(porcentaje_recuperable__range=(Decimal('0'), Decimal('100'))),
                name='chk_config_igv_periodo_porcentaje'
            )
        ]

    def __str__(self):
        return f"IGV {self.empresa.razon_social} - Periodo {self.periodo_id} ({self.metodo} - {self.porcentaje_recuperable}%)"
