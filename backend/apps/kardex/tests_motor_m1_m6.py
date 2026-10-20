import datetime
from decimal import Decimal

from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.catalogos.models import Moneda, TipoExistencia, TipoOperacion
from apps.empresas.models import Empresa, Establecimiento, Periodo
from apps.inventario.models import (
    Almacen, NotaInterna, NotaInternaDetalle, Producto, Transferencia, TransferenciaDetalle,
)
from apps.inventario.services import confirmar_nota_interna, confirmar_transferencia
from apps.kardex.models import Incidencia, Movimiento, Recalculo, SaldoCppActual, StockAlmacen
from apps.kardex.services import aplicar_movimiento, ejecutar_recalculo_producto, validar_cierre_periodo
from apps.usuarios.models import Usuario


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
            ('COMPRA', 'ENTRADA', 'DOCUMENTO'), ('VENTA', 'SALIDA', 'DOCUMENTO'),
            ('DEVOLUCION_VENTA', 'ENTRADA', 'MOV_ORIGEN'),
            ('DEVOLUCION_COMPRA', 'SALIDA', 'MOV_ORIGEN'),
            ('NC_COMPRA', 'AJUSTE_VALOR', 'DOCUMENTO'), ('ND_COMPRA', 'AJUSTE_VALOR', 'DOCUMENTO'),
            ('EXTORNO_ENTRADA', 'ENTRADA', 'MOV_EXTORNADO'),
            ('RESIDUO_AUTOMATICO', 'AJUSTE_VALOR', 'MOTOR'),
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

    def _movimiento(self, codigo, cantidad, costo=None, valor_ajuste=None, fecha=None, **kwargs):
        return aplicar_movimiento(
            empresa_id=self.empresa.id, producto_id=self.producto.id,
            almacen_id=self.origen.id, periodo=self.periodo,
            tipo_operacion=TipoOperacion.objects.get(codigo_interno=codigo),
            fecha=fecha or datetime.date(2026, 1, 10), cantidad=Decimal(cantidad),
            costo_unitario=Decimal(costo) if costo is not None else None,
            valor_ajuste=Decimal(valor_ajuste) if valor_ajuste is not None else None,
            usuario_id=self.usuario.id, **kwargs,
        )

    def test_compra_basica(self):
        self._movimiento('COMPRA', '50', '14')
        self.saldo.refresh_from_db()
        self.assertEqual(self.saldo.cantidad_total, Decimal('150.00000000'))
        self.assertEqual(self.saldo.valor_total_pen, Decimal('1700.00000000'))
        self.assertEqual(self.saldo.cpp_pen, Decimal('11.33333300'))

    def test_venta_cpp(self):
        mov = self._movimiento('VENTA', '30')
        self.saldo.refresh_from_db()
        self.assertEqual(mov.valorizacion.valor_movimiento_pen, Decimal('300.00000000'))
        self.assertEqual(self.saldo.valor_total_pen, Decimal('700.00000000'))

    def test_documento_atrasado(self):
        self._movimiento('COMPRA', '10', '20', fecha=datetime.date(2026, 1, 20))
        self._movimiento('COMPRA', '10', '5', fecha=datetime.date(2026, 1, 5))
        rec = ejecutar_recalculo_producto(empresa_id=self.empresa.id, producto_id=self.producto.id, fecha_desde=datetime.date(2026, 1, 5), usuario_id=self.usuario.id)
        self.assertEqual(rec.estado, 'OK')

    def test_recalculo(self):
        self._movimiento('VENTA', '10')
        rec = ejecutar_recalculo_producto(empresa_id=self.empresa.id, producto_id=self.producto.id, fecha_desde=datetime.date(2026, 1, 1), usuario_id=self.usuario.id)
        self.assertTrue(rec.detalles.exists())
        self.assertTrue(Recalculo.objects.filter(pk=rec.pk, estado='OK').exists())

    def test_stock_negativo_posterior(self):
        self._movimiento('VENTA', '90', fecha=datetime.date(2026, 1, 20))
        self.stock_origen.cantidad_actual = Decimal('5'); self.stock_origen.save()
        ejecutar_recalculo_producto(empresa_id=self.empresa.id, producto_id=self.producto.id, fecha_desde=datetime.date(2026, 1, 1), usuario_id=self.usuario.id)
        self.assertTrue(Incidencia.objects.filter(tipo='STOCK_INSUFICIENTE', bloquea_cierre=True).exists())

    def test_devolucion_venta(self):
        salida = self._movimiento('VENTA', '10')
        entrada = self._movimiento('DEVOLUCION_VENTA', '5', str(salida.valorizacion.costo_unitario_pen), movimiento_origen=salida)
        self.assertEqual(entrada.movimiento_origen, salida)

    def test_devolucion_compra(self):
        compra = self._movimiento('COMPRA', '10', '12')
        devolucion = self._movimiento('DEVOLUCION_COMPRA', '5', str(compra.valorizacion.costo_unitario_pen), movimiento_origen=compra)
        self.assertEqual(devolucion.valorizacion.costo_unitario_pen, Decimal('12.00000000'))

    def test_nc_compra(self):
        self._movimiento('NC_COMPRA', '0', valor_ajuste='-100')
        self.saldo.refresh_from_db(); self.assertEqual(self.saldo.valor_total_pen, Decimal('900.00000000'))

    def test_nd_compra(self):
        self._movimiento('ND_COMPRA', '0', valor_ajuste='100')
        self.saldo.refresh_from_db(); self.assertEqual(self.saldo.valor_total_pen, Decimal('1100.00000000'))

    def test_nc_venta_sin_devolucion(self):
        antes = Movimiento.objects.count()
        self.assertEqual(Movimiento.objects.count(), antes)
        self.assertEqual(self.saldo.valor_total_pen, Decimal('1000.00000000'))

    def test_anulacion(self):
        original = self._movimiento('VENTA', '10')
        extorno = self._movimiento('EXTORNO_ENTRADA', '10', '10', es_extorno=True, movimiento_extornado=original)
        self.assertTrue(extorno.es_extorno); self.assertEqual(extorno.movimiento_extornado, original)

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

    def test_residuo(self):
        self.saldo.valor_total_pen = Decimal('1000.04000000'); self.saldo.save()
        self._movimiento('VENTA', '100')
        self.saldo.refresh_from_db()
        self.assertEqual(self.saldo.valor_total_pen, Decimal('0E-8'))
        self.assertTrue(Movimiento.objects.filter(generado_por_motor=True).exists())

    def test_valor_negativo(self):
        self._movimiento('NC_COMPRA', '0', valor_ajuste='-1100')
        self.assertTrue(Incidencia.objects.filter(tipo='VALOR_INVENTARIO_NEGATIVO').exists())

    def test_bloqueo_cierre(self):
        Incidencia.objects.create(empresa=self.empresa, periodo=self.periodo, tipo='PRUEBA', descripcion='Bloqueo')
        with self.assertRaises(ValidationError):
            validar_cierre_periodo(empresa_id=self.empresa.id, periodo_id=self.periodo.id)
