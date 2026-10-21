import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const CierresPage: React.FC = () => {
  const { empresaActiva } = useAuth();

  return (
    <div style={styles.page}>
      {/* Encabezado */}
      <header style={styles.header}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.badgePrimary}>CIERRE DE PERÍODOS & SNAPSHOTS</span>
            <span style={styles.badgeNeutral}>Fases 9 & 10 · Bloque 5</span>
          </div>
          <h1 style={styles.title}>Cierre y Reapertura de Períodos</h1>
          <p style={styles.subtitle}>
            Generación de versiones oficiales de cierre, snapshots criptográficos y control de auditoría — {empresaActiva?.razon_social ?? 'Empresa Activa'}
          </p>
        </div>
      </header>

      {/* Tarjeta de Control de Cierre (Placeholder funcional para Dev B) */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardIconWrap}>
            <span>🔒</span>
          </div>
          <div>
            <h2 style={styles.cardTitle}>Proceso de Cierre Oficial Mensual</h2>
            <p style={styles.cardSubtitle}>
              Congela las existencias y CPP oficiales, verifica 0 incidencias bloqueantes y guarda el hash SHA-256.
            </p>
          </div>
        </div>

        <div style={styles.controlsRow}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Seleccionar Período a Cerrar</label>
            <select style={styles.select} disabled defaultValue="">
              <option value="">Seleccione período contable</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <button type="button" disabled style={styles.btnPrimary}>
              🔒 Ejecutar Cierre Oficial
            </button>
            <button type="button" disabled style={styles.btnDanger}>
              🔓 Reapertura de Período
            </button>
          </div>
        </div>

        <div style={styles.infoBanner}>
          <div style={styles.infoIcon}>🛡️</div>
          <div>
            <strong style={{ color: '#0f172a' }}>Reglas Estrictas de Cierre Contable</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#475569' }}>
              Este módulo será completado por Dev B para conectar los modelos <code>CierrePeriodo</code> y <code>CierrePeriodoDetalle</code>, validar que no existan incidencias con <code>bloquea_cierre = true</code>, generar el archivo Excel oficial inmutable y calcular el <code>hash_resultado</code>.
            </p>
          </div>
        </div>

        {/* Empty State / Bandeja de Espera */}
        <div style={styles.emptyWrap}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📦</div>
          <h3 style={styles.emptyTitle}>Bandeja de Cierres Lista para Conexión</h3>
          <p style={styles.emptyDesc}>
            Las tablas <code>cierre_periodo</code> y <code>cierre_periodo_detalle</code> ya han sido migradas en PostgreSQL con sus restricciones únicas 1:1.
          </p>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    color: '#0f172a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '12px',
  },
  badgeRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '6px',
  },
  badgePrimary: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: '#047857',
    backgroundColor: '#d1fae5',
    padding: '3px 8px',
    borderRadius: '6px',
    textTransform: 'uppercase',
  },
  badgeNeutral: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#475569',
    backgroundColor: '#e2e8f0',
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
    color: '#475569',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f1f5f9',
  },
  cardIconWrap: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    backgroundColor: '#ecfdf5',
    color: '#059669',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
  },
  cardSubtitle: {
    margin: '3px 0 0 0',
    fontSize: '13px',
    color: '#64748b',
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '14px',
    flexWrap: 'wrap',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '240px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
  },
  btnPrimary: {
    backgroundColor: '#059669',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '13px',
    padding: '9px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'not-allowed',
    opacity: 0.7,
    whiteSpace: 'nowrap',
  },
  btnDanger: {
    backgroundColor: '#dc2626',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '13px',
    padding: '9px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'not-allowed',
    opacity: 0.7,
    whiteSpace: 'nowrap',
  },
  infoBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '8px',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
  },
  infoIcon: {
    fontSize: '18px',
  },
  emptyWrap: {
    padding: '40px 16px',
    textAlign: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px dashed #cbd5e1',
    color: '#475569',
  },
  emptyTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#0f172a',
  },
  emptyDesc: {
    margin: '6px 0 0 0',
    fontSize: '13px',
    color: '#64748b',
  },
};

export default CierresPage;
