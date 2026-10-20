import datetime
from decimal import Decimal
from unittest import skip

from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.catalogos.models import Moneda, TipoExistencia, TipoOperacion
from apps.empresas.models import Empresa, Establecimiento, Periodo
from apps.inventario.models import (
    Almacen, NotaInterna, NotaInternaDetalle, Producto, Transferencia, TransferenciaDetalle,
)
from apps.inventario.services import confirmar_nota_interna, confirmar_transferencia
from apps.kardex.models import Movimiento, SaldoCppActual, StockAlmacen
from apps.usuarios.models import Usuario


DEPENDENCIA_DEV_A = 'Depende del motor documental, recálculo, extornos o cierre asignado a Dev A.'


class MotorM1M6Test(TestCase):
    def setUp(self):
        moneda = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.empresa = Empresa.objects.create(ruc='20600000001', razon_social='MOTOR TEST', moneda_base_codigo=moneda)
        establecimiento = Establecimiento.objects.create(empresa=self.empresa, codigo_sunat='0000', nombre='Principal')
        self.origen = Almacen.objects.create(empresa=self.empresa, establecimiento=establecimiento, codigo='ORI', nombre='Origen')
        self.destino = Almacen.objects.create(empresa=self.empresa, establecimiento=establecimiento, codigo='DES', nombre='Destino')
        tipo_existencia = TipoExistencia.objects.create(codigo='01', descripcion='Mercadería')
        self.producto = Producto.objects.create(empresa=self.empresa, codigo_interno='P001', descripcion='Producto', tipo_existencia_codigo=tipo_existencia)
        self.periodo = Periodo.objects.create(
            empresa=self.empresa, anio=2026, mes=1, orden=202601,
            fecha_inicio=datetime.date(2026, 1, 1), fecha_fin=datetime.date(2026, 1, 31), estado='ABIERTO',
        )
        self.usuario = Usuario.objects.create(username='motor_test', email='motor@test.local', password_hash='test')
        for codigo, naturaleza, origen in (
            ('MERMA', 'SALIDA', 'NOTA_INTERNA'), ('DESMEDRO', 'SALIDA', 'NOTA_INTERNA'),
            ('AJUSTE_VALOR_MANUAL', 'AJUSTE_VALOR', 'NOTA_INTERNA'),
            ('TRANSFERENCIA_SALIDA', 'SALIDA', 'TRANSFERENCIA'),
            ('TRANSFERENCIA_ENTRADA', 'ENTRADA', 'TRANSFERENCIA'),
        ):
            TipoOperacion.objects.create(
                codigo_interno=codigo, descripcion=codigo, naturaleza=naturaleza,
                es_interna=True, afecta_kardex=True, origen_requerido=origen,
            )
        self.saldo = SaldoCppActual.objects.create(
            empresa=self.empresa, producto=self.producto,
            cantidad_total=Decimal('100.00000000'), valor_total_pen=Decimal('1000.00000000'),
            cpp_pen=Decimal('10.00000000'),
        )
        self.stock_origen = StockAlmacen.objects.create(
            empresa=self.empresa, almacen=self.origen, producto=self.producto,
            cantidad_actual=Decimal('100.00000000'),
        )

    def _nota(self, codigo, cantidad='10.00000000', valor_ajuste=None):
        nota = NotaInterna.objects.create(
            empresa=self.empresa, almacen=self.origen, periodo=self.periodo,
            tipo_operacion=TipoOperacion.objects.get(codigo_interno=codigo),
            fecha=datetime.date(2026, 1, 10), motivo='Prueba', creado_por=self.usuario,
        )
        NotaInternaDetalle.objects.create(
            nota_interna=nota, producto=self.producto, cantidad_base=Decimal(cantidad),
            valor_ajuste_pen=Decimal(valor_ajuste) if valor_ajuste else None,
        )
        return nota

    @skip(DEPENDENCIA_DEV_A)
    def test_compra_basica(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_venta_cpp(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_documento_atrasado(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_recalculo(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_stock_negativo_posterior(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_devolucion_venta(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_devolucion_compra(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_nc_compra(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_nd_compra(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_nc_venta_sin_devolucion(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_anulacion(self):
        pass

    def test_merma(self):
        nota = confirmar_nota_interna(
            nota_id=self._nota('MERMA').id, empresa_id=self.empresa.id, usuario=self.usuario,
        )
        self.saldo.refresh_from_db(); self.stock_origen.refresh_from_db()
        self.assertEqual(nota.estado, 'CONFIRMADO')
        self.assertEqual(self.stock_origen.cantidad_actual, Decimal('90.00000000'))
        self.assertEqual(self.saldo.valor_total_pen, Decimal('900.00000000'))

    def test_desmedro(self):
        confirmar_nota_interna(
            nota_id=self._nota('DESMEDRO', '5.00000000').id,
            empresa_id=self.empresa.id, usuario=self.usuario,
        )
        movimiento = Movimiento.objects.get(nota_interna_detalle__isnull=False)
        self.assertEqual(movimiento.naturaleza, 'SALIDA')
        self.assertEqual(movimiento.valorizacion.costo_unitario_pen, Decimal('10.00000000'))

    def test_ajuste(self):
        confirmar_nota_interna(
            nota_id=self._nota('AJUSTE_VALOR_MANUAL', '0.00000000', '50.00000000').id,
            empresa_id=self.empresa.id, usuario=self.usuario,
        )
        self.saldo.refresh_from_db()
        self.assertEqual(self.saldo.cantidad_total, Decimal('100.00000000'))
        self.assertEqual(self.saldo.valor_total_pen, Decimal('1050.00000000'))
        self.assertEqual(self.saldo.cpp_pen, Decimal('10.50000000'))

    def test_transferencia(self):
        transferencia = Transferencia.objects.create(
            empresa=self.empresa, almacen_origen=self.origen, almacen_destino=self.destino,
            fecha=datetime.date(2026, 1, 15), creado_por=self.usuario,
        )
        detalle = TransferenciaDetalle.objects.create(
            transferencia=transferencia, producto=self.producto, cantidad_base=Decimal('25.00000000'),
        )
        confirmar_transferencia(
            transferencia_id=transferencia.id, empresa_id=self.empresa.id, usuario=self.usuario,
        )
        self.saldo.refresh_from_db(); self.stock_origen.refresh_from_db()
        destino = StockAlmacen.objects.get(empresa=self.empresa, almacen=self.destino, producto=self.producto)
        movimientos = Movimiento.objects.filter(transferencia=transferencia, transferencia_detalle=detalle)
        self.assertEqual(self.stock_origen.cantidad_actual, Decimal('75.00000000'))
        self.assertEqual(destino.cantidad_actual, Decimal('25.00000000'))
        self.assertEqual(movimientos.count(), 2)
        self.assertEqual(self.saldo.cantidad_total, Decimal('100.00000000'))
        self.assertEqual(self.saldo.cpp_pen, Decimal('10.00000000'))

        segunda = Transferencia.objects.create(
            empresa=self.empresa, almacen_origen=self.origen, almacen_destino=self.destino,
            fecha=datetime.date(2026, 1, 16), creado_por=self.usuario,
        )
        TransferenciaDetalle.objects.create(
            transferencia=segunda, producto=self.producto, cantidad_base=Decimal('1000.00000000'),
        )
        with self.assertRaises(ValidationError):
            confirmar_transferencia(
                transferencia_id=segunda.id, empresa_id=self.empresa.id, usuario=self.usuario,
            )
        segunda.refresh_from_db(); self.stock_origen.refresh_from_db()
        self.assertEqual(segunda.estado, 'BORRADOR')
        self.assertEqual(self.stock_origen.cantidad_actual, Decimal('75.00000000'))
        self.assertFalse(Movimiento.objects.filter(transferencia=segunda).exists())

    @skip(DEPENDENCIA_DEV_A)
    def test_residuo(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_valor_negativo(self):
        pass

    @skip(DEPENDENCIA_DEV_A)
    def test_bloqueo_cierre(self):
        pass
