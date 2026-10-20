import apiClient from './http';

export interface Incidencia { id: number; tipo: string; severidad: string; descripcion: string; bloquea_cierre: boolean; estado: 'PENDIENTE' | 'RESUELTA' | 'DESCARTADA'; detectado_en: string }
export interface RecalculoDetalle { movimiento_id: number; cpp_anterior: string | null; cpp_nuevo: string | null; valor_anterior: string | null; valor_nuevo: string | null; saldo_anterior: string | null; saldo_nuevo: string | null }
export interface Recalculo { id: number; producto: number; fecha_desde: string; fecha_hasta: string | null; version: number; estado: string; ejecutado_en: string; detalles: RecalculoDetalle[] }

export const obtenerIncidencias = async (): Promise<Incidencia[]> => (await apiClient.get('/kardex/incidencias/')).data;
export const resolverIncidencia = async (id: number, estado: 'RESUELTA' | 'DESCARTADA'): Promise<Incidencia> => (await apiClient.patch(`/kardex/incidencias/${id}/`, { estado })).data;
export const obtenerRecalculos = async (): Promise<Recalculo[]> => (await apiClient.get('/kardex/recalculos/')).data;
export const ejecutarRecalculo = async (producto: number, fecha_desde: string): Promise<Recalculo> => (await apiClient.post('/kardex/recalculos/', { producto, fecha_desde })).data;
