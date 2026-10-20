from datetime import date
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.catalogos.models import (
    Moneda,
    TipoCambio,
    TipoComprobante,
    TipoOperacion,
    TipoExistencia,
    UnidadMedida,
)


class CatalogosModelTest(TestCase):
    def setUp(self):
        self.moneda_usd = Moneda.objects.create(codigo='USD', nombre='Dólares Americanos')

    def test_crear_moneda(self):
        moneda = Moneda.objects.create(codigo='EUR', nombre='Euros')
        self.assertEqual(moneda.codigo, 'EUR')
        self.assertEqual(str(moneda), 'EUR - Euros')

    def test_tipo_cambio_unique_constraint(self):
        fecha = date(2026, 10, 19)
        tc = TipoCambio.objects.create(
            moneda_codigo=self.moneda_usd,
            fecha_publicacion=fecha,
            venta=Decimal('3.75000000'),
            compra=Decimal('3.74000000'),
            fuente='SUNAT'
        )
        self.assertEqual(tc.venta, Decimal('3.75000000'))

        # Duplicado en la misma moneda, fecha y fuente debe fallar
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                TipoCambio.objects.create(
                    moneda_codigo=self.moneda_usd,
                    fecha_publicacion=fecha,
                    venta=Decimal('3.80000000'),
                    compra=Decimal('3.79000000'),
                    fuente='SUNAT'
                )

    def test_tipo_comprobante_check_constraint(self):
        tc = TipoComprobante.objects.create(
            codigo_sunat='01',
            descripcion='FACTURA',
            es_nota=False,
            efecto_nota='NINGUNO'
        )
        self.assertEqual(tc.codigo_sunat, '01')

        # Efecto de nota inválido debe fallar
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                TipoComprobante.objects.create(
                    codigo_sunat='07',
                    descripcion='NOTA DE CREDITO',
                    es_nota=True,
                    efecto_nota='INVALIDO'
                )

    def test_tipo_operacion_check_constraint(self):
        top = TipoOperacion.objects.create(
            codigo_interno='COMPRA_LOCAL',
            codigo_sunat='02',
            descripcion='COMPRA NACIONAL',
            naturaleza='ENTRADA',
            origen_requerido='DOCUMENTO'
        )
        self.assertEqual(top.naturaleza, 'ENTRADA')

        # Naturaleza inválida debe fallar
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                TipoOperacion.objects.create(
                    codigo_interno='OPERACION_INVALIDA',
                    descripcion='INVALIDA',
                    naturaleza='OTRA',
                    origen_requerido='DOCUMENTO'
                )

        # Origen requerido inválido debe fallar
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                TipoOperacion.objects.create(
                    codigo_interno='OPERACION_INVALIDA_2',
                    descripcion='INVALIDA 2',
                    naturaleza='SALIDA',
                    origen_requerido='ORIGEN_NO_EXISTENTE'
                )

    def test_tipo_existencia_y_unidad_medida(self):
        te = TipoExistencia.objects.create(codigo='01', descripcion='MERCADERIAS')
        self.assertEqual(str(te), '01 - MERCADERIAS')

        um = UnidadMedida.objects.create(codigo='NIU', descripcion='UNIDADES')
        self.assertEqual(str(um), 'NIU - UNIDADES')
