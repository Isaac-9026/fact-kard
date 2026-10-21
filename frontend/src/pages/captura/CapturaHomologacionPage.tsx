import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const CapturaHomologacionPage: React.FC = () => {
  const { empresaActiva } = useAuth();

  return (
    <div style={styles.page}>
      {/* Encabezado */}
      <header style={styles.header}>
        <div style={styles.titleWrap}>
          <div style={styles.badge}>BLOQUE 6 • FASES 11 & 12</div>
          <h1 style={styles.title}>Captura XML / OCR y Homologación</h1>
          <p style={styles.subtitle}>
            Importación automática de comprobantes electrónicos (UBL 2.1) y catálogo de equivalencias de proveedores ·{' '}
            <strong>{empresaActiva?.razon_social || 'Empresa activa'}</strong>
          </p>
        </div>
      </header>

      {/* Grid de Estado / Placeholders */}
      <div style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>📥</span>
            <div>
              <h2 style={styles.cardTitle}>Importación de Comprobantes XML / UBL</h2>
              <p style={styles.cardSubtitle}>
                Carga de facturas electrónicas de compra en formato XML para extracción automática de cabecera y líneas.
              </p>
            </div>
          </div>
          <div style={styles.placeholderBox}>
            <div style={styles.dropzone}>
              <span style={{ fontSize: '32px' }}>📄</span>
              <p style={{ margin: '8px 0 0', fontWeight: 600, color: '#334155' }}>
                Arrastre archivos XML o PDF aquí para iniciar la captura
              </p>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Soporta XML Factura (01) y Nota de Crédito (07) SUNAT UBL 2.1
              </span>
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>🔄</span>
            <div>
              <h2 style={styles.cardTitle}>Homologación de Productos (Equivalencias)</h2>
              <p style={styles.cardSubtitle}>
                Mapeo inteligente entre códigos y descripciones del proveedor y el catálogo interno de la empresa.
              </p>
            </div>
          </div>
          <div style={styles.placeholderBox}>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              Aquí se listarán las equivalencias sugeridas y confirmadas para evitar duplicación de productos al importar facturas.
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
    background: '#e0e7ff',
    color: '#3730a3',
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
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
};

export default CapturaHomologacionPage;
