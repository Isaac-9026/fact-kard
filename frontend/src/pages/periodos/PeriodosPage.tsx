import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  obtenerPeriodos,
  crearPeriodo,
  cerrarPeriodo,
  reabrirPeriodo,
  configurarIgvPeriodo,
  type Periodo,
  type MetodoIgv,
} from '../../api/periodos';

export const PeriodosPage: React.FC = () => {
  const { empresaActiva, usuario } = useAuth();
  const esAdmin = Boolean(usuario?.es_admin_global || empresaActiva?.rol === 'ADMIN');

  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal: Crear Período
  const [modalCrearOpen, setModalCrearOpen] = useState(false);
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState(() => new Date().getMonth() + 1);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [guardandoPeriodo, setGuardandoPeriodo] = useState(false);

  // Modal: Configurar IGV
  const [modalIgvOpen, setModalIgvOpen] = useState(false);
  const [periodoIgv, setPeriodoIgv] = useState<Periodo | null>(null);
  const [metodoIgv, setMetodoIgv] = useState<MetodoIgv>('TOTAL');
  const [porcentajeProrrata, setPorcentajeProrrata] = useState('100.0000');
  const [guardandoIgv, setGuardandoIgv] = useState(false);

  // Modal: Reabrir Período
  const [modalReabrirOpen, setModalReabrirOpen] = useState(false);
  const [periodoReabrir, setPeriodoReabrir] = useState<Periodo | null>(null);
  const [motivoReapertura, setMotivoReapertura] = useState('');
  const [reabriendo, setReabriendo] = useState(false);

  // Auto-compute default dates when year or month changes in create modal
  useEffect(() => {
    if (anio && mes) {
      const year = Number(anio);
      const month = Number(mes);
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDate = new Date(year, month, 0).getDate();
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
      setFechaInicio(firstDay);
      setFechaFin(lastDay);
    }
  }, [anio, mes]);

  const cargarPeriodos = async () => {
    if (!empresaActiva) return;
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerPeriodos();
      setPeriodos(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Error al obtener los períodos contables.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPeriodos();
  }, [empresaActiva]);

  // Handlers
  const handleCrearPeriodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fechaFin < fechaInicio) {
      alert('La fecha de fin debe ser posterior o igual a la fecha de inicio.');
      return;
    }
    setGuardandoPeriodo(true);
    setError(null);
    try {
      const nuevo = await crearPeriodo({
        anio: Number(anio),
        mes: Number(mes),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      });
      setPeriodos((prev) => [nuevo, ...prev]);
      setModalCrearOpen(false);
      setSuccessMsg(`Período ${nuevo.anio}-${String(nuevo.mes).padStart(2, '0')} aperturado exitosamente.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const respData = (err as { response?: { data?: Record<string, string[] | string> } })?.response?.data;
      let msg = 'Error al crear el período contable.';
      if (respData) {
        msg = Object.entries(respData)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
          .join(' | ');
      }
      alert(msg);
    } finally {
      setGuardandoPeriodo(false);
    }
  };

  const abrirModalIgv = (p: Periodo) => {
    setPeriodoIgv(p);
    const existing = p.config_igv;
    if (existing) {
      setMetodoIgv(existing.metodo);
      setPorcentajeProrrata(existing.porcentaje_recuperable);
    } else {
      setMetodoIgv('TOTAL');
      setPorcentajeProrrata('100.0000');
    }
    setModalIgvOpen(true);
  };

  const handleGuardarIgv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodoIgv) return;
    setGuardandoIgv(true);
    try {
      const payload = {
        metodo: metodoIgv,
        porcentaje_recuperable:
          metodoIgv === 'PRORRATA'
            ? porcentajeProrrata
            : metodoIgv === 'TOTAL'
            ? '100.0000'
            : '0.0000',
      };
      const res = await configurarIgvPeriodo(periodoIgv.id, payload);
      setPeriodos((prev) =>
        prev.map((item) => (item.id === periodoIgv.id ? { ...item, config_igv: res } : item))
      );
      setModalIgvOpen(false);
      setSuccessMsg(`Criterio de IGV configurado en ${res.metodo} (${res.porcentaje_recuperable}%).`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const respData = (err as { response?: { data?: Record<string, string[] | string> } })?.response?.data;
      alert(respData?.detail || 'Error al guardar la configuración de IGV.');
    } finally {
      setGuardandoIgv(false);
    }
  };

  const abrirModalReapertura = (p: Periodo) => {
    setPeriodoReabrir(p);
    setMotivoReapertura('');
    setModalReabrirOpen(true);
  };

  const handleReabrir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodoReabrir) return;
    if (motivoReapertura.trim().length < 5) {
      alert('Debe ingresar un motivo detallado de reapertura (mínimo 5 caracteres).');
      return;
    }
    setReabriendo(true);
    try {
      const res = await reabrirPeriodo(periodoReabrir.id, {
        motivo_reapertura: motivoReapertura.trim(),
      });
      await cargarPeriodos();
      setModalReabrirOpen(false);
      setSuccessMsg(
        `Período ${periodoReabrir.anio}-${String(periodoReabrir.mes).padStart(2, '0')} reabierto. ${res.periodos_desactualizados} período(s) posterior(es) marcado(s) como DESACTUALIZADO.`
      );
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: unknown) {
      const respData = (err as { response?: { data?: Record<string, string[] | string> } })?.response?.data;
      alert(respData?.detail || 'Error al reabrir el período.');
    } finally {
      setReabriendo(false);
    }
  };

  const [cerrandoId, setCerrandoId] = useState<number | null>(null);

  const handleCerrarPeriodo = async (p: Periodo) => {
    if (!window.confirm(`¿Confirma el cierre del período fiscal ${p.anio}-${String(p.mes).padStart(2, '0')}?`)) {
      return;
    }
    setCerrandoId(p.id);
    try {
      await cerrarPeriodo(p.id);
      await cargarPeriodos();
      setSuccessMsg(`Período ${p.anio}-${String(p.mes).padStart(2, '0')} cerrado exitosamente.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const respData = (err as { response?: { data?: Record<string, string[] | string> } })?.response?.data;
      alert(respData?.detail || 'Error al cerrar el período.');
    } finally {
      setCerrandoId(null);
    }
  };

  // Metrics
  const metricas = useMemo(() => {
    const abiertos = periodos.filter((p) => p.estado === 'ABIERTO').length;
    const cerrados = periodos.filter((p) => p.estado === 'CERRADO').length;
    const desactualizados = periodos.filter((p) => p.estado === 'DESACTUALIZADO').length;
    return { total: periodos.length, abiertos, cerrados, desactualizados };
  }, [periodos]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitleRow}>
            <h1 style={styles.title}>Períodos Contables y Configuración IGV</h1>
            <span style={styles.badgeFiscal}>Control Fiscal • CPP</span>
          </div>
          <p style={styles.subtitle}>
            Apertura de meses contables, asignación de crédito fiscal IGV (Total, Nulo o Prorrata) y control estricto de reapertura con invalidación en cascada.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={cargarPeriodos} style={styles.btnSecondary} title="Recargar lista">
            🔄 Actualizar
          </button>
          <button onClick={() => setModalCrearOpen(true)} style={styles.btnPrimary}>
            + Nuevo Período
          </button>
        </div>
      </div>

      {/* Empresa Activa Indicator */}
      <div style={styles.companyBanner}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🏢</span>
          <div>
            <span style={styles.companyLabel}>EMPRESA ACTIVA:</span>
            <strong style={styles.companyName}>
              {empresaActiva ? `${empresaActiva.razon_social} (RUC: ${empresaActiva.ruc})` : 'Ninguna empresa seleccionada'}
            </strong>
          </div>
        </div>
        <span style={esAdmin ? styles.pillAdmin : styles.pillUser}>
          Rol: {empresaActiva?.rol || 'Sin Rol'}
        </span>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}
      {successMsg && <div style={styles.successBanner}>{successMsg}</div>}

      {/* Metric Cards */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Total Períodos</span>
          <span style={styles.metricVal}>{metricas.total}</span>
        </div>
        <div style={{ ...styles.metricCard, borderColor: 'rgba(16, 185, 129, 0.4)' }}>
          <span style={{ ...styles.metricLabel, color: 'var(--accent-success)' }}>Períodos Abiertos</span>
          <span style={{ ...styles.metricVal, color: 'var(--accent-success)' }}>{metricas.abiertos}</span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Períodos Cerrados</span>
          <span style={{ ...styles.metricVal, color: 'var(--text-secondary)' }}>{metricas.cerrados}</span>
        </div>
        <div style={{ ...styles.metricCard, borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <span style={{ ...styles.metricLabel, color: 'var(--accent-danger)' }}>Desactualizados</span>
          <span style={{ ...styles.metricVal, color: 'var(--accent-danger)' }}>{metricas.desactualizados}</span>
        </div>
      </div>

      {/* Main Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableCardHeader}>
          <h2 style={styles.tableTitle}>Registro de Períodos Fiscales</h2>
          <span style={styles.periodCountBadge}>{periodos.length} períodos registrados</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Período</th>
                <th style={styles.th}>Orden</th>
                <th style={styles.th}>Rango de Fechas</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Configuración IGV</th>
                <th style={styles.th}>Información Adicional</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {periodos.length === 0 ? (
                <tr>
                  <td colSpan={7} style={styles.tdEmpty}>
                    {loading ? 'Cargando períodos...' : 'No hay períodos registrados para esta empresa.'}
                  </td>
                </tr>
              ) : (
                periodos.map((p) => {
                  const estadoBadgeStyle =
                    p.estado === 'ABIERTO'
                      ? styles.badgeAbierto
                      : p.estado === 'CERRADO'
                      ? styles.badgeCerrado
                      : styles.badgeDesactualizado;

                  const cfg = p.config_igv;

                  return (
                    <tr key={p.id} style={styles.tr}>
                      {/* Period Year / Month */}
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={styles.periodPill}>
                            {p.anio} - {String(p.mes).padStart(2, '0')}
                          </span>
                        </div>
                      </td>

                      {/* Orden Monospace */}
                      <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {p.orden}
                      </td>

                      {/* Date Range */}
                      <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontSize: '0.825rem' }}>
                        {p.fecha_inicio} al {p.fecha_fin}
                      </td>

                      {/* Semantic Status Badge */}
                      <td style={styles.td}>
                        <span style={estadoBadgeStyle}>
                          <span style={styles.dot} />
                          {p.estado}
                        </span>
                      </td>

                      {/* IGV Criteria */}
                      <td style={styles.td}>
                        {cfg ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span
                              style={
                                cfg.metodo === 'TOTAL'
                                  ? styles.igvBadgeTotal
                                  : cfg.metodo === 'NULO'
                                  ? styles.igvBadgeNulo
                                  : styles.igvBadgeProrrata
                              }
                            >
                              {cfg.metodo} ({cfg.porcentaje_recuperable}%)
                            </span>
                            <span style={styles.igvSubText}>Crédito fiscal aplicable</span>
                          </div>
                        ) : (
                          <span style={styles.igvBadgeNone}>Sin Configurar</span>
                        )}
                      </td>

                      {/* Audit / Details */}
                      <td style={{ ...styles.td, fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                        {p.estado === 'DESACTUALIZADO' && p.motivo_desactualizado && (
                          <div style={styles.desactualizadoNote}>
                            ⚠️ <strong>Motivo:</strong> {p.motivo_desactualizado}
                          </div>
                        )}
                        {p.reabierto_en && (
                          <div style={styles.reabiertoNote}>
                            🔓 Reabierto el {new Date(p.reabierto_en).toLocaleDateString()}: <em>{p.motivo_reapertura}</em>
                          </div>
                        )}
                        {p.estado === 'ABIERTO' && !p.reabierto_en && <span>Período activo para registros.</span>}
                      </td>

                      {/* Actions */}
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => abrirModalIgv(p)}
                            style={styles.btnActionSecondary}
                            title="Configurar método de IGV para este período"
                          >
                            ⚙️ IGV
                          </button>

                          {esAdmin && p.estado === 'ABIERTO' && (
                            <button
                              onClick={() => handleCerrarPeriodo(p)}
                              disabled={cerrandoId === p.id}
                              style={styles.btnActionWarning}
                              title="Cerrar período contable"
                            >
                              {cerrandoId === p.id ? 'Cerrando...' : '🔒 Cerrar'}
                            </button>
                          )}

                          {esAdmin && (
                            <button
                              onClick={() => abrirModalReapertura(p)}
                              style={styles.btnActionDanger}
                              title="Reabrir período (marcará posteriores como DESACTUALIZADO)"
                            >
                              🔓 Reabrir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Apertura de Período */}
      {modalCrearOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Aperturar Nuevo Período Contable</h3>
              <button onClick={() => setModalCrearOpen(false)} style={styles.modalCloseBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearPeriodo} style={styles.modalForm}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Año Fiscal</label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={anio}
                    onChange={(e) => setAnio(Number(e.target.value))}
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Mes</label>
                  <select
                    value={mes}
                    onChange={(e) => setMes(Number(e.target.value))}
                    style={styles.select}
                    required
                  >
                    {[
                      '01 - Enero', '02 - Febrero', '03 - Marzo', '04 - Abril',
                      '05 - Mayo', '06 - Junio', '07 - Julio', '08 - Agosto',
                      '09 - Setiembre', '10 - Octubre', '11 - Noviembre', '12 - Diciembre',
                    ].map((mName, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {mName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.infoBannerSmall}>
                <span>Orden correlativo calculado automáticamente:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>
                  {anio * 100 + Number(mes)}
                </strong>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Fecha Inicio</label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Fecha Fin</label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setModalCrearOpen(false)}
                  style={styles.btnSecondary}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoPeriodo}
                  style={guardandoPeriodo ? styles.btnDisabled : styles.btnPrimary}
                >
                  {guardandoPeriodo ? 'Aperturando...' : 'Aperturar Período'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Configuración de IGV */}
      {modalIgvOpen && periodoIgv && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Configurar Criterio de IGV</h3>
                <p style={styles.modalSubtitle}>
                  Período: {periodoIgv.anio} - {String(periodoIgv.mes).padStart(2, '0')} ({periodoIgv.orden})
                </p>
              </div>
              <button onClick={() => setModalIgvOpen(false)} style={styles.modalCloseBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarIgv} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Método de Crédito Fiscal SUNAT</label>
                <select
                  value={metodoIgv}
                  onChange={(e) => setMetodoIgv(e.target.value as MetodoIgv)}
                  style={styles.select}
                  required
                >
                  <option value="TOTAL">TOTAL — 100% Recuperable (Operaciones gravadas)</option>
                  <option value="NULO">NULO — 0% Recuperable (Operaciones no gravadas)</option>
                  <option value="PRORRATA">PRORRATA — Porcentaje prorrateado (0% a 100%)</option>
                </select>
              </div>

              {metodoIgv === 'PRORRATA' && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Porcentaje Recuperable (%)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="100"
                    placeholder="Ej. 65.4500"
                    value={porcentajeProrrata}
                    onChange={(e) => setPorcentajeProrrata(e.target.value)}
                    style={{ ...styles.input, fontVariantNumeric: 'tabular-nums' }}
                    required
                  />
                  <small style={styles.fieldNote}>
                    Ingrese el coeficiente de prorrata con hasta 4 decimales según SUNAT.
                  </small>
                </div>
              )}

              <div style={styles.auditNote}>
                🔒 <strong>Auditoría Contable:</strong> Cada modificación a esta configuración queda registrada de forma inmutable con su usuario, fecha y valores anteriores.
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setModalIgvOpen(false)}
                  style={styles.btnSecondary}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoIgv}
                  style={guardandoIgv ? styles.btnDisabled : styles.btnSuccess}
                >
                  {guardandoIgv ? 'Guardando...' : 'Confirmar Configuración'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reapertura de Período (Solo ADMIN) */}
      {modalReabrirOpen && periodoReabrir && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalBox, border: '1px solid rgba(239, 68, 68, 0.4)' }}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ ...styles.modalTitle, color: 'var(--accent-danger)' }}>
                  ⚠️ Reapertura de Período Contable
                </h3>
                <p style={styles.modalSubtitle}>
                  Período: {periodoReabrir.anio} - {String(periodoReabrir.mes).padStart(2, '0')}
                </p>
              </div>
              <button onClick={() => setModalReabrirOpen(false)} style={styles.modalCloseBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleReabrir} style={styles.modalForm}>
              <div style={styles.warningBox}>
                <p>
                  <strong>REGLA ESTRICTA DE KARDEX:</strong> Al reabrir este período, el sistema marcará automáticamente todos los períodos posteriores que estén cerrados como <strong>DESACTUALIZADO</strong>. Esto obligará al recálculo del CPP y auditoría correspondiente.
                </p>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Motivo Detallado de Reapertura (Obligatorio)</label>
                <textarea
                  rows={4}
                  value={motivoReapertura}
                  onChange={(e) => setMotivoReapertura(e.target.value)}
                  placeholder="Explique detalladamente la razón contable (ej: Incorporación de facturas extemporáneas de compras emitidas con fecha del mes)..."
                  style={styles.textarea}
                  required
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setModalReabrirOpen(false)}
                  style={styles.btnSecondary}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={reabriendo}
                  style={reabriendo ? styles.btnDisabled : styles.btnDanger}
                >
                  {reabriendo ? 'Reabriendo...' : 'Confirmar Reapertura Oficial'}
                </button>
              </div>
            </form>
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
    gap: '1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
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
  badgeFiscal: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.65rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-success)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    fontFamily: 'var(--font-mono)',
  },
  companyBanner: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '0.85rem 1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  companyLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 700,
    letterSpacing: '0.5px',
    display: 'block',
  },
  companyName: {
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
  },
  pillAdmin: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--accent-primary)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  pillUser: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid var(--accent-danger)',
    color: '#fca5a5',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid var(--accent-success)',
    color: '#86efac',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
  },
  metricCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  metricLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  metricVal: {
    fontSize: '1.6rem',
    fontWeight: 800,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
  },
  tableCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  tableCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-color)',
  },
  tableTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  periodCountBadge: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.875rem',
  },
  th: {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    transition: 'background-color 0.15s',
  },
  td: {
    padding: '0.85rem 1rem',
    color: 'var(--text-primary)',
    verticalAlign: 'middle',
  },
  tdEmpty: {
    padding: '2.5rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  periodPill: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: 'currentColor',
    display: 'inline-block',
  },
  badgeAbierto: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-success)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  badgeCerrado: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
  },
  badgeDesactualizado: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--accent-danger)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  igvBadgeTotal: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--accent-primary)',
    display: 'inline-block',
  },
  igvBadgeNulo: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    display: 'inline-block',
  },
  igvBadgeProrrata: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: 'var(--accent-warning)',
    display: 'inline-block',
  },
  igvBadgeNone: {
    fontSize: '0.75rem',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
  },
  igvSubText: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  desactualizadoNote: {
    color: '#f87171',
    lineHeight: 1.3,
  },
  reabiertoNote: {
    color: 'var(--text-secondary)',
    lineHeight: 1.3,
  },
  btnActionSecondary: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 600,
    transition: 'all 0.15s',
  },
  btnActionDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: 'var(--accent-danger)',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 600,
    transition: 'all 0.15s',
  },
  btnActionWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    color: 'var(--accent-warning)',
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 600,
    transition: 'all 0.15s',
  },
  btnPrimary: {
    backgroundColor: 'var(--accent-primary)',
    color: '#ffffff',
    padding: '0.55rem 1.15rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.875rem',
    boxShadow: 'var(--shadow-sm)',
  },
  btnSuccess: {
    backgroundColor: 'var(--accent-success)',
    color: '#ffffff',
    padding: '0.55rem 1.15rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.875rem',
    boxShadow: 'var(--shadow-sm)',
  },
  btnDanger: {
    backgroundColor: 'var(--accent-danger)',
    color: '#ffffff',
    padding: '0.55rem 1.15rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.875rem',
  },
  btnSecondary: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    padding: '0.55rem 1rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.875rem',
  },
  btnDisabled: {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    padding: '0.55rem 1.15rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'not-allowed',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modalBox: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '480px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    boxShadow: 'var(--shadow-lg)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  modalSubtitle: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    marginTop: '0.2rem',
  },
  modalCloseBtn: {
    fontSize: '1.2rem',
    color: 'var(--text-muted)',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  formRow: {
    display: 'flex',
    gap: '1rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  input: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: '8px',
    padding: '0.55rem 0.85rem',
    fontSize: '0.9rem',
    outline: 'none',
  },
  select: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: '8px',
    padding: '0.55rem 0.85rem',
    fontSize: '0.9rem',
    outline: 'none',
  },
  textarea: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  infoBannerSmall: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    padding: '0.6rem 0.85rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldNote: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  auditNote: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    padding: '0.75rem 0.9rem',
    borderRadius: '8px',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '0.85rem',
    borderRadius: '8px',
    fontSize: '0.825rem',
    lineHeight: 1.4,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
};

export default PeriodosPage;
