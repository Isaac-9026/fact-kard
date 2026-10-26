from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from rest_framework.exceptions import ValidationError

from apps.empresas.models import CierrePeriodo, ConfigEmpresa, Empresa, Establecimiento, Periodo
from apps.inventario.models import Producto
from apps.kardex.models import Movimiento, ValorizacionMovimiento
from apps.reportes.saldos_corte import q8, saldos_al_corte, valores_por_establecimiento


ZERO = Decimal('0.00000000')


def texto_decimal(valor):
    return format(q8(valor), '.8f')


def validar_filtros_formato(*, empresa_id, periodo_id, establecimiento_id=None, producto_id=None):
    if not periodo_id:
        raise ValidationError({'periodo_id': 'Este parámetro es obligatorio.'})
    periodo = Periodo.objects.filter(pk=periodo_id, empresa_id=empresa_id).first()
    if not periodo:
        raise ValidationError({'periodo_id': 'El período no pertenece a la empresa activa.'})
    establecimiento = None
    if establecimiento_id:
        establecimiento = Establecimiento.objects.filter(
            pk=establecimiento_id, empresa_id=empresa_id,
        ).first()
        if not establecimiento:
            raise ValidationError({'establecimiento_id': 'El establecimiento no pertenece a la empresa activa.'})
    producto = None
    if producto_id:
        producto = Producto.objects.filter(pk=producto_id, empresa_id=empresa_id).first()
        if not producto:
            raise ValidationError({'producto_id': 'El producto no pertenece a la empresa activa.'})
    return periodo, establecimiento, producto


def _documento_sunat(movimiento):
    # BE-005: el extorno se reporta con el comprobante del movimiento que anula.
    if movimiento.movimiento_extornado_id and movimiento.movimiento_extornado:
        return _documento_sunat(movimiento.movimiento_extornado)
    if movimiento.documento_detalle_id:
        documento = movimiento.documento_detalle.documento
        return {
            'tipo_documento': documento.tipo_comprobante.codigo_sunat,
            'serie': documento.serie_normalizada or documento.serie or '',
            'numero': documento.numero_normalizado or documento.numero or '',
        }
    if movimiento.nota_interna_detalle_id:
        identificador = movimiento.nota_interna_detalle.nota_interna_id
        return {'tipo_documento': '00', 'serie': 'NI', 'numero': str(identificador)}
    if movimiento.transferencia_detalle_id or movimiento.transferencia_id:
        identificador = movimiento.transferencia_id or movimiento.transferencia_detalle.transferencia_id
        return {'tipo_documento': '00', 'serie': 'TR', 'numero': str(identificador)}
    if movimiento.saldo_inicial_id:
        return {'tipo_documento': '00', 'serie': 'SI', 'numero': str(movimiento.saldo_inicial_id)}
    return {'tipo_documento': '00', 'serie': 'MOV', 'numero': str(movimiento.id)}


def _cantidad_anterior(*, empresa_id, producto_id, establecimiento_id, fecha_inicio):
    movimientos = Movimiento.objects.filter(
        empresa_id=empresa_id,
        producto_id=producto_id,
        almacen__establecimiento_id=establecimiento_id,
        fecha_movimiento__lt=fecha_inicio,
    ).values_list('naturaleza', 'cantidad_base')
    saldo = ZERO
    for naturaleza, cantidad in movimientos:
        if naturaleza == 'ENTRADA':
            saldo += cantidad
        elif naturaleza == 'SALIDA':
            saldo -= cantidad
    return q8(saldo)


def _cpp_historico(*, empresa_id, producto_id, fecha_inicio=None, fecha_fin=None):
    """
    CON-010: CPP global (empresa + producto) de la última valorización en el orden
    oficial anterior a fecha_inicio, o hasta fecha_fin inclusive. Nunca usa
    SaldoCppActual, que refleja operaciones posteriores al período.
    """
    qs = ValorizacionMovimiento.objects.filter(
        movimiento__empresa_id=empresa_id, movimiento__producto_id=producto_id,
    )
    if fecha_inicio is not None:
        qs = qs.filter(movimiento__fecha_movimiento__lt=fecha_inicio)
    if fecha_fin is not None:
        qs = qs.filter(movimiento__fecha_movimiento__lte=fecha_fin)
    ultima = qs.order_by(
        '-movimiento__fecha_movimiento', '-movimiento__prioridad_dia',
        '-movimiento__secuencia', '-movimiento__id',
    ).first()
    return q8(ultima.cpp_empresa if ultima else ZERO)


def _valor_establecimiento(empresa_id, producto_id, establecimiento_id, corte, *, defecto):
    """Parte del saldo real de la empresa que corresponde al establecimiento al corte."""
    estado = saldos_al_corte(empresa_id, corte, producto_id).get(producto_id)
    if estado is None:
        return defecto
    return valores_por_establecimiento(empresa_id, estado).get(establecimiento_id, defecto)


def _periodo_anterior(periodo):
    return Periodo.objects.filter(
        empresa_id=periodo.empresa_id, orden__lt=periodo.orden,
    ).order_by('-orden').first()


def generar_formato_131(*, empresa_id, periodo_id, establecimiento_id=None, producto_id=None):
    periodo, establecimiento, producto = validar_filtros_formato(
        empresa_id=empresa_id,
        periodo_id=periodo_id,
        establecimiento_id=establecimiento_id,
        producto_id=producto_id,
    )
    empresa = Empresa.objects.get(pk=empresa_id)
    config = ConfigEmpresa.objects.filter(empresa_id=empresa_id).first()
    metodo_config = config.metodo_valuacion if config else 'CPP'
    metodo = 'PROMEDIO PONDERADO (CPP)' if metodo_config == 'CPP' else metodo_config

    movimientos = Movimiento.objects.filter(
        empresa_id=empresa_id,
        periodo_id=periodo.id,
        fecha_movimiento__gte=periodo.fecha_inicio,
        fecha_movimiento__lte=periodo.fecha_fin,
    ).select_related(
        'almacen__establecimiento', 'producto__tipo_existencia_codigo',
        'tipo_operacion', 'valorizacion',
        'documento_detalle__documento__tipo_comprobante',
        'nota_interna_detalle__nota_interna',
        'transferencia_detalle__transferencia',
        'movimiento_extornado__tipo_operacion',
        'movimiento_extornado__documento_detalle__documento__tipo_comprobante',
    )
    if establecimiento:
        movimientos = movimientos.filter(almacen__establecimiento_id=establecimiento.id)
    if producto:
        movimientos = movimientos.filter(producto_id=producto.id)
    movimientos = movimientos.order_by(
        'fecha_movimiento', 'prioridad_dia', 'secuencia', 'id',
    )

    agrupados = defaultdict(list)
    for movimiento in movimientos:
        agrupados[(movimiento.almacen.establecimiento_id, movimiento.producto_id)].append(movimiento)

    # Identificar productos que tienen saldo anterior en establecimientos aunque no hayan tenido movimientos en el mes
    from apps.kardex.models import StockAlmacen
    stocks_qs = StockAlmacen.objects.filter(empresa_id=empresa_id).select_related('almacen')
    if establecimiento:
        stocks_qs = stocks_qs.filter(almacen__establecimiento_id=establecimiento.id)
    if producto:
        stocks_qs = stocks_qs.filter(producto_id=producto.id)

    pares_conocidos = set(agrupados.keys())
    for st in stocks_qs:
        par = (st.almacen.establecimiento_id, st.producto_id)
        if par not in pares_conocidos:
            cant_ant = _cantidad_anterior(
                empresa_id=empresa_id,
                producto_id=st.producto_id,
                establecimiento_id=st.almacen.establecimiento_id,
                fecha_inicio=periodo.fecha_inicio,
            )
            if cant_ant != ZERO:
                agrupados[par] = []
                pares_conocidos.add(par)

    cierre = CierrePeriodo.objects.filter(periodo_id=periodo.id, vigente=True).prefetch_related('detalles').first()
    cierre_detalles = {
        (detalle.establecimiento_id, detalle.producto_id): detalle
        for detalle in cierre.detalles.all()
    } if cierre else {}

    # CON-010: el saldo inicial valorizado coincide con el cierre vigente del período anterior si existe.
    anterior = _periodo_anterior(periodo)
    cierre_anterior = CierrePeriodo.objects.filter(
        periodo_id=anterior.id, vigente=True,
    ).prefetch_related('detalles').first() if anterior else None
    detalles_cierre_anterior = {
        (detalle.establecimiento_id, detalle.producto_id): detalle
        for detalle in cierre_anterior.detalles.all()
    } if cierre_anterior else {}

    reportes = []
    for (estab_id, prod_id), movimientos_grupo in sorted(
        agrupados.items(), key=lambda item: (
            item[1][0].almacen.establecimiento.codigo_sunat if item[1] else Establecimiento.objects.get(pk=item[0][0]).codigo_sunat,
            item[1][0].producto.codigo_interno if item[1] else Producto.objects.get(pk=item[0][1]).codigo_interno,
        ),
    ):
        if movimientos_grupo:
            prod = movimientos_grupo[0].producto
            estab = movimientos_grupo[0].almacen.establecimiento
        else:
            prod = Producto.objects.select_related('tipo_existencia_codigo').get(pk=prod_id)
            estab = Establecimiento.objects.get(pk=estab_id)

        unidad_base = prod.unidades.select_related('unidad_codigo').filter(es_base=True).first()
        if not unidad_base:
            raise ValidationError({'producto_id': f'El producto {prod.codigo_interno} no tiene unidad base.'})
        saldo_inicial_cantidad = _cantidad_anterior(
            empresa_id=empresa_id,
            producto_id=prod_id,
            establecimiento_id=estab_id,
            fecha_inicio=periodo.fecha_inicio,
        )
        saldo_fisico = saldo_inicial_cantidad
        # CON-010: CPP histórico al inicio del período (no SaldoCppActual).
        cpp_inicial = _cpp_historico(empresa_id=empresa_id, producto_id=prod_id, fecha_inicio=periodo.fecha_inicio)
        detalle_inicial = detalles_cierre_anterior.get((estab_id, prod_id))
        if detalle_inicial is not None and q8(detalle_inicial.saldo_cantidad) == saldo_inicial_cantidad:
            costo_total_inicial = q8(detalle_inicial.saldo_valor_pen)
        else:
            # Bloque 4: sin cierre previo, el valor del establecimiento es su parte del saldo
            # real de la empresa (cantidad × CPP con el redondeo asignado como en el cierre).
            costo_total_inicial = _valor_establecimiento(
                empresa_id, prod_id, estab_id, periodo.fecha_inicio - timedelta(days=1),
                defecto=q8(saldo_inicial_cantidad * cpp_inicial),
            )
        saldo_inicial_valorizado = {
            'cantidad': texto_decimal(saldo_inicial_cantidad),
            'costo_unitario': texto_decimal(cpp_inicial),
            'costo_total': texto_decimal(costo_total_inicial),
        }
        cpp_global = cpp_inicial
        filas = []
        for movimiento in movimientos_grupo:
            valorizacion = getattr(movimiento, 'valorizacion', None)
            costo_unitario = q8(
                valorizacion.costo_unitario_pen if valorizacion and valorizacion.costo_unitario_pen is not None
                else valorizacion.cpp_empresa if valorizacion else ZERO
            )
            valor_movimiento = q8(
                valorizacion.valor_movimiento_pen if valorizacion and valorizacion.valor_movimiento_pen is not None
                else movimiento.valor_ajuste_pen
            )
            cpp_global = q8(valorizacion.cpp_empresa if valorizacion else costo_unitario)
            entrada = salida = None
            if movimiento.naturaleza == 'ENTRADA':
                saldo_fisico = q8(saldo_fisico + movimiento.cantidad_base)
                entrada = {
                    'cantidad': texto_decimal(movimiento.cantidad_base),
                    'costo_unitario': texto_decimal(costo_unitario),
                    'costo_total': texto_decimal(valor_movimiento),
                }
            elif movimiento.naturaleza == 'SALIDA':
                saldo_fisico = q8(saldo_fisico - movimiento.cantidad_base)
                salida = {
                    'cantidad': texto_decimal(movimiento.cantidad_base),
                    'costo_unitario': texto_decimal(costo_unitario),
                    'costo_total': texto_decimal(valor_movimiento),
                }
            elif movimiento.naturaleza == 'AJUSTE_VALOR':
                bloque = {'cantidad': texto_decimal(ZERO), 'costo_unitario': texto_decimal(ZERO), 'costo_total': texto_decimal(abs(valor_movimiento))}
                entrada = bloque if valor_movimiento >= ZERO else None
                salida = bloque if valor_movimiento < ZERO else None

            filas.append({
                'movimiento_id': movimiento.id,
                'fecha_emision': movimiento.fecha_movimiento.isoformat(),
                'documento': _documento_sunat(movimiento),
                'tipo_operacion': movimiento.tipo_operacion.codigo_sunat or '',
                'tipo_operacion_interno': movimiento.tipo_operacion.codigo_interno,
                'es_extorno': movimiento.es_extorno,
                'movimiento_extornado_id': movimiento.movimiento_extornado_id,
                'operacion_extornada': (
                    movimiento.movimiento_extornado.tipo_operacion.codigo_interno
                    if movimiento.movimiento_extornado_id and movimiento.movimiento_extornado else None
                ),
                'entrada': entrada,
                'salida': salida,
                'saldo_final': {
                    'cantidad': texto_decimal(saldo_fisico),
                    'costo_unitario': texto_decimal(cpp_global),
                    'costo_total': texto_decimal(saldo_fisico * cpp_global),
                },
                'orden': {
                    'prioridad_dia': movimiento.prioridad_dia,
                    'secuencia': movimiento.secuencia,
                },
            })

        # CON-010 / Bloque 4: el CPP al cierre del período es el histórico global a la fecha
        # fin; otros establecimientos pueden haberlo movido después del último movimiento
        # propio, así que no se toma el de la última fila.
        cpp_fin = _cpp_historico(empresa_id=empresa_id, producto_id=prod_id, fecha_fin=periodo.fecha_fin)
        if not filas and cpp_fin == cpp_inicial:
            # Bloque 3: sin movimientos y sin cambio de CPP el saldo final es exactamente el
            # inicial valorizado (no se reconstruye como cantidad × CPP).
            saldo_final_resumen = dict(saldo_inicial_valorizado)
        else:
            saldo_final_resumen = {
                'cantidad': texto_decimal(saldo_fisico),
                'costo_unitario': texto_decimal(cpp_fin),
                'costo_total': texto_decimal(saldo_fisico * cpp_fin),
            }

        microdiferencia = ZERO
        calculado = q8(Decimal(saldo_final_resumen['costo_total']))
        detalle_cierre = cierre_detalles.get((estab_id, prod_id))
        if detalle_cierre:
            oficial = q8(detalle_cierre.saldo_valor_pen)
            fuente_saldo_final = 'CIERRE'
        else:
            # Bloque 4: período sin cierre → misma regla que el cierre: la suma de los
            # establecimientos es exactamente el saldo real de la empresa.
            oficial = _valor_establecimiento(empresa_id, prod_id, estab_id, periodo.fecha_fin, defecto=calculado)
            fuente_saldo_final = 'CALCULADO'
        microdiferencia = q8(oficial - calculado)
        # El saldo final informado coincide con el saldo oficial (cierre o empresa).
        saldo_final_resumen['costo_total'] = texto_decimal(oficial)

        reportes.append({
            'cabecera': {
                'establecimiento': {'id': estab.id, 'codigo_sunat': estab.codigo_sunat, 'nombre': estab.nombre},
                'producto_id': prod.id,
                'codigo_existencia': prod.codigo_interno,
                'tipo_existencia': {
                    'codigo': prod.tipo_existencia_codigo_id,
                    'descripcion': prod.tipo_existencia_codigo.descripcion,
                },
                'descripcion_existencia': prod.descripcion,
                'unidad_medida': {
                    'codigo': unidad_base.unidad_codigo_id,
                    'descripcion': unidad_base.unidad_codigo.descripcion,
                },
                'metodo_valuacion': metodo,
            },
            'saldo_inicial': texto_decimal(saldo_inicial_cantidad),
            'saldo_inicial_valorizado': saldo_inicial_valorizado,
            'saldo_final': saldo_final_resumen,
            'movimientos': filas,
            'microdiferencia_cierre': texto_decimal(microdiferencia),
            # CIERRE: snapshot oficial; CALCULADO: reparto del saldo real de la empresa.
            'fuente_saldo_final': fuente_saldo_final,
        })

    return {
        'periodo': f'{periodo.anio:04d}-{periodo.mes:02d}',
        'periodo_id': periodo.id,
        'estado_periodo': periodo.estado,
        'empresa': {'ruc': empresa.ruc, 'razon_social': empresa.razon_social},
        'fuente_cierre': {
            'cierre_id': cierre.id,
            'version': cierre.version_calculo,
            'hash': cierre.hash_resultado,
        } if cierre else None,
        'reportes': reportes,
    }
