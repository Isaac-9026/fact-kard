/**
 * Compras, Ventas, Comprobantes y Notas de Crédito/Débito son la MISMA pantalla
 * (DocumentosPage) con un modo distinto. Aquí está toda la diferencia entre modos, como
 * funciones puras: qué filtros fijos se envían a la API y con qué clase se abre el
 * formulario de nuevo comprobante. La lógica de documentos no se duplica.
 */
export type ClaseVista = 'COMPRA' | 'VENTA';
export type VistaDocumentos = 'TODOS' | 'COMPRA' | 'VENTA' | 'NOTAS';

export interface FiltrosUsuarioDocumentos {
  clase?: ClaseVista;
  periodo?: number;
  estado?: string;
  estado_revision?: string;
  search?: string;
}

export interface FiltrosApiDocumentos extends FiltrosUsuarioDocumentos {
  es_nota?: boolean;
}

export interface ConfigVistaDocumentos {
  titulo: string;
  descripcion: string;
  /** Clase fija de la vista (el selector de clase se oculta). */
  claseFija?: ClaseVista;
  /** true = solo notas; false = sin notas; undefined = todas. */
  esNota?: boolean;
  botonNuevo: string;
}

export const CONFIG_VISTAS: Record<VistaDocumentos, ConfigVistaDocumentos> = {
  TODOS: {
    titulo: 'Documentos Comerciales',
    descripcion: 'Mesa de control de comprobantes (Compras, Ventas, NC, ND), revisión contable y confirmación con impacto en Kardex.',
    botonNuevo: 'Nuevo Comprobante',
  },
  COMPRA: {
    titulo: 'Compras',
    descripcion: 'Comprobantes de compra (facturas y boletas de proveedores). Las notas de crédito/débito están en su propia opción.',
    claseFija: 'COMPRA',
    esNota: false,
    botonNuevo: 'Nueva Compra',
  },
  VENTA: {
    titulo: 'Ventas',
    descripcion: 'Comprobantes de venta emitidos por la empresa. Las notas de crédito/débito están en su propia opción.',
    claseFija: 'VENTA',
    esNota: false,
    botonNuevo: 'Nueva Venta',
  },
  NOTAS: {
    titulo: 'Notas de Crédito / Débito',
    descripcion: 'Notas de crédito y débito de compras y ventas, vinculadas a su comprobante de origen.',
    esNota: true,
    botonNuevo: 'Nueva Nota',
  },
};

/** Filtros que se envían a la API: los del usuario más los fijos de la vista. */
export const filtrosApiDocumentos = <F extends FiltrosUsuarioDocumentos>(
  vista: VistaDocumentos,
  usuario: F,
): F & { es_nota?: boolean } => {
  const config = CONFIG_VISTAS[vista];
  const filtros: F & { es_nota?: boolean } = { ...usuario };
  if (config.claseFija) filtros.clase = config.claseFija;
  if (config.esNota !== undefined) filtros.es_nota = config.esNota;
  return filtros;
};

/** Clase con la que se abre el formulario de nuevo comprobante. */
export const claseInicialNuevo = (vista: VistaDocumentos, actual: ClaseVista): ClaseVista =>
  CONFIG_VISTAS[vista].claseFija ?? actual;

/** Tipos de comprobante que ofrece el formulario según la vista (notas o no notas). */
export const tiposComprobanteDeVista = <T extends { es_nota?: boolean }>(vista: VistaDocumentos, tipos: T[]): T[] => {
  const esNota = CONFIG_VISTAS[vista].esNota;
  if (esNota === undefined) return tipos;
  return tipos.filter((t) => Boolean(t.es_nota) === esNota);
};
