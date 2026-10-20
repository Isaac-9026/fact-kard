import React from 'react';

export const DocumentosPage: React.FC = () => {
  return (
    <div style={styles.container}>
      {/* Encabezado */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Documentos Comerciales</h1>
          <p style={styles.subtitle}>
            Gestión y captura manual de comprobantes: Compras, Ventas, Notas de Crédito, Notas de Débito y Mesa de Revisión.
          </p>
        </div>
        <div style={styles.badgeDev}>
          <span style={styles.badgeDot} />
          <span>Fase 6 — En Construcción (Dev A)</span>
        </div>
      </div>

      {/* Tarjeta Informativa / Placeholder */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardIcon}>📑</span>
          <div>
            <h2 style={styles.cardTitle}>Captura y Registro de Comprobantes</h2>
            <p style={styles.cardSubtitle}>Módulo comercial preparado con el modelo <code>Documento</code> y <code>DocumentoDetalle</code> (Migración 4).</p>
          </div>
        </div>

        <div style={styles.gridFeatures}>
          <div style={styles.featureItem}>
            <div style={styles.featureHeader}>
              <span style={styles.featureIcon}>🛒</span>
              <strong>Compras & Gastos</strong>
            </div>
            <p style={styles.featureText}>Registro de facturas y boletas de proveedores con afectación de inventario y crédito fiscal.</p>
          </div>

          <div style={styles.featureItem}>
            <div style={styles.featureHeader}>
              <span style={styles.featureIcon}>📈</span>
              <strong>Ventas Comerciales</strong>
            </div>
            <p style={styles.featureText}>Emisión y registro de comprobantes de ventas para salida valorizada de existencias.</p>
          </div>

          <div style={styles.featureItem}>
            <div style={styles.featureHeader}>
              <span style={styles.featureIcon}>🔄</span>
              <strong>Notas de Crédito / Débito</strong>
            </div>
            <p style={styles.featureText}>Ajustes y devoluciones vinculadas al comprobante de origen con trazabilidad de tipo de cambio.</p>
          </div>

          <div style={styles.featureItem}>
            <div style={styles.featureHeader}>
              <span style={styles.featureIcon}>🔍</span>
              <strong>Mesa de Revisión</strong>
            </div>
            <p style={styles.featureText}>Control de estados: BORRADOR, PENDIENTE, EN_REVISION, CONFIRMADO y ANULADO.</p>
          </div>
        </div>

        <div style={styles.noteBox}>
          <strong>Nota de Arquitectura:</strong> Rutas preparadas para el desarrollo paralelo de Dev A. El backend cuenta con las tablas <code>documento</code> y <code>documento_detalle</code> validadas 1:1 con el estándar oficial de base de datos.
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 6px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
  },
  badgeDev: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '20px',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontSize: '13px',
    fontWeight: 600,
    border: '1px solid #bfdbfe',
  },
  badgeDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '28px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
    paddingBottom: '20px',
    borderBottom: '1px solid #f1f5f9',
  },
  cardIcon: {
    fontSize: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '60px',
    height: '60px',
    borderRadius: '12px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1e293b',
    margin: '0 0 4px 0',
  },
  cardSubtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0,
  },
  gridFeatures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  featureItem: {
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  featureHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    fontSize: '14px',
    color: '#0f172a',
  },
  featureIcon: {
    fontSize: '18px',
  },
  featureText: {
    fontSize: '13px',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.5,
  },
  noteBox: {
    padding: '14px 18px',
    borderRadius: '8px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    fontSize: '13px',
    lineHeight: 1.5,
  },
};

export default DocumentosPage;
