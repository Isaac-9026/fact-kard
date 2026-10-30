/**
 * Bloque 17A — utilidades puras de la preparación tributaria (probadas con node --test).
 * El backend vuelve a validar todo; esto solo ayuda en el formulario.
 */

/** Ubigeo INEI: 6 dígitos, departamento 01-25, provincia y distrito 01-99. */
export function errorUbigeo(valor: string): string | null {
  if (!/^\d{6}$/.test(valor)) return 'El ubigeo debe tener 6 dígitos (p. ej. 150101).';
  const dep = Number(valor.slice(0, 2));
  if (dep < 1 || dep > 25) return 'El ubigeo debe empezar con un departamento entre 01 y 25.';
  if (valor.slice(2, 4) === '00' || valor.slice(4, 6) === '00') return 'Provincia y distrito del ubigeo no pueden ser 00.';
  return null;
}

/** Catálogo de motivos que corresponde al tipo de nota: 07 → 09 (NC), 08 → 10 (ND). */
export function catalogoMotivo(codigoTipo: string | undefined): '09' | '10' | null {
  if (codigoTipo === '07') return '09';
  if (codigoTipo === '08') return '10';
  return null;
}

export const ETIQUETA_PREPARACION: Record<'LISTO_PARA_EMISION' | 'NO_PREPARADO', string> = {
  LISTO_PARA_EMISION: 'Listo para emisión',
  NO_PREPARADO: 'No preparado',
};
