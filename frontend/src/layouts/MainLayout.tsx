import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const MainLayout: React.FC = () => {
  const { usuario, empresaActiva, empresasDisponibles, seleccionarEmpresa, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={styles.layout}>
      <header style={styles.header}>
        <div style={styles.brandContainer}>
          <div style={styles.logoBadge}>FK</div>
          <div>
            <h1 style={styles.brandTitle}>FACT-KARD</h1>
            <span style={styles.brandSubtitle}>Sistema de Facturación y Kardex Valorizado</span>
          </div>
        </div>

        <nav style={styles.nav}>
          <NavLink
            to="/empresas"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            🏢 Empresas
          </NavLink>
          <NavLink
            to="/auditoria"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            📋 Auditoría
          </NavLink>
          <NavLink
            to="/catalogos"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            🌐 Catálogos
          </NavLink>
          <NavLink
            to="/periodos"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            📅 Períodos
          </NavLink>
          <NavLink
            to="/inventario"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            📦 Inventario
          </NavLink>
        </nav>

        <div style={styles.rightSection}>
          {empresasDisponibles.length > 0 ? (
            <div style={styles.empresaSelector}>
              <span style={styles.selectorLabel}>Empresa:</span>
              <select
                aria-label="Seleccionar Empresa"
                value={empresaActiva?.id || ''}
                onChange={(e) => seleccionarEmpresa(Number(e.target.value))}
                style={styles.select}
              >
                {empresasDisponibles.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.razon_social} ({emp.rol})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={styles.noEmpresaBadge}>
              {empresaActiva ? empresaActiva.razon_social : 'Sin empresa activa'}
            </div>
          )}

          <div style={styles.userInfo}>
            <span style={styles.username}>{usuario ? usuario.username : 'Usuario'}</span>
            {empresaActiva && (
              <span style={styles.roleBadge}>{empresaActiva.rol}</span>
            )}
          </div>

          <button onClick={handleLogout} style={styles.logoutButton}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <Outlet />
      </main>

      <footer style={styles.footer}>
        <span>FACT-KARD &copy; {new Date().getFullYear()} — ASESCON | Dupla Full-Stack + IA</span>
      </footer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 2rem',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  brandContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'var(--accent-primary)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '1rem',
    boxShadow: 'var(--shadow-sm)',
  },
  brandTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '0.5px',
    lineHeight: 1.2,
  },
  brandSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  nav: {
    display: 'flex',
    gap: '0.5rem',
  },
  navLink: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
  },
  navLinkActive: {
    backgroundColor: 'var(--bg-tertiary)',
    color: '#ffffff',
    fontWeight: 600,
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginLeft: 'auto',
  },
  empresaSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  selectorLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  select: {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
    outline: 'none',
    cursor: 'pointer',
  },
  noEmpresaBadge: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-tertiary)',
    padding: '0.3rem 0.6rem',
    borderRadius: '4px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  username: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  roleBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: 'var(--accent-primary)',
    border: '1px solid rgba(59, 130, 246, 0.4)',
  },
  logoutButton: {
    padding: '0.4rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    fontSize: '0.8rem',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  main: {
    flex: 1,
    padding: '2rem',
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
  },
  footer: {
    padding: '1rem 2rem',
    textAlign: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    borderTop: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
  },
};

export default MainLayout;
