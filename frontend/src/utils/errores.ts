/**
 * Bloque 7 — mensaje legible de un error de la API sin usar `any`.
 * Devuelve el primer campo con contenido de `response.data` (en el orden dado) o el texto
 * por defecto. Las listas de DRF (`{"archivo": ["..."]}`) se unen con espacios.
 */
export function mensajeDeError(err: unknown, campos: readonly string[], porDefecto: string): string {
  const data = (err as { response?: { data?: unknown } } | null | undefined)?.response?.data
  if (data && typeof data === 'object') {
    for (const campo of campos) {
      const valor = (data as Record<string, unknown>)[campo]
      if (Array.isArray(valor)) {
        if (valor.length > 0) return valor.map(String).join(' ')
      } else if (valor !== undefined && valor !== null && valor !== '' && valor !== false && valor !== 0) {
        return String(valor)
      }
    }
  }
  return porDefecto
}
