from django.test import TestCase
from apps.catalogos.models import Moneda


class MonedaModelTest(TestCase):
    def test_crear_moneda(self):
        moneda = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.assertEqual(moneda.codigo, 'PEN')
        self.assertEqual(moneda.nombre, 'Soles')
        self.assertEqual(str(moneda), 'PEN - Soles')
