from datetime import date
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.auditoria.models import Auditoria
from apps.catalogos.models import Moneda, TipoCambio, TipoComprobante, TipoOperacion, UnidadMedida, TipoExistencia
from apps.documentos.models import Documento, DocumentoDetalle
from apps.empresas.models import Empresa, Establecimiento, Periodo, ConfigIgvPeriodo
from apps.inventario.models import Almacen, Producto, ProductoUnidad, ProductoEquivalencia, Tercero
from apps.usuarios.models import Usuario, UsuarioEmpresa


class DocumentosIntegridadTest(TestCase):
    def setUp(self):
        self.moneda = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.empresa = Empresa.objects.create(
            ruc='20600000001',
            razon_social='DOCS TEST S.A.C.',
            moneda_base_codigo=self.moneda
        )
        self.establecimiento = Establecimiento.objects.create(
            empresa=self.empresa,
            codigo_sunat='0000',
            nombre='SEDE CENTRAL'
        )
        self.almacen = Almacen.objects.create(
            empresa=self.empresa,
            establecimiento=self.establecimiento,
            codigo='ALM-01',
            nombre='ALMACEN CENTRAL'
        )
        self.periodo = Periodo.objects.create(
            empresa=self.empresa,
            anio=2026,
            mes=2,
            orden=202602,
            fecha_inicio='2026-02-01',
            fecha_fin='2026-02-28'
        )
        self.tipo_factura = TipoComprobante.objects.create(
            codigo_sunat='01',
            descripcion='FACTURA',
            es_nota=False,
            efecto_nota='NINGUNO'
        )
        self.tipo_nc = TipoComprobante.objects.create(
            codigo_sunat='07',
            descripcion='NOTA DE CREDITO',
            es_nota=True,
            efecto_nota='CREDITO'
        )
        self.tipo_op_compra = TipoOperacion.objects.create(
            codigo_interno='COMPRA_NACIONAL',
            codigo_sunat='02',
            descripcion='COMPRA NACIONAL',
            naturaleza='ENTRADA',
            es_interna=False,
            afecta_kardex=True,
            origen_requerido='DOCUMENTO'
        )
        self.tercero = Tercero.objects.create(
            empresa=self.empresa,
            tipo_documento='6',
            numero_documento='20500000002',
            razon_social='PROVEEDOR CENTRAL S.A.C.',
            es_proveedor=True
        )
        self.tipo_existencia = TipoExistencia.objects.create(
            codigo='01',
            descripcion='MERCADERIA'
        )
        self.und = UnidadMedida.objects.create(codigo='NIU', descripcion='UNIDAD')
        self.producto = Producto.objects.create(
            empresa=self.empresa,
            codigo_interno='P-TEST',
            descripcion='PRODUCTO DOC TEST',
            tipo_existencia_codigo=self.tipo_existencia
        )
        self.prod_unidad = ProductoUnidad.objects.create(
            producto=self.producto,
            unidad_codigo=self.und,
            factor_a_base=Decimal('1.00000000'),
            es_base=True
        )

    def test_creacion_documento_y_unicidad_normalizada(self):
        doc = Documento.objects.create(
            empresa=self.empresa,
            clase='COMPRA',
            periodo=self.periodo,
            tercero=self.tercero,
            ruc_emisor='20500000002',
            tipo_comprobante=self.tipo_factura,
            serie=' F001 ',
            serie_normalizada='F001',
            numero=' 000123 ',
            numero_normalizado='00000123',
            fecha_emision='2026-02-10',
            moneda_codigo=self.moneda,
            subtotal=Decimal('100.00000000'),
            igv=Decimal('18.00000000'),
            total=Decimal('118.00000000'),
            origen_captura='MANUAL',
            estado='BORRADOR',
            estado_revision='PENDIENTE'
        )
        self.assertIsNotNone(doc.id)
        self.assertEqual(doc.serie_normalizada, 'F001')
        self.assertEqual(doc.numero_normalizado, '00000123')

        # Duplicado con misma serie y numero normalizado debe violar uq_documento_emisor_comprobante
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Documento.objects.create(
                    empresa=self.empresa,
                    clase='COMPRA',
                    periodo=self.periodo,
                    tercero=self.tercero,
                    ruc_emisor='20500000002',
                    tipo_comprobante=self.tipo_factura,
                    serie='F-001',
                    serie_normalizada='F001',
                    numero='123',
                    numero_normalizado='00000123',
                    fecha_emision='2026-02-11',
                    moneda_codigo=self.moneda
                )

    def test_documento_check_constraints(self):
        # Clase inválida
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Documento.objects.create(
                    empresa=self.empresa,
                    clase='OTRA_CLASE',
                    periodo=self.periodo,
                    ruc_emisor='20500000002',
                    tipo_comprobante=self.tipo_factura,
                    serie_normalizada='F001',
                    numero_normalizado='00000001',
                    fecha_emision='2026-02-10',
                    moneda_codigo=self.moneda
                )

        # Origen captura inválido
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Documento.objects.create(
                    empresa=self.empresa,
                    clase='COMPRA',
                    periodo=self.periodo,
                    ruc_emisor='20500000002',
                    tipo_comprobante=self.tipo_factura,
                    serie_normalizada='F001',
                    numero_normalizado='00000002',
                    fecha_emision='2026-02-10',
                    moneda_codigo=self.moneda,
                    origen_captura='WHATSAPP'
                )

        # Estado inválido
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Documento.objects.create(
                    empresa=self.empresa,
                    clase='COMPRA',
                    periodo=self.periodo,
                    ruc_emisor='20500000002',
                    tipo_comprobante=self.tipo_factura,
                    serie_normalizada='F001',
                    numero_normalizado='00000003',
                    fecha_emision='2026-02-10',
                    moneda_codigo=self.moneda,
                    estado='PROCESADO'
                )

        # Estado revision inválido
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Documento.objects.create(
                    empresa=self.empresa,
                    clase='COMPRA',
                    periodo=self.periodo,
                    ruc_emisor='20500000002',
                    tipo_comprobante=self.tipo_factura,
                    serie_normalizada='F001',
                    numero_normalizado='00000004',
                    fecha_emision='2026-02-10',
                    moneda_codigo=self.moneda,
                    estado_revision='APROBADO'
                )

    def test_documento_origen_relacion_autoreferencial(self):
        doc_factura = Documento.objects.create(
            empresa=self.empresa,
            clase='COMPRA',
            periodo=self.periodo,
            tercero=self.tercero,
            ruc_emisor='20500000002',
            tipo_comprobante=self.tipo_factura,
            serie_normalizada='F001',
            numero_normalizado='00000100',
            fecha_emision='2026-02-10',
            moneda_codigo=self.moneda
        )
        doc_nc = Documento.objects.create(
            empresa=self.empresa,
            clase='COMPRA',
            periodo=self.periodo,
            tercero=self.tercero,
            ruc_emisor='20500000002',
            tipo_comprobante=self.tipo_nc,
            serie_normalizada='FC01',
            numero_normalizado='00000005',
            fecha_emision='2026-02-12',
            moneda_codigo=self.moneda,
            documento_origen=doc_factura
        )
        self.assertEqual(doc_nc.documento_origen, doc_factura)
        self.assertIn(doc_nc, doc_factura.documentos_derivados.all())

    def test_documento_detalle_y_constraints(self):
        doc = Documento.objects.create(
            empresa=self.empresa,
            clase='COMPRA',
            periodo=self.periodo,
            tercero=self.tercero,
            ruc_emisor='20500000002',
            tipo_comprobante=self.tipo_factura,
            serie_normalizada='F001',
            numero_normalizado='00000200',
            fecha_emision='2026-02-15',
            moneda_codigo=self.moneda
        )
        det1 = DocumentoDetalle.objects.create(
            documento=doc,
            linea=1,
            producto=self.producto,
            producto_unidad=self.prod_unidad,
            almacen=self.almacen,
            tipo_operacion=self.tipo_op_compra,
            cantidad_original=Decimal('10.00000000'),
            factor_conversion=Decimal('1.00000000'),
            cantidad_base=Decimal('10.00000000'),
            precio_unitario=Decimal('25.00000000'),
            igv=Decimal('4.50000000'),
            porcentaje_credito_fiscal_aplicado=Decimal('100.0000'),
            costo_unitario_pen=Decimal('25.00000000'),
            es_bonificacion=False
        )
        self.assertEqual(det1.linea, 1)
        self.assertEqual(doc.detalles.count(), 1)

        # UniqueConstraint: documento + linea
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                DocumentoDetalle.objects.create(
                    documento=doc,
                    linea=1,
                    producto=self.producto,
                    almacen=self.almacen,
                    tipo_operacion=self.tipo_op_compra
                )

        # CheckConstraint: cantidad_original >= 0
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                DocumentoDetalle.objects.create(
                    documento=doc,
                    linea=2,
                    producto=self.producto,
                    almacen=self.almacen,
                    tipo_operacion=self.tipo_op_compra,
                    cantidad_original=Decimal('-5.00000000')
                )

        # CheckConstraint: factor_conversion > 0
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                DocumentoDetalle.objects.create(
                    documento=doc,
                    linea=3,
                    producto=self.producto,
                    almacen=self.almacen,
                    tipo_operacion=self.tipo_op_compra,
                    factor_conversion=Decimal('0.00000000')
                )

        # CheckConstraint: porcentaje_credito_fiscal_aplicado BETWEEN 0 AND 100
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                DocumentoDetalle.objects.create(
                    documento=doc,
                    linea=4,
                    producto=self.producto,
                    almacen=self.almacen,
                    tipo_operacion=self.tipo_op_compra,
                    porcentaje_credito_fiscal_aplicado=Decimal('105.0000')
                )

    def test_documento_detalle_con_equivalencia_y_detalle_origen(self):
        equiv = ProductoEquivalencia.objects.create(
            empresa=self.empresa,
            tercero=self.tercero,
            codigo_externo='EQ-PROV-1',
            producto_unidad=self.prod_unidad,
            factor_conversion=Decimal('1.00000000')
        )
        doc = Documento.objects.create(
            empresa=self.empresa,
            clase='COMPRA',
            periodo=self.periodo,
            tercero=self.tercero,
            ruc_emisor='20500000002',
            tipo_comprobante=self.tipo_factura,
            serie_normalizada='F001',
            numero_normalizado='00000300',
            fecha_emision='2026-02-18',
            moneda_codigo=self.moneda
        )
        det_padre = DocumentoDetalle.objects.create(
            documento=doc,
            linea=1,
            producto=self.producto,
            almacen=self.almacen,
            tipo_operacion=self.tipo_op_compra,
            equivalencia=equiv,
            cantidad_original=Decimal('50.00000000')
        )
        det_hijo = DocumentoDetalle.objects.create(
            documento=doc,
            linea=2,
            producto=self.producto,
            almacen=self.almacen,
            tipo_operacion=self.tipo_op_compra,
            detalle_origen=det_padre,
            cantidad_original=Decimal('10.00000000')
        )
        self.assertEqual(det_padre.equivalencia, equiv)
        self.assertEqual(det_hijo.detalle_origen, det_padre)
        self.assertIn(det_hijo, det_padre.detalles_derivados.all())


class DocumentosApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.moneda_pen = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.moneda_usd = Moneda.objects.create(codigo='USD', nombre='Dólares Americanos')

        self.empresa = Empresa.objects.create(
            ruc='20100070970',
            razon_social='EMPRESA FISCAL S.A.C.',
            moneda_base_codigo=self.moneda_pen
        )
        self.empresa_otra = Empresa.objects.create(
            ruc='20999999999',
            razon_social='OTRA EMPRESA S.A.C.',
            moneda_base_codigo=self.moneda_pen
        )

        self.usuario = Usuario.objects.create(
            username='contadora_demo',
            email='contadora@test.com',
            es_admin_global=False,
            activo=True
        )
        UsuarioEmpresa.objects.create(
            usuario=self.usuario,
            empresa=self.empresa,
            rol='ADMIN',
            activo=True
        )
        self.client.force_authenticate(user=self.usuario)

        self.establecimiento = Establecimiento.objects.create(
            empresa=self.empresa,
            codigo_sunat='0000',
            nombre='CENTRAL'
        )
        self.almacen = Almacen.objects.create(
            empresa=self.empresa,
            establecimiento=self.establecimiento,
            codigo='ALM-01',
            nombre='ALMACEN GENERAL'
        )
        self.almacen_otra = Almacen.objects.create(
            empresa=self.empresa_otra,
            establecimiento=Establecimiento.objects.create(
                empresa=self.empresa_otra,
                codigo_sunat='0000',
                nombre='SEDE OTRA'
            ),
            codigo='ALM-OTRA',
            nombre='ALMACEN AJENO'
        )

        self.periodo_abierto = Periodo.objects.create(
            empresa=self.empresa,
            anio=2026,
            mes=1,
            orden=202601,
            fecha_inicio='2026-01-01',
            fecha_fin='2026-01-31',
            estado='ABIERTO'
        )
        self.periodo_cerrado = Periodo.objects.create(
            empresa=self.empresa,
            anio=2025,
            mes=12,
            orden=202512,
            fecha_inicio='2025-12-01',
            fecha_fin='2025-12-31',
            estado='CERRADO'
        )

        self.tipo_existencia = TipoExistencia.objects.create(codigo='01', descripcion='MERCADERIA')
        self.und = UnidadMedida.objects.create(codigo='NIU', descripcion='UNIDAD')
        self.caja = UnidadMedida.objects.create(codigo='BX', descripcion='CAJA')

        self.producto = Producto.objects.create(
            empresa=self.empresa,
            codigo_interno='PROD-A',
            descripcion='PRODUCTO A',
            tipo_existencia_codigo=self.tipo_existencia
        )
        self.pu_und = ProductoUnidad.objects.create(
            producto=self.producto,
            unidad_codigo=self.und,
            factor_a_base=Decimal('1.00000000'),
            es_base=True
        )
        self.pu_caja = ProductoUnidad.objects.create(
            producto=self.producto,
            unidad_codigo=self.caja,
            factor_a_base=Decimal('12.00000000'),
            es_base=False
        )

        self.tercero_prov = Tercero.objects.create(
            empresa=self.empresa,
            tipo_documento='6',
            numero_documento='20601234567',
            razon_social='PROVEEDOR LOGISTICO S.A.C.',
            es_proveedor=True
        )

        self.tipo_factura = TipoComprobante.objects.create(
            codigo_sunat='01',
            descripcion='FACTURA',
            es_nota=False,
            efecto_nota='NINGUNO'
        )
        self.tipo_nc = TipoComprobante.objects.create(
            codigo_sunat='07',
            descripcion='NOTA DE CREDITO',
            es_nota=True,
            efecto_nota='CREDITO'
        )

        self.tipo_op_compra = TipoOperacion.objects.create(
            codigo_interno='COMPRA_LOCAL',
            codigo_sunat='02',
            descripcion='COMPRA NACIONAL',
            naturaleza='ENTRADA',
            es_interna=False,
            afecta_kardex=True,
            origen_requerido='DOCUMENTO'
        )

        # Tipo de cambio para 2026-01-10 (viernes)
        self.tc_enero_10 = TipoCambio.objects.create(
            moneda_codigo=self.moneda_usd,
            fecha_publicacion=date(2026, 1, 10),
            venta=Decimal('3.75000000'),
            compra=Decimal('3.74000000'),
            fuente='SBS'
        )
        # Tipo de cambio posterior para 2026-01-20
        self.tc_enero_20 = TipoCambio.objects.create(
            moneda_codigo=self.moneda_usd,
            fecha_publicacion=date(2026, 1, 20),
            venta=Decimal('3.82000000'),
            compra=Decimal('3.81000000'),
            fuente='SBS'
        )

    def headers(self, empresa_id=None):
        return {'HTTP_X_EMPRESA_ID': str(empresa_id or self.empresa.id)}

    def test_creacion_factura_compra_pen_totales_y_costo(self):
        url = reverse('documento-list-create')
        data = {
            'clase': 'COMPRA',
            'periodo': self.periodo_abierto.id,
            'tercero': self.tercero_prov.id,
            'tipo_comprobante': self.tipo_factura.id,
            'serie': ' f001 ',
            'numero': ' 000456 ',
            'fecha_emision': '2026-01-10',
            'moneda_codigo': 'PEN',
            'detalles': [
                {
                    'producto': self.producto.id,
                    'producto_unidad': self.pu_caja.id,
                    'almacen': self.almacen.id,
                    'tipo_operacion': self.tipo_op_compra.id,
                    'cantidad_original': '10.00000000',
                    'precio_unitario': '120.00000000',
                    'igv': '216.00000000',
                    'es_bonificacion': False
                }
            ]
        }

        response = self.client.post(url, data, format='json', **self.headers())
        self.assertEqual(response.status_code, 201)

        doc = Documento.objects.get(id=response.data['id'])
        self.assertEqual(doc.serie_normalizada, 'F001')
        self.assertEqual(doc.numero_normalizado, '456')
        self.assertEqual(doc.moneda_codigo_id, 'PEN')
        self.assertIsNone(doc.tipo_cambio)
        self.assertIsNone(doc.monto_tc)
        self.assertEqual(doc.estado, 'BORRADOR')
        self.assertEqual(doc.estado_revision, 'PENDIENTE')
        self.assertEqual(doc.subtotal, Decimal('1200.00000000'))
        self.assertEqual(doc.igv, Decimal('216.00000000'))
        self.assertEqual(doc.total, Decimal('1416.00000000'))

        det = doc.detalles.first()
        self.assertEqual(det.factor_conversion, Decimal('12.00000000'))
        self.assertEqual(det.cantidad_base, Decimal('120.00000000'))
        self.assertEqual(det.porcentaje_credito_fiscal_aplicado, Decimal('100.0000'))
        # Con 100% crédito fiscal, el IGV es recuperable, no forma parte del costo:
        # Costo total = 1200 / 120 = 10 PEN/unidad base
        self.assertEqual(det.costo_unitario_pen, Decimal('10.00000000'))

    def test_creacion_factura_compra_usd_con_igv_prorrata_y_nulo(self):
        url = reverse('documento-list-create')

        # 1. Caso IGV PRORRATA (80% recuperable, 20% al costo)
        ConfigIgvPeriodo.objects.create(
            empresa=self.empresa,
            periodo=self.periodo_abierto,
            metodo='PRORRATA',
            porcentaje_recuperable=Decimal('80.0000')
        )

        data = {
            'clase': 'COMPRA',
            'periodo': self.periodo_abierto.id,
            'tercero': self.tercero_prov.id,
            'tipo_comprobante': self.tipo_factura.id,
            'serie': 'F002',
            'numero': '10',
            'fecha_emision': '2026-01-10',
            'moneda_codigo': 'USD',
            'detalles': [
                {
                    'producto': self.producto.id,
                    'producto_unidad': self.pu_und.id,
                    'almacen': self.almacen.id,
                    'tipo_operacion': self.tipo_op_compra.id,
                    'cantidad_original': '100.00000000',
                    'precio_unitario': '10.00000000',
                    'igv': '180.00000000',
                    'es_bonificacion': False
                }
            ]
        }

        response = self.client.post(url, data, format='json', **self.headers())
        self.assertEqual(response.status_code, 201)

        doc = Documento.objects.get(id=response.data['id'])
        self.assertEqual(doc.monto_tc, Decimal('3.75000000'))

        det = doc.detalles.first()
        self.assertEqual(det.porcentaje_credito_fiscal_aplicado, Decimal('80.0000'))
        # Costo USD:
        # valor = 100 * 10 = 1000 USD
        # igv no recuperable = 180 * (20%) = 36 USD
        # total USD = 1036 USD
        # total PEN = 1036 * 3.75 = 3885.00000000
        # costo unitario PEN = 3885 / 100 = 38.85000000
        self.assertEqual(det.costo_unitario_pen, Decimal('38.85000000'))

    def test_linea_con_bonificacion_costo_cero(self):
        url = reverse('documento-list-create')
        data = {
            'clase': 'COMPRA',
            'periodo': self.periodo_abierto.id,
            'tercero': self.tercero_prov.id,
            'tipo_comprobante': self.tipo_factura.id,
            'serie': 'F003',
            'numero': '20',
            'fecha_emision': '2026-01-10',
            'moneda_codigo': 'PEN',
            'detalles': [
                {
                    'producto': self.producto.id,
                    'producto_unidad': self.pu_und.id,
                    'almacen': self.almacen.id,
                    'tipo_operacion': self.tipo_op_compra.id,
                    'cantidad_original': '5.00000000',
                    'precio_unitario': '0.00000000',
                    'igv': '0.00000000',
                    'es_bonificacion': True
                }
            ]
        }

        response = self.client.post(url, data, format='json', **self.headers())
        self.assertEqual(response.status_code, 201)

        doc = Documento.objects.get(id=response.data['id'])
        det = doc.detalles.first()
        self.assertTrue(det.es_bonificacion)
        self.assertEqual(det.costo_unitario_pen, Decimal('0.00000000'))

    def test_nota_credito_usd_hereda_tc_documento_origen(self):
        # 1. Factura emitida el 10 de enero con TC 3.75
        factura = Documento.objects.create(
            empresa=self.empresa,
            clase='COMPRA',
            periodo=self.periodo_abierto,
            tercero=self.tercero_prov,
            ruc_emisor='20601234567',
            tipo_comprobante=self.tipo_factura,
            serie_normalizada='F001',
            numero_normalizado='100',
            fecha_emision='2026-01-10',
            moneda_codigo=self.moneda_usd,
            tipo_cambio=self.tc_enero_10,
            fecha_tc=date(2026, 1, 10),
            monto_tc=Decimal('3.75000000'),
            fuente_tc='SBS',
            subtotal=Decimal('500.00000000'),
            igv=Decimal('90.00000000'),
            total=Decimal('590.00000000')
        )
        det_factura = DocumentoDetalle.objects.create(
            documento=factura,
            linea=1,
            producto=self.producto,
            producto_unidad=self.pu_und,
            almacen=self.almacen,
            tipo_operacion=self.tipo_op_compra,
            cantidad_original=Decimal('50.00000000'),
            factor_conversion=Decimal('1.00000000'),
            cantidad_base=Decimal('50.00000000'),
            precio_unitario=Decimal('10.00000000'),
            costo_unitario_pen=Decimal('37.50000000')
        )

        # 2. Nota de Crédito emitida el 20 de enero (cuando el TC SBS del día es 3.82)
        url = reverse('documento-list-create')
        data_nc = {
            'clase': 'COMPRA',
            'periodo': self.periodo_abierto.id,
            'tercero': self.tercero_prov.id,
            'tipo_comprobante': self.tipo_nc.id,
            'serie': 'FC01',
            'numero': '5',
            'fecha_emision': '2026-01-20',
            'moneda_codigo': 'USD',
            'documento_origen': factura.id,
            'detalles': [
                {
                    'producto': self.producto.id,
                    'producto_unidad': self.pu_und.id,
                    'almacen': self.almacen.id,
                    'tipo_operacion': self.tipo_op_compra.id,
                    'cantidad_original': '10.00000000',
                    'precio_unitario': '10.00000000',
                    'igv': '18.00000000',
                    'detalle_origen': det_factura.id
                }
            ]
        }

        response = self.client.post(url, data_nc, format='json', **self.headers())
        self.assertEqual(response.status_code, 201)

        nc = Documento.objects.get(id=response.data['id'])
        # Regla contable oficial: la NC hereda el TC de la factura de origen (3.75), NO el de su fecha (3.82)
        self.assertEqual(nc.monto_tc, Decimal('3.75000000'))
        self.assertEqual(nc.fecha_tc, date(2026, 1, 10))
        self.assertEqual(nc.documento_origen, factura)

        det_nc = nc.detalles.first()
        self.assertEqual(det_nc.detalle_origen, det_factura)

    def test_rechazo_duplicado_y_almacen_otra_empresa(self):
        url = reverse('documento-list-create')

        # 1. Crear primer comprobante
        data_1 = {
            'clase': 'COMPRA',
            'periodo': self.periodo_abierto.id,
            'tercero': self.tercero_prov.id,
            'tipo_comprobante': self.tipo_factura.id,
            'serie': 'F001',
            'numero': '00000099',
            'fecha_emision': '2026-01-10',
            'moneda_codigo': 'PEN',
            'detalles': [
                {
                    'producto': self.producto.id,
                    'producto_unidad': self.pu_und.id,
                    'almacen': self.almacen.id,
                    'tipo_operacion': self.tipo_op_compra.id,
                    'cantidad_original': '1.00000000',
                    'precio_unitario': '10.00000000',
                }
            ]
        }
        resp1 = self.client.post(url, data_1, format='json', **self.headers())
        self.assertEqual(resp1.status_code, 201)

        # 2. Intentar duplicado con formato equivalente 'f001' y '99'
        data_dup = {
            'clase': 'COMPRA',
            'periodo': self.periodo_abierto.id,
            'tercero': self.tercero_prov.id,
            'tipo_comprobante': self.tipo_factura.id,
            'serie': ' f001 ',
            'numero': '99',
            'fecha_emision': '2026-01-11',
            'moneda_codigo': 'PEN',
            'detalles': [
                {
                    'producto': self.producto.id,
                    'producto_unidad': self.pu_und.id,
                    'almacen': self.almacen.id,
                    'tipo_operacion': self.tipo_op_compra.id,
                    'cantidad_original': '2.00000000',
                    'precio_unitario': '10.00000000',
                }
            ]
        }
        resp_dup = self.client.post(url, data_dup, format='json', **self.headers())
        self.assertEqual(resp_dup.status_code, 400)

        # 3. Intentar con almacén de otra empresa
        data_ajeno = {
            'clase': 'COMPRA',
            'periodo': self.periodo_abierto.id,
            'tercero': self.tercero_prov.id,
            'tipo_comprobante': self.tipo_factura.id,
            'serie': 'F001',
            'numero': '101',
            'fecha_emision': '2026-01-10',
            'moneda_codigo': 'PEN',
            'detalles': [
                {
                    'producto': self.producto.id,
                    'producto_unidad': self.pu_und.id,
                    'almacen': self.almacen_otra.id,
                    'tipo_operacion': self.tipo_op_compra.id,
                    'cantidad_original': '1.00000000',
                    'precio_unitario': '10.00000000',
                }
            ]
        }
        resp_ajeno = self.client.post(url, data_ajeno, format='json', **self.headers())
        self.assertEqual(resp_ajeno.status_code, 400)

    def test_flujo_revisar_documento_y_auditoria(self):
        doc = Documento.objects.create(
            empresa=self.empresa,
            clase='COMPRA',
            periodo=self.periodo_abierto,
            tercero=self.tercero_prov,
            ruc_emisor='20601234567',
            tipo_comprobante=self.tipo_factura,
            serie_normalizada='F010',
            numero_normalizado='1',
            fecha_emision='2026-01-10',
            moneda_codigo=self.moneda_pen,
            estado='BORRADOR',
            estado_revision='PENDIENTE'
        )
        self.assertEqual(doc.estado_revision, 'PENDIENTE')

        url_revisar = reverse('documento-revisar', args=[doc.id])

        # 1. Pasar a EN_REVISION
        resp_rev = self.client.post(url_revisar, {'estado_revision': 'EN_REVISION'}, format='json', **self.headers())
        self.assertEqual(resp_rev.status_code, 200)
        doc.refresh_from_db()
        self.assertEqual(doc.estado_revision, 'EN_REVISION')
        self.assertEqual(doc.revisado_por, self.usuario)

        # 2. Pasar a REVISADO
        resp_ok = self.client.post(url_revisar, {'estado_revision': 'REVISADO'}, format='json', **self.headers())
        self.assertEqual(resp_ok.status_code, 200)
        doc.refresh_from_db()
        self.assertEqual(doc.estado_revision, 'REVISADO')

        # 3. Confirmar documento
        url_confirmar = reverse('documento-confirmar', args=[doc.id])
        resp_conf = self.client.post(url_confirmar, {}, format='json', **self.headers())
        self.assertEqual(resp_conf.status_code, 200)
        doc.refresh_from_db()
        self.assertEqual(doc.estado, 'CONFIRMADO')

        # 4. Verificar auditoría registrada
        auditorias = Auditoria.objects.filter(empresa_id=self.empresa.id, entidad='DOCUMENTO', registro_id=doc.id)
        self.assertTrue(auditorias.filter(accion='ACTUALIZAR').exists())
        self.assertTrue(auditorias.filter(accion='CONFIRMAR').exists())

    def test_bloqueo_confirmacion_si_no_esta_revisado_o_periodo_cerrado(self):
        doc_no_revisado = Documento.objects.create(
            empresa=self.empresa,
            clase='COMPRA',
            periodo=self.periodo_abierto,
            tercero=self.tercero_prov,
            ruc_emisor='20601234567',
            tipo_comprobante=self.tipo_factura,
            serie_normalizada='F011',
            numero_normalizado='1',
            fecha_emision='2026-01-10',
            moneda_codigo=self.moneda_pen,
            estado='BORRADOR',
            estado_revision='PENDIENTE'
        )
        url_conf_1 = reverse('documento-confirmar', args=[doc_no_revisado.id])
        resp_1 = self.client.post(url_conf_1, {}, format='json', **self.headers())
        self.assertEqual(resp_1.status_code, 400)

        # Documento en período cerrado
        doc_cerrado = Documento.objects.create(
            empresa=self.empresa,
            clase='COMPRA',
            periodo=self.periodo_cerrado,
            tercero=self.tercero_prov,
            ruc_emisor='20601234567',
            tipo_comprobante=self.tipo_factura,
            serie_normalizada='F012',
            numero_normalizado='1',
            fecha_emision='2025-12-10',
            moneda_codigo=self.moneda_pen,
            estado='BORRADOR',
            estado_revision='REVISADO'
        )
        url_conf_2 = reverse('documento-confirmar', args=[doc_cerrado.id])
        resp_2 = self.client.post(url_conf_2, {}, format='json', **self.headers())
        self.assertEqual(resp_2.status_code, 400)
