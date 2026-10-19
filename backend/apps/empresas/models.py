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
