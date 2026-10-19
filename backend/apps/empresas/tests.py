from decimal import Decimal
from django.db import IntegrityError
from django.test import TestCase
from apps.catalogos.models import Moneda
from apps.empresas.models import Empresa, Establecimiento, ConfigEmpresa


class EmpresasModelTest(TestCase):
    def setUp(self):
        self.moneda = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.empresa = Empresa.objects.create(
            ruc='20100070970',
            razon_social='EMPRESA MODELO S.A.C.',
            moneda_base_codigo=self.moneda
        )

    def test_crear_empresa_y_establecimiento(self):
        est = Establecimiento.objects.create(
            empresa=self.empresa,
            codigo_sunat='0000',
            nombre='PRINCIPAL'
        )
        config = ConfigEmpresa.objects.create(
            empresa=self.empresa,
            tolerancia_residuo_pen=Decimal('0.05'),
            decimales_calculo=6,
            establecimiento_principal=est
        )
        self.assertEqual(config.tolerancia_residuo_pen, Decimal('0.05'))
        self.assertEqual(config.decimales_calculo, 6)
        self.assertEqual(config.regla_redondeo, 'ROUND_HALF_UP')
        self.assertEqual(config.metodo_valuacion, 'CPP')

    def test_empresa_estado_check_constraint(self):
        with self.assertRaises(IntegrityError):
            Empresa.objects.create(
                ruc='20100070971',
                razon_social='TEST INVALID ESTADO',
                moneda_base_codigo=self.moneda,
                estado='ESTADO_INVALIDO'
            )

    def test_config_decimales_calculo_check_constraint(self):
        with self.assertRaises(IntegrityError):
            ConfigEmpresa.objects.create(
                empresa=self.empresa,
                decimales_calculo=10  # Solo entre 2 y 8
            )
