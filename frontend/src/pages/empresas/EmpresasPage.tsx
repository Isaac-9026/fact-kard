import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const EmpresasPage: React.FC = () => {
  const { empresaActiva, empresasDisponibles } = useAuth();

  return (
    <div style={styles.container}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Gestión de Empresas y Configuración</h2>
          <p style={styles.pageDescription}>
            Módulo asignado a <strong>Dev B</strong> — Administración multiempresa, asignación de roles y parámetros contables.
          </p>
        </div>
        <button style={styles.actionButton}>+ Nueva Empresa</button>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Empresa Activa</h3>
            <span style={styles.badgeActive}>Seleccionada</span>
          </div>

          {empresaActiva ? (
            <div style={styles.detailsList}>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Razón Social:</span>
                <span style={styles.detailValue}>{empresaActiva.razon_social}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>RUC:</span>
                <span style={styles.detailValue}>{empresaActiva.ruc}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Nombre Comercial:</span>
                <span style={styles.detailValue}>{empresaActiva.nombre_comercial || '—'}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Rol del Usuario:</span>
                <span style={styles.badgeRole}>{empresaActiva.rol}</span>
              </div>
            </div>
          ) : (
            <p style={styles.emptyText}>No hay ninguna empresa seleccionada actualmente.</p>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Parámetros de Cálculo (ConfigEmpresa)</h3>
            <span style={styles.badgeConfig}>Reglas SQL 1:1</span>
          </div>
          <div style={styles.detailsList}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Método de Valuación:</span>
              <span style={styles.detailValue}>CPP (Costo Promedio Ponderado)</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Decimales de Cálculo:</span>
              <span style={styles.detailValue}>6 (Permitido: 2 a 8)</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Regla de Redondeo:</span>
              <span style={styles.detailValue}>ROUND_HALF_UP</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Tolerancia Residuo:</span>
              <span style={styles.detailValue}>S/ 0.05000000 PEN</span>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.tableCard}>
        <h3 style={styles.cardTitle}>Empresas Asociadas ({empresasDisponibles.length})</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>RUC</th>
              <th style={styles.th}>Razón Social</th>
              <th style={styles.th}>Rol</th>
              <th style={styles.th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {empresasDisponibles.map((emp) => (
              <tr key={emp.id} style={styles.tr}>
                <td style={styles.td}>{emp.id}</td>
                <td style={styles.td}><code>{emp.ruc}</code></td>
                <td style={styles.td}>{emp.razon_social}</td>
                <td style={styles.td}><span style={styles.badgeRole}>{emp.rol}</span></td>
                <td style={styles.td}><span style={styles.badgeActive}>ACTIVA</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  pageDescription: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '0.25rem',
  },
  actionButton: {
    backgroundColor: 'var(--accent-primary)',
    color: '#ffffff',
    padding: '0.55rem 1.1rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    padding: '1.25rem',
  },
  tableCard: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    padding: '1.25rem',
    overflowX: 'auto',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  cardTitle: {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  detailsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
    borderBottom: '1px solid var(--border-light)',
    paddingBottom: '0.4rem',
  },
  detailLabel: {
    color: 'var(--text-muted)',
  },
  detailValue: {
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
  },
  badgeActive: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-success)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  badgeConfig: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--accent-primary)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  badgeRole: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: 'var(--accent-primary)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '0.75rem',
    fontSize: '0.875rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.6rem 0.75rem',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border-color)',
    fontWeight: 600,
  },
  tr: {
    borderBottom: '1px solid var(--border-light)',
  },
  td: {
    padding: '0.6rem 0.75rem',
    color: 'var(--text-secondary)',
  },
};

export default EmpresasPage;
