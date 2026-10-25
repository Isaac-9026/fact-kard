from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Max, Q
from rest_framework.exceptions import ValidationError

from apps.auditoria.services import registrar_auditoria
from apps.catalogos.models import TipoOperacion
from apps.empresas.models import ConfigEmpresa, Periodo
from apps.kardex.models import (
    Incidencia, Movimiento, Recalculo, RecalculoDetalle, SaldoCppActual,
    StockAlmacen, ValorizacionMovimiento,
)

Q8 = Decimal('0.00000001')
Q6 = Decimal('0.000001')
ZERO = Decimal('0.00000000')


def q8(value):
    return Decimal(value).quantize(Q8, rounding=ROUND_HALF_UP)


def cpp(value, quantity):
    return ZERO if quantity == ZERO else (value / quantity).quantize(Q6, rounding=ROUND_HALF_UP)


def siguiente_secuencia_movimiento(*, empresa_id, producto_id, fecha_movimiento, prioridad_dia):
    ultima = Movimiento.objects.filter(
        empresa_id=empresa_id,
        producto_id=producto_id,
        fecha_movimiento=fecha_movimiento,
        prioridad_dia=prioridad_dia,
    ).aggregate(valor=Max('secuencia'))['valor']
    return (ultima or 0) + 1


def hay_movimientos_posteriores(movimiento):
    """Indica si el movimiento quedó antes de otro en el orden oficial del Kardex."""
    posteriores = Movimiento.objects.filter(
        empresa_id=movimiento.empresa_id,
        producto_id=movimiento.producto_id,
    )
    if movimiento.transferencia_id:
        posteriores = posteriores.exclude(transferencia_id=movimiento.transferencia_id)
    return posteriores.filter(
        Q(fecha_movimiento__gt=movimiento.fecha_movimiento)
        | Q(
            fecha_movimiento=movimiento.fecha_movimiento,
            prioridad_dia__gt=movimiento.prioridad_dia,
        )
        | Q(
            fecha_movimiento=movimiento.fecha_movimiento,
            prioridad_dia=movimiento.prioridad_dia,
            secuencia__gt=movimiento.secuencia,
        )
        | Q(
            fecha_movimiento=movimiento.fecha_movimiento,
            prioridad_dia=movimiento.prioridad_dia,
            secuencia=movimiento.secuencia,
            id__gt=movimiento.id,
        )
    ).exists()


def _saldo(empresa_id, producto_id):
    saldo = SaldoCppActual.objects.select_for_update().filter(
        empresa_id=empresa_id, producto_id=producto_id,
    ).first()
    return saldo or SaldoCppActual.objects.create(
        empresa_id=empresa_id, producto_id=producto_id,
        cantidad_total=ZERO, valor_total_pen=ZERO, cpp_pen=ZERO,
    )


def _stock(empresa_id, almacen_id, producto_id):
    stock = StockAlmacen.objects.select_for_update().filter(
        empresa_id=empresa_id, almacen_id=almacen_id, producto_id=producto_id,
    ).first()
    return stock or StockAlmacen.objects.create(
        empresa_id=empresa_id, almacen_id=almacen_id,
        producto_id=producto_id, cantidad_actual=ZERO,
    )


def _incidencia(**kwargs):
    tipo = kwargs['tipo']
    filtros = {key: kwargs.get(key) for key in ('empresa_id', 'periodo_id', 'producto_id', 'movimiento_id')}
    filtros.update(tipo=tipo, estado='PENDIENTE')
    return Incidencia.objects.get_or_create(
        **filtros,
        defaults={
            'severidad': kwargs.get('severidad', 'ERROR'),
            'bloquea_cierre': True,
            'descripcion': kwargs['descripcion'],
            'detalle': kwargs.get('detalle'),
            'documento_id': kwargs.get('documento_id'),
            'documento_detalle_id': kwargs.get('documento_detalle_id'),
        },
    )[0]


def _residuo(saldo, movimiento, periodo):
    if saldo.cantidad_total != ZERO or saldo.valor_total_pen == ZERO:
        return
    tolerancia = ConfigEmpresa.objects.filter(empresa_id=saldo.empresa_id).values_list(
        'tolerancia_residuo_pen', flat=True,
    ).first() or Decimal('0.05000000')
    if abs(saldo.valor_total_pen) > tolerancia:
        _incidencia(
            empresa_id=saldo.empresa_id, periodo_id=periodo.id, producto_id=saldo.producto_id,
            movimiento_id=movimiento.id, tipo='RESIDUO_VALORIZACION',
            descripcion='El residuo de valorización supera la tolerancia configurada.',
            detalle={'residuo': str(saldo.valor_total_pen), 'tolerancia': str(tolerancia)},
        )
        saldo.cpp_pen = ZERO
        return
    tipo = TipoOperacion.objects.get(codigo_interno='RESIDUO_AUTOMATICO')
    ajuste = Movimiento.objects.create(
        empresa_id=saldo.empresa_id, producto_id=saldo.producto_id,
        almacen_id=movimiento.almacen_id, periodo=periodo, tipo_operacion=tipo,
        fecha_movimiento=movimiento.fecha_movimiento, prioridad_dia=3,
        naturaleza='AJUSTE_VALOR', cantidad_base=ZERO,
        valor_ajuste_pen=-saldo.valor_total_pen, generado_por_motor=True,
        creado_por_id=movimiento.creado_por_id,
    )
    ValorizacionMovimiento.objects.create(
        movimiento=ajuste, costo_unitario_pen=ZERO,
        valor_movimiento_pen=-saldo.valor_total_pen,
        saldo_cantidad_empresa=ZERO, saldo_valor_empresa=ZERO, cpp_empresa=ZERO,
    )
    saldo.valor_total_pen = ZERO
    saldo.cpp_pen = ZERO
    saldo.ultimo_movimiento = ajuste


@transaction.atomic
def aplicar_movimiento(*, empresa_id, producto_id, almacen_id, periodo, tipo_operacion,
                       fecha, cantidad, usuario_id, costo_unitario=None, valor_ajuste=None,
                       documento_detalle=None, movimiento_origen=None, es_extorno=False,
                       movimiento_extornado=None):
    cantidad = q8(cantidad)
    saldo = _saldo(empresa_id, producto_id)
    stock = _stock(empresa_id, almacen_id, producto_id)
    naturaleza = tipo_operacion.naturaleza
    costo = q8(costo_unitario if costo_unitario is not None else (saldo.cpp_pen or ZERO))
    valor = q8(valor_ajuste if naturaleza == 'AJUSTE_VALOR' else cantidad * costo)
    if naturaleza == 'SALIDA':
        if stock.cantidad_actual < cantidad or saldo.cantidad_total < cantidad:
            raise ValidationError({'stock': 'Stock insuficiente para confirmar el movimiento.'})
        stock.cantidad_actual = q8(stock.cantidad_actual - cantidad)
        saldo.cantidad_total = q8(saldo.cantidad_total - cantidad)
        saldo.valor_total_pen = q8(saldo.valor_total_pen - valor)
        prioridad = 4
    elif naturaleza == 'ENTRADA':
        stock.cantidad_actual = q8(stock.cantidad_actual + cantidad)
        saldo.cantidad_total = q8(saldo.cantidad_total + cantidad)
        saldo.valor_total_pen = q8(saldo.valor_total_pen + valor)
        prioridad = 2
    else:
        saldo.valor_total_pen = q8(saldo.valor_total_pen + valor)
        prioridad = 3
    saldo.cpp_pen = cpp(saldo.valor_total_pen, saldo.cantidad_total)
    secuencia = siguiente_secuencia_movimiento(
        empresa_id=empresa_id,
        producto_id=producto_id,
        fecha_movimiento=fecha,
        prioridad_dia=prioridad,
    )
    movimiento = Movimiento.objects.create(
        empresa_id=empresa_id, producto_id=producto_id, almacen_id=almacen_id,
        periodo=periodo, documento_detalle=documento_detalle,
        movimiento_origen=movimiento_origen, movimiento_extornado=movimiento_extornado,
        tipo_operacion=tipo_operacion, fecha_movimiento=fecha, prioridad_dia=prioridad,
        secuencia=secuencia, naturaleza=naturaleza, cantidad_base=cantidad,
        valor_ajuste_pen=valor if naturaleza == 'AJUSTE_VALOR' else None,
        es_extorno=es_extorno, creado_por_id=usuario_id,
    )
    saldo.ultimo_movimiento = movimiento
    _residuo(saldo, movimiento, periodo)
    if saldo.valor_total_pen < ZERO:
        _incidencia(
            empresa_id=empresa_id, periodo_id=periodo.id, producto_id=producto_id,
            movimiento_id=movimiento.id, tipo='VALOR_INVENTARIO_NEGATIVO',
            descripcion='El valor del inventario resultó negativo.',
            detalle={'valor': str(saldo.valor_total_pen)},
        )
    saldo.save(update_fields=['cantidad_total', 'valor_total_pen', 'cpp_pen', 'ultimo_movimiento', 'actualizado_en'])
    stock.save(update_fields=['cantidad_actual', 'actualizado_en'])
    ValorizacionMovimiento.objects.create(
        movimiento=movimiento, costo_unitario_pen=costo,
        valor_movimiento_pen=valor, saldo_cantidad_empresa=saldo.cantidad_total,
        saldo_valor_empresa=saldo.valor_total_pen, cpp_empresa=saldo.cpp_pen,
    )
    if hay_movimientos_posteriores(movimiento):
        ejecutar_recalculo_producto(
            empresa_id=empresa_id,
            producto_id=producto_id,
            fecha_desde=fecha,
            usuario_id=usuario_id,
        )
    return movimiento


@transaction.atomic
def ejecutar_recalculo_producto(*, empresa_id, producto_id, fecha_desde, usuario_id=None):
    _saldo(empresa_id, producto_id)
    stocks = {}
    movimientos_base = Movimiento.objects.filter(
        empresa_id=empresa_id, producto_id=producto_id,
    ).select_related(
        'tipo_operacion', 'periodo', 'saldo_inicial', 'nota_interna_detalle',
        'movimiento_origen__valorizacion', 'movimiento_extornado__valorizacion',
    ).order_by('fecha_movimiento', 'prioridad_dia', 'secuencia', 'id')

    movimientos_anteriores = list(movimientos_base.filter(fecha_movimiento__lt=fecha_desde))
    movimientos_afectados = list(movimientos_base.filter(fecha_movimiento__gte=fecha_desde))

    # C-03: Prohibir recálculo que altere movimientos o comience en períodos cerrados
    periodos_cerrados = set(
        m.periodo for m in movimientos_afectados if m.periodo and m.periodo.estado == 'CERRADO'
    )
    periodo_desde_cerrado = Periodo.objects.filter(
        empresa_id=empresa_id,
        estado='CERRADO',
        fecha_inicio__lte=fecha_desde,
        fecha_fin__gte=fecha_desde,
    ).first()
    if periodo_desde_cerrado:
        periodos_cerrados.add(periodo_desde_cerrado)

    if periodos_cerrados:
        nombres = ", ".join(f"{p.anio}-{p.mes:02d}" for p in sorted(periodos_cerrados, key=lambda p: (p.anio, p.mes)))
        raise ValidationError({
            'recalculo': f"No se puede recalcular porque afectaría los períodos cerrados: {nombres}. Debe reabrir el período oficialmente antes de recalcular."
        })

    version = (Recalculo.objects.filter(empresa_id=empresa_id, producto_id=producto_id).aggregate(
        valor=Max('version'),
    )['valor'] or 0) + 1
    recalculo = Recalculo.objects.create(
        empresa_id=empresa_id, producto_id=producto_id, fecha_desde=fecha_desde,
        version=version, estado='EN_PROCESO', ejecutado_por_id=usuario_id,
    )

    # Los movimientos anteriores solo reconstruyen el punto de partida. Su
    # valorización es historia consolidada y no debe versionarse nuevamente.
    for movimiento in movimientos_anteriores:
        if movimiento.naturaleza == 'ENTRADA':
            stocks[movimiento.almacen_id] = q8(
                stocks.get(movimiento.almacen_id, ZERO) + movimiento.cantidad_base,
            )
        elif movimiento.naturaleza == 'SALIDA':
            stocks[movimiento.almacen_id] = q8(
                stocks.get(movimiento.almacen_id, ZERO) - movimiento.cantidad_base,
            )

    if movimientos_anteriores:
        valorizacion_previa = getattr(movimientos_anteriores[-1], 'valorizacion', None)
        if valorizacion_previa is None:
            raise ValidationError({
                'recalculo': 'El último movimiento anterior a fecha_desde no tiene valorización.',
            })
        cantidad = q8(valorizacion_previa.saldo_cantidad_empresa or ZERO)
        valor = q8(valorizacion_previa.saldo_valor_empresa or ZERO)
    else:
        cantidad = ZERO
        valor = ZERO

    for movimiento in movimientos_afectados:
        anterior = getattr(movimiento, 'valorizacion', None)
        cpp_vigente = cpp(valor, cantidad)
        if movimiento.transferencia_id:
            # Una transferencia solo redistribuye stock entre almacenes. Sus dos
            # movimientos conservan el mismo costo histórico y no alteran el
            # saldo ni el CPP global de empresa + producto.
            costo = anterior.costo_unitario_pen if anterior else cpp_vigente
            movimiento_valor = q8(movimiento.cantidad_base * costo)
            delta_stock = movimiento.cantidad_base if movimiento.naturaleza == 'ENTRADA' else -movimiento.cantidad_base
            stocks[movimiento.almacen_id] = q8(stocks.get(movimiento.almacen_id, ZERO) + delta_stock)
            if stocks[movimiento.almacen_id] < ZERO:
                _incidencia(empresa_id=empresa_id, periodo_id=movimiento.periodo_id,
                            producto_id=producto_id, movimiento_id=movimiento.id,
                            tipo='STOCK_INSUFICIENTE', descripcion='El recálculo detectó stock negativo posterior.')
        elif movimiento.naturaleza == 'ENTRADA':
            if movimiento.saldo_inicial_id and movimiento.saldo_inicial:
                movimiento_valor = q8(movimiento.saldo_inicial.valor_total_pen)
                costo = cpp(movimiento_valor, movimiento.cantidad_base)
            elif movimiento.movimiento_origen_id and movimiento.movimiento_origen and hasattr(movimiento.movimiento_origen, 'valorizacion'):
                costo = q8(movimiento.movimiento_origen.valorizacion.costo_unitario_pen)
                movimiento_valor = q8(movimiento.cantidad_base * costo)
            else:
                costo = anterior.costo_unitario_pen if anterior else ZERO
                movimiento_valor = q8(movimiento.cantidad_base * costo)
            cantidad = q8(cantidad + movimiento.cantidad_base)
            valor = q8(valor + movimiento_valor)
            stocks[movimiento.almacen_id] = stocks.get(movimiento.almacen_id, ZERO) + movimiento.cantidad_base
        elif movimiento.naturaleza == 'SALIDA':
            if movimiento.nota_interna_detalle_id and movimiento.nota_interna_detalle.costo_unitario_pen is not None:
                costo = q8(movimiento.nota_interna_detalle.costo_unitario_pen)
            elif (movimiento.movimiento_origen_id or movimiento.es_extorno or movimiento.movimiento_extornado_id) and anterior:
                if movimiento.movimiento_origen_id and movimiento.movimiento_origen and hasattr(movimiento.movimiento_origen, 'valorizacion'):
                    costo = q8(movimiento.movimiento_origen.valorizacion.costo_unitario_pen)
                elif movimiento.movimiento_extornado_id and movimiento.movimiento_extornado and hasattr(movimiento.movimiento_extornado, 'valorizacion'):
                    costo = q8(movimiento.movimiento_extornado.valorizacion.costo_unitario_pen)
                else:
                    costo = anterior.costo_unitario_pen
            else:
                costo = cpp_vigente
            movimiento_valor = q8(movimiento.cantidad_base * costo)
            cantidad = q8(cantidad - movimiento.cantidad_base)
            valor = q8(valor - movimiento_valor)
            stocks[movimiento.almacen_id] = stocks.get(movimiento.almacen_id, ZERO) - movimiento.cantidad_base
            if stocks[movimiento.almacen_id] < ZERO:
                _incidencia(empresa_id=empresa_id, periodo_id=movimiento.periodo_id,
                            producto_id=producto_id, movimiento_id=movimiento.id,
                            tipo='STOCK_INSUFICIENTE', descripcion='El recálculo detectó stock negativo posterior.')
        else:
            costo = ZERO; movimiento_valor = movimiento.valor_ajuste_pen or ZERO; valor = q8(valor + movimiento_valor)
        nuevo_cpp = cpp(valor, cantidad)
        if anterior:
            RecalculoDetalle.objects.create(
                recalculo=recalculo, movimiento=movimiento, cpp_anterior=anterior.cpp_empresa,
                cpp_nuevo=nuevo_cpp, valor_anterior=anterior.valor_movimiento_pen,
                valor_nuevo=movimiento_valor, saldo_anterior=anterior.saldo_valor_empresa,
                saldo_nuevo=valor,
            )
            ValorizacionMovimiento.objects.filter(pk=anterior.pk).update(
                costo_unitario_pen=costo, valor_movimiento_pen=movimiento_valor,
                saldo_cantidad_empresa=cantidad, saldo_valor_empresa=valor,
                cpp_empresa=nuevo_cpp, recalculo=recalculo,
                version_actual=anterior.version_actual + 1,
            )
    saldo = SaldoCppActual.objects.select_for_update().get(empresa_id=empresa_id, producto_id=producto_id)
    saldo.cantidad_total=cantidad; saldo.valor_total_pen=valor; saldo.cpp_pen=cpp(valor, cantidad)
    ultimo_movimiento = (
        movimientos_afectados[-1] if movimientos_afectados
        else movimientos_anteriores[-1] if movimientos_anteriores
        else None
    )
    saldo.ultimo_movimiento=ultimo_movimiento; saldo.save()
    for almacen_id, cantidad_stock in stocks.items():
        StockAlmacen.objects.update_or_create(
            empresa_id=empresa_id, almacen_id=almacen_id, producto_id=producto_id,
            defaults={'cantidad_actual': q8(cantidad_stock)},
        )
    recalculo.estado='OK'; recalculo.save(update_fields=['estado'])
    registrar_auditoria(empresa_id, usuario_id, 'RECALCULAR', 'RECALCULO', recalculo.id,
                        None, {'producto_id': producto_id, 'version': version})
    return recalculo


def validar_cierre_periodo(*, empresa_id, periodo_id):
    if Incidencia.objects.filter(
        empresa_id=empresa_id, periodo_id=periodo_id, bloquea_cierre=True, estado='PENDIENTE',
    ).exists():
        raise ValidationError({'incidencias': 'El período tiene incidencias pendientes que bloquean el cierre.'})
    return True


@transaction.atomic
def confirmar_documento_motor(*, documento_id, empresa_id, usuario_id):
    from django.utils import timezone
    from apps.documentos.models import Documento
    documento = Documento.objects.select_for_update(of=('self',)).select_related(
        'periodo', 'tipo_comprobante', 'documento_origen',
    ).prefetch_related('detalles__tipo_operacion', 'detalles__detalle_origen').filter(
        pk=documento_id, empresa_id=empresa_id,
    ).first()
    if documento is None:
        raise ValidationError({'detail': 'El documento no existe o no pertenece a la empresa activa.'})
    if documento.estado != 'BORRADOR':
        raise ValidationError({'estado': 'Solo puede confirmarse un documento BORRADOR.'})
    if documento.estado_revision != 'REVISADO':
        raise ValidationError({'estado_revision': 'El documento debe estar REVISADO.'})
    # A-04: Bloquear el período con select_for_update para evitar condición de carrera frente al cierre
    periodo = Periodo.objects.select_for_update().get(id=documento.periodo_id, empresa_id=empresa_id)
    if periodo.estado != 'ABIERTO':
        raise ValidationError({'periodo': 'El período debe estar ABIERTO.'})
    for detalle in documento.detalles.all():
        if not detalle.afecta_kardex_aplicado or detalle.producto_id is None:
            continue
        cantidad = detalle.cantidad_base or ZERO
        costo = detalle.costo_unitario_pen
        origen = None
        if detalle.detalle_origen_id:
            origen = Movimiento.objects.filter(
                empresa_id=empresa_id, documento_detalle_id=detalle.detalle_origen_id,
            ).select_related('valorizacion').order_by('id').first()
            if origen is None:
                raise ValidationError({'detalle_origen': 'No existe movimiento histórico para la línea origen.'})
            costo = origen.valorizacion.costo_unitario_pen
        valor_ajuste = None
        if detalle.tipo_operacion.naturaleza == 'AJUSTE_VALOR':
            # A-05: Multiplicar precio por cantidad si existe e incorporar IGV no recuperable
            if detalle.cantidad_original and detalle.cantidad_original > ZERO:
                valor_base = (detalle.precio_unitario or ZERO) * detalle.cantidad_original
            else:
                valor_base = detalle.precio_unitario or ZERO

            porcentaje_cf = detalle.porcentaje_credito_fiscal_aplicado
            if porcentaje_cf is not None and porcentaje_cf < Decimal('100.0000'):
                porcentaje_no_recup = (Decimal('100.0000') - porcentaje_cf) / Decimal('100.0000')
                igv_no_recuperable = (detalle.igv or ZERO) * porcentaje_no_recup
            else:
                igv_no_recuperable = ZERO

            costo_linea_doc = valor_base + igv_no_recuperable
            monto_tc = documento.monto_tc if (documento.moneda_codigo_id == 'USD' and documento.monto_tc) else Decimal('1')
            importe = q8(costo_linea_doc * monto_tc)
            efecto = getattr(documento.tipo_comprobante, 'efecto_nota', 'NINGUNO')
            valor_ajuste = -abs(importe) if efecto == 'CREDITO' else abs(importe)
        aplicar_movimiento(
            empresa_id=empresa_id, producto_id=detalle.producto_id,
            almacen_id=detalle.almacen_id, periodo=documento.periodo,
            tipo_operacion=detalle.tipo_operacion, fecha=documento.fecha_emision,
            cantidad=cantidad, usuario_id=usuario_id, costo_unitario=costo,
            valor_ajuste=valor_ajuste, documento_detalle=detalle, movimiento_origen=origen,
        )
    documento.estado='CONFIRMADO'; documento.confirmado_por_id=usuario_id; documento.confirmado_en=timezone.now()
    documento.save(update_fields=['estado', 'confirmado_por', 'confirmado_en'])
    registrar_auditoria(empresa_id, usuario_id, 'CONFIRMAR', 'DOCUMENTO', documento.id,
                        {'estado': 'BORRADOR'}, {'estado': 'CONFIRMADO'})
    return documento


@transaction.atomic
def anular_documento_motor(*, documento_id, empresa_id, usuario_id, motivo):
    from apps.documentos.models import Documento
    documento = Documento.objects.select_for_update(of=('self',)).select_related('periodo').filter(
        pk=documento_id, empresa_id=empresa_id,
    ).first()
    if documento is None:
        raise ValidationError({'detail': 'El documento no existe o no pertenece a la empresa activa.'})
    periodo = Periodo.objects.select_for_update().get(id=documento.periodo_id, empresa_id=empresa_id)
    if periodo.estado != 'ABIERTO':
        _incidencia(empresa_id=empresa_id, periodo_id=documento.periodo_id,
                    tipo='ANULACION_PERIODO_CERRADO', documento_id=documento.id,
                    descripcion='Se intentó anular un documento de período cerrado.')
        raise ValidationError({'periodo': 'No se puede anular directamente en un período CERRADO.'})
    if documento.estado == 'CONFIRMADO':
        for original in Movimiento.objects.filter(
            empresa_id=empresa_id, documento_detalle__documento=documento,
        ).select_related('tipo_operacion', 'valorizacion'):
            if original.naturaleza == 'AJUSTE_VALOR':
                tipo = TipoOperacion.objects.filter(
                    naturaleza='AJUSTE_VALOR', activo=True,
                ).filter(
                    Q(origen_requerido='MOV_EXTORNADO') | Q(id=original.tipo_operacion_id)
                ).first() or original.tipo_operacion
                monto_ajuste_original = original.valor_ajuste_pen
                if monto_ajuste_original is None and hasattr(original, 'valorizacion'):
                    monto_ajuste_original = original.valorizacion.valor_movimiento_pen
                aplicar_movimiento(
                    empresa_id=empresa_id, producto_id=original.producto_id,
                    almacen_id=original.almacen_id, periodo=documento.periodo,
                    tipo_operacion=tipo, fecha=documento.fecha_emision,
                    cantidad=ZERO, usuario_id=usuario_id,
                    costo_unitario=ZERO,
                    valor_ajuste=-(monto_ajuste_original or ZERO), es_extorno=True,
                    movimiento_extornado=original,
                )
            else:
                tipo = TipoOperacion.objects.filter(
                    naturaleza='SALIDA' if original.naturaleza == 'ENTRADA' else 'ENTRADA',
                    origen_requerido='MOV_EXTORNADO', activo=True,
                ).first()
                if tipo is None:
                    tipo = TipoOperacion.objects.filter(
                        naturaleza='SALIDA' if original.naturaleza == 'ENTRADA' else 'ENTRADA',
                        activo=True,
                    ).first()
                if tipo is None:
                    raise ValidationError({'tipo_operacion': 'Falta el tipo de operación de extorno.'})
                aplicar_movimiento(
                    empresa_id=empresa_id, producto_id=original.producto_id,
                    almacen_id=original.almacen_id, periodo=documento.periodo,
                    tipo_operacion=tipo, fecha=documento.fecha_emision,
                    cantidad=original.cantidad_base, usuario_id=usuario_id,
                    costo_unitario=original.valorizacion.costo_unitario_pen,
                    valor_ajuste=None, es_extorno=True,
                    movimiento_extornado=original,
                )
    documento.estado='ANULADO'; documento.save(update_fields=['estado'])
    registrar_auditoria(empresa_id, usuario_id, 'ANULAR', 'DOCUMENTO', documento.id,
                        {'estado': 'CONFIRMADO'}, {'estado': 'ANULADO'}, motivo)
    return documento
