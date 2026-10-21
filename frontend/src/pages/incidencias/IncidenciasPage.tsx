import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  obtenerIncidencias,
  obtenerRecalculos,
  resolverIncidencia,
  ejecutarRecalculo,
  type Incidencia,
  type Recalculo,
} from '../../api/kardex';
import { getProductos, type Producto } from '../../api/inventario';
import { useAuth } from '../../context/AuthContext';

export const IncidenciasPage: React.FC = () => {
  const { empresaActiva, usuario } = useAuth();
  const [tab, setTab] = useState<'incidencias' | 'recalculos'>('incidencias');
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [recalculos, setRecalculos] = useState<Recalculo[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulario de Recálculo Manual
  const [recalculoProducto, setRecalculoProducto] = useState<string>('');
  const [recalculoFecha, setRecalculoFecha] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [ejecutandoRecalculo, setEjecutandoRecalculo] = useState<boolean>(false);

  // Modal de Detalle de Recálculo
  const [recalculoSeleccionado, setRecalculoSeleccionado] = useState<Recalculo | null>(null);

  const esAdmin = Boolean(usuario?.es_admin_global || empresaActiva?.rol === 'ADMIN');

  const cargar = useCallback(async () => {
    if (!empresaActiva) return;
    setLoading(true);
    try {
      const [listaIncidencias, listaRecalculos, listaProductos] = await Promise.all([
        obtenerIncidencias(),
        obtenerRecalculos(),
        getProductos(),
      ]);
      setIncidencias(listaIncidencias);
      setRecalculos(listaRecalculos);
      setProductos(listaProductos);
    } catch {
      setError('No se pudo cargar la información del motor Kardex.');
    } finally {
      setLoading(false);
    }
  }, [empresaActiva?.id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarEstado = async (id: number, nuevoEstado: 'RESUELTA' | 'DESCARTADA') => {
    setError(null);
    setSuccess(null);
    try {
      await resolverIncidencia(id, nuevoEstado);
      setSuccess(`Incidencia #${id} marcada como ${nuevoEstado}.`);
      await cargar();
    } catch {
      setError('No se pudo actualizar el estado de la incidencia.');
    }
  };

  const handleEjecutarRecalculo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recalculoProducto || !recalculoFecha) {
      setError('Debe seleccionar el producto y la fecha desde la cual recalcular.');
      return;
    }
    setError(null);
    setSuccess(null);
    setEjecutandoRecalculo(true);
    try {
      await ejecutarRecalculo(Number(recalculoProducto), recalculoFecha);
      setSuccess('Recálculo cronológico ejecutado exitosamente.');
      await cargar();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const msg = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
        setError(`Error al ejecutar recálculo: ${msg}`);
      } else {
        setError('Ocurrió un error al ejecutar el recálculo.');
      }
    } finally {
      setEjecutandoRecalculo(false);
    }
  };

  const getNombreProducto = (id: number) => {
    const prod = productos.find((p) => p.id === id);
    return prod ? `${prod.codigo_interno} — ${prod.descripcion}` : `Producto #${id}`;
  };

  return (
    <div style={styles.page}>
      {/* Encabezado */}
      <header style={styles.header}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.badgePrimary}>CONTROL DE CALIDAD KARDEX</span>
            <span style={styles.badgeNeutral}>Fase 7 · Auditoría & Recálculos</span>
          </div>
          <h1 style={styles.title}>Incidencias y Recálculos de Kardex</h1>
          <p style={styles.subtitle}>
            Supervisión de inconsistencias contables, bloqueos de cierre y motor de recálculo cronológico — {empresaActiva?.razon_social ?? 'Empresa Activa'}
          </p>
        </div>
      </header>

      {/* Alertas */}
      {error && (
        <div style={styles.alertError} role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}
      {success && (
        <div style={styles.alertSuccess} role="status">
          <strong>Éxito:</strong> {success}
        </div>
      )}

      {/* Selector de Pestañas */}
      <div style={styles.tabBar}>
        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(tab === 'incidencias' ? styles.tabBtnActive : {}),
          }}
          onClick={() => setTab('incidencias')}
        >
          <span>⚠️ Incidencias Registradas</span>
          <span style={styles.tabBadge}>{incidencias.length}</span>
        </button>

        <button
          type="button"
          style={{
            ...styles.tabBtn,
            ...(tab === 'recalculos' ? styles.tabBtnActive : {}),
          }}
          onClick={() => setTab('recalculos')}
        >
          <span>🔄 Historial de Recálculos</span>
          <span style={styles.tabBadge}>{recalculos.length}</span>
        </button>
      </div>

      {/* PESTAÑA 1: INCIDENCIAS */}
      {tab === 'incidencias' && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Bandeja de Incidencias Contables</h2>
              <p style={styles.cardSubtitle}>
                Las incidencias con bloqueo de cierre deben resolverse o descartarse antes de cerrar el período mensual.
              </p>
            </div>
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={() => void cargar()}
              disabled={loading}
            >
              🔄 Actualizar
            </button>
          </div>

          {loading ? (
            <div style={styles.emptyWrap}>Cargando incidencias...</div>
          ) : incidencias.length === 0 ? (
            <div style={styles.emptyWrap}>
              <p style={{ margin: 0, fontWeight: 700, color: '#166534', fontSize: '15px' }}>
                ✓ No hay incidencias registradas
              </p>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                El inventario y las operaciones contables no presentan inconsistencias ni descalces.
              </span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Severidad</th>
                    <th style={styles.th}>Descripción</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Bloquea Cierre</th>
                    <th style={styles.th}>Estado</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {incidencias.map((i) => (
                    <tr key={i.id} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: 700 }}>
                        <span style={styles.typeCode}>{i.tipo}</span>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badgeBase,
                            ...(i.severidad === 'CRITICA' || i.severidad === 'ERROR'
                              ? styles.badgeError
                              : i.severidad === 'ADVERTENCIA'
                              ? styles.badgeAdvertencia
                              : styles.badgeInfo),
                          }}
                        >
                          {i.severidad}
                        </span>
                      </td>
                      <td style={{ ...styles.td, maxWidth: '340px' }}>
                        <div style={{ color: '#0f172a', fontWeight: 500 }}>{i.descripcion}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Detectado: {new Date(i.detectado_en).toLocaleString()}
                        </div>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        {i.bloquea_cierre ? (
                          <span style={styles.badgeBloqueo}>SÍ (Bloquea)</span>
                        ) : (
                          <span style={styles.badgeNoBloqueo}>No</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badgeBase,
                            ...(i.estado === 'RESUELTA'
                              ? styles.badgeConfirmado
                              : i.estado === 'DESCARTADA'
                              ? styles.badgeDescartada
                              : styles.badgeBorrador),
                          }}
                        >
                          {i.estado}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {esAdmin && i.estado === 'PENDIENTE' ? (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              style={styles.btnSuccessSm}
                              onClick={() => void cambiarEstado(i.id, 'RESUELTA')}
                              title="Marcar como resuelta"
                            >
                              Resolver
                            </button>
                            <button
                              type="button"
                              style={styles.btnDangerSm}
                              onClick={() => void cambiarEstado(i.id, 'DESCARTADA')}
                              title="Descartar incidencia"
                            >
                              Descartar
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: RECÁLCULOS */}
      {tab === 'recalculos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Disparador de Recálculo Manual */}
          {esAdmin && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h2 style={styles.cardTitle}>Disparar Recálculo Cronológico</h2>
                  <p style={styles.cardSubtitle}>
                    Recorre todos los movimientos del producto desde la fecha indicada re-valorizando el CPP y las existencias.
                  </p>
                </div>
              </div>

              <form onSubmit={handleEjecutarRecalculo} style={styles.formRow3}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Producto *</label>
                  <select
                    required
                    style={styles.select}
                    value={recalculoProducto}
                    onChange={(e) => setRecalculoProducto(e.target.value)}
                  >
                    <option value="">Seleccione producto</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo_interno} — {p.descripcion}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Fecha Desde *</label>
                  <input
                    required
                    type="date"
                    style={styles.input}
                    value={recalculoFecha}
                    onChange={(e) => setRecalculoFecha(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={ejecutandoRecalculo}
                    style={styles.btnPrimary}
                  >
                    {ejecutandoRecalculo ? 'Recalculando...' : '⚡ Ejecutar Recálculo'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabla de Historial de Recálculos */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Historial de Recálculos ({recalculos.length})</h2>
                <p style={styles.cardSubtitle}>
                  Registro de ejecuciones automáticas y manuales del motor de costeo.
                </p>
              </div>
            </div>

            {loading ? (
              <div style={styles.emptyWrap}>Cargando historial de recálculos...</div>
            ) : recalculos.length === 0 ? (
              <div style={styles.emptyWrap}>
                <p style={{ margin: 0, fontWeight: 600 }}>No hay recálculos registrados.</p>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Los recálculos se disparan automáticamente ante documentos atrasados o manualmente desde el formulario superior.
                </span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>ID</th>
                      <th style={styles.th}>Producto</th>
                      <th style={styles.th}>Fecha Desde</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Versión</th>
                      <th style={styles.th}>Estado</th>
                      <th style={styles.th}>Ejecutado El</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Movimientos Afectados</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recalculos.map((r) => (
                      <tr key={r.id} style={styles.tr}>
                        <td style={{ ...styles.td, fontWeight: 700, fontFamily: 'monospace' }}>
                          #{r.id}
                        </td>
                        <td style={{ ...styles.td, fontWeight: 600 }}>
                          {getNombreProducto(r.producto)}
                        </td>
                        <td style={styles.td}>{r.fecha_desde}</td>
                        <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace' }}>
                          v{r.version}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badgeBase,
                              ...(r.estado === 'OK' ? styles.badgeConfirmado : styles.badgeError),
                            }}
                          >
                            {r.estado}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {new Date(r.ejecutado_en).toLocaleString()}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace' }}>
                          {r.detalles ? r.detalles.length : 0}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          {r.detalles && r.detalles.length > 0 ? (
                            <button
                              type="button"
                              style={styles.btnSecondarySm}
                              onClick={() => setRecalculoSeleccionado(r)}
                            >
                              Ver Variaciones
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>Sin cambios</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Detalle de Variaciones de Costo */}
      {recalculoSeleccionado && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>
                  Detalle de Recálculo #{recalculoSeleccionado.id} — v{recalculoSeleccionado.version}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {getNombreProducto(recalculoSeleccionado.producto)} · Desde {recalculoSeleccionado.fecha_desde}
                </span>
              </div>
              <button
                type="button"
                style={styles.btnClose}
                onClick={() => setRecalculoSeleccionado(null)}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Mov. ID</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>CPP Anterior</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>CPP Nuevo</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Valor Anterior</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Valor Nuevo</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Saldo Anterior</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Saldo Nuevo</th>
                  </tr>
                </thead>
                <tbody>
                  {recalculoSeleccionado.detalles.map((d, idx) => (
                    <tr key={idx} style={styles.tr}>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontWeight: 600 }}>
                        #{d.movimiento_id}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace' }}>
                        {d.cpp_anterior ? parseFloat(d.cpp_anterior).toFixed(6) : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', color: '#16a34a', fontWeight: 700 }}>
                        {d.cpp_nuevo ? parseFloat(d.cpp_nuevo).toFixed(6) : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace' }}>
                        {d.valor_anterior ? parseFloat(d.valor_anterior).toFixed(2) : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                        {d.valor_nuevo ? parseFloat(d.valor_nuevo).toFixed(2) : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace' }}>
                        {d.saldo_anterior ? parseFloat(d.saldo_anterior).toFixed(2) : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                        {d.saldo_nuevo ? parseFloat(d.saldo_nuevo).toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={() => setRecalculoSeleccionado(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    color: '#0f172a', // Dark text explicitly
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
    color: '#b45309',
    backgroundColor: '#fef3c7',
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
  tabBar: {
    display: 'flex',
    gap: '8px',
    borderBottom: '2px solid #e2e8f0',
    paddingBottom: '2px',
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    borderRadius: '8px 8px 0 0',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    color: '#2563eb',
    boxShadow: '0 -2px 5px rgba(0,0,0,0.03)',
    borderBottom: '2px solid #2563eb',
  },
  tabBadge: {
    backgroundColor: '#e2e8f0',
    color: '#334155',
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: '999px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '16px',
    borderBottom: '1px solid #f1f5f9',
    flexWrap: 'wrap',
    gap: '12px',
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
  formRow3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
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
  input: {
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
    padding: '9px 18px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
  },
  btnSecondary: {
    backgroundColor: '#ffffff',
    color: '#334155',
    fontWeight: 600,
    fontSize: '13px',
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
  },
  btnSecondarySm: {
    backgroundColor: '#f1f5f9',
    color: '#334155',
    fontWeight: 600,
    fontSize: '11px',
    padding: '4px 10px',
    borderRadius: '5px',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
  },
  btnSuccessSm: {
    backgroundColor: '#16a34a',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '11px',
    padding: '4px 10px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
  },
  btnDangerSm: {
    backgroundColor: '#dc2626',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '11px',
    padding: '4px 10px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    textAlign: 'left',
  },
  th: {
    backgroundColor: '#f8fafc',
    color: '#475569',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '10px 14px',
    borderBottom: '1px solid #e2e8f0',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '12px 14px',
    color: '#1e293b',
    verticalAlign: 'middle',
  },
  typeCode: {
    fontFamily: 'monospace',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
  },
  badgeBase: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  badgeError: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fecaca',
  },
  badgeAdvertencia: {
    backgroundColor: '#ffedd5',
    color: '#9a3412',
    border: '1px solid #fed7aa',
  },
  badgeInfo: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    border: '1px solid #bae6fd',
  },
  badgeBorrador: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fde68a',
  },
  badgeConfirmado: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    border: '1px solid #bbf7d0',
  },
  badgeDescartada: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    border: '1px solid #cbd5e1',
  },
  badgeBloqueo: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    border: '1px solid #fca5a5',
    fontWeight: 800,
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '999px',
  },
  badgeNoBloqueo: {
    color: '#64748b',
    fontSize: '12px',
  },
  alertError: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  alertSuccess: {
    backgroundColor: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  emptyWrap: {
    padding: '36px 16px',
    textAlign: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px dashed #cbd5e1',
    color: '#475569',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 9999,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    width: '100%',
    maxWidth: '900px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: '#f8fafc',
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
  },
  btnClose: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#475569',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: '16px 20px',
    overflowY: 'auto',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '12px 20px',
    borderTop: '1px solid #f1f5f9',
    backgroundColor: '#f8fafc',
  },
};

export default IncidenciasPage;
