import hashlib
import re
import xml.etree.ElementTree as ET
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.auditoria.services import registrar_auditoria
from apps.catalogos.models import Moneda, TipoComprobante, TipoOperacion
from apps.documentos.models import Documento, DocumentoCaptura, DocumentoDetalle, CapturaCampo
from apps.empresas.models import Periodo
from apps.inventario.models import Almacen, ProductoEquivalencia, Tercero
from apps.kardex.models import Incidencia

DECIMAL_CERO = Decimal('0.00000000')
DECIMAL_UNO = Decimal('1.00000000')
Q8 = Decimal('0.00000001')
Q4 = Decimal('0.0001')


def calcular_hash_sha256(content: bytes) -> str:
    """Calcula el hash SHA-256 de los bytes de un archivo."""
    return hashlib.sha256(content).hexdigest()


def _strip_namespaces(root: ET.Element) -> None:
    """Elimina los prefijos de namespaces de todas las etiquetas XML para facilitar el recorrido."""
    for elem in root.iter():
        if '}' in elem.tag:
            elem.tag = elem.tag.split('}', 1)[1]


def _find_text(element: ET.Element, tag_name: str, default: Optional[str] = None) -> Optional[str]:
    """Busca el primer elemento con tag_name y retorna su texto limpio."""
    found = element.find(f".//{tag_name}")
    if found is not None and found.text:
        return found.text.strip()
    return default


def parsear_xml_ubl(content: bytes) -> Dict[str, Any]:
    """
    Parsea de forma segura un XML UBL 2.1 de factura (01), boleta (03) o nota de crédito (07)
    según las especificaciones técnicas de SUNAT.
    """
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        raise ValidationError({'archivo': f'El archivo XML no tiene un formato válido: {str(e)}'})

    _strip_namespaces(root)

    root_tag = root.tag
    is_credit_note = 'CreditNote' in root_tag
    is_debit_note = 'DebitNote' in root_tag

    # 1. Tipo de comprobante
    tipo_comp = _find_text(root, 'InvoiceTypeCode')
    if not tipo_comp:
        if is_credit_note:
            tipo_comp = '07'
        elif is_debit_note:
            tipo_comp = '08'
        else:
            tipo_comp = '01'

    # 2. Serie y número (ej. F001-00001234 o F001-1234)
    id_doc = _find_text(root, 'ID') or ''
    serie = ''
    numero = ''
    if '-' in id_doc:
        partes = id_doc.split('-', 1)
        serie = partes[0].strip().upper()
        numero = partes[1].strip()
    else:
        serie = id_doc[:4].upper()
        numero = id_doc[4:] if len(id_doc) > 4 else id_doc

    # 2.1 Documento de referencia (para notas de crédito / débito)
    doc_modificado = (
        _find_text(root, 'BillingReference/InvoiceDocumentReference/ID')
        or _find_text(root, 'InvoiceDocumentReference/ID')
        or _find_text(root, 'DiscrepancyResponse/ReferenceID')
        or ''
    )

    # 3. Fecha de emisión
    fecha_str = _find_text(root, 'IssueDate')
    fecha_emision = None
    if fecha_str:
        try:
            fecha_emision = datetime.strptime(fecha_str, '%Y-%m-%d').date()
        except ValueError:
            fecha_emision = timezone.now().date()
    else:
        fecha_emision = timezone.now().date()

    # 4. Moneda
    moneda_str = _find_text(root, 'DocumentCurrencyCode') or 'PEN'

    # 5. Emisor (Proveedor)
    ruc_emisor = ''
    razon_social_emisor = ''
    supplier = root.find('.//AccountingSupplierParty')
    if supplier is not None:
        # RUC
        party_id = _find_text(supplier, 'ID')
        if not party_id or len(party_id) != 11:
            party_id = _find_text(supplier, 'CompanyID')
        ruc_emisor = party_id or ''

        # Razón Social
        legal_name = _find_text(supplier, 'RegistrationName')
        if not legal_name:
            legal_name = _find_text(supplier, 'Name')
        razon_social_emisor = legal_name or ''

    # 6. Adquiriente (Cliente / Empresa receptora)
    ruc_cliente = ''
    customer = root.find('.//AccountingCustomerParty')
    if customer is not None:
        ruc_cliente = _find_text(customer, 'ID') or _find_text(customer, 'CompanyID') or ''

    # 7. Totales monetarios
    subtotal_str = _find_text(root, 'LineExtensionAmount') or '0.00'
    igv_str = '0.00'
    tax_total = root.find('.//TaxTotal')
    if tax_total is not None:
        igv_str = _find_text(tax_total, 'TaxAmount') or '0.00'
    total_str = _find_text(root, 'PayableAmount') or _find_text(root, 'LineExtensionAmount') or '0.00'

    try:
        subtotal = Decimal(subtotal_str).quantize(Q8, rounding=ROUND_HALF_UP)
    except Exception:
        subtotal = DECIMAL_CERO

    try:
        igv = Decimal(igv_str).quantize(Q8, rounding=ROUND_HALF_UP)
    except Exception:
        igv = DECIMAL_CERO

    try:
        total = Decimal(total_str).quantize(Q8, rounding=ROUND_HALF_UP)
    except Exception:
        total = subtotal + igv

    # 8. Líneas de Detalle
    line_tag = 'CreditNoteLine' if is_credit_note else ('DebitNoteLine' if is_debit_note else 'InvoiceLine')
    lines = root.findall(f'.//{line_tag}')
    detalles = []

    for index, line in enumerate(lines, start=1):
        # Cantidad y unidad
        qty_elem = line.find('.//InvoicedQuantity')
        if qty_elem is None:
            qty_elem = line.find('.//CreditedQuantity')
        if qty_elem is None:
            qty_elem = line.find('.//DebitedQuantity')

        cant_str = qty_elem.text.strip() if (qty_elem is not None and qty_elem.text) else '1.0'
        unit_code = qty_elem.get('unitCode', 'NIU') if qty_elem is not None else 'NIU'

        # Código externo y descripción del ítem
        item = line.find('.//Item')
        codigo_externo = ''
        descripcion = ''
        if item is not None:
            sellers_id = _find_text(item, 'ID')
            codigo_externo = sellers_id or ''
            descripcion = _find_text(item, 'Description') or ''

        # Precio unitario
        price = _find_text(line, 'PriceAmount')
        if not price:
            alt_price = line.find('.//PricingReference')
            if alt_price is not None:
                price = _find_text(alt_price, 'PriceAmount')

        # Subtotal de la línea
        line_ext = _find_text(line, 'LineExtensionAmount')

        try:
            cant_dec = Decimal(cant_str).quantize(Q8, rounding=ROUND_HALF_UP)
        except Exception:
            cant_dec = DECIMAL_UNO

        try:
            precio_dec = Decimal(price or '0.00').quantize(Q8, rounding=ROUND_HALF_UP)
        except Exception:
            precio_dec = DECIMAL_CERO

        try:
            val_total_dec = Decimal(line_ext or str(cant_dec * precio_dec)).quantize(Q8, rounding=ROUND_HALF_UP)
        except Exception:
            val_total_dec = (cant_dec * precio_dec).quantize(Q8, rounding=ROUND_HALF_UP)

        detalles.append({
            'numero_linea': index,
            'codigo_externo': codigo_externo,
            'descripcion': descripcion,
            'unidad_medida': unit_code,
            'cantidad': cant_dec,
            'precio_unitario': precio_dec,
            'valor_total': val_total_dec,
        })

    return {
        'tipo': 'XML',
        'cabecera': {
            'tipo_comprobante': tipo_comp,
            'serie': serie,
            'numero': numero,
            'serie_numero': id_doc or f"{serie}-{numero}",
            'fecha_emision': fecha_emision.strftime('%Y-%m-%d'),
            'moneda': moneda_str,
            'ruc_emisor': ruc_emisor,
            'razon_social_emisor': razon_social_emisor,
            'ruc_cliente': ruc_cliente,
            'subtotal': str(subtotal),
            'igv': str(igv),
            'total': str(total),
            'doc_modificado': doc_modificado,
        },
        'detalles': detalles,
        'confianza_global': Decimal('100.0000'),
    }


def extraer_ocr_basico(content: bytes, filename: str, texto_ocr: Optional[str] = None) -> Dict[str, Any]:
    """
    Simulación y extracción OCR básica para comprobantes en PDF, Imagen o Escáner.
    Extrae los campos de cabecera y líneas requeridos por la Sección 40 del manual,
    asignando niveles de confianza entre 0% y 100%.
    """
    texto = texto_ocr or ''
    if not texto and content:
        try:
            texto = content.decode('utf-8', errors='ignore')
        except Exception:
            texto = ''

    # RUC (11 dígitos, empieza en 10 o 20)
    ruc_match = re.search(r'\b(10\d{9}|20\d{9})\b', texto)
    ruc_emisor = ruc_match.group(1) if ruc_match else '20000000001'
    conf_ruc = Decimal('95.0000') if ruc_match else Decimal('60.0000')

    # Tipo Comprobante
    tipo_comp = '01'
    conf_tipo = Decimal('90.0000')
    if re.search(r'\bNOTA\s+DE\s+CR[EÉ]DITO\b', texto, re.IGNORECASE):
        tipo_comp = '07'
    elif re.search(r'\bBOLETA\b', texto, re.IGNORECASE):
        tipo_comp = '03'
    elif re.search(r'\bFACTURA\b', texto, re.IGNORECASE):
        tipo_comp = '01'

    # Serie y Número (ej. F001-1234 o E001-5678)
    serie_match = re.search(r'\b([FE][0-9A-Z]{3})[- ]?([0-9]{1,8})\b', texto)
    if serie_match:
        serie = serie_match.group(1).upper()
        numero = serie_match.group(2)
        conf_serie_num = Decimal('92.0000')
    else:
        serie = 'F001'
        numero = '00000001'
        conf_serie_num = Decimal('65.0000')

    # Fecha (YYYY-MM-DD o DD/MM/YYYY)
    fecha_match = re.search(r'\b(\d{4}[-/]\d{2}[-/]\d{2})\b', texto)
    if fecha_match:
        fecha_emision = fecha_match.group(1).replace('/', '-')
        conf_fecha = Decimal('90.0000')
    else:
        fecha_alt = re.search(r'\b(\d{2})[/.-](\d{2})[/.-](\d{4})\b', texto)
        if fecha_alt:
            fecha_emision = f"{fecha_alt.group(3)}-{fecha_alt.group(2)}-{fecha_alt.group(1)}"
            conf_fecha = Decimal('88.0000')
        else:
            fecha_emision = timezone.now().date().strftime('%Y-%m-%d')
            conf_fecha = Decimal('70.0000')

    # Moneda
    if re.search(r'\b(USD|D[OÓ]LARES?|\$)\b', texto, re.IGNORECASE):
        moneda = 'USD'
        conf_moneda = Decimal('94.0000')
    else:
        moneda = 'PEN'
        conf_moneda = Decimal('92.0000')

    # Totales
    total_match = re.search(r'\bTOTAL(?:\s+A\s+PAGAR)?[:\s]+(?:S/\.?|\$)?\s*([0-9,]+\.[0-9]{2})\b', texto, re.IGNORECASE)
    if total_match:
        total_str = total_match.group(1).replace(',', '')
        total_dec = Decimal(total_str).quantize(Q8, rounding=ROUND_HALF_UP)
        conf_total = Decimal('88.0000')
    else:
        total_dec = Decimal('118.00000000')
        conf_total = Decimal('70.0000')

    subtotal_dec = (total_dec / Decimal('1.18')).quantize(Q8, rounding=ROUND_HALF_UP)
    igv_dec = (total_dec - subtotal_dec).quantize(Q8, rounding=ROUND_HALF_UP)

    # Razón Social Emisor
    rz_match = re.search(r'\b(?:SE[NÑ]OR(?:ES)?|EMISOR|PROVEEDOR|RAZ[OÓ]N\s+SOCIAL)[:\s]+([^\n\r]+)', texto, re.IGNORECASE)
    razon_social = rz_match.group(1).strip() if rz_match else 'PROVEEDOR OCR EXTRAIDO S.A.C.'
    conf_rz = Decimal('85.0000') if rz_match else Decimal('60.0000')

    # Líneas extraídas
    detalles = [
        {
            'numero_linea': 1,
            'codigo_externo': 'ITEM-OCR-01',
            'descripcion': 'MERCADERIA O SERVICIO OCR EXTRAIDO',
            'unidad_medida': 'NIU',
            'cantidad': Decimal('1.00000000'),
            'precio_unitario': subtotal_dec,
            'valor_total': subtotal_dec,
            'confianza': Decimal('82.5000'),
        }
    ]

    return {
        'tipo': 'OCR',
        'cabecera': {
            'tipo_comprobante': (tipo_comp, conf_tipo),
            'serie': (serie, conf_serie_num),
            'numero': (numero, conf_serie_num),
            'serie_numero': (f"{serie}-{numero}", conf_serie_num),
            'fecha_emision': (fecha_emision, conf_fecha),
            'moneda': (moneda, conf_moneda),
            'ruc_emisor': (ruc_emisor, conf_ruc),
            'razon_social_emisor': (razon_social, conf_rz),
            'subtotal': (str(subtotal_dec), Decimal('85.0000')),
            'igv': (str(igv_dec), Decimal('85.0000')),
            'total': (str(total_dec), conf_total),
        },
        'detalles': detalles,
        'confianza_global': Decimal('84.0000'),
    }


@transaction.atomic
def procesar_subida_captura(
    *,
    empresa_id: int,
    usuario,
    archivo,
    tipo: str,
    texto_ocr: Optional[str] = None,
) -> Tuple[DocumentoCaptura, bool]:
    """
    Procesa un archivo XML o PDF/Imagen/Escáner:
    1. Calcula el hash SHA-256 para evitar reprocesar archivos idénticos.
    2. Crea el registro en DocumentoCaptura.
    3. Extrae campos y puebla CapturaCampo con su seccion, numero_linea y nivel de confianza.
    Retorna (captura, fue_creado_nuevo).
    """
    content = archivo.read()
    hash_sha256 = calcular_hash_sha256(content)

    # Verificar si ya existe idéntico en la empresa
    existente = DocumentoCaptura.objects.filter(
        empresa_id=empresa_id,
        hash_sha256=hash_sha256,
    ).first()

    if existente is not None:
        return existente, False

    captura = DocumentoCaptura.objects.create(
        empresa_id=empresa_id,
        tipo=tipo.upper(),
        ruta_archivo=f"uploads/{tipo.lower()}/{archivo.name}",
        hash_sha256=hash_sha256,
        estado_proceso='PROCESADO',
        subido_por=usuario,
    )

    if tipo.upper() == 'XML':
        datos = parsear_xml_ubl(content)
        # Poblar cabecera (confianza 100% para XML electrónico estructurado)
        conf_xml = Decimal('100.0000')
        for nombre, valor in datos['cabecera'].items():
            CapturaCampo.objects.create(
                documento_captura=captura,
                seccion='CABECERA',
                numero_linea=None,
                nombre_campo=nombre,
                valor_extraido=str(valor) if valor is not None else '',
                confianza=conf_xml,
            )

        # Poblar detalle
        for item in datos['detalles']:
            num_linea = item['numero_linea']
            for campo_nombre in ('codigo_externo', 'descripcion', 'unidad_medida', 'cantidad', 'precio_unitario', 'valor_total'):
                val = item.get(campo_nombre)
                CapturaCampo.objects.create(
                    documento_captura=captura,
                    seccion='DETALLE',
                    numero_linea=num_linea,
                    nombre_campo=campo_nombre,
                    valor_extraido=str(val) if val is not None else '',
                    confianza=conf_xml,
                )

    else:
        # OCR para PDF, IMAGEN o ESCANER
        datos = extraer_ocr_basico(content, archivo.name, texto_ocr)
        for nombre, tupla in datos['cabecera'].items():
            valor, conf = tupla
            CapturaCampo.objects.create(
                documento_captura=captura,
                seccion='CABECERA',
                numero_linea=None,
                nombre_campo=nombre,
                valor_extraido=str(valor) if valor is not None else '',
                confianza=conf,
            )

        for item in datos['detalles']:
            num_linea = item['numero_linea']
            conf_det = item.get('confianza', Decimal('80.0000'))
            for campo_nombre in ('codigo_externo', 'descripcion', 'unidad_medida', 'cantidad', 'precio_unitario', 'valor_total'):
                val = item.get(campo_nombre)
                CapturaCampo.objects.create(
                    documento_captura=captura,
                    seccion='DETALLE',
                    numero_linea=num_linea,
                    nombre_campo=campo_nombre,
                    valor_extraido=str(val) if val is not None else '',
                    confianza=conf_det,
                )

    registrar_auditoria(
        empresa_id=empresa_id,
        usuario_id=usuario.id,
        accion='SUBIR_CAPTURA_DOCUMENTO',
        entidad='DOCUMENTO_CAPTURA',
        registro_id=captura.id,
        valor_anterior=None,
        valor_nuevo={'tipo': captura.tipo, 'hash_sha256': hash_sha256, 'archivo': archivo.name},
    )

    return captura, True


@transaction.atomic
def corregir_campo_captura(
    *,
    captura_id: int,
    campo_id: int,
    valor_corregido: str,
    empresa_id: int,
    usuario,
) -> CapturaCampo:
    """Permite al usuario humano corregir el valor de un campo extraído."""
    campo = CapturaCampo.objects.select_for_update().filter(
        pk=campo_id,
        documento_captura_id=captura_id,
        documento_captura__empresa_id=empresa_id,
    ).first()

    if campo is None:
        raise ValidationError({'campo_id': 'Campo de captura no encontrado para esta empresa.'})

    val_ant = campo.valor_corregido or campo.valor_extraido
    campo.valor_corregido = valor_corregido
    campo.corregido_por = usuario
    campo.save(update_fields=['valor_corregido', 'corregido_por'])

    registrar_auditoria(
        empresa_id=empresa_id,
        usuario_id=usuario.id,
        accion='CORREGIR_CAMPO_CAPTURA',
        entidad='CAPTURA_CAMPO',
        registro_id=campo.id,
        valor_anterior={'valor': val_ant},
        valor_nuevo={'valor_corregido': valor_corregido, 'campo': campo.nombre_campo},
    )
    return campo


@transaction.atomic
def generar_borrador_desde_captura(
    *,
    captura_id: int,
    empresa_id: int,
    usuario,
    almacen_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Convierte los campos de CapturaCampo en un Documento y DocumentoDetalle en estado estricto:
    estado = 'BORRADOR' y estado_revision = 'PENDIENTE'.
    REGLA INQUEBRANTABLE: Jamás confirma ni mueve stock en Kardex automáticamente.
    Si algún ítem no tiene equivalencia, genera Incidencia 'PRODUCTO_SIN_HOMOLOGAR'.
    """
    captura = DocumentoCaptura.objects.select_for_update().filter(
        pk=captura_id,
        empresa_id=empresa_id,
    ).first()

    if captura is None:
        raise ValidationError({'captura_id': 'Captura no encontrada para esta empresa.'})

    if captura.documento_id is not None:
        raise ValidationError({
            'documento': f'Esta captura ya generó el documento borrador #{captura.documento_id}.'
        })

    campos = captura.campos.all()
    if not campos.exists():
        raise ValidationError({'captura': 'La captura no contiene campos extraídos para generar un comprobante.'})

    # Extraer valores efectivos (valor_corregido si existe, sino valor_extraido)
    cabecera: Dict[str, str] = {}
    detalles: Dict[int, Dict[str, str]] = {}

    for c in campos:
        val = c.valor_corregido if (c.valor_corregido is not None and c.valor_corregido != '') else (c.valor_extraido or '')
        if c.seccion == 'CABECERA':
            cabecera[c.nombre_campo] = val
        elif c.seccion == 'DETALLE':
            linea_num = c.numero_linea or 1
            if linea_num not in detalles:
                detalles[linea_num] = {}
            detalles[linea_num][c.nombre_campo] = val

    # 1. Tercero Proveedor
    ruc_emisor = cabecera.get('ruc_emisor', '').strip()
    if not ruc_emisor:
        ruc_emisor = '20000000001'
    rz_emisor = cabecera.get('razon_social_emisor', '').strip() or f'PROVEEDOR RUC {ruc_emisor}'

    tercero, _ = Tercero.objects.get_or_create(
        empresa_id=empresa_id,
        numero_documento=ruc_emisor,
        defaults={
            'tipo_documento': '6',
            'razon_social': rz_emisor,
            'es_proveedor': True,
            'es_cliente': False,
        }
    )

    # 2. Tipo de comprobante
    tipo_comp_cod = cabecera.get('tipo_comprobante', '01').strip()
    tipo_comp = TipoComprobante.objects.filter(codigo_sunat=tipo_comp_cod).first()
    if not tipo_comp:
        tipo_comp = TipoComprobante.objects.filter(codigo_sunat='01').first()

    # 3. Serie y Número normalizados con función centralizada de documentos (A-06)
    from apps.documentos.services import normalizar_numero, normalizar_serie, validar_duplicado_documento
    serie_raw = cabecera.get('serie', 'F001').strip()
    num_raw = cabecera.get('numero', '1').strip()
    serie_norm = normalizar_serie(serie_raw)
    num_norm = normalizar_numero(num_raw)

    # Validar duplicados contra la clave lógica oficial de la empresa (A-06)
    validar_duplicado_documento(
        empresa_id=empresa_id,
        ruc_emisor=ruc_emisor,
        tipo_comprobante_id=tipo_comp.id,
        serie_normalizada=serie_norm,
        numero_normalizado=num_norm,
    )

    # 3.1 Documento de origen para notas (NC / ND)
    documento_origen = None
    if tipo_comp.es_nota:
        ref_doc = cabecera.get('doc_modificado') or cabecera.get('documento_modificado')
        if ref_doc:
            ref_serie = ''
            ref_num = ''
            if '-' in ref_doc:
                partes_ref = ref_doc.split('-', 1)
                ref_serie = normalizar_serie(partes_ref[0])
                ref_num = normalizar_numero(partes_ref[1])
            else:
                ref_serie = normalizar_serie(ref_doc[:4])
                ref_num = normalizar_numero(ref_doc[4:])
            documento_origen = Documento.objects.filter(
                empresa_id=empresa_id,
                ruc_emisor=ruc_emisor,
                serie_normalizada=ref_serie,
                numero_normalizado=ref_num,
            ).first()

    # 4. Fecha de emisión
    fecha_str = cabecera.get('fecha_emision')
    fecha_emision = None
    if fecha_str:
        try:
            fecha_emision = datetime.strptime(fecha_str, '%Y-%m-%d').date()
        except ValueError:
            fecha_emision = timezone.now().date()
    else:
        fecha_emision = timezone.now().date()

    # 5. Período
    periodo = Periodo.objects.filter(
        empresa_id=empresa_id,
        estado='ABIERTO',
        fecha_inicio__lte=fecha_emision,
        fecha_fin__gte=fecha_emision,
    ).first()

    if not periodo:
        periodo = Periodo.objects.filter(empresa_id=empresa_id, estado='ABIERTO').order_by('-fecha_inicio').first()

    if not periodo:
        raise ValidationError({'periodo': 'No existe un período contable ABIERTO para registrar el comprobante.'})

    # 6. Moneda y Tipo de Cambio
    moneda_cod = cabecera.get('moneda', 'PEN').strip().upper()
    moneda = Moneda.objects.filter(codigo=moneda_cod).first()
    if not moneda:
        moneda = Moneda.objects.get(codigo='PEN')

    tipo_cambio = None
    fecha_tc = None
    monto_tc = None
    fuente_tc = None
    if moneda.codigo == 'USD':
        try:
            from apps.documentos.services import resolver_tipo_cambio_usd
            tc = resolver_tipo_cambio_usd(fecha_emision)
            tipo_cambio = tc
            fecha_tc = tc.fecha_publicacion
            monto_tc = tc.venta
            fuente_tc = tc.fuente
        except Exception:
            tipo_cambio = None
            fecha_tc = None
            monto_tc = None
            fuente_tc = None

    # 7. Totales
    def parse_dec(val: str, default: Decimal = DECIMAL_CERO) -> Decimal:
        try:
            return Decimal(val.replace(',', '')).quantize(Q8, rounding=ROUND_HALF_UP)
        except Exception:
            return default

    subtotal = parse_dec(cabecera.get('subtotal', '0'))
    igv = parse_dec(cabecera.get('igv', '0'))
    total = parse_dec(cabecera.get('total', '0'))
    if total == DECIMAL_CERO:
        total = subtotal + igv

    # 8. Almacén destino por defecto
    almacen = None
    if almacen_id:
        almacen = Almacen.objects.filter(pk=almacen_id, empresa_id=empresa_id, activo=True).first()
    if not almacen:
        almacen = Almacen.objects.filter(empresa_id=empresa_id, activo=True).first()
    if not almacen:
        raise ValidationError({'almacen': 'La empresa no cuenta con un almacén activo disponible.'})

    # 9. Tipo de operación de compra / ajuste por defecto según comprobante (A-06)
    if tipo_comp.es_nota:
        if getattr(tipo_comp, 'efecto_nota', None) == 'CREDITO':
            tipo_op = TipoOperacion.objects.filter(codigo_interno='NC_COMPRA').first()
        else:
            tipo_op = TipoOperacion.objects.filter(codigo_interno='ND_COMPRA').first()
        if not tipo_op:
            tipo_op = TipoOperacion.objects.filter(naturaleza='AJUSTE_VALOR', es_interna=False).first()
    else:
        tipo_op = TipoOperacion.objects.filter(codigo_interno='COMPRA').first()
        if not tipo_op:
            tipo_op = TipoOperacion.objects.filter(naturaleza='ENTRADA', es_interna=False).first()

    # 10. Crear Documento en BORRADOR estricto
    documento = Documento.objects.create(
        empresa_id=empresa_id,
        clase='COMPRA',
        periodo=periodo,
        tercero=tercero,
        ruc_emisor=ruc_emisor,
        tipo_comprobante=tipo_comp,
        serie=serie_raw,
        serie_normalizada=serie_norm,
        numero=num_raw,
        numero_normalizado=num_norm,
        fecha_emision=fecha_emision,
        moneda_codigo=moneda,
        tipo_cambio=tipo_cambio,
        fecha_tc=fecha_tc,
        monto_tc=monto_tc,
        fuente_tc=fuente_tc,
        subtotal=subtotal,
        igv=igv,
        total=total,
        documento_origen=documento_origen,
        origen_captura=captura.tipo,
        estado='BORRADOR',
        estado_revision='PENDIENTE',
        creado_por=usuario,
    )

    incidencias_creadas: List[Dict[str, Any]] = []

    if tipo_comp.es_nota and not documento_origen:
        inc_origen = Incidencia.objects.create(
            empresa_id=empresa_id,
            periodo=periodo,
            documento=documento,
            producto=None,
            tipo='DOCUMENTO_ORIGEN_PENDIENTE',
            severidad='ADVERTENCIA',
            bloquea_cierre=True,
            estado='PENDIENTE',
            descripcion=(
                f"La Nota {serie_norm}-{num_norm} del proveedor {tercero.razon_social} "
                f"no tiene comprobante de origen vinculado. Debe asociarse antes de confirmar."
            ),
            detalle={'captura_id': captura.id, 'referencia': cabecera.get('doc_modificado', '')},
        )
        incidencias_creadas.append({
            'incidencia_id': inc_origen.id,
            'tipo': 'DOCUMENTO_ORIGEN_PENDIENTE',
        })

    from apps.documentos.services import obtener_porcentaje_credito_fiscal
    porcentaje_cf = obtener_porcentaje_credito_fiscal(empresa_id, periodo)

    # 11. Crear Líneas de DocumentoDetalle
    for index, (linea_num, line_fields) in enumerate(sorted(detalles.items()), start=1):
        cod_ext = (line_fields.get('codigo_externo') or '').strip()
        desc_ext = (line_fields.get('descripcion') or '').strip()
        und_ext = (line_fields.get('unidad_medida') or 'NIU').strip()

        cant = parse_dec(line_fields.get('cantidad', '1.0'), default=DECIMAL_UNO)
        precio = parse_dec(line_fields.get('precio_unitario', '0.0'), default=DECIMAL_CERO)
        val_linea = parse_dec(line_fields.get('valor_total', str(cant * precio)), default=cant * precio)

        # Buscar homologación en ProductoEquivalencia
        equiv = None
        if cod_ext:
            equiv = ProductoEquivalencia.objects.filter(
                empresa_id=empresa_id,
                tercero=tercero,
                codigo_externo__iexact=cod_ext,
                activa=True,
                confirmado_por__isnull=False,
            ).select_related('producto_unidad__producto', 'producto_unidad__unidad_codigo').first()

        if not equiv and desc_ext:
            equiv = ProductoEquivalencia.objects.filter(
                empresa_id=empresa_id,
                tercero=tercero,
                descripcion_externa__iexact=desc_ext,
                activa=True,
                confirmado_por__isnull=False,
            ).select_related('producto_unidad__producto', 'producto_unidad__unidad_codigo').first()

        if equiv is not None:
            prod = equiv.producto_unidad.producto
            prod_und = equiv.producto_unidad
            factor = equiv.factor_conversion
            cant_base = (cant * factor).quantize(Q8, rounding=ROUND_HALF_UP)
            tiene_homologacion = True
        else:
            prod = None
            prod_und = None
            factor = DECIMAL_UNO
            cant_base = cant
            tiene_homologacion = False

        igv_linea = (val_linea * Decimal('0.18')).quantize(Q8, rounding=ROUND_HALF_UP)

        # Cálculo de Costo Unitario PEN (C-04: factor de empaque, moneda USD e IGV no recuperable)
        valor_linea_calc = cant * precio
        porcentaje_no_recup = (Decimal('100.0000') - porcentaje_cf) / Decimal('100.0000')
        igv_no_recuperable = igv_linea * porcentaje_no_recup
        costo_linea_doc = valor_linea_calc + igv_no_recuperable

        if moneda.codigo == 'USD' and monto_tc:
            costo_linea_pen = costo_linea_doc * monto_tc
        else:
            costo_linea_pen = costo_linea_doc

        if cant_base > DECIMAL_CERO:
            costo_unitario_pen = (costo_linea_pen / cant_base).quantize(Q8, rounding=ROUND_HALF_UP)
        else:
            costo_unitario_pen = DECIMAL_CERO

        det = DocumentoDetalle.objects.create(
            documento=documento,
            linea=index,
            producto=prod,
            producto_unidad=prod_und,
            almacen=almacen,
            tipo_operacion=tipo_op,
            afecta_kardex_aplicado=True,
            equivalencia=equiv,
            descripcion_original=desc_ext or (prod.descripcion if prod else f'Ítem {index}'),
            cantidad_original=cant,
            factor_conversion=factor,
            cantidad_base=cant_base,
            precio_unitario=precio,
            igv=igv_linea,
            porcentaje_credito_fiscal_aplicado=porcentaje_cf,
            costo_unitario_pen=costo_unitario_pen,
            es_bonificacion=False,
        )

        if not tiene_homologacion:
            # Regla: Registrar Incidencia bloqueante 'PRODUCTO_SIN_HOMOLOGAR'
            inc = Incidencia.objects.create(
                empresa_id=empresa_id,
                periodo=periodo,
                documento=documento,
                documento_detalle=det,
                producto=None,
                tipo='PRODUCTO_SIN_HOMOLOGAR',
                severidad='ADVERTENCIA',
                bloquea_cierre=True,
                estado='PENDIENTE',
                descripcion=(
                    f"Línea #{det.linea} ({cod_ext or desc_ext}) del proveedor {tercero.razon_social} "
                    f"no cuenta con equivalencia confirmada en ProductoEquivalencia."
                ),
                detalle={
                    'documento_id': documento.id,
                    'documento_detalle_id': det.id,
                    'linea': det.linea,
                    'tercero_id': tercero.id,
                    'codigo_externo': cod_ext,
                    'descripcion_externa': desc_ext,
                    'unidad_externa': und_ext,
                    'cantidad': str(cant),
                    'precio_unitario': str(precio),
                },
            )
            incidencias_creadas.append({
                'incidencia_id': inc.id,
                'linea': det.linea,
                'codigo_externo': cod_ext,
                'descripcion': desc_ext,
            })

    # Vincular captura con el documento y actualizar estado
    captura.documento = documento
    captura.estado_proceso = 'BORRADOR_GENERADO'
    captura.save(update_fields=['documento', 'estado_proceso'])

    registrar_auditoria(
        empresa_id=empresa_id,
        usuario_id=usuario.id,
        accion='GENERAR_BORRADOR_DESDE_CAPTURA',
        entidad='DOCUMENTO',
        registro_id=documento.id,
        valor_anterior=None,
        valor_nuevo={
            'captura_id': captura.id,
            'estado': documento.estado,
            'lineas_totales': len(detalles),
            'lineas_sin_homologar': len(incidencias_creadas),
        },
    )

    return {
        'documento_id': documento.id,
        'serie_numero': f"{documento.serie_normalizada}-{documento.numero_normalizado}",
        'estado': documento.estado,
        'estado_revision': documento.estado_revision,
        'total_lineas': len(detalles),
        'lineas_sin_homologar': len(incidencias_creadas),
        'incidencias': incidencias_creadas,
        'mensaje': 'Comprobante borrador generado exitosamente en estado BORRADOR y PENDIENTE.',
    }
