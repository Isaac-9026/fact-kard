from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.auditoria.services import registrar_auditoria
from apps.catalogos.models import TipoCambio, TipoComprobante, TipoOperacion, Moneda
from apps.documentos.models import Documento, DocumentoDetalle
from apps.empresas.models import Empresa, Periodo, ConfigIgvPeriodo
from apps.inventario.models import Almacen, Producto, ProductoUnidad, Tercero, ProductoEquivalencia


def normalizar_serie(serie: Optional[str]) -> str:
    """Normaliza la serie: mayúsculas y sin espacios."""
    if not serie:
        return ""
    return serie.strip().upper()


def normalizar_numero(numero: Optional[str]) -> str:
    """Normaliza el número: sin espacios y removiendo ceros a la izquierda."""
    if not numero:
        return "0"
    limpio = numero.strip().lstrip('0')
    return limpio if limpio else "0"


def resolver_tipo_cambio_usd(fecha_emision: date) -> TipoCambio:
    """
    Resuelve el tipo de cambio venta oficial para USD a la fecha de emisión
    o el último publicado anterior o igual (fin de semana o feriado).
    """
    tc = (
        TipoCambio.objects.filter(
            moneda_codigo='USD',
            fecha_publicacion__lte=fecha_emision
        )
        .order_by('-fecha_publicacion', '-id')
        .first()
    )
    if not tc or tc.venta is None:
        raise ValidationError(
            f"No existe tipo de cambio registrado para USD a la fecha {fecha_emision.isoformat()} ni en fechas anteriores."
        )
    return tc


def obtener_porcentaje_credito_fiscal(empresa_id: int, periodo: Periodo) -> Decimal:
    """
    Obtiene el porcentaje de crédito fiscal recuperable del período.
    TOTAL: 100%
    NULO: 0%
    PRORRATA: porcentaje_recuperable configurado
    Si no existe configuración para el período, se asume TOTAL (100%).
    """
    config = ConfigIgvPeriodo.objects.filter(empresa_id=empresa_id, periodo=periodo).first()
    if not config:
        return Decimal('100.0000')

    metodo = config.metodo.upper()
    if metodo == 'TOTAL':
        return Decimal('100.0000')
    elif metodo == 'NULO':
        return Decimal('0.0000')
    elif metodo == 'PRORRATA':
        return config.porcentaje_recuperable
    return Decimal('100.0000')


def validar_duplicado_documento(
    empresa_id: int,
    ruc_emisor: str,
    tipo_comprobante_id: int,
    serie_normalizada: str,
    numero_normalizado: str,
    excluir_id: Optional[int] = None
) -> None:
    """Verifica la clave lógica de comprobante único para la empresa."""
    qs = Documento.objects.filter(
        empresa_id=empresa_id,
        ruc_emisor=ruc_emisor,
        tipo_comprobante_id=tipo_comprobante_id,
        serie_normalizada=serie_normalizada,
        numero_normalizado=numero_normalizado,
    )
    if excluir_id:
        qs = qs.exclude(id=excluir_id)

    if qs.exists():
        raise ValidationError(
            f"Ya existe un comprobante registrado con RUC emisor '{ruc_emisor}', "
            f"serie '{serie_normalizada}' y número '{numero_normalizado}'."
        )


@transaction.atomic
def crear_documento(
    empresa_id: int,
    usuario_id: int,
    datos_cabecera: Dict[str, Any],
    detalles_datos: List[Dict[str, Any]]
) -> Documento:
    """
    Crea un comprobante comercial (Documento) y sus líneas de detalle (DocumentoDetalle)
    aplicando todas las reglas de dominio, normalización y cálculos contables oficiales.
    """
    empresa = Empresa.objects.get(id=empresa_id)

    # 1. Validar Período
    periodo_val = datos_cabecera.get('periodo') or datos_cabecera.get('periodo_id')
    if isinstance(periodo_val, Periodo):
        periodo = periodo_val
        if periodo.empresa_id != empresa_id:
            raise ValidationError({'periodo': 'El período seleccionado no pertenece a la empresa activa.'})
    else:
        try:
            periodo = Periodo.objects.get(id=periodo_val, empresa_id=empresa_id)
        except Periodo.DoesNotExist:
            raise ValidationError({'periodo': 'El período seleccionado no existe o no pertenece a la empresa activa.'})

    if periodo.estado == 'CERRADO':
        raise ValidationError({'periodo': 'No se pueden registrar comprobantes en un período CERRADO.'})

    # 2. Validar Clase
    clase = datos_cabecera.get('clase', '').upper()
    if clase not in ('COMPRA', 'VENTA'):
        raise ValidationError({'clase': "La clase debe ser 'COMPRA' o 'VENTA'."})

    # 3. Validar Tercero
    tercero = None
    tercero_val = datos_cabecera.get('tercero') or datos_cabecera.get('tercero_id')
    if isinstance(tercero_val, Tercero):
        tercero = tercero_val
        if tercero.empresa_id != empresa_id:
            raise ValidationError({'tercero': 'El tercero seleccionado no pertenece a la empresa activa.'})
    elif tercero_val:
        try:
            tercero = Tercero.objects.get(id=tercero_val, empresa_id=empresa_id)
        except Tercero.DoesNotExist:
            raise ValidationError({'tercero': 'El tercero seleccionado no existe o no pertenece a la empresa activa.'})

    # 4. RUC Emisor según clase
    if clase == 'VENTA':
        ruc_emisor = empresa.ruc
    else:
        ruc_input = datos_cabecera.get('ruc_emisor')
        if ruc_input:
            ruc_emisor = ruc_input.strip()
        elif tercero:
            ruc_emisor = tercero.numero_documento.strip()
        else:
            raise ValidationError({'ruc_emisor': 'Debe especificar el RUC del emisor para una compra.'})

    if len(ruc_emisor) != 11:
        raise ValidationError({'ruc_emisor': f"El RUC del emisor debe tener exactamente 11 dígitos (recibido: '{ruc_emisor}')."})

    # 5. Tipo de Comprobante
    tipo_comp_val = datos_cabecera.get('tipo_comprobante') or datos_cabecera.get('tipo_comprobante_id')
    if isinstance(tipo_comp_val, TipoComprobante):
        tipo_comprobante = tipo_comp_val
    else:
        try:
            tipo_comprobante = TipoComprobante.objects.get(id=tipo_comp_val)
        except TipoComprobante.DoesNotExist:
            raise ValidationError({'tipo_comprobante': 'El tipo de comprobante seleccionado no existe.'})

    # 6. Normalización de Serie y Número
    serie = datos_cabecera.get('serie', '')
    numero = datos_cabecera.get('numero', '')
    serie_normalizada = normalizar_serie(serie)
    numero_normalizado = normalizar_numero(numero)

    if not serie_normalizada:
        raise ValidationError({'serie': 'La serie del comprobante es obligatoria.'})
    if not numero_normalizado or numero_normalizado == '0':
        raise ValidationError({'numero': 'El número del comprobante es obligatorio y debe ser mayor a 0.'})

    # Validar duplicados
    validar_duplicado_documento(
        empresa_id=empresa_id,
        ruc_emisor=ruc_emisor,
        tipo_comprobante_id=tipo_comprobante.id,
        serie_normalizada=serie_normalizada,
        numero_normalizado=numero_normalizado
    )

    # 7. Documento Origen (obligatorio si es nota)
    documento_origen = None
    doc_origen_val = datos_cabecera.get('documento_origen') or datos_cabecera.get('documento_origen_id')
    if isinstance(doc_origen_val, Documento):
        documento_origen = doc_origen_val
        if documento_origen.empresa_id != empresa_id:
            raise ValidationError({'documento_origen': 'El documento de origen no pertenece a la empresa activa.'})
    elif doc_origen_val:
        try:
            documento_origen = Documento.objects.get(id=doc_origen_val, empresa_id=empresa_id)
        except Documento.DoesNotExist:
            raise ValidationError({'documento_origen': 'El documento de origen no existe o no pertenece a la empresa activa.'})

    if tipo_comprobante.es_nota and not documento_origen:
        raise ValidationError({'documento_origen': 'Las Notas de Crédito o Débito deben estar vinculadas a un documento de origen.'})

    # 8. Moneda y Tipo de Cambio
    moneda_raw = datos_cabecera.get('moneda_codigo')
    if isinstance(moneda_raw, Moneda):
        moneda_codigo = moneda_raw.codigo
    elif isinstance(moneda_raw, dict):
        moneda_codigo = moneda_raw.get('codigo', 'PEN')
    else:
        moneda_codigo = str(moneda_raw or 'PEN').strip().upper()

    try:
        moneda = Moneda.objects.get(codigo=moneda_codigo)
    except Moneda.DoesNotExist:
        raise ValidationError({'moneda_codigo': f"La moneda '{moneda_codigo}' no está registrada en el sistema."})

    fecha_emision = datos_cabecera.get('fecha_emision')
    if isinstance(fecha_emision, str):
        fecha_emision = date.fromisoformat(fecha_emision)

    if not fecha_emision:
        raise ValidationError({'fecha_emision': 'La fecha de emisión es obligatoria.'})

    if not (periodo.fecha_inicio <= fecha_emision <= periodo.fecha_fin):
        raise ValidationError({
            'fecha_emision': (
                f"La fecha de emisión ({fecha_emision}) no corresponde al rango del período "
                f"contable seleccionado ({periodo.fecha_inicio} al {periodo.fecha_fin})."
            )
        })

    tipo_cambio = None
    fecha_tc = None
    monto_tc = None
    fuente_tc = None

    if moneda_codigo == 'PEN':
        tipo_cambio = None
        fecha_tc = None
        monto_tc = None
        fuente_tc = None
    elif moneda_codigo == 'USD':
        if tipo_comprobante.es_nota and documento_origen:
            # Regla contable: Copiar obligatoriamente el TC del documento original
            tipo_cambio = documento_origen.tipo_cambio
            fecha_tc = documento_origen.fecha_tc
            monto_tc = documento_origen.monto_tc
            fuente_tc = documento_origen.fuente_tc
        else:
            # Resolver TC venta SBS para compras/ventas regulares en USD
            tc = resolver_tipo_cambio_usd(fecha_emision)
            tipo_cambio = tc
            fecha_tc = tc.fecha_publicacion
            monto_tc = tc.venta
            fuente_tc = tc.fuente

    # 9. Crear Cabecera del Documento
    documento = Documento.objects.create(
        empresa_id=empresa_id,
        clase=clase,
        periodo=periodo,
        tercero=tercero,
        ruc_emisor=ruc_emisor,
        tipo_comprobante=tipo_comprobante,
        serie=serie.strip() if serie else None,
        serie_normalizada=serie_normalizada,
        numero=numero.strip() if numero else None,
        numero_normalizado=numero_normalizado,
        fecha_emision=fecha_emision,
        moneda_codigo=moneda,
        tipo_cambio=tipo_cambio,
        fecha_tc=fecha_tc,
        monto_tc=monto_tc,
        fuente_tc=fuente_tc,
        subtotal=Decimal('0.00000000'),
        igv=Decimal('0.00000000'),
        total=Decimal('0.00000000'),
        documento_origen=documento_origen,
        origen_captura=datos_cabecera.get('origen_captura', 'MANUAL'),
        estado='BORRADOR',
        estado_revision='PENDIENTE',
        creado_por_id=usuario_id
    )

    # 10. Procesar y Guardar Líneas de Detalle
    if not detalles_datos:
        raise ValidationError({'detalles': 'El comprobante debe contener al menos una línea de detalle.'})

    porcentaje_cf = obtener_porcentaje_credito_fiscal(empresa_id, periodo)

    subtotal_acum = Decimal('0.00000000')
    igv_acum = Decimal('0.00000000')

    for idx, linea_data in enumerate(detalles_datos, start=1):
        linea_num = linea_data.get('linea') or idx

        # Almacén
        almacen_val = linea_data.get('almacen') or linea_data.get('almacen_id')
        if isinstance(almacen_val, Almacen):
            almacen = almacen_val
            if almacen.empresa_id != empresa_id:
                raise ValidationError({'detalles': f"Línea {linea_num}: El almacén no pertenece a la empresa activa."})
        else:
            try:
                almacen = Almacen.objects.get(id=almacen_val, empresa_id=empresa_id)
            except Almacen.DoesNotExist:
                raise ValidationError({'detalles': f"Línea {linea_num}: El almacén no existe o no pertenece a la empresa activa."})

        # Tipo de Operación
        tipo_op_val = linea_data.get('tipo_operacion') or linea_data.get('tipo_operacion_id')
        if isinstance(tipo_op_val, TipoOperacion):
            tipo_op = tipo_op_val
        else:
            try:
                tipo_op = TipoOperacion.objects.get(id=tipo_op_val)
            except TipoOperacion.DoesNotExist:
                raise ValidationError({'detalles': f"Línea {linea_num}: El tipo de operación no existe."})

        # A-05: Validar tipo de operación contra clase y si es nota
        if tipo_comprobante.es_nota:
            if tipo_op.naturaleza not in ('AJUSTE_VALOR', 'ENTRADA', 'SALIDA'):
                raise ValidationError({'detalles': f"Línea {linea_num}: La operación '{tipo_op.codigo_interno}' no es válida para comprobantes de tipo Nota."})
        elif clase == 'COMPRA':
            if tipo_op.naturaleza != 'ENTRADA':
                raise ValidationError({'detalles': f"Línea {linea_num}: Un comprobante de compra debe usar una operación de naturaleza ENTRADA."})
        elif clase == 'VENTA':
            if tipo_op.naturaleza != 'SALIDA':
                raise ValidationError({'detalles': f"Línea {linea_num}: Un comprobante de venta debe usar una operación de naturaleza SALIDA."})

        # Producto y Unidad
        producto = None
        prod_val = linea_data.get('producto') or linea_data.get('producto_id')
        if isinstance(prod_val, Producto):
            producto = prod_val
            if producto.empresa_id != empresa_id:
                raise ValidationError({'detalles': f"Línea {linea_num}: El producto no pertenece a la empresa activa."})
        elif prod_val:
            try:
                producto = Producto.objects.get(id=prod_val, empresa_id=empresa_id)
            except Producto.DoesNotExist:
                raise ValidationError({'detalles': f"Línea {linea_num}: El producto no existe o no pertenece a la empresa activa."})

        producto_unidad = None
        pu_val = linea_data.get('producto_unidad') or linea_data.get('producto_unidad_id')
        if isinstance(pu_val, ProductoUnidad):
            producto_unidad = pu_val
        elif pu_val:
            try:
                producto_unidad = ProductoUnidad.objects.get(id=pu_val)
            except ProductoUnidad.DoesNotExist:
                raise ValidationError({'detalles': f"Línea {linea_num}: La unidad de producto no existe."})

        if producto and producto_unidad and producto_unidad.producto_id != producto.id:
            raise ValidationError(
                {'detalles': f"Línea {linea_num}: La unidad {producto_unidad.unidad_codigo_id} no pertenece al producto {producto.codigo_interno}."}
            )

        # Factor de conversión y cantidades
        cantidad_original_raw = linea_data.get('cantidad_original')
        cantidad_original = Decimal(str(cantidad_original_raw)) if cantidad_original_raw is not None else Decimal('0.00000000')

        if cantidad_original < Decimal('0'):
            raise ValidationError({'detalles': f"Línea {linea_num}: La cantidad original no puede ser negativa."})

        if producto_unidad:
            factor_conversion = producto_unidad.factor_a_base
        else:
            fc_raw = linea_data.get('factor_conversion')
            factor_conversion = Decimal(str(fc_raw)) if fc_raw else Decimal('1.00000000')

        cantidad_base = (cantidad_original * factor_conversion).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
        cantidad_base = cantidad_base.quantize(Decimal('0.00000001'))

        # Precios e IGV
        precio_unit_raw = linea_data.get('precio_unitario')
        precio_unitario = Decimal(str(precio_unit_raw)) if precio_unit_raw is not None else Decimal('0.00000000')

        igv_linea_raw = linea_data.get('igv')
        igv_linea = Decimal(str(igv_linea_raw)) if igv_linea_raw is not None else Decimal('0.00000000')

        es_bonificacion = bool(linea_data.get('es_bonificacion', False))

        # Cálculo de Costo Unitario PEN
        costo_unitario_pen = None
        if es_bonificacion:
            costo_unitario_pen = Decimal('0.00000000')
        elif clase == 'COMPRA':
            # Valor sin IGV de la línea
            valor_linea = precio_unitario * cantidad_original

            # Porción de IGV no recuperable que se suma al costo
            porcentaje_no_recup = (Decimal('100.0000') - porcentaje_cf) / Decimal('100.0000')
            igv_no_recuperable = igv_linea * porcentaje_no_recup

            costo_linea_doc = valor_linea + igv_no_recuperable

            if moneda_codigo == 'USD':
                costo_linea_pen = costo_linea_doc * monto_tc
            else:
                costo_linea_pen = costo_linea_doc

            if cantidad_base > Decimal('0'):
                costo_unitario_pen = (costo_linea_pen / cantidad_base).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
            else:
                costo_unitario_pen = Decimal('0.00000000')

        # Detalle de Origen (para notas)
        detalle_origen = None
        det_origen_val = linea_data.get('detalle_origen') or linea_data.get('detalle_origen_id')
        if isinstance(det_origen_val, DocumentoDetalle):
            detalle_origen = det_origen_val
        elif det_origen_val:
            try:
                detalle_origen = DocumentoDetalle.objects.get(id=det_origen_val)
            except DocumentoDetalle.DoesNotExist:
                raise ValidationError({'detalles': f"Línea {linea_num}: El detalle de origen no existe."})

        if detalle_origen and documento_origen and detalle_origen.documento_id != documento_origen.id:
            raise ValidationError(
                {'detalles': f"Línea {linea_num}: La línea de origen #{detalle_origen.linea} no pertenece al documento de origen #{documento_origen.id}."}
            )

        # Equivalencia
        equivalencia = None
        equiv_val = linea_data.get('equivalencia') or linea_data.get('equivalencia_id')
        if isinstance(equiv_val, ProductoEquivalencia):
            equivalencia = equiv_val
            if equivalencia.empresa_id != empresa_id:
                raise ValidationError({'detalles': f"Línea {linea_num}: La equivalencia no pertenece a la empresa activa."})
        elif equiv_val:
            try:
                equivalencia = ProductoEquivalencia.objects.get(id=equiv_val, empresa_id=empresa_id)
            except ProductoEquivalencia.DoesNotExist:
                raise ValidationError({'detalles': f"Línea {linea_num}: La equivalencia no existe o no pertenece a la empresa activa."})

        # Crear línea
        DocumentoDetalle.objects.create(
            documento=documento,
            linea=linea_num,
            producto=producto,
            producto_unidad=producto_unidad,
            almacen=almacen,
            tipo_operacion=tipo_op,
            afecta_kardex_aplicado=tipo_op.afecta_kardex,
            equivalencia=equivalencia,
            descripcion_original=linea_data.get('descripcion_original'),
            cantidad_original=cantidad_original,
            factor_conversion=factor_conversion,
            cantidad_base=cantidad_base,
            precio_unitario=precio_unitario,
            igv=igv_linea,
            porcentaje_credito_fiscal_aplicado=porcentaje_cf,
            costo_unitario_pen=costo_unitario_pen,
            es_bonificacion=es_bonificacion,
            detalle_origen=detalle_origen
        )

        subtotal_acum += (precio_unitario * cantidad_original)
        igv_acum += igv_linea

    # Actualizar totales en la cabecera
    total_acum = subtotal_acum + igv_acum
    documento.subtotal = subtotal_acum.quantize(Decimal('0.00000001'))
    documento.igv = igv_acum.quantize(Decimal('0.00000001'))
    documento.total = total_acum.quantize(Decimal('0.00000001'))
    documento.save(update_fields=['subtotal', 'igv', 'total'])

    registrar_auditoria(
        empresa_id=empresa_id,
        usuario_id=usuario_id,
        accion='CREAR',
        entidad='DOCUMENTO',
        registro_id=documento.id,
        valor_nuevo={
            'clase': documento.clase,
            'comprobante': f"{documento.serie_normalizada}-{documento.numero_normalizado}",
            'ruc_emisor': documento.ruc_emisor,
            'total': str(documento.total),
            'moneda': documento.moneda_codigo_id
        },
        motivo="Creación de documento en borrador"
    )

    return documento


@transaction.atomic
def revisar_documento(
    documento_id: int,
    empresa_id: int,
    usuario_id: int,
    nuevo_estado_revision: str,
    motivo: Optional[str] = None
) -> Documento:
    """
    Actualiza el estado de revisión de un comprobante (PENDIENTE, EN_REVISION, REVISADO, OBSERVADO)
    y registra la auditoría inmutable correspondiente.
    """
    try:
        doc = Documento.objects.get(id=documento_id, empresa_id=empresa_id)
    except Documento.DoesNotExist:
        raise ValidationError({'detail': 'El documento no existe o no pertenece a la empresa activa.'})

    estados_validos = ('PENDIENTE', 'EN_REVISION', 'REVISADO', 'OBSERVADO')
    if nuevo_estado_revision not in estados_validos:
        raise ValidationError({'estado_revision': f"Estado de revisión inválido. Debe ser uno de {estados_validos}."})

    estado_anterior = doc.estado_revision
    doc.estado_revision = nuevo_estado_revision
    doc.revisado_por_id = usuario_id
    doc.revisado_en = timezone.now()
    doc.save(update_fields=['estado_revision', 'revisado_por', 'revisado_en'])

    registrar_auditoria(
        empresa_id=empresa_id,
        usuario_id=usuario_id,
        accion='ACTUALIZAR',
        entidad='DOCUMENTO',
        registro_id=doc.id,
        valor_anterior={'estado_revision': estado_anterior},
        valor_nuevo={'estado_revision': nuevo_estado_revision},
        motivo=motivo or f"Cambio de estado de revisión de {estado_anterior} a {nuevo_estado_revision}"
    )

    return doc


@transaction.atomic
def confirmar_documento_validacion(
    documento_id: int,
    empresa_id: int,
    usuario_id: int
) -> Documento:
    """
    Valida las condiciones estrictas para confirmar un comprobante comercial:
    - Período NO debe estar CERRADO.
    - Estado de revisión DEBE ser 'REVISADO'.
    - Estado documental DEBE ser 'BORRADOR'.
    """
    from apps.kardex.services import confirmar_documento_motor
    return confirmar_documento_motor(
        documento_id=documento_id, empresa_id=empresa_id, usuario_id=usuario_id,
    )


@transaction.atomic
def anular_documento(
    documento_id: int,
    empresa_id: int,
    usuario_id: int,
    motivo: str
) -> Documento:
    """Anula un documento en borrador o confirmado."""
    from apps.kardex.services import anular_documento_motor
    return anular_documento_motor(
        documento_id=documento_id, empresa_id=empresa_id, usuario_id=usuario_id,
        motivo=motivo,
    )
