import apiClient from './http';

export interface Formato131Filtros { periodo_id: number | string; establecimiento_id?: number | string; producto_id?: number | string }
export interface BloqueValor { cantidad: string; costo_unitario: string; costo_total: string }
export interface Formato131Movimiento { movimiento_id: number; fecha_emision: string; documento: { tipo_documento: string; serie: string; numero: string }; tipo_operacion: string; entrada: BloqueValor | null; salida: BloqueValor | null; saldo_final: BloqueValor; orden: { prioridad_dia: number; secuencia: number } }
export interface Formato131Reporte { cabecera: { establecimiento: { id: number; codigo_sunat: string; nombre: string }; producto_id: number; codigo_existencia: string; tipo_existencia: { codigo: string; descripcion: string }; descripcion_existencia: string; unidad_medida: { codigo: string; descripcion: string }; metodo_valuacion: string }; saldo_inicial?: string; saldo_inicial_valorizado?: BloqueValor; saldo_final?: BloqueValor; movimientos: Formato131Movimiento[]; microdiferencia_cierre: string; fuente_saldo_final?: 'CIERRE' | 'CALCULADO' }
export interface Formato131Response { periodo: string; periodo_id: number; estado_periodo: string; empresa: { ruc: string; razon_social: string }; fuente_cierre: { cierre_id: number; version: number; hash: string } | null; reportes: Formato131Reporte[] }
export interface PilotoReal { periodo_id: number; producto_id: number; producto_codigo: string; estado_periodo: string; fuente: 'CIERRE_PERIODO_DETALLE' | 'SALDO_CPP_ACTUAL'; cierre_id: number | null; cantidad_factkard: string; cpp_factkard: string; valor_factkard: string }
export interface PilotoPayload { periodo_id: number | string; producto_id: number | string; cantidad_esperada: string; cpp_esperado: string; valor_esperado: string; tiempo_manual_segundos: string; tiempo_factkard_segundos: string }
export interface PilotoResultado extends PilotoReal { esperado: { cantidad: string; cpp: string; valor: string }; diferencias: { cantidad: string; cpp: string; valor: string }; cuadra_100: boolean; reduccion_porcentaje: string }

const limpiarFiltros = (f: Formato131Filtros) => ({ periodo_id: f.periodo_id, ...(f.establecimiento_id ? { establecimiento_id: f.establecimiento_id } : {}), ...(f.producto_id ? { producto_id: f.producto_id } : {}) });
export const obtenerFormato131 = async (f: Formato131Filtros): Promise<Formato131Response> => (await apiClient.get<Formato131Response>('/reportes/formato-13-1/', { params: limpiarFiltros(f) })).data;
export const descargarFormato131 = async (f: Formato131Filtros): Promise<void> => {
  const response = await apiClient.get('/reportes/formato-13-1/excel/', { params: limpiarFiltros(f), responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a'); link.href = url; link.download = `formato_13_1_${f.periodo_id}.xlsx`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
};
export const obtenerPiloto = async (periodoId: number | string, productoId: number | string): Promise<PilotoReal> => (await apiClient.get<PilotoReal>('/reportes/piloto-comparador/', { params: { periodo_id: periodoId, producto_id: productoId } })).data;
export const compararPiloto = async (payload: PilotoPayload): Promise<PilotoResultado> => (await apiClient.post<PilotoResultado>('/reportes/piloto-comparador/', payload)).data;
