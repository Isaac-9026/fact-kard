import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getMeApi } from '../api/auth';
import type { Usuario, EmpresaAsociada, EmpresaActiva, AuthContextType } from '../types/auth';
import { reconciliarEstadoEmpresas } from './authState';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const refrescoEmpresasEnCurso = useRef<Promise<EmpresaAsociada[]> | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const saved = localStorage.getItem('usuario');
    if (!saved) return null;
    try {
      return JSON.parse(saved) as Usuario;
    } catch {
      return null;
    }
  });

  const [empresasDisponibles, setEmpresasDisponibles] = useState<EmpresaAsociada[]>(() => {
    const saved = localStorage.getItem('empresas_disponibles');
    if (!saved) return [];
    try {
      return JSON.parse(saved) as EmpresaAsociada[];
    } catch {
      return [];
    }
  });

  const [empresaActiva, setEmpresaActiva] = useState<EmpresaActiva | null>(() => {
    const saved = localStorage.getItem('empresa_activa');
    if (!saved) return null;
    try {
      const activaGuardada = JSON.parse(saved) as EmpresaActiva;
      const empresasGuardadas = localStorage.getItem('empresas_disponibles');
      const empresas = empresasGuardadas
        ? JSON.parse(empresasGuardadas) as EmpresaAsociada[]
        : [];
      return reconciliarEstadoEmpresas(empresas, activaGuardada).empresaActiva;
    } catch {
      return null;
    }
  });

  const persistirEstadoEmpresas = useCallback((empresas: EmpresaAsociada[]) => {
    setEmpresasDisponibles(empresas);
    localStorage.setItem('empresas_disponibles', JSON.stringify(empresas));

    setEmpresaActiva((actual) => {
      const siguiente = reconciliarEstadoEmpresas(empresas, actual).empresaActiva;
      if (siguiente) {
        localStorage.setItem('empresa_id', String(siguiente.id));
        localStorage.setItem('empresa_activa', JSON.stringify(siguiente));
      } else {
        localStorage.removeItem('empresa_id');
        localStorage.removeItem('empresa_activa');
      }
      return siguiente;
    });
  }, []);

  const refrescarEmpresasDisponibles = useCallback(() => {
    if (refrescoEmpresasEnCurso.current) return refrescoEmpresasEnCurso.current;

    const refresco = getMeApi()
      .then((data) => {
        setUsuario(data.usuario);
        localStorage.setItem('usuario', JSON.stringify(data.usuario));
        persistirEstadoEmpresas(data.empresas);
        return data.empresas;
      })
      .catch((error: unknown) => {
        persistirEstadoEmpresas([]);
        throw error;
      })
      .finally(() => {
        refrescoEmpresasEnCurso.current = null;
      });

    refrescoEmpresasEnCurso.current = refresco;
    return refresco;
  }, [persistirEstadoEmpresas]);

  useEffect(() => {
    if (!token) return;
    void refrescarEmpresasDisponibles().catch(() => undefined);
  }, [refrescarEmpresasDisponibles, token]);

  const login = (newToken: string, newUsuario: Usuario, empresas: EmpresaAsociada[]) => {
    setToken(newToken);
    setUsuario(newUsuario);
    setEmpresasDisponibles(empresas);

    localStorage.setItem('token', newToken);
    localStorage.setItem('usuario', JSON.stringify(newUsuario));
    localStorage.setItem('empresas_disponibles', JSON.stringify(empresas));

    const savedEmpresaId = localStorage.getItem('empresa_id');
    const matched = empresas.find((e) => String(e.id) === savedEmpresaId);
    const activa = matched || empresas[0] || null;

    if (activa) {
      const basicActiva: EmpresaActiva = {
        id: activa.id,
        ruc: activa.ruc,
        razon_social: activa.razon_social,
        nombre_comercial: activa.nombre_comercial,
        rol: activa.rol,
      };
      setEmpresaActiva(basicActiva);
      localStorage.setItem('empresa_id', String(basicActiva.id));
      localStorage.setItem('empresa_activa', JSON.stringify(basicActiva));
    } else {
      setEmpresaActiva(null);
      localStorage.removeItem('empresa_id');
      localStorage.removeItem('empresa_activa');
    }
  };

  const logout = () => {
    setToken(null);
    setUsuario(null);
    setEmpresaActiva(null);
    setEmpresasDisponibles([]);

    localStorage.removeItem('token');
    localStorage.removeItem('empresa_id');
    localStorage.removeItem('usuario');
    localStorage.removeItem('empresas_disponibles');
    localStorage.removeItem('empresa_activa');
  };

  const registrarEmpresaDisponible = (empresa: EmpresaAsociada) => {
    setEmpresasDisponibles((actuales) => {
      const existe = actuales.some((disponible) => disponible.id === empresa.id);
      const actualizadas = existe
        ? actuales.map((disponible) => disponible.id === empresa.id ? empresa : disponible)
        : [...actuales, empresa];

      localStorage.setItem('empresas_disponibles', JSON.stringify(actualizadas));
      return actualizadas;
    });
  };

  const seleccionarEmpresa = (empresaId: number) => {
    const encontrada = empresasDisponibles.find((e) => e.id === empresaId);
    if (encontrada) {
      const basicActiva: EmpresaActiva = {
        id: encontrada.id,
        ruc: encontrada.ruc,
        razon_social: encontrada.razon_social,
        nombre_comercial: encontrada.nombre_comercial,
        rol: encontrada.rol,
      };
      setEmpresaActiva(basicActiva);
      localStorage.setItem('empresa_id', String(empresaId));
      localStorage.setItem('empresa_activa', JSON.stringify(basicActiva));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        empresaActiva,
        empresasDisponibles,
        token,
        isAuthenticated: !!token,
        login,
        logout,
        registrarEmpresaDisponible,
        refrescarEmpresasDisponibles,
        seleccionarEmpresa,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};

export default AuthContext;
