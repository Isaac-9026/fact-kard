import React from 'react';

export const OperacionesInternasPage: React.FC = () => {
  return (
    <div style={styles.container}>
      {/* Encabezado */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Operaciones Internas y Saldo Inicial</h1>
          <p style={styles.subtitle}>
            Captura manual de inventarios: Saldo Inicial y Notas Internas (Mermas, Desmedros, Sobrantes, Faltantes y Ajustes de Valor).
          </p>
        </div>
        <div style={styles.badgeDev}>
          <span style={styles.badgeDot} />
          <span>Fase 6 — En Construcción (Dev B)</span>
        </div>
      </div>

      {/* Tarjeta Informativa / Placeholder */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardIcon}>📝</span>
          <div>
            <h2 style={styles.cardTitle}>Control de Movimientos Internos de Almacén</h2>
            <p style={styles.cardSubtitle}>Módulo operativo respaldado por <code>SaldoInicial</code>, <code>NotaInterna</code> y <code>NotaInternaDetalle</code> (Migración 4).</p>
          </div>
        </div>

        <div style={styles.gridFeatures}>
          <div style={styles.featureItem}>
            <div style={styles.featureHeader}>
              <span style={styles.featureIcon}>🏁</span>
              <strong>Saldos Iniciales</strong>
            </div>
            <p style={styles.featureText}>Apertura de inventario físico y monetario por período, almacén y producto (CPP inicial).</p>
          </div>

          <div style={styles.featureItem}>
            <div style={styles.featureHeader}>
              <span style={styles.featureIcon}>📉</span>
              <strong>Mermas y Desmedros</strong>
            </div>
            <p style={styles.featureText}>Salidas extraordinarias con sustento técnico, informe de desmedro y tipo de operación interna.</p>
          </div>

          <div style={styles.featureItem}>
            <div style={styles.featureHeader}>
              <span style={styles.featureIcon}>⚖️</span>
              <strong>Ajustes de Inventario</strong>
            </div>
            <p style={styles.featureText}>Regularización de existencias físicas (sobrantes y faltantes) y reclasificaciones entre almacenes.</p>
          </div>

          <div style={styles.featureItem}>
            <div style={styles.featureHeader}>
              <span style={styles.featureIcon}>💵</span>
              <strong>Ajustes de Valor (CPP)</strong>
            </div>
            <p style={styles.featureText}>Modificación de costos sin variación de unidades físicas para cumplimiento del costo promedio ponderado.</p>
          </div>
        </div>

        <div style={styles.noteBox}>
          <strong>Nota de Arquitectura:</strong> Rutas preparadas para el desarrollo paralelo de Dev B. El backend cuenta con las tablas <code>saldo_inicial</code>, <code>nota_interna</code> y <code>nota_interna_detalle</code> validadas 1:1 con el estándar oficial de base de datos.
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
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: '13px',
    fontWeight: 600,
    border: '1px solid #fde68a',
  },
  badgeDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#f59e0b',
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

export default OperacionesInternasPage;
