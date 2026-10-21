import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  obtenerKardexValorizado,
  exportarKardexExcel,
  type KardexFila,
  type KardexResumen,
  type KardexFiltros,
} from '../../api/reportes';
import { getProductos, getAlmacenes, type Producto, type Almacen } from '../../api/inventario';
import { obtenerPeriodos, type Periodo } from '../../api/periodos';
import { obtenerTiposOperacion, type TipoOperacion } from '../../api/catalogos';

const formatQty = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

const formatCost = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
};

const formatMoney = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const KardexPage: React.FC = () => {
  const { empresaActiva } = useAuth();

  // Catálogos para filtros
  const [productos, setProductos] = useState<Producto[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [tiposOperacion, setTiposOperacion] = useState<TipoOperacion[]>([]);

  // Estado de filtros
  const [productoId, setProductoId] = useState<string>('');
  const [periodoId, setPeriodoId] = useState<string>('');
  const [almacenId, setAlmacenId] = useState<string>('');
  const [tipoOperacionId, setTipoOperacionId] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');

  // Estado de resultados
  const [movimientos, setMovimientos] = useState<KardexFila[]>([]);
  const [resumen, setResumen] = useState<KardexResumen | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Carga inicial de catálogos
  useEffect(() => {
    let isMounted = true;
    const cargarCatalogos = async () => {
      try {
        const [prodsData, almsData, persData, opsData] = await Promise.all([
          getProductos().catch(() => []),
          getAlmacenes().catch(() => []),
          obtenerPeriodos().catch(() => []),
          obtenerTiposOperacion().catch(() => []),
        ]);
        if (isMounted) {
          setProductos(prodsData);
          setAlmacenes(almsData);
          setPeriodos(persData);
          setTiposOperacion(opsData);

          // Si hay períodos, preseleccionar el último abierto
          const abierto = persData.find((p) => p.estado === 'ABIERTO');
          if (abierto) {
            setPeriodoId(String(abierto.id));
          }
        }
      } catch (err) {
        console.error('Error al cargar catálogos de Kardex', err);
      }
    };
    cargarCatalogos();
    return () => {
      isMounted = false;
    };
  }, [empresaActiva?.id]);

  // Ejecución de la consulta contable
  const cargarKardex = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filtros: KardexFiltros = {
        producto_id: productoId ? Number(productoId) : undefined,
        periodo_id: periodoId ? Number(periodoId) : undefined,
        almacen_id: almacenId ? Number(almacenId) : undefined,
        tipo_operacion_id: tipoOperacionId ? Number(tipoOperacionId) : undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      };

      const res = await obtenerKardexValorizado(filtros);
      setMovimientos(res.movimientos);
      setResumen(res.resumen);
    } catch (err: any) {
      console.error('Error al consultar Kardex', err);
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          'No se pudo cargar el Kardex Valorizado. Verifique los filtros y conexión.'
      );
    } finally {
      setLoading(false);
    }
  }, [productoId, periodoId, almacenId, tipoOperacionId, fechaDesde, fechaHasta]);

  // Cargar kardex al cambiar los filtros principales
  useEffect(() => {
    cargarKardex();
  }, [cargarKardex]);

  // Exportar a Excel
  const handleExportarExcel = async () => {
    setExporting(true);
    try {
      const filtros: KardexFiltros = {
        producto_id: productoId ? Number(productoId) : undefined,
        periodo_id: periodoId ? Number(periodoId) : undefined,
        almacen_id: almacenId ? Number(almacenId) : undefined,
        tipo_operacion_id: tipoOperacionId ? Number(tipoOperacionId) : undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      };
      await exportarKardexExcel(filtros);
    } catch (err) {
      console.error('Error al exportar Excel', err);
      alert('Error al generar el archivo Excel. Por favor intente nuevamente.');
    } finally {
      setExporting(false);
    }
  };

  const handleLimpiarFiltros = () => {
    setProductoId('');
    setPeriodoId('');
    setAlmacenId('');
    setTipoOperacionId('');
    setFechaDesde('');
    setFechaHasta('');
  };

  const productoSeleccionado = useMemo(() => {
    if (!productoId) return null;
    return productos.find((p) => String(p.id) === String(productoId));
  }, [productoId, productos]);

  return (
    <div style={styles.page}>
      {/* 1. Encabezado principal */}
      <header style={styles.header}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.badgePrimary}>MÓDULO KARDEX VALORIZADO</span>
            <span style={styles.badgeNeutral}>Fase 8 · Bloque 5</span>
            <span style={styles.badgeSuccess}>SUNAT FORMATO 13.1</span>
          </div>
          <h1 style={styles.title}>Consulta de Kardex Permanente Valorizado</h1>
          <p style={styles.subtitle}>
            Control contable por método Promedio Ponderado Móvil (CPP Global en PEN) —{' '}
            <strong style={{ color: '#0f172a' }}>{empresaActiva?.razon_social ?? 'Empresa Activa'}</strong>
            {empresaActiva?.ruc ? ` (RUC: ${empresaActiva.ruc})` : ''}
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={exporting || loading}
            style={{
              ...styles.btnExport,
              opacity: exporting || loading ? 0.7 : 1,
              cursor: exporting || loading ? 'not-allowed' : 'pointer',
            }}
            title="Descargar libro Excel con 4 hojas oficiales (Kardex, Movimientos, Incidencias, Saldos)"
          >
            <span>{exporting ? '⏳' : '📥'}</span>
            <span>{exporting ? 'Generando Excel...' : 'Exportar a Excel (.xlsx)'}</span>
          </button>
        </div>
      </header>

      {/* 2. Tarjetas KPI de Resumen Superior */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>STOCK TOTAL EMPRESA</span>
            <span style={{ ...styles.kpiIcon, backgroundColor: '#e0f2fe', color: '#0284c7' }}>📦</span>
          </div>
          <div style={styles.kpiValue}>
            {loading ? '...' : formatQty(resumen?.saldo_final_cantidad)}
          </div>
          <div style={styles.kpiFooter}>
            {productoSeleccionado
              ? `${productoSeleccionado.codigo_interno} (Unidades Base)`
              : 'Balance acumulado a la fecha'}
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>CPP VIGENTE (PEN)</span>
            <span style={{ ...styles.kpiIcon, backgroundColor: '#fef3c7', color: '#d97706' }}>⚖️</span>
          </div>
          <div style={styles.kpiValue}>
            {loading ? '...' : resumen?.cpp_final ? `S/ ${formatCost(resumen.cpp_final)}` : 'S/ 0.000000'}
          </div>
          <div style={styles.kpiFooter}>Costo Promedio Ponderado Móvil</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>SALDO VALORIZADO</span>
            <span style={{ ...styles.kpiIcon, backgroundColor: '#dcfce7', color: '#16a34a' }}>💰</span>
          </div>
          <div style={styles.kpiValue}>
            {loading ? '...' : `S/ ${formatMoney(resumen?.saldo_final_valor)}`}
          </div>
          <div style={styles.kpiFooter}>Valor contable del inventario</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>TOTAL ENTRADAS</span>
            <span style={{ ...styles.kpiIcon, backgroundColor: '#eff6ff', color: '#2563eb' }}>⬇️</span>
          </div>
          <div style={styles.kpiValue}>
            {loading ? '...' : formatQty(resumen?.total_entradas_cantidad)}
          </div>
          <div style={styles.kpiFooter}>
            {loading ? '...' : `Valor: S/ ${formatMoney(resumen?.total_entradas_valor)}`}
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <span style={styles.kpiLabel}>TOTAL SALIDAS</span>
            <span style={{ ...styles.kpiIcon, backgroundColor: '#fdf2f8', color: '#db2777' }}>⬆️</span>
          </div>
          <div style={styles.kpiValue}>
            {loading ? '...' : formatQty(resumen?.total_salidas_cantidad)}
          </div>
          <div style={styles.kpiFooter}>
            {loading ? '...' : `Valor: S/ ${formatMoney(resumen?.total_salidas_valor)}`}
          </div>
        </div>
      </div>

      {/* 3. Barra de Filtros Oficiales (Sección 42 del Manual) */}
      <div style={styles.filterCard}>
        <div style={styles.filterHeader}>
          <span style={styles.filterTitle}>🔍 Filtros de Consulta Oficial</span>
          <span style={styles.filterSubtitle}>
            Consulte por producto, período contable, almacén o rango de fechas
          </span>
        </div>

        <div style={styles.filterGrid}>
          {/* Producto */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Producto</label>
            <select
              style={styles.select}
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
            >
              <option value="">Todos los productos</option>
              {productos.map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.codigo_interno} — {prod.descripcion}
                </option>
              ))}
            </select>
          </div>

          {/* Período */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Período Contable</label>
            <select
              style={styles.select}
              value={periodoId}
              onChange={(e) => setPeriodoId(e.target.value)}
            >
              <option value="">Todos los períodos</option>
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.anio}-{String(p.mes).padStart(2, '0')} ({p.estado})
                </option>
              ))}
            </select>
          </div>

          {/* Almacén */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Almacén</label>
            <select
              style={styles.select}
              value={almacenId}
              onChange={(e) => setAlmacenId(e.target.value)}
            >
              <option value="">Todos los almacenes (Consolidado)</option>
              {almacenes.map((alm) => (
                <option key={alm.id} value={alm.id}>
                  {alm.codigo} — {alm.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Operación */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Tipo de Operación</label>
            <select
              style={styles.select}
              value={tipoOperacionId}
              onChange={(e) => setTipoOperacionId(e.target.value)}
            >
              <option value="">Todas las operaciones</option>
              {tiposOperacion.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.codigo_sunat || op.codigo_interno} — {op.descripcion}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha Desde */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Fecha Desde</label>
            <input
              type="date"
              style={styles.input}
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>

          {/* Fecha Hasta */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Fecha Hasta</label>
            <input
              type="date"
              style={styles.input}
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
        </div>

        <div style={styles.filterActions}>
          <button
            type="button"
            onClick={cargarKardex}
            disabled={loading}
            style={styles.btnPrimary}
          >
            {loading ? 'Consultando...' : '🔄 Actualizar Consulta'}
          </button>
          <button
            type="button"
            onClick={handleLimpiarFiltros}
            disabled={loading}
            style={styles.btnSecondary}
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* 4. Mensaje de Error */}
      {error && (
        <div style={styles.errorBox}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* 5. Tabla Oficial de Kardex Valorizado */}
      <div style={styles.tableCard}>
        <div style={styles.tableToolbar}>
          <div>
            <h2 style={styles.tableTitle}>Movimientos Contables Registrados</h2>
            <span style={styles.tableMeta}>
              {movimientos.length} movimiento(s) ordenados cronológicamente por motor Kardex
            </span>
          </div>
          <div style={styles.legend}>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#16a34a' }} /> Entrada
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#dc2626' }} /> Salida
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#2563eb' }} /> Ajuste Valor
            </span>
          </div>
        </div>

        {loading ? (
          <div style={styles.loadingBox}>
            <div style={styles.spinner} />
            <p style={{ marginTop: '12px', color: '#475569', fontSize: '14px' }}>
              Procesando y valorizando movimientos de Kardex...
            </p>
          </div>
        ) : movimientos.length === 0 ? (
          <div style={styles.emptyBox}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>📭</div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
              No se encontraron movimientos registrados
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              No hay operaciones registradas para los filtros seleccionados o el producto aún no tiene movimientos confirmados.
            </p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                {/* Nivel 1: Agrupación oficial */}
                <tr>
                  <th colSpan={5} style={{ ...styles.thGroup, ...styles.thGroupOp }}>
                    DATOS DE LA OPERACIÓN
                  </th>
                  <th colSpan={3} style={{ ...styles.thGroup, ...styles.thGroupEnt }}>
                    ENTRADAS
                  </th>
                  <th colSpan={3} style={{ ...styles.thGroup, ...styles.thGroupSal }}>
                    SALIDAS
                  </th>
                  <th colSpan={3} style={{ ...styles.thGroup, ...styles.thGroupSaldo }}>
                    SALDO VALORIZADO
                  </th>
                </tr>

                {/* Nivel 2: Subcolumnas */}
                <tr>
                  <th style={styles.thSub}>Fecha</th>
                  <th style={styles.thSub}>Documento Ref.</th>
                  <th style={styles.thSub}>Tipo Operación</th>
                  <th style={styles.thSub}>Naturaleza</th>
                  <th style={styles.thSub}>Almacén</th>

                  {/* Entradas */}
                  <th style={{ ...styles.thSub, ...styles.textRight }}>Cantidad</th>
                  <th style={{ ...styles.thSub, ...styles.textRight }}>Costo Unit.</th>
                  <th style={{ ...styles.thSub, ...styles.textRight }}>Valor Total</th>

                  {/* Salidas */}
                  <th style={{ ...styles.thSub, ...styles.textRight }}>Cantidad</th>
                  <th style={{ ...styles.thSub, ...styles.textRight }}>Costo Unit.</th>
                  <th style={{ ...styles.thSub, ...styles.textRight }}>Valor Total</th>

                  {/* Saldo Final */}
                  <th style={{ ...styles.thSub, ...styles.textRight }}>Cantidad</th>
                  <th style={{ ...styles.thSub, ...styles.textRight }}>C.P.P.</th>
                  <th style={{ ...styles.thSub, ...styles.textRight }}>Valor Total</th>
                </tr>
              </thead>

              <tbody>
                {movimientos.map((mov, idx) => {
                  const isEntrada = mov.naturaleza === 'ENTRADA';
                  const isSalida = mov.naturaleza === 'SALIDA';
                  const isAjuste = mov.naturaleza === 'AJUSTE_VALOR';

                  return (
                    <tr
                      key={mov.id}
                      style={{
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      }}
                    >
                      {/* Fecha */}
                      <td style={{ ...styles.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {mov.fecha}
                      </td>

                      {/* Documento Ref */}
                      <td style={{ ...styles.td, fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{mov.documento_referencia || '—'}</span>
                          {mov.es_extorno && (
                            <span style={styles.tagWarning} title="Movimiento de extorno">
                              EXTORNO
                            </span>
                          )}
                          {mov.generado_por_motor && (
                            <span style={styles.tagInfo} title="Ajuste automático generado por el motor">
                              MOTOR
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tipo Operación */}
                      <td style={styles.td} title={mov.tipo_operacion_descripcion}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>
                          {mov.tipo_operacion_codigo}
                        </span>{' '}
                        <span style={{ color: '#475569', fontSize: '11px' }}>
                          {mov.tipo_operacion_descripcion}
                        </span>
                      </td>

                      {/* Naturaleza */}
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <span
                          style={{
                            ...styles.badgeNaturaleza,
                            backgroundColor: isEntrada
                              ? '#dcfce7'
                              : isSalida
                              ? '#fee2e2'
                              : '#dbeafe',
                            color: isEntrada
                              ? '#166534'
                              : isSalida
                              ? '#991b1b'
                              : '#1e40af',
                          }}
                        >
                          {mov.naturaleza}
                        </span>
                      </td>

                      {/* Almacén */}
                      <td style={styles.td}>
                        <span style={{ fontSize: '12px', color: '#334155' }}>
                          {mov.almacen_codigo} - {mov.almacen_nombre}
                        </span>
                      </td>

                      {/* Bloque Entradas */}
                      <td style={{ ...styles.td, ...styles.numCell, color: isEntrada || (isAjuste && mov.entrada_valor) ? '#166534' : '#64748b' }}>
                        {formatQty(mov.entrada_cantidad)}
                      </td>
                      <td style={{ ...styles.td, ...styles.numCell }}>
                        {formatCost(mov.entrada_costo_unitario)}
                      </td>
                      <td style={{ ...styles.td, ...styles.numCell, fontWeight: 600, color: isEntrada || (isAjuste && mov.entrada_valor) ? '#166534' : '#64748b' }}>
                        {formatMoney(mov.entrada_valor)}
                      </td>

                      {/* Bloque Salidas */}
                      <td style={{ ...styles.td, ...styles.numCell, color: isSalida || (isAjuste && mov.salida_valor) ? '#991b1b' : '#64748b' }}>
                        {formatQty(mov.salida_cantidad)}
                      </td>
                      <td style={{ ...styles.td, ...styles.numCell }}>
                        {formatCost(mov.salida_costo_unitario)}
                      </td>
                      <td style={{ ...styles.td, ...styles.numCell, fontWeight: 600, color: isSalida || (isAjuste && mov.salida_valor) ? '#991b1b' : '#64748b' }}>
                        {formatMoney(mov.salida_valor)}
                      </td>

                      {/* Bloque Saldo Final */}
                      <td style={{ ...styles.td, ...styles.numCell, fontWeight: 600, color: '#0f172a' }}>
                        {formatQty(mov.saldo_cantidad)}
                      </td>
                      <td style={{ ...styles.td, ...styles.numCell, color: '#0f172a' }}>
                        {formatCost(mov.cpp)}
                      </td>
                      <td style={{ ...styles.td, ...styles.numCell, fontWeight: 700, color: '#0f172a' }}>
                        {formatMoney(mov.saldo_valor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Pie de tabla con totales oficiales */}
              {resumen && (
                <tfoot>
                  <tr style={styles.tfootRow}>
                    <td colSpan={5} style={{ ...styles.tdFoot, textAlign: 'right', fontWeight: 700 }}>
                      TOTALES DEL PERÍODO:
                    </td>
                    <td style={{ ...styles.tdFoot, ...styles.numCell, fontWeight: 700 }}>
                      {formatQty(resumen.total_entradas_cantidad)}
                    </td>
                    <td style={{ ...styles.tdFoot, textAlign: 'center', color: '#94a3b8' }}>—</td>
                    <td style={{ ...styles.tdFoot, ...styles.numCell, fontWeight: 700, color: '#166534' }}>
                      S/ {formatMoney(resumen.total_entradas_valor)}
                    </td>

                    <td style={{ ...styles.tdFoot, ...styles.numCell, fontWeight: 700 }}>
                      {formatQty(resumen.total_salidas_cantidad)}
                    </td>
                    <td style={{ ...styles.tdFoot, textAlign: 'center', color: '#94a3b8' }}>—</td>
                    <td style={{ ...styles.tdFoot, ...styles.numCell, fontWeight: 700, color: '#991b1b' }}>
                      S/ {formatMoney(resumen.total_salidas_valor)}
                    </td>

                    <td style={{ ...styles.tdFoot, ...styles.numCell, fontWeight: 800 }}>
                      {formatQty(resumen.saldo_final_cantidad)}
                    </td>
                    <td style={{ ...styles.tdFoot, ...styles.numCell, fontWeight: 700 }}>
                      {formatCost(resumen.cpp_final)}
                    </td>
                    <td style={{ ...styles.tdFoot, ...styles.numCell, fontWeight: 800, color: '#0f172a' }}>
                      S/ {formatMoney(resumen.saldo_final_valor)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '24px 32px',
    maxWidth: '1600px',
    margin: '0 auto',
    color: '#0f172a',
    fontFamily: 'inherit',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  badgeRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px',
  },
  badgePrimary: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.05em',
    padding: '3px 8px',
    borderRadius: '4px',
    backgroundColor: '#0f172a',
    color: '#ffffff',
  },
  badgeNeutral: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: '4px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
  },
  badgeSuccess: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '4px',
    backgroundColor: '#dcfce7',
    color: '#166534',
    border: '1px solid #bbf7d0',
  },
  title: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '13px',
    color: '#475569',
    margin: '4px 0 0',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  btnExport: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: 700,
    borderRadius: '6px',
    backgroundColor: '#166534',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 2px 4px rgba(22, 101, 52, 0.25)',
    transition: 'all 0.15s ease',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '14px',
    marginBottom: '20px',
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '14px 16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  },
  kpiHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  kpiLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.04em',
  },
  kpiIcon: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
  },
  kpiValue: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#0f172a',
    fontVariantNumeric: 'tabular-nums',
  },
  kpiFooter: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '4px',
  },
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '16px 20px',
    border: '1px solid #e2e8f0',
    marginBottom: '20px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  },
  filterHeader: {
    marginBottom: '14px',
  },
  filterTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
    marginRight: '8px',
  },
  filterSubtitle: {
    fontSize: '12px',
    color: '#64748b',
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    marginBottom: '14px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#334155',
  },
  select: {
    padding: '8px 10px',
    fontSize: '12px',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '5px',
    outline: 'none',
  },
  input: {
    padding: '8px 10px',
    fontSize: '12px',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '5px',
    outline: 'none',
  },
  filterActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    borderTop: '1px solid #f1f5f9',
    paddingTop: '12px',
  },
  btnPrimary: {
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 700,
    backgroundColor: '#0f172a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '12px 16px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  tableToolbar: {
    padding: '14px 20px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  tableTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  tableMeta: {
    fontSize: '12px',
    color: '#64748b',
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    color: '#475569',
    fontWeight: 600,
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  loadingBox: {
    padding: '60px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTop: '3px solid #0f172a',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  emptyBox: {
    padding: '60px 20px',
    textAlign: 'center',
  },
  tableWrapper: {
    overflowX: 'auto',
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  thGroup: {
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textAlign: 'center',
    color: '#ffffff',
    borderBottom: '1px solid #cbd5e1',
  },
  thGroupOp: {
    backgroundColor: '#1e293b',
  },
  thGroupEnt: {
    backgroundColor: '#1e3a8a',
  },
  thGroupSal: {
    backgroundColor: '#7c2d12',
  },
  thGroupSaldo: {
    backgroundColor: '#065f46',
  },
  thSub: {
    backgroundColor: '#f1f5f9',
    color: '#1e293b',
    padding: '8px 10px',
    fontWeight: 700,
    fontSize: '11px',
    textAlign: 'left',
    borderBottom: '2px solid #cbd5e1',
    borderRight: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px 10px',
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #f1f5f9',
    color: '#0f172a',
  },
  numCell: {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  textRight: {
    textAlign: 'right',
  },
  badgeNaturaleza: {
    display: 'inline-block',
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.02em',
  },
  tagWarning: {
    fontSize: '9px',
    fontWeight: 800,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '1px 4px',
    borderRadius: '3px',
    border: '1px solid #fde68a',
  },
  tagInfo: {
    fontSize: '9px',
    fontWeight: 800,
    backgroundColor: '#f3e8ff',
    color: '#6b21a8',
    padding: '1px 4px',
    borderRadius: '3px',
    border: '1px solid #e9d5ff',
  },
  tfootRow: {
    backgroundColor: '#f1f5f9',
    borderTop: '2px solid #0f172a',
    borderBottom: '3px double #0f172a',
  },
  tdFoot: {
    padding: '10px',
    fontSize: '12px',
    color: '#0f172a',
  },
};
