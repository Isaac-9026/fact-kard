import apiClient from './http';

export type RolEmpresa = 'ADMIN' | 'USUARIO';
export interface Moneda { codigo: string; nombre: string }
export interface Empresa { id: number; ruc: string; razon_social: string; nombre_comercial: string | null; direccion: string | null; moneda_base_codigo: string; estado: 'ACTIVA' | 'INACTIVA'; creado_en: string; rol: RolEmpresa }
export interface CrearEmpresaPayload { ruc: string; razon_social: string; nombre_comercial?: string; direccion?: string; moneda_base_codigo: string }
export interface Establecimiento { id: number; codigo_sunat: string; nombre: string; activo: boolean; direccion?: string | null; ubigeo?: string | null; es_principal?: boolean }
export type EstablecimientoPayload = Omit<Establecimiento, 'id' | 'es_principal'>;

/** Bloque 17A: resultado de una validación previa a la emisión electrónica (solo lectura). */
export interface ValidacionTributaria { listo: boolean; errores: string[]; advertencias: string[] }
/** Bloque 17A: datos del emisor electrónico de la empresa activa (el RUC no se edita aquí). */
export interface DatosFiscales {
  id: number; ruc: string; razon_social: string; nombre_comercial: string | null; direccion: string | null;
  ubigeo: string | null; departamento: string | null; provincia: string | null; distrito: string | null; codigo_pais: string;
  validacion: ValidacionTributaria;
}
export type DatosFiscalesPayload = Partial<Omit<DatosFiscales, 'id' | 'ruc' | 'validacion'>>;
export interface ConfigEmpresa { id: number; empresa: number; tolerancia_residuo_pen: string; decimales_calculo: number; regla_redondeo: 'ROUND_HALF_UP'; metodo_valuacion: 'CPP'; establecimiento_principal: number | null; tasa_igv_pct?: string; tasas_igv?: { vigente_desde: string; tasa_pct: string }[] }
export interface ActualizarConfigPayload { tolerancia_residuo_pen?: string; decimales_calculo?: number; establecimiento_principal?: number | null; tasa_igv_pct?: string; tasa_igv_vigente_desde?: string }

export const obtenerMonedas = async (): Promise<Moneda[]> => (await apiClient.get<Moneda[]>('/catalogos/monedas/')).data;
export const obtenerEmpresas = async (): Promise<Empresa[]> => (await apiClient.get<Empresa[]>('/empresas/')).data;
export const crearEmpresa = async (payload: CrearEmpresaPayload): Promise<Empresa> => (await apiClient.post<Empresa>('/empresas/', payload)).data;
export const obtenerConfigEmpresa = async (): Promise<ConfigEmpresa> => (await apiClient.get<ConfigEmpresa>('/empresas/config/')).data;
export const actualizarConfigEmpresa = async (payload: ActualizarConfigPayload): Promise<ConfigEmpresa> => (await apiClient.patch<ConfigEmpresa>('/empresas/config/', payload)).data;
export const obtenerDatosFiscales = async (): Promise<DatosFiscales> => (await apiClient.get<DatosFiscales>('/empresas/datos-fiscales/')).data;
export const actualizarDatosFiscales = async (payload: DatosFiscalesPayload): Promise<DatosFiscales> => (await apiClient.patch<DatosFiscales>('/empresas/datos-fiscales/', payload)).data;
export const obtenerEstablecimientos = async (): Promise<Establecimiento[]> => (await apiClient.get<Establecimiento[]>('/empresas/establecimientos/')).data;
export const crearEstablecimiento = async (payload: EstablecimientoPayload): Promise<Establecimiento> => (await apiClient.post<Establecimiento>('/empresas/establecimientos/', payload)).data;
export const actualizarEstablecimiento = async (id: number, payload: Partial<EstablecimientoPayload>): Promise<Establecimiento> => (await apiClient.patch<Establecimiento>(`/empresas/establecimientos/${id}/`, payload)).data;

/** Bloque 17B: estado de la preparación SUNAT (solo ADMIN). Nunca trae usuario, clave ni certificado. */
export interface EstadoSunat {
  ambiente: 'beta' | 'produccion' | null;
  configurado: boolean;
  certificado_configurado: boolean;
  credenciales_configuradas: boolean;
  faltantes: string[];
  advertencias: string[];
  credenciales_corresponden_a_empresa: boolean | null;
  conexion_sunat_habilitada: boolean;
}
export const obtenerEstadoSunat = async (): Promise<EstadoSunat> => (await apiClient.get<EstadoSunat>('/configuracion/sunat/estado/')).data;
