import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const Formato131Page: React.FC = () => {
  const { empresaActiva } = useAuth();

  return (
    <div style={styles.page}>
      {/* Encabezado */}
      <header style={styles.header}>
        <div style={styles.titleWrap}>
          <div style={styles.badge}>BLOQUE 6 • FASES 13 & 14</div>
          <h1 style={styles.title}>Reporte Oficial Formato 13.1 SUNAT</h1>
          <p style={styles.subtitle}>
            Libro de Inventario Permanente Valorizado (Resolución de Superintendencia N° 234-2006/SUNAT) y Panel de Piloto Paralelo ·{' '}
            <strong>{empresaActiva?.razon_social || 'Empresa activa'}</strong>
          </p>
        </div>
      </header>

      {/* Grid de Estado / Placeholders */}
      <div style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>📜</span>
            <div>
              <h2 style={styles.cardTitle}>Generador Formato 13.1 Oficial</h2>
              <p style={styles.cardSubtitle}>
                Estructura canónica SUNAT desglosada por establecimiento anexo con CPP global y asignación de microdiferencias.
              </p>
            </div>
          </div>
          <div style={styles.placeholderBox}>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              Aquí se seleccionará el período cerrado y establecimiento para emitir el reporte tributario 13.1 imprimible y exportable.
            </p>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>⚖️</span>
            <div>
              <h2 style={styles.cardTitle}>Panel de Piloto Paralelo (Comparativa)</h2>
              <p style={styles.cardSubtitle}>
                Comparador automático entre el Kardex del sistema anterior y el cálculo oficial de FACT-KARD.
              </p>
            </div>
          </div>
          <div style={styles.placeholderBox}>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              Aquí se visualizarán las diferencias detectadas, alertas de tolerancia y el estado de la conciliación contable.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    color: '#0f172a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  badge: {
    alignSelf: 'flex-start',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    background: '#fef3c7',
    color: '#92400e',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: 0,
    fontSize: '13px',
    color: '#64748b',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '20px',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  cardIcon: {
    fontSize: '24px',
    background: '#f1f5f9',
    padding: '8px',
    borderRadius: '8px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
  },
  cardSubtitle: {
    margin: '3px 0 0',
    fontSize: '12px',
    color: '#64748b',
  },
  placeholderBox: {
    border: '2px dashed #cbd5e1',
    borderRadius: '8px',
    padding: '32px 16px',
    textAlign: 'center',
    background: '#f8fafc',
  },
};

export default Formato131Page;
