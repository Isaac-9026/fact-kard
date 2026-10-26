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

const TASA_IGV = 0.18;

/** IGV sugerido para la línea, o null si la afectación no tiene tasa que sugerir (GRATUITO). */
export function igvSugerido(afectacion: AfectacionIgv, cantidad: string, precio: string): string | null {
  if (afectacion === 'GRATUITO') return null;
  if (afectacion !== 'GRAVADO') return '0.00000000';
  const cant = parseFloat(cantidad) || 0;
  const pu = parseFloat(precio) || 0;
  return (cant * pu * TASA_IGV).toFixed(8);
}

/** El IGV solo es editable en líneas gravadas o gratuitas; en las demás es 0. */
export function igvEditable(afectacion: AfectacionIgv): boolean {
  return afectacion === 'GRAVADO' || afectacion === 'GRATUITO';
}
