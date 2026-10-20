from decimal import Decimal
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.catalogos.models import Moneda, TipoComprobante, TipoOperacion, UnidadMedida, TipoExistencia
from apps.documentos.models import Documento, DocumentoDetalle
from apps.empresas.models import Empresa, Establecimiento, Periodo
from apps.inventario.models import Almacen, Producto, ProductoUnidad, ProductoEquivalencia, Tercero


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
