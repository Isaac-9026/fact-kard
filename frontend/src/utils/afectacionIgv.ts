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

/** El IGV solo es editable en líneas gravadas o gratuitas; en las demás es 0. */
export function igvEditable(afectacion: AfectacionIgv): boolean {
  return afectacion === 'GRAVADO' || afectacion === 'GRATUITO';
}
