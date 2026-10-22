import hashlib
import json
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.auditoria.services import registrar_auditoria
from apps.documentos.models import Documento
from apps.empresas.models import CierrePeriodo, CierrePeriodoDetalle, ConfigEmpresa, Periodo
from apps.kardex.models import Incidencia, Movimiento, SaldoCppActual


OCHO_DECIMALES = Decimal('0.00000001')


def _q8(valor):
    return Decimal(valor or 0).quantize(OCHO_DECIMALES, rounding=ROUND_HALF_UP)


def _decimal_texto(valor):
    return format(_q8(valor), '.8f')


def calcular_hash_cierre(snapshot_resumen, detalles):
    ordenados = sorted(
        detalles,
        key=lambda d: (int(d['producto_id']), int(d['establecimiento_id'])),
    )
    contenido = {'resumen': snapshot_resumen, 'detalles': ordenados}
    serializado = json.dumps(contenido, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(serializado.encode('utf-8')).hexdigest()


def _validar_cierre(periodo):
    if periodo.estado == 'CERRADO':
        raise ValidationError({'detail': 'El período ya se encuentra cerrado.'})

    previos = list(Periodo.objects.filter(
        empresa_id=periodo.empresa_id,
        orden__lt=periodo.orden,
        estado__in=['ABIERTO', 'DESACTUALIZADO'],
    ).order_by('orden').values('id', 'anio', 'mes', 'estado'))
    if previos:
        raise ValidationError({'detail': 'Existen períodos anteriores pendientes de cierre.', 'periodos': previos})

    incidencias = list(Incidencia.objects.filter(
        empresa_id=periodo.empresa_id,
        periodo_id=periodo.id,
        bloquea_cierre=True,
        estado='PENDIENTE',
    ).order_by('id').values('id', 'tipo', 'severidad', 'descripcion'))
    if incidencias:
        raise ValidationError({'detail': 'Existen incidencias bloqueantes pendientes.', 'incidencias': incidencias})

    pendientes = Documento.objects.filter(
        empresa_id=periodo.empresa_id,
        periodo_id=periodo.id,
        estado='BORRADOR',
    ).exclude(estado_revision='REVISADO').count()
    advertencias = []
    if pendientes:
        advertencias.append(f'{pendientes} documento(s) permanecen en borrador y sin revisión final.')
    return advertencias


def _construir_snapshot(periodo, fecha_cierre):
    movimientos = Movimiento.objects.filter(
        empresa_id=periodo.empresa_id,
        fecha_movimiento__lte=periodo.fecha_fin,
    ).select_related('almacen', 'valorizacion').order_by(
        'producto_id', 'fecha_movimiento', 'prioridad_dia', 'secuencia', 'id'
    )

    cantidades = defaultdict(Decimal)
    ultimos = {}
    for movimiento in movimientos:
        signo = Decimal('1') if movimiento.naturaleza == 'ENTRADA' else Decimal('-1') if movimiento.naturaleza == 'SALIDA' else Decimal('0')
        cantidades[(movimiento.producto_id, movimiento.almacen.establecimiento_id)] += signo * movimiento.cantidad_base
        if hasattr(movimiento, 'valorizacion'):
            ultimos[movimiento.producto_id] = movimiento.valorizacion

    config = ConfigEmpresa.objects.filter(empresa_id=periodo.empresa_id).first()
    detalles = []
    microdiferencias = []
    for producto_id in sorted(set(ultimos) | {clave[0] for clave in cantidades}):
        valorizacion = ultimos.get(producto_id)
        cantidad_global = _q8(valorizacion.saldo_cantidad_empresa if valorizacion else 0)
        valor_global = _q8(valorizacion.saldo_valor_empresa if valorizacion else 0)
        cpp = _q8(valorizacion.cpp_empresa if valorizacion else 0)
        por_establecimiento = {
            establecimiento_id: _q8(cantidad)
            for (pid, establecimiento_id), cantidad in cantidades.items()
            if pid == producto_id and _q8(cantidad) != 0
        }
        if _q8(sum(por_establecimiento.values(), Decimal('0'))) != cantidad_global:
            raise ValidationError({'detail': f'El saldo físico por establecimiento no concilia para el producto {producto_id}.'})
        filas_producto = []
        for establecimiento_id, cantidad in sorted(por_establecimiento.items()):
            filas_producto.append({
                'producto_id': producto_id,
                'establecimiento_id': establecimiento_id,
                'saldo_cantidad': _decimal_texto(cantidad),
                'saldo_valor_pen': _decimal_texto(cantidad * cpp),
                'cpp_pen': _decimal_texto(cpp),
            })
        diferencia = _q8(valor_global - sum((Decimal(f['saldo_valor_pen']) for f in filas_producto), Decimal('0')))
        if diferencia:
            if not config or not config.establecimiento_principal_id:
                raise ValidationError({'detail': 'Se requiere un establecimiento principal para asignar la microdiferencia del cierre.'})
            fila = next((f for f in filas_producto if f['establecimiento_id'] == config.establecimiento_principal_id), None)
            if fila is None:
                fila = {'producto_id': producto_id, 'establecimiento_id': config.establecimiento_principal_id, 'saldo_cantidad': _decimal_texto(0), 'saldo_valor_pen': _decimal_texto(0), 'cpp_pen': _decimal_texto(cpp)}
                filas_producto.append(fila)
            fila['saldo_valor_pen'] = _decimal_texto(Decimal(fila['saldo_valor_pen']) + diferencia)
            microdiferencias.append({'producto_id': producto_id, 'establecimiento_id': config.establecimiento_principal_id, 'valor_pen': _decimal_texto(diferencia)})
        detalles.extend(filas_producto)

    total_cantidad = sum((Decimal(f['saldo_cantidad']) for f in detalles), Decimal('0'))
    total_valor = sum((Decimal(f['saldo_valor_pen']) for f in detalles), Decimal('0'))
    resumen = {
        'empresa_id': periodo.empresa_id,
        'periodo_id': periodo.id,
        'anio': periodo.anio,
        'mes': periodo.mes,
        'fecha_inicio': periodo.fecha_inicio.isoformat(),
        'fecha_fin': periodo.fecha_fin.isoformat(),
        'fecha_cierre': fecha_cierre.isoformat(),
        'total_productos': len({f['producto_id'] for f in detalles}),
        'total_detalles': len(detalles),
        'cantidad_total': _decimal_texto(total_cantidad),
        'valor_total_inventario_pen': _decimal_texto(total_valor),
        'microdiferencias': microdiferencias,
    }
    return resumen, sorted(detalles, key=lambda f: (f['producto_id'], f['establecimiento_id']))


@transaction.atomic
def cerrar_periodo(*, empresa_id, periodo_id, usuario):
    periodo = Periodo.objects.select_for_update().filter(id=periodo_id, empresa_id=empresa_id).first()
    if not periodo:
        raise ValidationError({'detail': 'Período no encontrado en la empresa activa.'})
    advertencias = _validar_cierre(periodo)
    # Serializa cierres concurrentes con cualquier confirmación/recálculo del CPP.
    list(SaldoCppActual.objects.select_for_update().filter(empresa_id=empresa_id).values_list('id', flat=True))
    fecha_cierre = timezone.now()
    resumen, detalles = _construir_snapshot(periodo, fecha_cierre)
    version = (CierrePeriodo.objects.filter(periodo_id=periodo.id).aggregate(maximo=Max('version_calculo'))['maximo'] or 0) + 1
    resumen['version_calculo'] = version
    CierrePeriodo.objects.filter(periodo_id=periodo.id, vigente=True).update(vigente=False)
    cierre = CierrePeriodo.objects.create(
        periodo=periodo, version_calculo=version, cerrado_por=usuario,
        archivo_excel=None, snapshot_resumen=resumen,
        hash_resultado=calcular_hash_cierre(resumen, detalles), vigente=True,
    )
    CierrePeriodoDetalle.objects.bulk_create([
        CierrePeriodoDetalle(cierre_periodo=cierre, producto_id=f['producto_id'], establecimiento_id=f['establecimiento_id'], saldo_cantidad=Decimal(f['saldo_cantidad']), saldo_valor_pen=Decimal(f['saldo_valor_pen']), cpp_pen=Decimal(f['cpp_pen']))
        for f in detalles
    ])
    estado_anterior = periodo.estado
    periodo.estado = 'CERRADO'
    periodo.cerrado_por = usuario
    periodo.cerrado_en = fecha_cierre
    periodo.motivo_desactualizado = None
    periodo.save(update_fields=['estado', 'cerrado_por', 'cerrado_en', 'motivo_desactualizado'])
    registrar_auditoria(empresa_id, usuario.id, 'CERRAR', 'periodo', periodo.id, {'estado': estado_anterior}, {'estado': 'CERRADO', 'cierre_id': cierre.id, 'version': version, 'hash': cierre.hash_resultado, 'total_productos': resumen['total_productos'], 'cantidad_total': resumen['cantidad_total'], 'valor_total_inventario_pen': resumen['valor_total_inventario_pen']}, f'Cierre oficial {periodo.anio}-{periodo.mes:02d}')
    registrar_auditoria(empresa_id, usuario.id, 'CREAR', 'cierre_periodo', cierre.id, None, {'periodo_id': periodo.id, 'version': version, 'detalles': len(detalles)}, 'Generación de snapshot oficial de cierre')
    for diferencia in resumen['microdiferencias']:
        registrar_auditoria(empresa_id, usuario.id, 'AJUSTAR', 'cierre_periodo_detalle', cierre.id, None, diferencia, 'Asignación de microdiferencia al establecimiento principal')
    return cierre, advertencias


@transaction.atomic
def reabrir_periodo(*, empresa_id, periodo_id, usuario, motivo):
    periodo = Periodo.objects.select_for_update().filter(id=periodo_id, empresa_id=empresa_id).first()
    if not periodo:
        raise ValidationError({'detail': 'Período no encontrado en la empresa activa.'})
    if periodo.estado != 'CERRADO':
        raise ValidationError({'detail': 'Solo puede reabrirse un período cerrado.'})
    anterior = periodo.estado
    periodo.estado = 'ABIERTO'; periodo.reabierto_por = usuario; periodo.reabierto_en = timezone.now(); periodo.motivo_reapertura = motivo
    periodo.save(update_fields=['estado', 'reabierto_por', 'reabierto_en', 'motivo_reapertura'])
    registrar_auditoria(empresa_id, usuario.id, 'REABRIR', 'periodo', periodo.id, {'estado': anterior}, {'estado': 'ABIERTO', 'motivo_reapertura': motivo}, motivo)
    posteriores = list(Periodo.objects.select_for_update().filter(empresa_id=empresa_id, orden__gt=periodo.orden, estado='CERRADO').order_by('orden'))
    for posterior in posteriores:
        posterior.estado = 'DESACTUALIZADO'
        posterior.motivo_desactualizado = f'Reapertura de período anterior {periodo.anio}-{periodo.mes:02d}: {motivo}'
        posterior.save(update_fields=['estado', 'motivo_desactualizado'])
        registrar_auditoria(empresa_id, usuario.id, 'DESACTUALIZAR', 'periodo', posterior.id, {'estado': 'CERRADO'}, {'estado': 'DESACTUALIZADO', 'motivo': posterior.motivo_desactualizado}, f'Desactualizado por reapertura de período {periodo.anio}-{periodo.mes:02d}')
    return periodo, len(posteriores)
