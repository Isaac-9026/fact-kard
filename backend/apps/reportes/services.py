from decimal import Decimal, ROUND_HALF_UP
from django.db.models import Q, Sum

from apps.kardex.models import Movimiento, SaldoCppActual, StockAlmacen
from apps.empresas.models import Empresa, Periodo
from apps.inventario.models import Producto, Almacen
from apps.catalogos.models import TipoOperacion

DECIMAL_ZERO = Decimal('0.00000000')


def obtener_documento_referencia(movimiento):
    """
    Retorna la serie-número o código representativo del documento origen del movimiento.
    """
    if movimiento.documento_detalle_id and movimiento.documento_detalle:
        doc = getattr(movimiento.documento_detalle, 'documento', None)
        if doc:
            tc = getattr(doc, 'tipo_comprobante', None)
            tc_cod = getattr(tc, 'codigo_sunat', None) or (str(doc.tipo_comprobante_id) if doc.tipo_comprobante_id else '')
            serie = doc.serie_normalizada or doc.serie or ''
            num = doc.numero_normalizado or doc.numero or ''
            ref = f"{serie}-{num}".strip('-')
            if tc_cod and ref:
                return f"{tc_cod} {ref}"
            return ref or f"DOC-{doc.id}"

    if movimiento.nota_interna_detalle_id and movimiento.nota_interna_detalle:
        ni = getattr(movimiento.nota_interna_detalle, 'nota_interna', None)
        if ni:
            return f"NI-{ni.id:06d}"

    if movimiento.transferencia_detalle_id and movimiento.transferencia_detalle:
        tr = getattr(movimiento.transferencia_detalle, 'transferencia', None)
        if tr:
            return f"TR-{tr.id:06d}"

    if movimiento.transferencia_id:
        return f"TR-{movimiento.transferencia_id:06d}"

    if movimiento.saldo_inicial_id:
        return f"SI-{movimiento.saldo_inicial_id:06d}"

    return f"MOV-{movimiento.id}"


def consultar_kardex_valorizado(
    empresa_id: int,
    producto_id: int = None,
    periodo_id: int = None,
    almacen_id: int = None,
    tipo_operacion_id: int = None,
    fecha_desde: str = None,
    fecha_hasta: str = None
):
    """
    Consulta oficial del Kardex Valorizado bajo el orden cronológico estricto del motor:
    (fecha_movimiento, prioridad_dia, secuencia, id).
    Aplica filtros oficiales y calcula totales de entradas, salidas y saldos.
    """
    qs = Movimiento.objects.filter(empresa_id=empresa_id).select_related(
        'valorizacion',
        'tipo_operacion',
        'almacen',
        'producto',
        'documento_detalle__documento__tipo_comprobante',
        'nota_interna_detalle__nota_interna',
        'transferencia_detalle__transferencia',
        'transferencia',
        'saldo_inicial',
    )

    if periodo_id:
        qs = qs.filter(periodo_id=periodo_id)
    if producto_id:
        qs = qs.filter(producto_id=producto_id)
    if almacen_id:
        qs = qs.filter(almacen_id=almacen_id)
    if tipo_operacion_id:
        qs = qs.filter(tipo_operacion_id=tipo_operacion_id)
    if fecha_desde:
        qs = qs.filter(fecha_movimiento__gte=fecha_desde)
    if fecha_hasta:
        qs = qs.filter(fecha_movimiento__lte=fecha_hasta)

    # Orden cronológico oficial del motor Kardex
    qs = qs.order_by('fecha_movimiento', 'prioridad_dia', 'secuencia', 'id')

    filas = []
    total_entradas_cant = DECIMAL_ZERO
    total_entradas_val = DECIMAL_ZERO
    total_salidas_cant = DECIMAL_ZERO
    total_salidas_val = DECIMAL_ZERO

    # Seguimiento del saldo progresivo acumulado por producto
    saldos_acumulados = {}

    for mov in qs:
        val = getattr(mov, 'valorizacion', None)
        val_costo = val.costo_unitario_pen if (val and val.costo_unitario_pen is not None) else None
        val_total = val.valor_movimiento_pen if (val and val.valor_movimiento_pen is not None) else None
        val_cpp = val.cpp_empresa if (val and val.cpp_empresa is not None) else None

        doc_ref = obtener_documento_referencia(mov)
        tipo_op_cod = (mov.tipo_operacion.codigo_sunat or mov.tipo_operacion.codigo_interno) if mov.tipo_operacion else ''
        tipo_op_desc = mov.tipo_operacion.descripcion if mov.tipo_operacion else ''
        almacen_cod = mov.almacen.codigo if mov.almacen else ''
        almacen_nom = mov.almacen.nombre if mov.almacen else ''

        entrada_cant = None
        entrada_costo = None
        entrada_val = None
        salida_cant = None
        salida_costo = None
        salida_val = None

        if mov.naturaleza == 'ENTRADA':
            entrada_cant = mov.cantidad_base
            entrada_costo = val_costo if val_costo is not None else DECIMAL_ZERO
            entrada_val = val_total if val_total is not None else DECIMAL_ZERO
            total_entradas_cant += entrada_cant
            total_entradas_val += entrada_val

        elif mov.naturaleza == 'SALIDA':
            salida_cant = mov.cantidad_base
            salida_costo = val_costo if val_costo is not None else DECIMAL_ZERO
            salida_val = val_total if val_total is not None else DECIMAL_ZERO
            total_salidas_cant += salida_cant
            total_salidas_val += salida_val

        elif mov.naturaleza == 'AJUSTE_VALOR':
            adj = val_total if val_total is not None else (mov.valor_ajuste_pen or DECIMAL_ZERO)
            if adj >= Decimal('0'):
                entrada_cant = DECIMAL_ZERO
                entrada_costo = DECIMAL_ZERO
                entrada_val = abs(adj)
                total_entradas_val += entrada_val
            else:
                salida_cant = DECIMAL_ZERO
                salida_costo = DECIMAL_ZERO
                salida_val = abs(adj)
                total_salidas_val += salida_val

        # Saldo progresivo acumulado dinámico por producto dentro del alcance consultado
        prod_id = mov.producto_id
        if prod_id not in saldos_acumulados:
            prev_qs = Movimiento.objects.filter(
                empresa_id=empresa_id,
                producto_id=prod_id,
            )
            if almacen_id:
                prev_qs = prev_qs.filter(almacen_id=almacen_id)

            prev_qs = prev_qs.filter(
                Q(fecha_movimiento__lt=mov.fecha_movimiento) |
                Q(fecha_movimiento=mov.fecha_movimiento, prioridad_dia__lt=mov.prioridad_dia) |
                Q(fecha_movimiento=mov.fecha_movimiento, prioridad_dia=mov.prioridad_dia, secuencia__lt=mov.secuencia) |
                Q(fecha_movimiento=mov.fecha_movimiento, prioridad_dia=mov.prioridad_dia, secuencia=mov.secuencia, id__lt=mov.id)
            )
            ent_prev = prev_qs.filter(naturaleza='ENTRADA').aggregate(t=Sum('cantidad_base'))['t'] or DECIMAL_ZERO
            sal_prev = prev_qs.filter(naturaleza='SALIDA').aggregate(t=Sum('cantidad_base'))['t'] or DECIMAL_ZERO
            saldos_acumulados[prod_id] = ent_prev - sal_prev

        if mov.naturaleza == 'ENTRADA':
            saldos_acumulados[prod_id] += mov.cantidad_base
        elif mov.naturaleza == 'SALIDA':
            saldos_acumulados[prod_id] -= mov.cantidad_base

        saldo_cant_progresivo = saldos_acumulados[prod_id]
        cpp_progresivo = val_cpp if val_cpp is not None else (val_costo if val_costo is not None else DECIMAL_ZERO)
        saldo_valor_progresivo = (saldo_cant_progresivo * cpp_progresivo).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)

        fila = {
            'id': mov.id,
            'fecha': mov.fecha_movimiento,
            'documento_referencia': doc_ref,
            'tipo_operacion_codigo': tipo_op_cod,
            'tipo_operacion_descripcion': tipo_op_desc,
            'naturaleza': mov.naturaleza,
            'almacen_codigo': almacen_cod,
            'almacen_nombre': almacen_nom,
            'producto_id': mov.producto_id,
            'producto_codigo': mov.producto.codigo_interno if mov.producto else '',
            'producto_descripcion': mov.producto.descripcion if mov.producto else '',
            'entrada_cantidad': entrada_cant,
            'entrada_costo_unitario': entrada_costo,
            'entrada_valor': entrada_val,
            'salida_cantidad': salida_cant,
            'salida_costo_unitario': salida_costo,
            'salida_valor': salida_val,
            'saldo_cantidad': saldo_cant_progresivo,
            'cpp': cpp_progresivo,
            'saldo_valor': saldo_valor_progresivo,
            'prioridad_dia': mov.prioridad_dia,
            'secuencia': mov.secuencia,
            'es_extorno': mov.es_extorno,
            'generado_por_motor': mov.generado_por_motor,
            'creado_en': mov.creado_en,
        }
        filas.append(fila)

    if filas:
        ultima_fila = filas[-1]
        saldo_final_cantidad = ultima_fila['saldo_cantidad']
        cpp_final = ultima_fila['cpp']
        saldo_final_valor = ultima_fila['saldo_valor']
    else:
        # Si no hay movimientos para el filtro pero se consultó un producto específico
        if producto_id:
            actual = SaldoCppActual.objects.filter(empresa_id=empresa_id, producto_id=producto_id).first()
            if actual:
                saldo_final_cantidad = actual.cantidad_total
                cpp_final = actual.cpp_pen
                saldo_final_valor = actual.valor_total_pen
            else:
                saldo_final_cantidad = DECIMAL_ZERO
                cpp_final = None
                saldo_final_valor = DECIMAL_ZERO
        else:
            saldo_final_cantidad = DECIMAL_ZERO
            cpp_final = None
            saldo_final_valor = DECIMAL_ZERO

    resumen = {
        'total_entradas_cantidad': total_entradas_cant.quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP),
        'total_entradas_valor': total_entradas_val.quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP),
        'total_salidas_cantidad': total_salidas_cant.quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP),
        'total_salidas_valor': total_salidas_val.quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP),
        'saldo_final_cantidad': saldo_final_cantidad.quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP),
        'cpp_final': cpp_final.quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP) if cpp_final is not None else None,
        'saldo_final_valor': saldo_final_valor.quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP),
        'total_registros': len(filas),
    }

    return {
        'empresa_id': empresa_id,
        'filtros': {
            'producto_id': producto_id,
            'periodo_id': periodo_id,
            'almacen_id': almacen_id,
            'tipo_operacion_id': tipo_operacion_id,
            'fecha_desde': fecha_desde,
            'fecha_hasta': fecha_hasta,
        },
        'resumen': resumen,
        'movimientos': filas,
    }
