import axios, { type InternalAxiosRequestConfig } from 'axios';
import {
  crearControlCierreSesion,
  debeCerrarSesionPor401,
  tokenDesdeAuthorization,
} from '../utils/sesion';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    const empresaId = sessionStorage.getItem('empresa_id') || localStorage.getItem('empresa_id');
    if (empresaId) {
      config.headers.set('X-Empresa-Id', empresaId);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// FE-002: un 401 con el token vigente invalida la sesión una sola vez.
const controlCierreSesion = crearControlCierreSesion();
let manejadorSesionInvalida: (() => void) | null = null;

export const registrarManejadorSesionInvalida = (manejador: () => void) => {
  manejadorSesionInvalida = manejador;
  return () => {
    if (manejadorSesionInvalida === manejador) {
      manejadorSesionInvalida = null;
    }
  };
};

/** Se llama tras un login exitoso para volver a escuchar 401 de la nueva sesión. */
export const reiniciarControlSesion = () => controlCierreSesion.reiniciar();

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error?.config as InternalAxiosRequestConfig | undefined;
    const tokenEnviado = tokenDesdeAuthorization(config?.headers?.get?.('Authorization'));
    const cerrar = debeCerrarSesionPor401({
      status: error?.response?.status,
      url: config?.url,
      tokenEnviado,
      tokenActual: localStorage.getItem('token'),
    });
    if (cerrar && manejadorSesionInvalida) {
      controlCierreSesion.intentar(manejadorSesionInvalida);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
