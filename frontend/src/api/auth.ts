import { apiClient } from './http';
import type { Usuario, EmpresaAsociada } from '../types/auth';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
  empresas: EmpresaAsociada[];
}

export interface MeResponse {
  usuario: Usuario;
  empresas: EmpresaAsociada[];
}

export interface UsuarioEmpresaItem {
  id: number;
  usuario_id: number;
  username: string;
  email: string;
  empresa_id: number;
  empresa_razon_social: string;
  rol: 'ADMIN' | 'USUARIO';
  activo: boolean;
}

export interface AsignarUsuarioPayload {
  usuario_id: number;
  rol: 'ADMIN' | 'USUARIO';
  activo?: boolean;
}

/**
 * Autentica usuario en FACT-KARD y devuelve token + empresas asignadas.
 */
export const loginApi = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/usuarios/login/', credentials);
  return response.data;
};

/**
 * Obtiene el perfil del usuario autenticado y sus empresas activas.
 */
export const getMeApi = async (): Promise<MeResponse> => {
  const response = await apiClient.get<MeResponse>('/usuarios/me/');
  return response.data;
};

/**
 * Obtiene la lista de usuarios y roles asignados a la empresa activa (X-Empresa-Id).
 */
export const getAsignacionesApi = async (): Promise<UsuarioEmpresaItem[]> => {
  const response = await apiClient.get<UsuarioEmpresaItem[]>('/usuarios/asignaciones/');
  return response.data;
};

/**
 * Asigna o modifica el rol de un usuario en la empresa activa (X-Empresa-Id).
 */
export const asignarUsuarioApi = async (payload: AsignarUsuarioPayload): Promise<UsuarioEmpresaItem> => {
  const response = await apiClient.post<UsuarioEmpresaItem>('/usuarios/asignaciones/', payload);
  return response.data;
};
