import axios, { type InternalAxiosRequestConfig } from 'axios';

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

export default apiClient;
