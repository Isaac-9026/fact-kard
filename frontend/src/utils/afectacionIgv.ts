// Bloque 3: afectación del IGV por línea. Solo sugiere el IGV en pantalla;
// el backend es quien valida (GRAVADO 18 %, EXONERADO/INAFECTO/EXPORTACION 0).

export type AfectacionIgv = 'GRAVADO' | 'EXONERADO' | 'INAFECTO' | 'EXPORTACION' | 'GRATUITO';

export const AFECTACIONES_IGV: { valor: AfectacionIgv; etiqueta: string }[] = [
  { valor: 'GRAVADO', etiqueta: 'Gravado' },
  { valor: 'EXONERADO', etiqueta: 'Exonerado' },
  { valor: 'INAFECTO', etiqueta: 'Inafecto' },
  { valor: 'EXPORTACION', etiqueta: 'Exportación' },
  { valor: 'GRATUITO', etiqueta: 'Gratuito' },
];

// Bloque 4: la tasa real la entrega el backend (ConfigEmpresa.tasa_igv_pct). Este valor
// solo se usa mientras no se haya leído la configuración.
export const TASA_IGV_POR_DEFECTO_PCT = '18.00';

/** IGV sugerido para la línea, o null si la afectación no tiene tasa que sugerir (GRATUITO). */
export function igvSugerido(
  afectacion: AfectacionIgv, cantidad: string, precio: string, tasaPct: string = TASA_IGV_POR_DEFECTO_PCT,
): string | null {
  if (afectacion === 'GRATUITO') return null;
  if (afectacion !== 'GRAVADO') return '0.00000000';
  const cant = parseFloat(cantidad) || 0;
  const pu = parseFloat(precio) || 0;
  const tasa = (parseFloat(tasaPct) || 0) / 100;
  return (cant * pu * tasa).toFixed(8);
}

export interface TasaIgvVigencia { vigente_desde: string; tasa_pct: string }

/** Bloque 5: tasa vigente en la fecha del comprobante (ISO yyyy-mm-dd); si no hay historial, la actual. */
export function tasaVigente(tasas: TasaIgvVigencia[] | undefined, fecha: string, actual: string): string {
  const aplicables = (tasas ?? []).filter((t) => t.vigente_desde <= fecha);
  if (aplicables.length === 0) return actual;
  return aplicables.reduce((a, b) => (b.vigente_desde > a.vigente_desde ? b : a)).tasa_pct;
}

/** El IGV solo es editable en líneas gravadas o gratuitas; en las demás es 0. */
export function igvEditable(afectacion: AfectacionIgv): boolean {
  return afectacion === 'GRAVADO' || afectacion === 'GRATUITO';
}
