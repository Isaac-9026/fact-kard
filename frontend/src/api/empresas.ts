import apiClient from './http';

export type RolEmpresa = 'ADMIN' | 'USUARIO';
export interface Moneda { codigo: string; nombre: string }
export interface Empresa { id: number; ruc: string; razon_social: string; nombre_comercial: string | null; direccion: string | null; moneda_base_codigo: string; estado: 'ACTIVA' | 'INACTIVA'; creado_en: string; rol: RolEmpresa }
export interface CrearEmpresaPayload { ruc: string; razon_social: string; nombre_comercial?: string; direccion?: string; moneda_base_codigo: string }
export interface Establecimiento { id: number; codigo_sunat: string; nombre: string; activo: boolean }
export type EstablecimientoPayload = Omit<Establecimiento, 'id'>;
export interface ConfigEmpresa { id: number; empresa: number; tolerancia_residuo_pen: string; decimales_calculo: number; regla_redondeo: 'ROUND_HALF_UP'; metodo_valuacion: 'CPP'; establecimiento_principal: number | null; tasa_igv_pct?: string }
export interface ActualizarConfigPayload { tolerancia_residuo_pen?: string; decimales_calculo?: number; establecimiento_principal?: number | null; tasa_igv_pct?: string }

export const obtenerMonedas = async (): Promise<Moneda[]> => (await apiClient.get<Moneda[]>('/catalogos/monedas/')).data;
export const obtenerEmpresas = async (): Promise<Empresa[]> => (await apiClient.get<Empresa[]>('/empresas/')).data;
export const crearEmpresa = async (payload: CrearEmpresaPayload): Promise<Empresa> => (await apiClient.post<Empresa>('/empresas/', payload)).data;
export const obtenerConfigEmpresa = async (): Promise<ConfigEmpresa> => (await apiClient.get<ConfigEmpresa>('/empresas/config/')).data;
export const actualizarConfigEmpresa = async (payload: ActualizarConfigPayload): Promise<ConfigEmpresa> => (await apiClient.patch<ConfigEmpresa>('/empresas/config/', payload)).data;
export const obtenerEstablecimientos = async (): Promise<Establecimiento[]> => (await apiClient.get<Establecimiento[]>('/empresas/establecimientos/')).data;
export const crearEstablecimiento = async (payload: EstablecimientoPayload): Promise<Establecimiento> => (await apiClient.post<Establecimiento>('/empresas/establecimientos/', payload)).data;
export const actualizarEstablecimiento = async (id: number, payload: Partial<EstablecimientoPayload>): Promise<Establecimiento> => (await apiClient.patch<Establecimiento>(`/empresas/establecimientos/${id}/`, payload)).data;
