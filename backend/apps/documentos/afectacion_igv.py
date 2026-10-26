"""
Afectación del IGV por línea — Bloque 3 (mínimo necesario, no es un módulo tributario).

Cada línea se clasifica en GRAVADO, EXONERADO, INAFECTO, EXPORTACION o GRATUITO.
Opcionalmente guarda el código del Catálogo 07 de SUNAT ("Códigos de tipo de
afectación del IGV", Anexo E de la R.S. 245-2017/SUNAT) del que se derivó.

La validación vive en el backend; el frontend solo ayuda.
"""
from decimal import ROUND_HALF_UP, Decimal

from rest_framework.exceptions import ValidationError

# Tasa general del IGV en Perú (16 % IGV + 2 % IPM). No existe en el modelo una tasa
# configurable por empresa/período; si se agrega, debe reemplazar esta constante.
TASA_IGV = Decimal('0.18')
TOLERANCIA_IGV = Decimal('0.01')

GRAVADO, EXONERADO, INAFECTO, EXPORTACION, GRATUITO = (
    'GRAVADO', 'EXONERADO', 'INAFECTO', 'EXPORTACION', 'GRATUITO',
)
AFECTACIONES = (
    (GRAVADO, 'Gravado'),
    (EXONERADO, 'Exonerado'),
    (INAFECTO, 'Inafecto'),
    (EXPORTACION, 'Exportación'),
    (GRATUITO, 'Gratuito / bonificación'),
)
SIN_IGV = {EXONERADO, INAFECTO, EXPORTACION}

# Catálogo 07 → afectación. 11-16, 21 y 31-36 son transferencias gratuitas
# (retiros, premios, donaciones, bonificaciones, muestras, publicidad).
CATALOGO_07 = {
    '10': GRAVADO,
    **{c: GRATUITO for c in ('11', '12', '13', '14', '15', '16')},
    '20': EXONERADO,
    '21': GRATUITO,
    '30': INAFECTO,
    **{c: GRATUITO for c in ('31', '32', '33', '34', '35', '36')},
    '40': EXPORTACION,
}
# 17 (Gravado – IVAP) usa otra tasa; no se soporta en este bloque.
CODIGOS_NO_SOPORTADOS = {'17': 'Gravado – IVAP (tasa distinta del IGV general)'}


def resolver_afectacion(*, afectacion, codigo, es_bonificacion, linea_num):
    """Devuelve (afectacion, codigo) normalizados o lanza ValidationError (400)."""
    codigo = (codigo or '').strip() or None
    afectacion = (afectacion or '').strip().upper() or None
    if codigo is not None:
        if codigo in CODIGOS_NO_SOPORTADOS:
            raise ValidationError({'detalles': (
                f"Línea {linea_num}: afectación {codigo} ({CODIGOS_NO_SOPORTADOS[codigo]}) no soportada; "
                'registre el comprobante manualmente.'
            )})
        if codigo not in CATALOGO_07:
            raise ValidationError({'detalles': (
                f"Línea {linea_num}: el código de afectación del IGV '{codigo}' no existe en el Catálogo 07 de SUNAT."
            )})
        derivada = CATALOGO_07[codigo]
        if afectacion is not None and afectacion != derivada:
            raise ValidationError({'detalles': (
                f"Línea {linea_num}: la afectación {afectacion} no coincide con el código SUNAT {codigo} ({derivada})."
            )})
        afectacion = derivada
    if afectacion is None:
        afectacion = GRATUITO if es_bonificacion else GRAVADO
    if afectacion not in dict(AFECTACIONES):
        raise ValidationError({'detalles': f"Línea {linea_num}: afectación del IGV '{afectacion}' no válida."})
    if es_bonificacion and afectacion != GRATUITO:
        raise ValidationError({'detalles': (
            f"Línea {linea_num}: una bonificación es una transferencia gratuita; su afectación debe ser GRATUITO."
        )})
    return afectacion, codigo


def igv_esperado(base):
    return (base * TASA_IGV).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def validar_igv_linea(*, igv, base, afectacion, linea_num):
    """
    GRAVADO: IGV = base × 18 % (± S/ 0.01); con base > 0 el IGV 0 se rechaza.
    EXONERADO / INAFECTO / EXPORTACION: IGV 0.
    GRATUITO: se conserva la lógica previa (sin validación de tasa; el IGV de una
    transferencia gratuita es referencial o no existe).
    """
    if afectacion == GRATUITO:
        return
    if afectacion in SIN_IGV:
        if igv != Decimal('0'):
            raise ValidationError({'detalles': (
                f"Línea {linea_num}: una línea {afectacion.lower()} no lleva IGV (recibido {igv.normalize():f})."
            )})
        return
    esperado = igv_esperado(base)
    if abs(igv - esperado) > TOLERANCIA_IGV:
        raise ValidationError({'detalles': (
            f"Línea {linea_num}: el IGV {igv.normalize():f} no corresponde a la base gravada "
            f"{base.normalize():f} (18 % = {esperado:f}). Si la línea es exonerada, inafecta o de "
            'exportación indique su afectación.'
        )})
