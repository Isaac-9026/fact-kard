export interface Usuario {
  id: number;
  username: string;
  email: string;
  es_admin_global: boolean;
  activo?: boolean;
}

export interface EmpresaAsociada {
  id: number;
  ruc: string;
  razon_social: string;
  nombre_comercial?: string | null;
  rol: 'ADMIN' | 'USUARIO';
  activo?: boolean;
}

export interface EmpresaActiva {
  id: number;
  ruc: string;
  razon_social: string;
  nombre_comercial?: string | null;
  rol: 'ADMIN' | 'USUARIO';
}

export interface AuthContextType {
  usuario: Usuario | null;
  empresaActiva: EmpresaActiva | null;
  empresasDisponibles: EmpresaAsociada[];
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, usuario: Usuario, empresas: EmpresaAsociada[]) => void;
  logout: () => void;
  seleccionarEmpresa: (empresaId: number) => void;
}
