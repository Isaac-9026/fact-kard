import React, { useEffect, useState, useMemo } from 'react';
import {
  obtenerMonedas,
  obtenerTiposComprobante,
  obtenerTiposOperacion,
  obtenerTiposExistencia,
  obtenerUnidadesMedida,
  obtenerTiposCambio,
  crearTipoCambio,
  resolverTipoCambio,
  type Moneda,
  type TipoComprobante,
  type TipoOperacion,
  type TipoExistencia,
  type UnidadMedida,
  type TipoCambio,
  type TipoCambioResolverResult,
} from '../../api/catalogos';

type TabKey = 'tc' | 'comprobantes' | 'operaciones' | 'existencias' | 'unidades' | 'monedas';

export const CatalogosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('tc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Data states
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [comprobantes, setComprobantes] = useState<TipoComprobante[]>([]);
  const [operaciones, setOperaciones] = useState<TipoOperacion[]>([]);
  const [existencias, setExistencias] = useState<TipoExistencia[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [tiposCambio, setTiposCambio] = useState<TipoCambio[]>([]);

  // Resolver tester state
  const [testMoneda, setTestMoneda] = useState('USD');
  const [testFecha, setTestFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [resolviendo, setResolviendo] = useState(false);
  const [resolverError, setResolverError] = useState<string | null>(null);
  const [resolverResult, setResolverResult] = useState<TipoCambioResolverResult | null>(null);

  // New TC modal/form state
  const [modalTcOpen, setModalTcOpen] = useState(false);
  const [nuevoTc, setNuevoTc] = useState({
    moneda_codigo: 'USD',
    fecha_publicacion: new Date().toISOString().split('T')[0],
    compra: '',
    venta: '',
    fuente: 'SBS',
  });
  const [guardandoTc, setGuardandoTc] = useState(false);

  // Initial load
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, c, o, e, u, tc] = await Promise.all([
        obtenerMonedas(),
        obtenerTiposComprobante(),
        obtenerTiposOperacion(),
        obtenerTiposExistencia(),
        obtenerUnidadesMedida(),
        obtenerTiposCambio(),
      ]);
      setMonedas(m);
      setComprobantes(c);
      setOperaciones(o);
      setExistencias(e);
      setUnidades(u);
      setTiposCambio(tc);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Error al conectar con el servidor de catálogos.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testFecha) return;
    setResolviendo(true);
    setResolverError(null);
    setResolverResult(null);
    try {
      const res = await resolverTipoCambio(testMoneda, testFecha);
      setResolverResult(res);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string; fecha?: string[] } } })?.response?.data?.detail ||
        (err as { response?: { data?: { fecha?: string[] } } })?.response?.data?.fecha?.[0];
      setResolverError(msg || 'No se encontró un tipo de cambio aplicable para esta fecha.');
    } finally {
      setResolviendo(false);
    }
  };

  const handleCrearTc = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoTc(true);
    setError(null);
    try {
      const creado = await crearTipoCambio({
        moneda_codigo: nuevoTc.moneda_codigo,
        fecha_publicacion: nuevoTc.fecha_publicacion,
        compra: nuevoTc.compra,
        venta: nuevoTc.venta,
        fuente: nuevoTc.fuente || 'SBS',
      });
      setTiposCambio((prev) => [creado, ...prev]);
      setModalTcOpen(false);
      setNuevoTc({
        moneda_codigo: 'USD',
        fecha_publicacion: new Date().toISOString().split('T')[0],
        compra: '',
        venta: '',
        fuente: 'SBS',
      });
    } catch (err: unknown) {
      const respData = (err as { response?: { data?: Record<string, string[] | string> } })?.response?.data;
      let msg = 'Error al registrar el tipo de cambio.';
      if (respData) {
        msg = Object.entries(respData)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
          .join(' | ');
      }
      alert(msg);
    } finally {
      setGuardandoTc(false);
    }
  };

  // Filtered views
  const filteredComprobantes = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return comprobantes.filter(
      (c) => c.codigo_sunat.toLowerCase().includes(q) || c.descripcion.toLowerCase().includes(q)
    );
  }, [comprobantes, searchTerm]);

  const filteredOperaciones = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return operaciones.filter(
      (o) =>
        o.codigo_interno.toLowerCase().includes(q) ||
        (o.codigo_sunat && o.codigo_sunat.toLowerCase().includes(q)) ||
        o.descripcion.toLowerCase().includes(q) ||
        o.naturaleza.toLowerCase().includes(q)
    );
  }, [operaciones, searchTerm]);

  const filteredExistencias = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return existencias.filter(
      (e) => e.codigo.toLowerCase().includes(q) || e.descripcion.toLowerCase().includes(q)
    );
  }, [existencias, searchTerm]);

  const filteredUnidades = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return unidades.filter(
      (u) => u.codigo.toLowerCase().includes(q) || u.descripcion.toLowerCase().includes(q)
    );
  }, [unidades, searchTerm]);

  const filteredTc = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return tiposCambio.filter(
      (tc) =>
        tc.fecha_publicacion.includes(q) ||
        tc.moneda_codigo.toLowerCase().includes(q) ||
        tc.fuente.toLowerCase().includes(q)
    );
  }, [tiposCambio, searchTerm]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitleRow}>
            <h1 style={styles.title}>Catálogos SUNAT y Tipo de Cambio</h1>
            <span style={styles.badgeOfficial}>SUNAT • Tablas Oficiales</span>
          </div>
          <p style={styles.subtitle}>
            Administración centralizada de Tablas 5, 6, 10 y 12 de SUNAT, resolución de Tipo de Cambio SBS/SUNAT y soporte de feriados.
          </p>
        </div>
        <button
          onClick={cargarDatos}
          disabled={loading}
          style={loading ? styles.btnDisabled : styles.btnSecondary}
          title="Recargar catálogos"
        >
          {loading ? 'Cargando...' : '🔄 Actualizar'}
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Tabs navigation */}
      <div style={styles.tabNav}>
        <button
          onClick={() => { setActiveTab('tc'); setSearchTerm(''); }}
          style={activeTab === 'tc' ? styles.tabBtnActive : styles.tabBtn}
        >
          💵 Tipo de Cambio SBS ({tiposCambio.length})
        </button>
        <button
          onClick={() => { setActiveTab('comprobantes'); setSearchTerm(''); }}
          style={activeTab === 'comprobantes' ? styles.tabBtnActive : styles.tabBtn}
        >
          📄 Comprobantes ({comprobantes.length})
        </button>
        <button
          onClick={() => { setActiveTab('operaciones'); setSearchTerm(''); }}
          style={activeTab === 'operaciones' ? styles.tabBtnActive : styles.tabBtn}
        >
          ⚡ Operaciones ({operaciones.length})
        </button>
        <button
          onClick={() => { setActiveTab('existencias'); setSearchTerm(''); }}
          style={activeTab === 'existencias' ? styles.tabBtnActive : styles.tabBtn}
        >
          📦 Existencias ({existencias.length})
        </button>
        <button
          onClick={() => { setActiveTab('unidades'); setSearchTerm(''); }}
          style={activeTab === 'unidades' ? styles.tabBtnActive : styles.tabBtn}
        >
          ⚖️ Unidades de Medida ({unidades.length})
        </button>
        <button
          onClick={() => { setActiveTab('monedas'); setSearchTerm(''); }}
          style={activeTab === 'monedas' ? styles.tabBtnActive : styles.tabBtn}
        >
          🪙 Monedas ({monedas.length})
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'tc' && (
        <div style={styles.tcSection}>
          {/* Official Resolver Tester */}
          <div style={styles.resolverCard}>
            <div style={styles.resolverCardHeader}>
              <span style={{ fontSize: '1.5rem' }}>🎯</span>
              <div>
                <h2 style={styles.resolverTitle}>Probador de Tipo de Cambio Contable Oficial</h2>
                <p style={styles.resolverSubtitle}>
                  Aplica la regla oficial: busca la fecha exacta o, en fines de semana y feriados bancarios, hereda el último tipo de cambio publicado previo.
                </p>
              </div>
            </div>

            <form onSubmit={handleResolver} style={styles.resolverForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Moneda</label>
                <select
                  value={testMoneda}
                  onChange={(e) => setTestMoneda(e.target.value)}
                  style={styles.select}
                >
                  <option value="USD">USD - Dólares Americanos</option>
                  <option value="PEN">PEN - Soles</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Fecha a Consultar (Documento)</label>
                <input
                  type="date"
                  value={testFecha}
                  onChange={(e) => setTestFecha(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={resolviendo}
                style={resolviendo ? styles.btnDisabled : styles.btnPrimary}
              >
                {resolviendo ? 'Consultando...' : '🔍 Resolver Tipo de Cambio'}
              </button>
            </form>

            {resolverError && <div style={styles.resolverError}>{resolverError}</div>}

            {resolverResult && (
              <div style={styles.resolverResultBox}>
                <div style={styles.resultHeader}>
                  <span
                    style={
                      resolverResult.es_fecha_exacta
                        ? styles.pillExact
                        : styles.pillFallback
                    }
                  >
                    {resolverResult.es_fecha_exacta
                      ? '✓ Fecha Exacta Publicada'
                      : '⚠️ Fin de Semana / Feriado (Último TC publicado)'}
                  </span>
                  <span style={styles.sourceTag}>Fuente: {resolverResult.fuente}</span>
                </div>

                <div style={styles.resultGrid}>
                  <div>
                    <span style={styles.resultLabel}>Fecha Consultada:</span>
                    <strong style={styles.resultValue}>{resolverResult.fecha_consultada}</strong>
                  </div>
                  <div>
                    <span style={styles.resultLabel}>Fecha Publicación Oficial:</span>
                    <strong style={styles.resultValue}>{resolverResult.fecha_publicacion}</strong>
                  </div>
                  <div style={styles.tcMontoBox}>
                    <span style={styles.resultLabel}>Compra:</span>
                    <strong style={styles.tcValorCompra}>
                      S/ {resolverResult.compra}
                    </strong>
                  </div>
                  <div style={styles.tcMontoBox}>
                    <span style={styles.resultLabel}>Venta:</span>
                    <strong style={styles.tcValorVenta}>
                      S/ {resolverResult.venta}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Exchange Rates List Header & Action */}
          <div style={styles.listHeaderRow}>
            <div style={styles.searchBox}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Buscar por fecha (YYYY-MM-DD), moneda o fuente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <button onClick={() => setModalTcOpen(true)} style={styles.btnSuccess}>
              + Registrar Tipo de Cambio
            </button>
          </div>

          {/* Exchange Rates Table */}
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Moneda</th>
                  <th style={styles.th}>Fecha Publicación</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Compra (S/)</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Venta (S/)</th>
                  <th style={styles.th}>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {filteredTc.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={styles.tdEmpty}>
                      No hay tipos de cambio registrados con este criterio.
                    </td>
                  </tr>
                ) : (
                  filteredTc.map((tc) => (
                    <tr key={tc.id} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={styles.monedaTag}>{tc.moneda_codigo}</span>
                      </td>
                      <td style={{ ...styles.td, fontFamily: 'var(--font-mono)' }}>
                        {tc.fecha_publicacion}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-success)' }}>
                        {tc.compra ?? '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {tc.venta ?? '—'}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.fuenteBadge}>{tc.fuente}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comprobantes Tab */}
      {activeTab === 'comprobantes' && (
        <div style={styles.catalogCard}>
          <div style={styles.listHeaderRow}>
            <div style={styles.searchBox}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Buscar código SUNAT o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <span style={styles.itemCountBadge}>{filteredComprobantes.length} tipos de comprobante</span>
          </div>

          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Código SUNAT</th>
                  <th style={styles.th}>Descripción</th>
                  <th style={styles.th}>Clasificación</th>
                  <th style={styles.th}>Efecto Contable</th>
                  <th style={styles.th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredComprobantes.map((c) => (
                  <tr key={c.id} style={styles.tr}>
                    <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {c.codigo_sunat}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500 }}>{c.descripcion}</td>
                    <td style={styles.td}>
                      {c.es_nota ? (
                        <span style={styles.badgeNota}>Nota Oficial</span>
                      ) : (
                        <span style={styles.badgeStandard}>Comprobante Base</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={
                          c.efecto_nota === 'CREDITO'
                            ? styles.badgeCredit
                            : c.efecto_nota === 'DEBITO'
                            ? styles.badgeDebit
                            : styles.badgeNeutral
                        }
                      >
                        {c.efecto_nota}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={c.activo ? styles.badgeActive : styles.badgeInactive}>
                        {c.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Operaciones Tab */}
      {activeTab === 'operaciones' && (
        <div style={styles.catalogCard}>
          <div style={styles.listHeaderRow}>
            <div style={styles.searchBox}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Buscar por código interno, SUNAT o naturaleza..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <span style={styles.itemCountBadge}>{filteredOperaciones.length} operaciones</span>
          </div>

          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Cód. Interno</th>
                  <th style={styles.th}>Cód. SUNAT</th>
                  <th style={styles.th}>Descripción</th>
                  <th style={styles.th}>Naturaleza</th>
                  <th style={styles.th}>Origen Requerido</th>
                  <th style={styles.th}>Kardex</th>
                </tr>
              </thead>
              <tbody>
                {filteredOperaciones.map((o) => (
                  <tr key={o.id} style={styles.tr}>
                    <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {o.codigo_interno}
                    </td>
                    <td style={{ ...styles.td, fontFamily: 'var(--font-mono)' }}>
                      {o.codigo_sunat || '—'}
                    </td>
                    <td style={styles.td}>{o.descripcion}</td>
                    <td style={styles.td}>
                      <span
                        style={
                          o.naturaleza === 'ENTRADA'
                            ? styles.badgeEntrada
                            : o.naturaleza === 'SALIDA'
                            ? styles.badgeSalida
                            : styles.badgeAjuste
                        }
                      >
                        {o.naturaleza}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {o.origen_requerido}
                    </td>
                    <td style={styles.td}>
                      {o.afecta_kardex ? (
                        <span style={styles.badgeSuccessSm}>AFECTA</span>
                      ) : (
                        <span style={styles.badgeNeutralSm}>NO AFECTA</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Existencias Tab */}
      {activeTab === 'existencias' && (
        <div style={styles.catalogCard}>
          <div style={styles.listHeaderRow}>
            <div style={styles.searchBox}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Buscar código o descripción de existencia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <span style={styles.itemCountBadge}>{filteredExistencias.length} tipos (Tabla 5)</span>
          </div>

          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '120px' }}>Código</th>
                  <th style={styles.th}>Descripción Oficial Tabla 5 SUNAT</th>
                </tr>
              </thead>
              <tbody>
                {filteredExistencias.map((e) => (
                  <tr key={e.codigo} style={styles.tr}>
                    <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {e.codigo}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500 }}>{e.descripcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unidades Tab */}
      {activeTab === 'unidades' && (
        <div style={styles.catalogCard}>
          <div style={styles.listHeaderRow}>
            <div style={styles.searchBox}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Buscar código o unidad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <span style={styles.itemCountBadge}>{filteredUnidades.length} unidades (Tabla 6)</span>
          </div>

          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '140px' }}>Código SUNAT</th>
                  <th style={styles.th}>Descripción Oficial de Unidad de Medida</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnidades.map((u) => (
                  <tr key={u.codigo} style={styles.tr}>
                    <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      <span style={styles.codePill}>{u.codigo}</span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500 }}>{u.descripcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monedas Tab */}
      {activeTab === 'monedas' && (
        <div style={styles.catalogCard}>
          <div style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '120px' }}>Código</th>
                  <th style={styles.th}>Nombre Oficial de la Moneda</th>
                </tr>
              </thead>
              <tbody>
                {monedas.map((m) => (
                  <tr key={m.codigo} style={styles.tr}>
                    <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      <span style={styles.monedaTag}>{m.codigo}</span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500 }}>{m.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Registrar Tipo de Cambio */}
      {modalTcOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Registrar Tipo de Cambio</h3>
              <button onClick={() => setModalTcOpen(false)} style={styles.modalCloseBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearTc} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Moneda</label>
                <select
                  value={nuevoTc.moneda_codigo}
                  onChange={(e) => setNuevoTc({ ...nuevoTc, moneda_codigo: e.target.value })}
                  style={styles.select}
                  required
                >
                  <option value="USD">USD - Dólares Americanos</option>
                  <option value="EUR">EUR - Euros</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Fecha de Publicación</label>
                <input
                  type="date"
                  value={nuevoTc.fecha_publicacion}
                  onChange={(e) => setNuevoTc({ ...nuevoTc, fecha_publicacion: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Compra (S/)</label>
                  <input
                    type="number"
                    step="0.00000001"
                    min="0.00000001"
                    placeholder="Ej. 3.74200000"
                    value={nuevoTc.compra}
                    onChange={(e) => setNuevoTc({ ...nuevoTc, compra: e.target.value })}
                    style={{ ...styles.input, fontVariantNumeric: 'tabular-nums' }}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Venta (S/)</label>
                  <input
                    type="number"
                    step="0.00000001"
                    min="0.00000001"
                    placeholder="Ej. 3.75100000"
                    value={nuevoTc.venta}
                    onChange={(e) => setNuevoTc({ ...nuevoTc, venta: e.target.value })}
                    style={{ ...styles.input, fontVariantNumeric: 'tabular-nums' }}
                    required
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Fuente Oficial</label>
                <input
                  type="text"
                  value={nuevoTc.fuente}
                  onChange={(e) => setNuevoTc({ ...nuevoTc, fuente: e.target.value })}
                  style={styles.input}
                  placeholder="SBS / SUNAT"
                  required
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setModalTcOpen(false)}
                  style={styles.btnSecondary}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoTc}
                  style={guardandoTc ? styles.btnDisabled : styles.btnSuccess}
                >
                  {guardandoTc ? 'Guardando...' : 'Guardar Tipo de Cambio'}
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
  badgeOfficial: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.65rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--accent-primary)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    fontFamily: 'var(--font-mono)',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid var(--accent-danger)',
    color: '#fca5a5',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
  },
  tabNav: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '0.25rem',
    overflowX: 'auto',
  },
  tabBtn: {
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  tabBtnActive: {
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    fontSize: '0.875rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    boxShadow: 'var(--shadow-sm)',
  },
  tcSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  resolverCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    boxShadow: 'var(--shadow-md)',
  },
  resolverCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  resolverTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  resolverSubtitle: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    marginTop: '0.15rem',
  },
  resolverForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    alignItems: 'flex-end',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    flex: '1 1 200px',
  },
  formRow: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
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
  resolverError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
  },
  resolverResultBox: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '10px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  pillExact: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-success)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  pillFallback: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: 'var(--accent-warning)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
  },
  sourceTag: {
    fontSize: '0.75rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  resultGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    alignItems: 'center',
  },
  resultLabel: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginBottom: '0.2rem',
  },
  resultValue: {
    fontSize: '1rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
  },
  tcMontoBox: {
    backgroundColor: 'var(--bg-secondary)',
    padding: '0.6rem 0.9rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  tcValorCompra: {
    fontSize: '1.25rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-success)',
    fontVariantNumeric: 'tabular-nums',
  },
  tcValorVenta: {
    fontSize: '1.25rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-primary)',
    fontVariantNumeric: 'tabular-nums',
  },
  listHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '0.5rem 0.85rem',
    flex: '1 1 300px',
  },
  searchIcon: {
    fontSize: '0.9rem',
    opacity: 0.7,
  },
  searchInput: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
  },
  itemCountBadge: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
  },
  tableCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    overflowX: 'auto',
    boxShadow: 'var(--shadow-sm)',
  },
  catalogCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
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
  },
  tdEmpty: {
    padding: '2.5rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  monedaTag: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: 'var(--accent-primary)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
  },
  fuenteBadge: {
    fontSize: '0.75rem',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
  },
  codePill: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    backgroundColor: 'var(--bg-tertiary)',
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
  },
  badgeNota: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: 'var(--accent-warning)',
  },
  badgeStandard: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--accent-primary)',
  },
  badgeCredit: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-success)',
  },
  badgeDebit: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--accent-danger)',
  },
  badgeNeutral: {
    fontSize: '0.75rem',
    padding: '0.2rem 0.55rem',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
  },
  badgeActive: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-success)',
  },
  badgeInactive: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--accent-danger)',
  },
  badgeEntrada: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-success)',
  },
  badgeSalida: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--accent-danger)',
  },
  badgeAjuste: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: 'var(--accent-warning)',
  },
  badgeSuccessSm: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--accent-success)',
  },
  badgeNeutralSm: {
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
  },
  btnPrimary: {
    backgroundColor: 'var(--accent-primary)',
    color: '#ffffff',
    padding: '0.55rem 1.15rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.875rem',
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.15s',
  },
  btnSuccess: {
    backgroundColor: 'var(--accent-success)',
    color: '#ffffff',
    padding: '0.55rem 1.15rem',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.875rem',
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.15s',
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
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
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
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
};

export default CatalogosPage;
