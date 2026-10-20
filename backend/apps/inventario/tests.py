from decimal import Decimal
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.catalogos.models import Moneda, TipoExistencia, UnidadMedida
from apps.empresas.models import Empresa, Establecimiento
from apps.inventario.models import Almacen, Tercero, Producto, ProductoUnidad


class InventarioModelTest(TestCase):
    def setUp(self):
        self.moneda = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.empresa = Empresa.objects.create(
            ruc='20100070970',
            razon_social='EMPRESA MODELO S.A.C.',
            moneda_base_codigo=self.moneda
        )
        self.establecimiento = Establecimiento.objects.create(
            empresa=self.empresa,
            codigo_sunat='0000',
            nombre='PRINCIPAL'
        )
        self.tipo_existencia = TipoExistencia.objects.create(
            codigo='01',
            descripcion='MERCADERIAS'
        )
        self.und = UnidadMedida.objects.create(codigo='NIU', descripcion='UNIDADES')
        self.caja = UnidadMedida.objects.create(codigo='BX', descripcion='CAJAS')

    def test_crear_almacen_y_unique_constraint(self):
        alm = Almacen.objects.create(
            empresa=self.empresa,
            establecimiento=self.establecimiento,
            codigo='ALM01',
            nombre='ALMACEN CENTRAL'
        )
        self.assertEqual(alm.codigo, 'ALM01')
        self.assertTrue(alm.activo)

        # Mismo código en la misma empresa debe fallar
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Almacen.objects.create(
                    empresa=self.empresa,
                    establecimiento=self.establecimiento,
                    codigo='ALM01',
                    nombre='OTRO ALMACEN'
                )

    def test_tercero_constraints(self):
        # Debe tener es_cliente o es_proveedor en True
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Tercero.objects.create(
                    empresa=self.empresa,
                    tipo_documento='6',
                    numero_documento='20601111111',
                    razon_social='CLIENTE INVALIDO',
                    es_cliente=False,
                    es_proveedor=False
                )

        # Tercero válido
        tercero = Tercero.objects.create(
            empresa=self.empresa,
            tipo_documento='6',
            numero_documento='20601111111',
            razon_social='PROVEEDOR CENTRAL S.A.C.',
            es_proveedor=True
        )
        self.assertEqual(tercero.estado, 'ACTIVO')

        # Duplicado en la misma empresa debe fallar
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Tercero.objects.create(
                    empresa=self.empresa,
                    tipo_documento='6',
                    numero_documento='20601111111',
                    razon_social='OTRO NOMBRE',
                    es_cliente=True
                )

    def test_producto_y_uq_producto_unidad_base(self):
        prod = Producto.objects.create(
            empresa=self.empresa,
            codigo_interno='PROD-001',
            descripcion='PRODUCTO DE PRUEBA',
            tipo_existencia_codigo=self.tipo_existencia
        )

        # 1. Crear unidad base (es_base=True)
        pu_base = ProductoUnidad.objects.create(
            producto=prod,
            unidad_codigo=self.und,
            factor_a_base=Decimal('1.00000000'),
            es_base=True
        )
        self.assertTrue(pu_base.es_base)

        # 2. Crear segunda unidad derivada (es_base=False, factor 12)
        pu_caja = ProductoUnidad.objects.create(
            producto=prod,
            unidad_codigo=self.caja,
            factor_a_base=Decimal('12.00000000'),
            es_base=False
        )
        self.assertFalse(pu_caja.es_base)

        # 3. Intentar agregar una SEGUNDA unidad con es_base=True al mismo producto
        # Debe fallar obligatoriamente por el índice parcial único uq_producto_unidad_base
        und_paquete = UnidadMedida.objects.create(codigo='PK', descripcion='PAQUETES')
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                ProductoUnidad.objects.create(
                    producto=prod,
                    unidad_codigo=und_paquete,
                    factor_a_base=Decimal('6.00000000'),
                    es_base=True
                )

    def test_producto_unidad_factor_check_constraint(self):
        prod = Producto.objects.create(
            empresa=self.empresa,
            codigo_interno='PROD-002',
            descripcion='PRODUCTO FACTOR CERO',
            tipo_existencia_codigo=self.tipo_existencia
        )
        # Factor a base debe ser estrictamente > 0
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                ProductoUnidad.objects.create(
                    producto=prod,
                    unidad_codigo=self.und,
                    factor_a_base=Decimal('0.00000000'),
                    es_base=True
                )
