from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Max
from rest_framework.exceptions import ValidationError

from apps.auditoria.services import registrar_auditoria
from apps.catalogos.models import TipoOperacion
from apps.empresas.models import ConfigEmpresa
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
    secuencia = Movimiento.objects.filter(
        empresa_id=empresa_id, producto_id=producto_id, fecha_movimiento=fecha,
        prioridad_dia=prioridad,
    ).aggregate(valor=Max('secuencia'))['valor'] or 0
    movimiento = Movimiento.objects.create(
        empresa_id=empresa_id, producto_id=producto_id, almacen_id=almacen_id,
        periodo=periodo, documento_detalle=documento_detalle,
        movimiento_origen=movimiento_origen, movimiento_extornado=movimiento_extornado,
        tipo_operacion=tipo_operacion, fecha_movimiento=fecha, prioridad_dia=prioridad,
        secuencia=secuencia + 1, naturaleza=naturaleza, cantidad_base=cantidad,
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
    return movimiento


@transaction.atomic
def ejecutar_recalculo_producto(*, empresa_id, producto_id, fecha_desde, usuario_id=None):
    _saldo(empresa_id, producto_id)
    version = (Recalculo.objects.filter(empresa_id=empresa_id, producto_id=producto_id).aggregate(
        valor=Max('version'),
    )['valor'] or 0) + 1
    recalculo = Recalculo.objects.create(
        empresa_id=empresa_id, producto_id=producto_id, fecha_desde=fecha_desde,
        version=version, estado='EN_PROCESO', ejecutado_por_id=usuario_id,
    )
    cantidad = ZERO
    valor = ZERO
    stocks = {}
    movimientos = Movimiento.objects.filter(
        empresa_id=empresa_id, producto_id=producto_id,
    ).select_related('tipo_operacion').order_by('fecha_movimiento', 'prioridad_dia', 'secuencia', 'id')
    for movimiento in movimientos:
        anterior = getattr(movimiento, 'valorizacion', None)
        cpp_vigente = cpp(valor, cantidad)
        if movimiento.naturaleza == 'ENTRADA':
            costo = anterior.costo_unitario_pen if anterior else ZERO
            movimiento_valor = q8(movimiento.cantidad_base * costo)
            cantidad = q8(cantidad + movimiento.cantidad_base); valor = q8(valor + movimiento_valor)
            stocks[movimiento.almacen_id] = stocks.get(movimiento.almacen_id, ZERO) + movimiento.cantidad_base
        elif movimiento.naturaleza == 'SALIDA':
            costo = anterior.costo_unitario_pen if movimiento.movimiento_origen_id and anterior else cpp_vigente
            movimiento_valor = q8(movimiento.cantidad_base * costo)
            cantidad = q8(cantidad - movimiento.cantidad_base); valor = q8(valor - movimiento_valor)
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
    saldo.ultimo_movimiento=movimientos.last(); saldo.save()
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
    if documento.periodo.estado != 'ABIERTO':
        raise ValidationError({'periodo': 'El período debe estar ABIERTO.'})
    productos = set()
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
            importe = q8((detalle.precio_unitario or ZERO) * (documento.monto_tc or Decimal('1')))
            valor_ajuste = -abs(importe) if documento.tipo_comprobante.efecto_nota == 'CREDITO' else abs(importe)
        aplicar_movimiento(
            empresa_id=empresa_id, producto_id=detalle.producto_id,
            almacen_id=detalle.almacen_id, periodo=documento.periodo,
            tipo_operacion=detalle.tipo_operacion, fecha=documento.fecha_emision,
            cantidad=cantidad, usuario_id=usuario_id, costo_unitario=costo,
            valor_ajuste=valor_ajuste, documento_detalle=detalle, movimiento_origen=origen,
        )
        productos.add(detalle.producto_id)
    documento.estado='CONFIRMADO'; documento.confirmado_por_id=usuario_id; documento.confirmado_en=timezone.now()
    documento.save(update_fields=['estado', 'confirmado_por', 'confirmado_en'])
    for producto_id in productos:
        if Movimiento.objects.filter(
            empresa_id=empresa_id, producto_id=producto_id,
            fecha_movimiento__gt=documento.fecha_emision,
        ).exists():
            ejecutar_recalculo_producto(
                empresa_id=empresa_id, producto_id=producto_id,
                fecha_desde=documento.fecha_emision, usuario_id=usuario_id,
            )
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
    if documento.periodo.estado != 'ABIERTO':
        _incidencia(empresa_id=empresa_id, periodo_id=documento.periodo_id,
                    tipo='ANULACION_PERIODO_CERRADO', documento_id=documento.id,
                    descripcion='Se intentó anular un documento de período cerrado.')
        raise ValidationError({'periodo': 'No se puede anular directamente en un período CERRADO.'})
    if documento.estado == 'CONFIRMADO':
        for original in Movimiento.objects.filter(
            empresa_id=empresa_id, documento_detalle__documento=documento,
        ).select_related('tipo_operacion', 'valorizacion'):
            tipo = TipoOperacion.objects.filter(
                naturaleza='SALIDA' if original.naturaleza == 'ENTRADA' else 'ENTRADA',
                origen_requerido='MOV_EXTORNADO', activo=True,
            ).first()
            if tipo is None:
                raise ValidationError({'tipo_operacion': 'Falta el tipo de operación de extorno.'})
            aplicar_movimiento(
                empresa_id=empresa_id, producto_id=original.producto_id,
                almacen_id=original.almacen_id, periodo=documento.periodo,
                tipo_operacion=tipo, fecha=documento.fecha_emision,
                cantidad=original.cantidad_base, usuario_id=usuario_id,
                costo_unitario=original.valorizacion.costo_unitario_pen,
                valor_ajuste=-(original.valor_ajuste_pen or ZERO), es_extorno=True,
                movimiento_extornado=original,
            )
    documento.estado='ANULADO'; documento.save(update_fields=['estado'])
    registrar_auditoria(empresa_id, usuario_id, 'ANULAR', 'DOCUMENTO', documento.id,
                        {'estado': 'CONFIRMADO'}, {'estado': 'ANULADO'}, motivo)
    return documento
