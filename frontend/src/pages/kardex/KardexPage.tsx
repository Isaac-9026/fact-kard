import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const KardexPage: React.FC = () => {
  const { empresaActiva } = useAuth();

  return (
    <div style={styles.page}>
      {/* Encabezado */}
      <header style={styles.header}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.badgePrimary}>MÓDULO KARDEX VALORIZADO</span>
            <span style={styles.badgeNeutral}>Fase 8 · Bloque 5</span>
          </div>
          <h1 style={styles.title}>Consulta de Kardex Valorizado</h1>
          <p style={styles.subtitle}>
            Kardex permanente valorizado en moneda nacional (PEN) y exportación a Excel — {empresaActiva?.razon_social ?? 'Empresa Activa'}
          </p>
        </div>
      </header>

      {/* Tarjeta de Filtros de Consulta (Placeholder funcional para Dev A) */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardIconWrap}>
            <span>📊</span>
          </div>
          <div>
            <h2 style={styles.cardTitle}>Filtros de Consulta de Kardex</h2>
            <p style={styles.cardSubtitle}>
              Seleccione el producto, período contable o rango de fechas para generar la sábana de movimientos.
            </p>
          </div>
        </div>

        <div style={styles.filtersGrid}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Producto</label>
            <select style={styles.select} disabled defaultValue="">
              <option value="">Todos los productos</option>
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Almacén</label>
            <select style={styles.select} disabled defaultValue="">
              <option value="">Todos los almacenes (Consolidado)</option>
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Período Contable</label>
            <select style={styles.select} disabled defaultValue="">
              <option value="">Período activo</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <button type="button" disabled style={styles.btnPrimary}>
              🔍 Consultar Kardex
            </button>
            <button type="button" disabled style={styles.btnSecondary}>
              📥 Exportar Excel (.xlsx)
            </button>
          </div>
        </div>

        <div style={styles.infoBanner}>
          <div style={styles.infoIcon}>💡</div>
          <div>
            <strong style={{ color: '#0f172a' }}>Motor Kardex Oficial (Formato 13.1 SUNAT)</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#475569' }}>
              Este módulo será completado por Dev A para consultar el historial cronológico valorizado al sexto decimal, el saldo acumulado en cantidad y valor, y la generación de archivos Excel oficiales mediante <code>openpyxl</code>.
            </p>
          </div>
        </div>

        {/* Empty State / Bandeja de Espera */}
        <div style={styles.emptyWrap}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📑</div>
          <h3 style={styles.emptyTitle}>Bandeja de Kardex Lista para Conexión</h3>
          <p style={styles.emptyDesc}>
            Los modelos y endpoints de movimientos y valorizaciones (<code>/api/kardex/movimientos/</code> y <code>/api/kardex/saldos-actuales/</code>) están listos en el backend.
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
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
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
    backgroundColor: '#eff6ff',
    color: '#2563eb',
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
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '14px',
    alignItems: 'flex-end',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
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
    backgroundColor: '#2563eb',
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
  btnSecondary: {
    backgroundColor: '#f1f5f9',
    color: '#334155',
    fontWeight: 600,
    fontSize: '13px',
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
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
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
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

export default KardexPage;
