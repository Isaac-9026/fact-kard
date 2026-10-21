import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const MainLayout: React.FC = () => {
  const { usuario, empresaActiva, empresasDisponibles, seleccionarEmpresa, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Helper to determine the section title for the topbar breadcrumb
  const getCurrentSection = (path: string) => {
    if (path.startsWith('/documentos')) {
      return { section: 'OPERACIONES', title: 'Documentos Comerciales', icon: '📑' };
    }
    if (path.startsWith('/operaciones-internas')) {
      return { section: 'OPERACIONES', title: 'Operaciones Internas', icon: '📝' };
    }
    if (path.startsWith('/transferencias')) {
      return { section: 'OPERACIONES', title: 'Transferencias entre Almacenes', icon: '🔄' };
    }
    if (path.startsWith('/incidencias')) {
      return { section: 'OPERACIONES', title: 'Incidencias y Recálculos', icon: '⚠️' };
    }
    if (path.startsWith('/kardex')) {
      return { section: 'KARDEX Y CIERRE', title: 'Consulta de Kardex Valorizado', icon: '📊' };
    }
    if (path.startsWith('/cierres')) {
      return { section: 'KARDEX Y CIERRE', title: 'Cierre y Reapertura de Períodos', icon: '🔒' };
    }
    if (path.startsWith('/inventario')) {
      return { section: 'MAESTROS Y FISCAL', title: 'Inventario y Terceros', icon: '📦' };
    }
    if (path.startsWith('/periodos')) {
      return { section: 'MAESTROS Y FISCAL', title: 'Períodos e IGV', icon: '📅' };
    }
    if (path.startsWith('/catalogos')) {
      return { section: 'MAESTROS Y FISCAL', title: 'Catálogos y Tipo de Cambio', icon: '🌐' };
    }
    if (path.startsWith('/empresas')) {
      return { section: 'SEGURIDAD Y EMPRESA', title: 'Empresas y Anexos', icon: '🏢' };
    }
    if (path.startsWith('/auditoria')) {
      return { section: 'SEGURIDAD Y EMPRESA', title: 'Registro de Auditoría', icon: '📋' };
    }
    return { section: 'SISTEMA', title: 'Panel Principal', icon: '📊' };
  };

  const currentSection = getCurrentSection(location.pathname);
  const esAdmin = Boolean(usuario?.es_admin_global || empresaActiva?.rol === 'ADMIN');

  return (
    <div style={styles.layout}>
      {/* 1. SIDEBAR IZQUIERDO FIJO */}
      <aside
        style={{
          ...styles.sidebar,
          width: collapsed ? '72px' : '260px',
        }}
      >
        {/* Cabecera del Sidebar */}
        <div style={styles.sidebarHeader}>
          <div style={styles.brandContainer}>
            <div style={styles.logoBadge}>FK</div>
            {!collapsed && (
              <div style={styles.brandTextWrap}>
                <span style={styles.brandTitle}>FACT-KARD</span>
                <span style={styles.brandSubtitle}>Sistema Kardex SUNAT</span>
              </div>
            )}
          </div>
        </div>

        {/* Navegación Vertical por Secciones */}
        <nav style={styles.sidebarNav}>
          {/* SECCIÓN: OPERACIONES */}
          <div style={styles.navGroup}>
            {!collapsed ? (
              <span style={styles.groupHeader}>OPERACIONES</span>
            ) : (
              <div style={styles.groupDivider} />
            )}

            <NavLink
              to="/documentos"
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title="Documentos Comerciales"
            >
              <span style={styles.navIcon}>📑</span>
              {!collapsed && <span style={styles.navText}>Documentos Comerciales</span>}
            </NavLink>

            <NavLink
              to="/operaciones-internas"
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title="Operaciones Internas"
            >
              <span style={styles.navIcon}>📝</span>
              {!collapsed && <span style={styles.navText}>Operaciones Internas</span>}
            </NavLink>

            <NavLink
              to="/transferencias"
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title="Transferencias entre Almacenes"
            >
              <span style={styles.navIcon}>🔄</span>
              {!collapsed && <span style={styles.navText}>Transferencias</span>}
            </NavLink>

            <NavLink
              to="/incidencias"
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title="Bandeja de Incidencias y Recálculos"
            >
              <span style={styles.navIcon}>⚠️</span>
              {!collapsed && <span style={styles.navText}>Incidencias</span>}
            </NavLink>
          </div>

          {/* SECCIÓN: KARDEX Y CIERRE */}
          <div style={styles.navGroup}>
            {!collapsed ? (
              <span style={styles.groupHeader}>KARDEX Y CIERRE</span>
            ) : (
              <div style={styles.groupDivider} />
            )}

            <NavLink
              to="/kardex"
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title="Kardex Valorizado (SUNAT 13.1)"
            >
              <span style={styles.navIcon}>📊</span>
              {!collapsed && <span style={styles.navText}>Kardex Valorizado</span>}
            </NavLink>

            <NavLink
              to="/cierres"
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title="Cierre de Períodos"
            >
              <span style={styles.navIcon}>🔒</span>
              {!collapsed && <span style={styles.navText}>Cierre de Períodos</span>}
            </NavLink>
          </div>

          {/* SECCIÓN: MAESTROS Y FISCAL */}
          <div style={styles.navGroup}>
            {!collapsed ? (
              <span style={styles.groupHeader}>MAESTROS Y FISCAL</span>
            ) : (
              <div style={styles.groupDivider} />
            )}

            <NavLink
              to="/inventario"
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title="Inventario y Terceros"
            >
              <span style={styles.navIcon}>📦</span>
              {!collapsed && <span style={styles.navText}>Inventario y Terceros</span>}
            </NavLink>

            <NavLink
              to="/periodos"
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title="Períodos e IGV"
            >
              <span style={styles.navIcon}>📅</span>
              {!collapsed && <span style={styles.navText}>Períodos e IGV</span>}
            </NavLink>

            <NavLink
              to="/catalogos"
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title="Catálogos y TC"
            >
              <span style={styles.navIcon}>🌐</span>
              {!collapsed && <span style={styles.navText}>Catálogos y TC</span>}
            </NavLink>
          </div>

          {/* SECCIÓN: SEGURIDAD Y EMPRESA */}
          <div style={styles.navGroup}>
            {!collapsed ? (
              <span style={styles.groupHeader}>SEGURIDAD Y EMPRESA</span>
            ) : (
              <div style={styles.groupDivider} />
            )}

            <NavLink
              to="/empresas"
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title="Empresas y Anexos"
            >
              <span style={styles.navIcon}>🏢</span>
              {!collapsed && <span style={styles.navText}>Empresas y Anexos</span>}
            </NavLink>

            <NavLink
              to="/auditoria"
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title="Auditoría"
            >
              <span style={styles.navIcon}>📋</span>
              {!collapsed && <span style={styles.navText}>Auditoría</span>}
            </NavLink>
          </div>
        </nav>

        {/* Pie del Sidebar: Estado del Sistema */}
        <div style={styles.sidebarFooter}>
          <div style={styles.systemStatus}>
            <span style={styles.statusDot} />
            {!collapsed && (
              <div style={styles.statusTextWrap}>
                <span style={styles.statusTitle}>SUNAT Conectado</span>
                <span style={styles.statusVersion}>Fases 4 & 5 • CPP 13.1</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. CONTENEDOR DERECHO */}
      <div style={styles.rightContainer}>
        {/* TOPBAR SUPERIOR (Alto ~60px, fondo blanco con borde inferior sutil) */}
        <header style={styles.topbar}>
          {/* Izquierda: Botón Toggle y Breadcrumb / Sección */}
          <div style={styles.topbarLeft}>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              style={styles.collapseBtn}
              title={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
              aria-label="Colapsar menú lateral"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div style={styles.breadcrumb}>
              <span style={styles.breadcrumbCategory}>{currentSection.section}</span>
              <span style={styles.breadcrumbDivider}>/</span>
              <span style={styles.breadcrumbCurrent}>
                <span style={{ marginRight: '6px' }}>{currentSection.icon}</span>
                {currentSection.title}
              </span>
            </div>
          </div>

          {/* Derecha: Selector de Empresa Activa, Rol, Usuario y Logout */}
          <div style={styles.topbarRight}>
            {/* Selector de Empresa Activa (Destacado como contexto principal) */}
            <div style={styles.empresaContextCard}>
              <span style={styles.empresaContextIcon}>🏢</span>
              <div style={styles.empresaSelectWrap}>
                <span style={styles.empresaContextLabel}>EMPRESA ACTIVA</span>
                {empresasDisponibles.length > 0 ? (
                  <select
                    aria-label="Seleccionar Empresa Activa"
                    value={empresaActiva?.id || ''}
                    onChange={(e) => seleccionarEmpresa(Number(e.target.value))}
                    style={styles.empresaSelect}
                  >
                    {empresasDisponibles.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.razon_social} ({emp.ruc})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={styles.empresaFallbackName}>
                    {empresaActiva ? empresaActiva.razon_social : 'Sin empresa activa'}
                  </span>
                )}
              </div>
            </div>

            {/* Badge de Rol */}
            <span style={esAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser}>
              {empresaActiva?.rol || (usuario?.es_admin_global ? 'ADMIN' : 'USUARIO')}
            </span>

            {/* Identificador de Usuario */}
            <div style={styles.userSection}>
              <div style={styles.userAvatar}>
                {usuario?.username ? usuario.username.charAt(0).toUpperCase() : 'U'}
              </div>
              <span style={styles.userName}>{usuario ? usuario.username : 'Usuario'}</span>
            </div>

            {/* Botón Cerrar Sesión */}
            <button
              type="button"
              onClick={handleLogout}
              style={styles.logoutBtn}
              title="Cerrar sesión del sistema"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: '4px' }}
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Salir</span>
            </button>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL (<main> con flex-1 p-6 bg-slate-50 overflow-x-auto) */}
        <main style={styles.mainContent}>
          <div style={styles.contentWrapper}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    backgroundColor: '#f8fafc', // slate-50
    fontFamily: "var(--font-sans, 'Inter', sans-serif)",
  },

  /* SIDEBAR STYLES (Slate-900 oscuro sobrio) */
  sidebar: {
    backgroundColor: '#0f172a', // slate-900
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    borderRight: '1px solid #1e293b',
    transition: 'width 0.2s cubic-bezier(0.2, 0, 0, 1)',
    zIndex: 40,
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
  },
  sidebarHeader: {
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 1rem',
    borderBottom: '1px solid #1e293b',
  },
  brandContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    overflow: 'hidden',
  },
  logoBadge: {
    width: '34px',
    height: '34px',
    minWidth: '34px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.95rem',
    letterSpacing: '-0.5px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.25)',
  },
  brandTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  brandTitle: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '0.5px',
    lineHeight: 1.2,
  },
  brandSubtitle: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    letterSpacing: '0.2px',
  },
  sidebarNav: {
    flex: 1,
    padding: '1rem 0.65rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  navGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  groupHeader: {
    fontSize: '0.675rem',
    fontWeight: 700,
    color: '#64748b', // slate-500
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '0.35rem 0.65rem',
    userSelect: 'none',
  },
  groupDivider: {
    height: '1px',
    backgroundColor: '#1e293b',
    margin: '0.5rem 0',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.55rem 0.75rem',
    borderRadius: '6px',
    color: '#94a3b8',
    fontSize: '0.875rem',
    fontWeight: 500,
    textDecoration: 'none',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  navItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa', // blue-400
    fontWeight: 600,
    boxShadow: 'inset 3px 0 0 #3b82f6',
  },
  navIcon: {
    fontSize: '1.1rem',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sidebarFooter: {
    padding: '0.75rem 1rem',
    borderTop: '1px solid #1e293b',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  systemStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    minWidth: '8px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
  },
  statusTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  statusTitle: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  statusVersion: {
    fontSize: '0.675rem',
    color: '#64748b',
  },

  /* CONTENEDOR DERECHO */
  rightContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    // Scoped CSS variables to give child screens rich, high-contrast B2B styling
    '--bg-primary': '#f8fafc',
    '--bg-secondary': '#ffffff',
    '--bg-tertiary': '#f1f5f9',
    '--bg-card': '#ffffff',
    '--text-primary': '#0f172a',
    '--text-secondary': '#475569',
    '--text-muted': '#64748b',
    '--border-color': '#e2e8f0',
    '--border-light': 'rgba(0, 0, 0, 0.06)',
    '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
    '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
  } as React.CSSProperties,

  /* TOPBAR SUPERIOR (Alto ~60px, fondo blanco) */
  topbar: {
    height: '60px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    gap: '1rem',
    position: 'sticky',
    top: 0,
    zIndex: 30,
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
  },
  topbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    overflow: 'hidden',
  },
  collapseBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#475569',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, color 0.15s ease',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.875rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  breadcrumbCategory: {
    color: '#64748b',
    fontWeight: 600,
    fontSize: '0.75rem',
    letterSpacing: '0.04em',
  },
  breadcrumbDivider: {
    color: '#cbd5e1',
    fontWeight: 400,
  },
  breadcrumbCurrent: {
    color: '#0f172a',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
  },

  topbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    flexShrink: 0,
  },
  empresaContextCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '0.25rem 0.65rem',
    transition: 'border-color 0.15s ease',
  },
  empresaContextIcon: {
    fontSize: '1.05rem',
  },
  empresaSelectWrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  empresaContextLabel: {
    fontSize: '0.625rem',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.05em',
    lineHeight: 1,
    marginBottom: '2px',
  },
  empresaSelect: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#0f172a',
    fontSize: '0.825rem',
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
    maxWidth: '220px',
  },
  empresaFallbackName: {
    fontSize: '0.825rem',
    fontWeight: 600,
    color: '#0f172a',
  },
  roleBadgeAdmin: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    backgroundColor: '#e0e7ff', // indigo-100
    color: '#4338ca', // indigo-700
    border: '1px solid #c7d2fe',
    letterSpacing: '0.04em',
  },
  roleBadgeUser: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    backgroundColor: '#f1f5f9', // slate-100
    color: '#475569', // slate-600
    border: '1px solid #e2e8f0',
    letterSpacing: '0.04em',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  userAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.8rem',
  },
  userName: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#0f172a',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#64748b',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease',
  },

  /* CONTENIDO PRINCIPAL */
  mainContent: {
    flex: 1,
    padding: '1.5rem',
    backgroundColor: '#f8fafc',
    overflowX: 'auto',
  },
  contentWrapper: {
    maxWidth: '1600px',
    margin: '0 auto',
    width: '100%',
  },
};

export default MainLayout;
