import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const PeriodosPage: React.FC = () => {
  const { empresaActiva } = useAuth();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Períodos Fiscales y Configuración IGV</h1>
          <p style={styles.subtitle}>
            Módulo asignado a <strong>Dev A</strong> — Control de apertura/cierre de meses fiscales, estados de período y prorrateo de IGV.
          </p>
        </div>
        <span style={styles.badge}>Bloque 2 • Fase 4</span>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.icon}>📅</span>
          <div>
            <h2 style={styles.cardTitle}>Andamiaje Base — Gestión de Períodos Contables</h2>
            <p style={styles.cardDesc}>
              Empresa activa: <strong>{empresaActiva?.razon_social || 'Todas las empresas'}</strong>
            </p>
          </div>
        </div>

        <div style={styles.infoBox}>
          <p>
            📌 <strong>Espacio de trabajo reservado para Dev A:</strong> En este módulo se implementará la grilla de períodos mensuales (Año/Mes, estados ABIERTO, CERRADO, DESACTUALIZADO) y la configuración mensual de porcentaje de crédito fiscal IGV recuperable.
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
    gap: '1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '0.25rem',
  },
  badge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-success)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    fontFamily: 'var(--font-mono)',
  },
  card: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  icon: {
    fontSize: '2rem',
  },
  cardTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  cardDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  infoBox: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '1rem 1.25rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
};

export default PeriodosPage;
