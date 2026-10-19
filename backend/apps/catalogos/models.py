from django.db import models


class Moneda(models.Model):
    codigo = models.CharField(max_length=3, primary_key=True)
    nombre = models.CharField(max_length=100)

    class Meta:
        db_table = 'moneda'
        verbose_name = 'Moneda'
        verbose_name_plural = 'Monedas'

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"
