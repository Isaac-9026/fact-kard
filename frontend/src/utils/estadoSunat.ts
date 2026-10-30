/**
 * Bloque 17B — textos del estado de preparación SUNAT (puro, probado con node --test).
 * Solo describe estados; los valores secretos nunca llegan al frontend.
 */
export interface EstadoSunatBasico {
  ambiente: 'beta' | 'produccion' | null;
  configurado: boolean;
  certificado_configurado: boolean;
  credenciales_configuradas: boolean;
  credenciales_corresponden_a_empresa?: boolean | null;
}

export interface FilaEstadoSunat { etiqueta: string; valor: string; ok: boolean }

export function filasEstadoSunat(e: EstadoSunatBasico): FilaEstadoSunat[] {
  const filas: FilaEstadoSunat[] = [
    { etiqueta: 'Ambiente', valor: e.ambiente === 'produccion' ? 'Producción' : e.ambiente === 'beta' ? 'Beta (pruebas)' : 'No válido', ok: e.ambiente !== null },
    { etiqueta: 'Credenciales SOL', valor: e.credenciales_configuradas ? 'Configuradas' : 'No configuradas', ok: e.credenciales_configuradas },
    { etiqueta: 'Certificado digital', valor: e.certificado_configurado ? 'Configurado' : 'No configurado', ok: e.certificado_configurado },
  ];
  if (e.credenciales_corresponden_a_empresa === false) {
    filas.push({ etiqueta: 'Credenciales de esta empresa', valor: 'Pertenecen a otro RUC', ok: false });
  }
  filas.push({ etiqueta: 'Estado', valor: e.configurado ? 'Preparado (sin conexión aún)' : 'Pendiente', ok: e.configurado });
  return filas;
}
