import apiClient from './http';

export type ClaseDocumento = 'COMPRA' | 'VENTA';
export type EstadoDocumental = 'BORRADOR' | 'CONFIRMADO' | 'ANULADO';
export type EstadoRevision = 'PENDIENTE' | 'EN_REVISION' | 'REVISADO' | 'OBSERVADO';

export interface DocumentoDetalle {
  id: number;
  linea: number;
  producto: number | null;
  producto_codigo?: string;
  producto_descripcion?: string;
  producto_unidad: number | null;
  unidad_codigo?: string;
  almacen: number;
  almacen_codigo?: string;
  almacen_nombre?: string;
  tipo_operacion: number;
  tipo_operacion_codigo?: string;
  tipo_operacion_descripcion?: string;
  afecta_kardex_aplicado: boolean;
  equivalencia: number | null;
  descripcion_original?: string | null;
  cantidad_original: string;
  factor_conversion: string;
  cantidad_base: string;
  precio_unitario: string;
  igv: string;
  porcentaje_credito_fiscal_aplicado: string;
  costo_unitario_pen: string | null;
  es_bonificacion: boolean;
  detalle_origen: number | null;
}

export interface Documento {
  id: number;
  empresa_id: number;
  clase: ClaseDocumento;
  periodo: number;
  periodo_orden?: number;
  tercero: number | null;
  tercero_razon_social?: string;
  ruc_emisor: string;
  tipo_comprobante: number;
  tipo_comprobante_codigo?: string;
  tipo_comprobante_descripcion?: string;
  es_nota?: boolean;
  serie: string | null;
  serie_normalizada: string;
  numero: string | null;
  numero_normalizado: string;
  fecha_emision: string;
  moneda_codigo: string;
  tipo_cambio: number | null;
  fecha_tc: string | null;
  monto_tc: string | null;
  fuente_tc: string | null;
  subtotal: string;
  igv: string;
  total: string;
  documento_origen: number | null;
  documento_origen_comprobante?: string | null;
  origen_captura: string;
  estado: EstadoDocumental;
  estado_revision: EstadoRevision;
  revisado_por?: number | null;
  revisado_por_username?: string | null;
  revisado_en?: string | null;
  creado_por?: number | null;
  creado_por_username?: string | null;
  confirmado_por?: number | null;
  confirmado_por_username?: string | null;
  confirmado_en?: string | null;
  detalles_count?: number;
  detalles?: DocumentoDetalle[];
}

export interface CrearDocumentoDetallePayload {
  producto?: number | null;
  producto_unidad?: number | null;
  almacen: number;
  tipo_operacion: number;
  cantidad_original: string | number;
  precio_unitario?: string | number;
  igv?: string | number;
  es_bonificacion?: boolean;
  descripcion_original?: string;
  detalle_origen?: number | null;
  equivalencia?: number | null;
}

export interface CrearDocumentoPayload {
  clase: ClaseDocumento;
  periodo: number;
  tercero?: number | null;
  ruc_emisor?: string;
  tipo_comprobante: number;
  serie: string;
  numero: string;
  fecha_emision: string;
  moneda_codigo: string;
  documento_origen?: number | null;
  origen_captura?: string;
  detalles: CrearDocumentoDetallePayload[];
}

export interface DocumentoFiltros {
  clase?: ClaseDocumento;
  periodo?: number;
  estado?: EstadoDocumental;
  estado_revision?: EstadoRevision;
  search?: string;
}

export const obtenerDocumentos = async (filtros?: DocumentoFiltros): Promise<Documento[]> => {
  const { data } = await apiClient.get<Documento[]>('/documentos/', { params: filtros });
  return data;
};

export const obtenerDocumento = async (id: number): Promise<Documento> => {
  const { data } = await apiClient.get<Documento>(`/documentos/${id}/`);
  return data;
};

export const crearDocumento = async (payload: CrearDocumentoPayload): Promise<Documento> => {
  const { data } = await apiClient.post<Documento>('/documentos/', payload);
  return data;
};

export const eliminarDocumento = async (id: number): Promise<void> => {
  await apiClient.delete(`/documentos/${id}/`);
};

export const revisarDocumento = async (
  id: number,
  estado_revision: EstadoRevision,
  motivo?: string
): Promise<Documento> => {
  const { data } = await apiClient.post<Documento>(`/documentos/${id}/revisar/`, {
    estado_revision,
    motivo,
  });
  return data;
};

export const confirmarDocumento = async (id: number): Promise<Documento> => {
  const { data } = await apiClient.post<Documento>(`/documentos/${id}/confirmar/`);
  return data;
};

export const anularDocumento = async (id: number, motivo: string): Promise<Documento> => {
  const { data } = await apiClient.post<Documento>(`/documentos/${id}/anular/`, { motivo });
  return data;
};
