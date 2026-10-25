"""
Fixture común para las regresiones del Bloque 2 (CON-001 … CON-009).
Usa el flujo real de la API: crear → revisar → confirmar / anular.
"""
from datetime import date
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient

from apps.catalogos.models import Moneda, TipoCambio, TipoComprobante, TipoExistencia, TipoOperacion, UnidadMedida
from apps.empresas.models import ConfigEmpresa, Empresa, Establecimiento, Periodo
from apps.inventario.models import Almacen, Producto, ProductoEquivalencia, ProductoUnidad, Tercero
from apps.kardex.models import Movimiento, SaldoCppActual, StockAlmacen
from apps.usuarios.models import Usuario, UsuarioEmpresa

# (codigo_interno, naturaleza, afecta_kardex, origen_requerido) — igual que seed_catalogos_sunat
TIPOS_OPERACION = (
    ('COMPRA', 'ENTRADA', True, 'DOCUMENTO'),
    ('VENTA', 'SALIDA', True, 'DOCUMENTO'),
    ('DEVOLUCION_VENTA', 'ENTRADA', True, 'MOV_ORIGEN'),
    ('DEVOLUCION_COMPRA', 'SALIDA', True, 'MOV_ORIGEN'),
    ('NC_DESCUENTO_COMPRA', 'AJUSTE_VALOR', True, 'DOCUMENTO'),
    ('ND_CARGO_COMPRA', 'AJUSTE_VALOR', True, 'DOCUMENTO'),
    ('NC_VENTA_SIN_DEVOLUCION', 'AJUSTE_VALOR', False, 'DOCUMENTO'),
    ('EXTORNO_ENTRADA', 'ENTRADA', True, 'MOV_EXTORNADO'),
    ('EXTORNO_SALIDA', 'SALIDA', True, 'MOV_EXTORNADO'),
    ('RESIDUO_AUTOMATICO', 'AJUSTE_VALOR', True, 'MOTOR'),
)

XML_UBL = """<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>{serie}-{numero}</cbc:ID>
  <cbc:IssueDate>{fecha}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>{moneda}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyIdentification><cbc:ID>{ruc}</cbc:ID></cac:PartyIdentification>
    <cac:PartyLegalEntity><cbc:RegistrationName>PROVEEDOR XML QA S.A.C.</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:TaxTotal><cbc:TaxAmount>18.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount>100.00</cbc:LineExtensionAmount>
    <cbc:PayableAmount>118.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="NIU">10</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount>100.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Description>ITEM XML QA</cbc:Description>
      <cac:SellersItemIdentification><cbc:ID>SKU-QA-1</cbc:ID></cac:SellersItemIdentification></cac:Item>
    <cac:Price><cbc:PriceAmount>10.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>
"""


class Bloque2Fixture:
    """Mezclar con django.test.TestCase."""

    RUC_PROVEEDOR = '20555000111'

    def crear_base(self):
        self.pen = Moneda.objects.create(codigo='PEN', nombre='Soles')
        self.usd = Moneda.objects.create(codigo='USD', nombre='Dólares')
        self.empresa = Empresa.objects.create(ruc='20100100100', razon_social='EMPRESA B2 S.A.C.', moneda_base_codigo=self.pen)
        self.otra_empresa = Empresa.objects.create(ruc='20100100200', razon_social='OTRA B2 S.A.C.', moneda_base_codigo=self.pen)
        self.establecimiento = Establecimiento.objects.create(empresa=self.empresa, codigo_sunat='0000', nombre='PRINCIPAL')
        ConfigEmpresa.objects.create(empresa=self.empresa, establecimiento_principal=self.establecimiento)
        self.almacen = Almacen.objects.create(
            empresa=self.empresa, establecimiento=self.establecimiento, codigo='ALM', nombre='ALMACEN',
        )
        self.tipo_existencia = TipoExistencia.objects.create(codigo='01', descripcion='MERCADERIAS')
        self.und = UnidadMedida.objects.create(codigo='NIU', descripcion='UNIDADES')
        self.producto = self.crear_producto('P-B2')
        self.pu = self.producto.unidades.get(es_base=True)
        self.producto_2 = self.crear_producto('P-B2-2')
        self.proveedor = Tercero.objects.create(
            empresa=self.empresa, tipo_documento='6', numero_documento=self.RUC_PROVEEDOR,
            razon_social='PROVEEDOR B2', es_proveedor=True,
        )
        self.proveedor_2 = Tercero.objects.create(
            empresa=self.empresa, tipo_documento='6', numero_documento='20555000222',
            razon_social='PROVEEDOR B2 DOS', es_proveedor=True,
        )
        self.cliente = Tercero.objects.create(
            empresa=self.empresa, tipo_documento='6', numero_documento='20666000111',
            razon_social='CLIENTE B2', es_cliente=True,
        )
        self.factura = TipoComprobante.objects.create(codigo_sunat='01', descripcion='FACTURA')
        self.nota_credito = TipoComprobante.objects.create(
            codigo_sunat='07', descripcion='NOTA DE CREDITO', es_nota=True, efecto_nota='CREDITO',
        )
        self.nota_debito = TipoComprobante.objects.create(
            codigo_sunat='08', descripcion='NOTA DE DEBITO', es_nota=True, efecto_nota='DEBITO',
        )
        self.op = {}
        for codigo, naturaleza, afecta, origen in TIPOS_OPERACION:
            self.op[codigo] = TipoOperacion.objects.create(
                codigo_interno=codigo, descripcion=codigo, naturaleza=naturaleza,
                es_interna=codigo in ('EXTORNO_ENTRADA', 'EXTORNO_SALIDA', 'RESIDUO_AUTOMATICO'),
                afecta_kardex=afecta, origen_requerido=origen,
            )
        self.diciembre = Periodo.objects.create(
            empresa=self.empresa, anio=2025, mes=12, orden=202512,
            fecha_inicio=date(2025, 12, 1), fecha_fin=date(2025, 12, 31), estado='CERRADO',
        )
        self.enero = Periodo.objects.create(
            empresa=self.empresa, anio=2026, mes=1, orden=202601,
            fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 1, 31), estado='ABIERTO',
        )
        self.usuario = Usuario.objects.create(username='admin_b2', email='admin_b2@test.pe', password_hash='x')
        UsuarioEmpresa.objects.create(usuario=self.usuario, empresa=self.empresa, rol='ADMIN')
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)
        self.headers = {'HTTP_X_EMPRESA_ID': str(self.empresa.id)}
        self._numero = 0

    def crear_producto(self, codigo):
        producto = Producto.objects.create(
            empresa=self.empresa, codigo_interno=codigo, descripcion=f'PRODUCTO {codigo}',
            tipo_existencia_codigo=self.tipo_existencia,
        )
        ProductoUnidad.objects.create(
            producto=producto, unidad_codigo=self.und, factor_a_base=Decimal('1.00000000'), es_base=True,
        )
        return producto

    def crear_tc(self, fecha, venta):
        return TipoCambio.objects.create(
            moneda_codigo=self.usd, fecha_publicacion=fecha,
            compra=Decimal(venta) - Decimal('0.01'), venta=Decimal(venta), fuente='SBS',
        )

    # ---- API documentos -----------------------------------------------------

    def linea(self, operacion, cantidad='10', precio='10', producto=None, **extra):
        producto = producto or self.producto
        linea = {
            'producto': producto.id,
            'producto_unidad': producto.unidades.get(es_base=True).id,
            'almacen': self.almacen.id,
            'tipo_operacion': self.op[operacion].id,
            'cantidad_original': str(cantidad),
            'precio_unitario': str(precio),
            'igv': str((Decimal(str(cantidad)) * Decimal(str(precio)) * Decimal('0.18')).quantize(Decimal('0.01'))),
        }
        linea.update(extra)
        return {k: v for k, v in linea.items() if v is not None}

    def payload(self, clase, lineas, *, tipo=None, fecha='2026-01-10', tercero=None, moneda='PEN',
                origen=None, periodo=None, serie=None):
        self._numero += 1
        if tercero is None:
            tercero = self.proveedor if clase == 'COMPRA' else self.cliente
        data = {
            'clase': clase,
            'periodo': (periodo or self.enero).id,
            'tercero': tercero.id if tercero else None,
            'tipo_comprobante': (tipo or self.factura).id,
            'serie': serie or ('F001' if (tipo or self.factura) == self.factura else 'FC01'),
            'numero': str(self._numero),
            'fecha_emision': fecha,
            'moneda_codigo': moneda,
            'detalles': lineas,
        }
        if origen is not None:
            data['documento_origen'] = origen.id
        return data

    def crear(self, data, esperado=201):
        resp = self.client.post(reverse('documento-list-create'), data, format='json', **self.headers)
        if esperado is not None:
            assert resp.status_code == esperado, (resp.status_code, getattr(resp, 'data', resp.content))
        return resp

    def revisar(self, documento_id):
        resp = self.client.post(
            reverse('documento-revisar', args=[documento_id]), {'estado_revision': 'REVISADO'},
            format='json', **self.headers,
        )
        assert resp.status_code == 200, resp.data
        return resp

    def confirmar(self, documento_id, esperado=200):
        resp = self.client.post(reverse('documento-confirmar', args=[documento_id]), format='json', **self.headers)
        if esperado is not None:
            assert resp.status_code == esperado, (resp.status_code, getattr(resp, 'data', resp.content))
        return resp

    def anular(self, documento_id, esperado=200):
        resp = self.client.post(
            reverse('documento-anular', args=[documento_id]), {'motivo': 'QA bloque 2'},
            format='json', **self.headers,
        )
        if esperado is not None:
            assert resp.status_code == esperado, (resp.status_code, getattr(resp, 'data', resp.content))
        return resp

    def documento_confirmado(self, clase, lineas, **kwargs):
        doc_id = self.crear(self.payload(clase, lineas, **kwargs)).data['id']
        self.revisar(doc_id)
        self.confirmar(doc_id)
        return doc_id

    def compra_confirmada(self, cantidad='10', precio='10', fecha='2026-01-10', **kwargs):
        return self.documento_confirmado('COMPRA', [self.linea('COMPRA', cantidad, precio)], fecha=fecha, **kwargs)

    # ---- Captura -------------------------------------------------------------

    def subir_xml(self, *, fecha='2026-01-10', moneda='PEN', numero='501'):
        xml = XML_UBL.format(serie='F001', numero=numero, fecha=fecha, moneda=moneda, ruc=self.RUC_PROVEEDOR)
        archivo = SimpleUploadedFile(f'factura_{numero}.xml', xml.encode('utf-8'), content_type='text/xml')
        resp = self.client.post(
            reverse('documento-captura-subir'), {'archivo': archivo, 'tipo': 'XML'},
            format='multipart', **self.headers,
        )
        assert resp.status_code == 201, resp.data
        return resp.data['id']

    def homologar_sku(self):
        ProductoEquivalencia.objects.create(
            empresa=self.empresa, tercero=self.proveedor, codigo_externo='SKU-QA-1',
            descripcion_externa='ITEM XML QA', unidad_externa_codigo=self.und, producto_unidad=self.pu,
            factor_conversion=Decimal('1.00000000'), confirmado_por=self.usuario, activa=True,
        )

    def generar_borrador(self, captura_id):
        return self.client.post(
            reverse('documento-captura-generar-borrador', args=[captura_id]), {},
            format='json', **self.headers,
        )

    # ---- Estado del inventario ----------------------------------------------

    def movimientos(self, producto=None):
        return Movimiento.objects.filter(empresa=self.empresa, producto=producto or self.producto)

    def saldo(self, producto=None):
        return SaldoCppActual.objects.filter(empresa=self.empresa, producto=producto or self.producto).first()

    def stock(self, producto=None):
        st = StockAlmacen.objects.filter(
            empresa=self.empresa, almacen=self.almacen, producto=producto or self.producto,
        ).first()
        return st.cantidad_actual if st else Decimal('0')
