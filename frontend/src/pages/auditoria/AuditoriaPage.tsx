import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const AuditoriaPage: React.FC = () => {
  const { empresaActiva } = useAuth();

  const placeholderLogs = [
    {
      id: 1,
      fecha: '2026-10-19 18:19:42',
      usuario: 'admin_test',
      accion: 'MIGRACION_INICIAL',
      entidad: 'DATABASE',
      registro_id: 1,
      motivo: 'Ejecución exitosa de Migración 1 (Modelos de BD y triggers)',
    },
    {
      id: 2,
      fecha: '2026-10-19 18:21:40',
      usuario: 'admin_test',
      accion: 'TEST_INMUTABILIDAD',
      entidad: 'AUDITORIA',
      registro_id: 1,
      motivo: 'Comprobación de bloqueo de UPDATE y DELETE en tabla auditoria',
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Visor de Auditoría</h2>
          <p style={styles.pageDescription}>
            Módulo asignado a <strong>Dev A</strong> — Registro inmutable de transacciones y operaciones del sistema.
          </p>
        </div>
        <div style={styles.immutableBadge}>
          🛡️ Tabla Inmutable (Solo INSERT)
        </div>
      </div>

      <div style={styles.infoBox}>
        <strong>Regla Estricta de Auditoría:</strong> Toda modificación o extorno de datos en FACT-KARD genera un registro obligatorio con <code>valor_anterior</code> y <code>valor_nuevo</code>. Los triggers <code>trg_auditoria_no_update</code> y <code>trg_auditoria_no_delete</code> impiden cualquier alteración o borrado a nivel de base de datos.
      </div>

      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h3 style={styles.cardTitle}>
            Registros de Auditoría — {empresaActiva ? empresaActiva.razon_social : 'Todas las empresas'}
          </h3>
          <span style={styles.countBadge}>{placeholderLogs.length} eventos</span>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Fecha</th>
              <th style={styles.th}>Usuario</th>
              <th style={styles.th}>Acción</th>
              <th style={styles.th}>Entidad</th>
              <th style={styles.th}>Registro ID</th>
              <th style={styles.th}>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {placeholderLogs.map((log) => (
              <tr key={log.id} style={styles.tr}>
                <td style={styles.td}><code>{log.id}</code></td>
                <td style={styles.td}>{log.fecha}</td>
                <td style={styles.td}><span style={styles.userBadge}>{log.usuario}</span></td>
                <td style={styles.td}><span style={styles.actionBadge}>{log.accion}</span></td>
                <td style={styles.td}><code>{log.entidad}</code></td>
                <td style={styles.td}>{log.registro_id}</td>
                <td style={styles.td}>{log.motivo}</td>
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
  immutableBadge: {
    fontSize: '0.8rem',
    fontWeight: 600,
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--accent-danger)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  infoBox: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '1rem 1.25rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
  },
  tableCard: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    padding: '1.25rem',
    overflowX: 'auto',
  },
  tableHeader: {
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
  countBadge: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-tertiary)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.65rem 0.75rem',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border-color)',
    fontWeight: 600,
  },
  tr: {
    borderBottom: '1px solid var(--border-light)',
  },
  td: {
    padding: '0.65rem 0.75rem',
    color: 'var(--text-secondary)',
  },
  userBadge: {
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  actionBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-success)',
  },
};

export default AuditoriaPage;
