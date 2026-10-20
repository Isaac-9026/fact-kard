import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const IncidenciasPage: React.FC = () => {
  const { empresaActiva } = useAuth();

  return (
    <div style={styles.container}>
      {/* Encabezado */}
      <header style={styles.header}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.badge}>MÓDULO EN PREPARACIÓN</span>
            <span style={styles.versionBadge}>Bloque 4 · Fase 7</span>
          </div>
          <h1 style={styles.title}>Bandeja de Incidencias y Recálculos</h1>
          <p style={styles.subtitle}>
            Supervisión y resolución de inconsistencias del motor Kardex ({empresaActiva?.razon_social || 'Empresa Activa'})
          </p>
        </div>
      </header>

      {/* Tarjeta Informativa / Placeholder */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.iconCircle}>
            <span>⚠️</span>
          </div>
          <div>
            <h2 style={styles.cardTitle}>Motor de Integridad y Recálculo de Kardex</h2>
            <p style={styles.cardDesc}>
              Detección de stock negativo, descalces de CPP y control de bloqueos de cierre mensual.
            </p>
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.infoBox}>
            <div style={styles.infoBoxIcon}>🛑</div>
            <div style={styles.infoBoxTitle}>Bloqueo de Cierre</div>
            <div style={styles.infoBoxText}>
              Las incidencias con <code>bloquea_cierre = true</code> impiden el cierre del período fiscal hasta su resolución o descarte.
            </div>
          </div>

          <div style={styles.infoBox}>
            <div style={styles.infoBoxIcon}>🔄</div>
            <div style={styles.infoBoxTitle}>Recálculo Cronológico</div>
            <div style={styles.infoBoxText}>
              Propagación en cadena de variaciones de costo unitario para documentos extemporáneos o notas de ajuste.
            </div>
          </div>

          <div style={styles.infoBox}>
            <div style={styles.infoBoxIcon}>📊</div>
            <div style={styles.infoBoxTitle}>Cachés y Consistencia</div>
            <div style={styles.infoBoxText}>
              Sincronización atómica entre <code>stock_almacen</code>, <code>saldo_cpp_actual</code> y los registros inmutables de <code>movimiento</code>.
            </div>
          </div>
        </div>

        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🛡️</div>
          <h3 style={styles.emptyTitle}>Bandeja de Incidencias Lista para Implementación</h3>
          <p style={styles.emptyText}>
            Los modelos <code>Incidencia</code>, <code>Recalculo</code>, <code>RecalculoDetalle</code>, <code>ValorizacionMovimiento</code>, <code>StockAlmacen</code> y <code>SaldoCppActual</code> ya están sincronizados en PostgreSQL.
          </p>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px',
  },
  badgeRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#b45309',
    backgroundColor: '#fef3c7',
    padding: '3px 8px',
    borderRadius: '6px',
    textTransform: 'uppercase',
  },
  versionBadge: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#475569',
    backgroundColor: '#f1f5f9',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#64748b',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '28px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    paddingBottom: '20px',
    borderBottom: '1px solid #f1f5f9',
  },
  iconCircle: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: '#fffbeb',
    color: '#d97706',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '17px',
    fontWeight: 700,
    color: '#1e293b',
  },
  cardDesc: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#64748b',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
    margin: '24px 0',
  },
  infoBox: {
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '18px',
  },
  infoBoxIcon: {
    fontSize: '24px',
    marginBottom: '10px',
  },
  infoBoxTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '6px',
  },
  infoBoxText: {
    fontSize: '12.5px',
    color: '#64748b',
    lineHeight: '1.5',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '1px dashed #cbd5e1',
  },
  emptyIcon: {
    fontSize: '36px',
    marginBottom: '12px',
  },
  emptyTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#334155',
  },
  emptyText: {
    margin: '6px 0 0 0',
    fontSize: '13px',
    color: '#64748b',
  },
};

export default IncidenciasPage;
