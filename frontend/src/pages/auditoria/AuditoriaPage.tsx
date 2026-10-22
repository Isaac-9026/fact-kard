import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAuditoriaApi, type AuditoriaItem } from '../../api/auditoria';
import type { AxiosError } from 'axios';

export const AuditoriaPage: React.FC = () => {
  const { empresaActiva } = useAuth();
  const [logs, setLogs] = useState<AuditoriaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros
  const [filtroEntidad, setFiltroEntidad] = useState<string>('');
  const [filtroAccion, setFiltroAccion] = useState<string>('');

  // Modal de Detalle JSON
  const [selectedLog, setSelectedLog] = useState<AuditoriaItem | null>(null);

  const fetchAuditoria = useCallback(async () => {
    if (!empresaActiva) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);
      const data = await getAuditoriaApi({
        entidad: filtroEntidad,
        accion: filtroAccion,
      });
      setLogs(data);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      if (axiosErr.response?.data?.detail) {
        setErrorMsg(axiosErr.response.data.detail);
      } else {
        setErrorMsg('Error al consultar los registros de auditoría.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [empresaActiva, filtroEntidad, filtroAccion]);

  useEffect(() => {
    fetchAuditoria();
  }, [fetchAuditoria]);

  const handleClearFilters = () => {
    setFiltroEntidad('');
    setFiltroAccion('');
  };

  const formatFecha = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return isoString;
    }
  };

  const getActionBadgeStyle = (accion: string): React.CSSProperties => {
    const act = accion.toUpperCase();
    if (act.includes('CREAR') || act.includes('ASIGNAR')) {
      return {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        color: 'var(--accent-success)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
      };
    }
    if (act.includes('MODIFICAR') || act.includes('ACTUALIZAR')) {
      return {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        color: 'var(--accent-primary)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
      };
    }
    if (act.includes('ELIMINAR') || act.includes('EXTORNO') || act.includes('BLOQUEAR')) {
      return {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        color: 'var(--accent-danger)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
      };
    }
    return {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      color: 'var(--accent-warning)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
    };
  };

  const formatJson = useMemo(() => {
    return (data: Record<string, unknown> | null | undefined): string => {
      if (!data || Object.keys(data).length === 0) return 'Sin datos registrados';
      return JSON.stringify(data, null, 2);
    };
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <h1 style={styles.pageTitle}>Log de Auditoría</h1>
            <span style={styles.immutableBadge}>
              🛡️ Tabla Inmutable (Solo INSERT)
            </span>
          </div>
          <p style={styles.pageDescription}>
            Registro de trazabilidad y operaciones para{' '}
            <strong style={styles.highlightText}>
              {empresaActiva ? `${empresaActiva.razon_social} (RUC ${empresaActiva.ruc})` : 'Empresa no seleccionada'}
            </strong>.
          </p>
        </div>

        <button
          onClick={fetchAuditoria}
          disabled={isLoading}
          style={styles.refreshButton}
          title="Actualizar registros"
        >
          {isLoading ? 'Cargando...' : '🔄 Actualizar'}
        </button>
      </div>

      {/* Regla contable informativa */}
      <div style={styles.infoBanner}>
        <div style={styles.infoIcon}>⚖️</div>
        <div style={styles.infoContent}>
          <strong>Garantía de Fidelidad Contable:</strong> Todo evento operacional, asignación de permisos, cierre y extorno genera un registro persistente con <code>valor_anterior</code> y <code>valor_nuevo</code>. Los triggers SQL <code>trg_auditoria_no_update</code> y <code>trg_auditoria_no_delete</code> impiden cualquier alteración física en la base de datos.
        </div>
      </div>

      {/* Filtros */}
      <div style={styles.filtersCard}>
        <div style={styles.filterGroup}>
          <label htmlFor="filtro-entidad" style={styles.filterLabel}>Entidad</label>
          <input
            id="filtro-entidad"
            type="text"
            placeholder="Ej: USUARIO_EMPRESA, DOCUMENTO"
            value={filtroEntidad}
            onChange={(e) => setFiltroEntidad(e.target.value)}
            style={styles.filterInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <label htmlFor="filtro-accion" style={styles.filterLabel}>Acción</label>
          <input
            id="filtro-accion"
            type="text"
            placeholder="Ej: ASIGNAR_USUARIO, CREAR"
            value={filtroAccion}
            onChange={(e) => setFiltroAccion(e.target.value)}
            style={styles.filterInput}
          />
        </div>

        {(filtroEntidad || filtroAccion) && (
          <button onClick={handleClearFilters} style={styles.clearFilterButton}>
            ✕ Limpiar Filtros
          </button>
        )}

        <div style={styles.resultsBadge}>
          {logs.length} {logs.length === 1 ? 'registro' : 'registros'}
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div style={styles.errorAlert} role="alert">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}

      {/* Tabla contable */}
      <div style={styles.tableCard}>
        {isLoading ? (
          <div style={styles.emptyState}>
            <div style={styles.spinner} />
            <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>
              Cargando eventos de auditoría...
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyStateTitle}>No se encontraron registros de auditoría</p>
            <p style={styles.emptyStateSubtitle}>
              {filtroEntidad || filtroAccion
                ? 'Intenta ajustar o limpiar los filtros de búsqueda.'
                : 'No se han registrado operaciones para esta empresa.'}
            </p>
          </div>
        ) : (
          <div style={styles.tableResponsive}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '70px' }}>ID</th>
                  <th style={{ ...styles.th, width: '160px' }}>Fecha y Hora</th>
                  <th style={{ ...styles.th, width: '140px' }}>Usuario</th>
                  <th style={{ ...styles.th, width: '170px' }}>Acción</th>
                  <th style={{ ...styles.th, width: '160px' }}>Entidad</th>
                  <th style={{ ...styles.th, width: '110px', textAlign: 'right' }}>Reg. ID</th>
                  <th style={styles.th}>Motivo / Descripción</th>
                  <th style={{ ...styles.th, width: '110px', textAlign: 'center' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const hasJsonDiff = !!(log.valor_anterior || log.valor_nuevo);
                  return (
                    <tr key={log.id} style={styles.tr}>
                      <td style={styles.tdMono}>#{log.id}</td>
                      <td style={styles.tdMono}>{formatFecha(log.fecha)}</td>
                      <td style={styles.td}>
                        <span style={styles.userTag}>
                          👤 {log.usuario_username || `ID ${log.usuario_id || 'Sistema'}`}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...getActionBadgeStyle(log.accion) }}>
                          {log.accion}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <code style={styles.entityCode}>{log.entidad}</code>
                      </td>
                      <td style={{ ...styles.tdMono, textAlign: 'right' }}>
                        {log.registro_id !== null && log.registro_id !== undefined ? (
                          <span>{log.registro_id}</span>
                        ) : (
                          <span style={styles.textMuted}>—</span>
                        )}
                      </td>
                      <td style={styles.tdMotivo}>
                        {log.motivo || <span style={styles.textMuted}>Sin motivo especificado</span>}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        {hasJsonDiff ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            style={styles.diffButton}
                            title="Ver diferencias JSON"
                          >
                            JSON 🔍
                          </button>
                        ) : (
                          <span style={styles.textMuted}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Visor JSON Diferencial */}
      {selectedLog && (
        <div style={styles.modalOverlay} onClick={() => setSelectedLog(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>
                  Detalle de Cambios — Registro #{selectedLog.id}
                </h3>
                <p style={styles.modalSubtitle}>
                  Entidad: <code>{selectedLog.entidad}</code> • Acción: <strong>{selectedLog.accion}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={styles.modalCloseButton}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.diffGrid}>
                {/* Panel Valor Anterior */}
                <div style={styles.diffPanel}>
                  <div style={styles.diffPanelHeader}>
                    <span style={styles.diffLabelDanger}>Valor Anterior (Before)</span>
                  </div>
                  <pre style={styles.jsonViewer}>
                    {formatJson(selectedLog.valor_anterior)}
                  </pre>
                </div>

                {/* Panel Valor Nuevo */}
                <div style={styles.diffPanel}>
                  <div style={styles.diffPanelHeader}>
                    <span style={styles.diffLabelSuccess}>Valor Nuevo (After)</span>
                  </div>
                  <pre style={styles.jsonViewer}>
                    {formatJson(selectedLog.valor_nuevo)}
                  </pre>
                </div>
              </div>

              {selectedLog.motivo && (
                <div style={styles.modalMotivo}>
                  <strong>Motivo registrado:</strong> {selectedLog.motivo}
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => setSelectedLog(null)}
                style={styles.modalCloseFooterBtn}
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
  },
  pageDescription: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '0.35rem',
  },
  highlightText: {
    color: 'var(--text-primary)',
  },
  immutableBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.3rem 0.7rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: 'var(--accent-danger)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  refreshButton: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    padding: '0.6rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    transition: 'background-color 0.15s ease',
  },
  infoBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.85rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '1rem 1.25rem',
    fontSize: '0.85rem',
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  infoIcon: {
    fontSize: '1.35rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  infoContent: {
    flex: 1,
  },
  filtersCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    flex: '1 1 200px',
  },
  filterLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  filterInput: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '0.55rem 0.8rem',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
  },
  clearFilterButton: {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '0.55rem 0.85rem',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  resultsBadge: {
    marginLeft: 'auto',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-primary)',
    padding: '0.45rem 0.85rem',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    fontFamily: 'var(--font-mono)',
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    color: 'var(--accent-danger)',
    borderRadius: '8px',
    padding: '0.85rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  tableCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  tableResponsive: {
    overflowX: 'auto',
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.825rem',
    lineHeight: 1.4,
  },
  th: {
    textAlign: 'left',
    padding: '0.75rem 0.95rem',
    color: 'var(--text-muted)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderBottom: '1px solid var(--border-color)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontSize: '0.725rem',
  },
  tr: {
    borderBottom: '1px solid var(--border-light)',
    transition: 'background-color 0.1s ease',
  },
  td: {
    padding: '0.75rem 0.95rem',
    color: 'var(--text-secondary)',
    verticalAlign: 'middle',
  },
  tdMono: {
    padding: '0.75rem 0.95rem',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'middle',
  },
  tdMotivo: {
    padding: '0.75rem 0.95rem',
    color: 'var(--text-secondary)',
    maxWidth: '320px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    verticalAlign: 'middle',
  },
  userTag: {
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
  },
  badge: {
    display: 'inline-block',
    fontSize: '0.725rem',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.3px',
  },
  entityCode: {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--accent-primary)',
    padding: '0.2rem 0.45rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-mono)',
    border: '1px solid var(--border-color)',
  },
  diffButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: 'var(--accent-primary)',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '4px',
    padding: '0.25rem 0.55rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
  },
  textMuted: {
    color: 'var(--text-muted)',
  },
  emptyState: {
    padding: '3.5rem 1.5rem',
    textAlign: 'center',
  },
  emptyStateTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  emptyStateSubtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginTop: '0.35rem',
  },
  spinner: {
    display: 'inline-block',
    width: '28px',
    height: '28px',
    border: '3px solid rgba(255, 255, 255, 0.15)',
    borderTopColor: 'var(--accent-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    zIndex: 1000,
    backdropFilter: 'blur(3px)',
  },
  modalContent: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '850px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
  },
  modalHeader: {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  modalSubtitle: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    marginTop: '0.25rem',
  },
  modalCloseButton: {
    color: 'var(--text-muted)',
    fontSize: '1.25rem',
    padding: '0.2rem 0.5rem',
    cursor: 'pointer',
  },
  modalBody: {
    padding: '1.5rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  diffGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1rem',
  },
  diffPanel: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  diffPanelHeader: {
    padding: '0.6rem 0.85rem',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderBottom: '1px solid var(--border-color)',
  },
  diffLabelDanger: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--accent-danger)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
  },
  diffLabelSuccess: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--accent-success)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
  },
  jsonViewer: {
    padding: '0.85rem',
    margin: 0,
    fontSize: '0.8rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '260px',
    overflowY: 'auto',
  },
  modalMotivo: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
  },
  modalFooter: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  modalCloseFooterBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: '#ffffff',
    padding: '0.6rem 1.25rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default AuditoriaPage;
