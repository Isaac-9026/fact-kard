import React, { useEffect, useState } from 'react';
import { obtenerEstablecimientos, type Establecimiento } from '../../api/empresas';
import { getProductos, type Producto } from '../../api/inventario';
import { obtenerPeriodos, type Periodo } from '../../api/periodos';
import { compararPiloto, descargarFormato131, obtenerFormato131, obtenerPiloto, type Formato131Response, type PilotoReal, type PilotoResultado } from '../../api/formato131';
import { useAuth } from '../../context/AuthContext';

const apiError = (error: unknown) => {
  const data = (error as { response?: { data?: Record<string, string | string[]> | string } }).response?.data;
  if (!data || typeof data === 'string') return 'No se pudo completar la operación. Intenta nuevamente.';
  return Object.values(data).flat().join(' ');
};
const n = (value?: string | null) => value ?? '—';

export const Formato131Page: React.FC = () => {
  const { empresaActiva } = useAuth();
  const [tab, setTab] = useState<'formato' | 'piloto'>('formato');
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [periodo, setPeriodo] = useState('');
  const [establecimiento, setEstablecimiento] = useState('');
  const [producto, setProducto] = useState('');
  const [reporte, setReporte] = useState<Formato131Response | null>(null);
  const [real, setReal] = useState<PilotoReal | null>(null);
  const [resultado, setResultado] = useState<PilotoResultado | null>(null);
  const [form, setForm] = useState({ cantidad_esperada: '', cpp_esperado: '', valor_esperado: '', tiempo_manual_segundos: '', tiempo_factkard_segundos: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([obtenerPeriodos(), obtenerEstablecimientos(), getProductos()]).then(([p, e, pr]) => {
      if (!active) return;
      setPeriodos(p); setEstablecimientos(e); setProductos(pr);
      setPeriodo(p[0] ? String(p[0].id) : ''); setProducto(pr[0] ? String(pr[0].id) : '');
    }).catch(e => active && setError(apiError(e)));
    return () => { active = false; };
  }, [empresaActiva?.id]);

  const consultar = async () => {
    if (!periodo) return setError('Selecciona un período para generar el reporte.');
    setBusy(true); setError('');
    try { setReporte(await obtenerFormato131({ periodo_id: periodo, establecimiento_id: establecimiento, producto_id: producto })); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };
  const consultarReal = async () => {
    if (!periodo || !producto) return setError('Selecciona período y producto.');
    setBusy(true); setError(''); setResultado(null);
    try { setReal(await obtenerPiloto(periodo, producto)); } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };
  const comparar = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const data = await compararPiloto({ periodo_id: periodo, producto_id: producto, ...form }); setReal(data); setResultado(data); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };

  const selectorPeriodo = <label style={s.field}>Período<select style={s.input} value={periodo} onChange={e => setPeriodo(e.target.value)}><option value="">Seleccionar</option>{periodos.map(p => <option key={p.id} value={p.id}>{p.anio}-{String(p.mes).padStart(2, '0')} · {p.estado}</option>)}</select></label>;
  const selectorProducto = <label style={s.field}>Producto<select style={s.input} value={producto} onChange={e => setProducto(e.target.value)}><option value="">Todos</option>{productos.map(p => <option key={p.id} value={p.id}>{p.codigo_interno} · {p.descripcion}</option>)}</select></label>;

  return <main style={s.page}>
    <header style={s.hero}><div><h1 style={s.title}>Inventario valorizado y conciliación</h1><p style={s.subtitle}>Emisión oficial del Formato 13.1 y validación paralela de {empresaActiva?.razon_social ?? 'la empresa activa'}.</p></div><span style={s.safe}>● Fuente contable protegida</span></header>
    <nav style={s.tabs} aria-label="Secciones"><button style={tab === 'formato' ? s.active : s.tab} onClick={() => setTab('formato')}>Formato 13.1 Oficial SUNAT</button><button style={tab === 'piloto' ? s.active : s.tab} onClick={() => setTab('piloto')}>Piloto Paralelo y Métrica de Eficiencia</button></nav>
    {error && <div role="alert" style={s.error}>{error}</div>}
    {tab === 'formato' ? <>
      <section style={s.filters}>{selectorPeriodo}<label style={s.field}>Establecimiento<select style={s.input} value={establecimiento} onChange={e => setEstablecimiento(e.target.value)}><option value="">Todos</option>{establecimientos.map(e => <option key={e.id} value={e.id}>{e.codigo_sunat} · {e.nombre}</option>)}</select></label>{selectorProducto}<button style={s.primary} disabled={busy} onClick={consultar}>{busy ? 'Consultando…' : 'Consultar'}</button><button style={s.secondary} disabled={!periodo || busy} onClick={async () => { setBusy(true); setError(''); try { await descargarFormato131({ periodo_id: periodo, establecimiento_id: establecimiento, producto_id: producto }); } catch (e) { setError(apiError(e)); } finally { setBusy(false); } }}>Exportar oficial (.xlsx)</button></section>
      {!reporte && <div style={s.empty}><strong>Selecciona el alcance del libro</strong><span>El reporte conserva el orden oficial y usa el CPP global.</span></div>}
      {reporte?.reportes.length === 0 && <div style={s.empty}><strong>Sin movimientos</strong><span>No hay operaciones para los filtros elegidos.</span></div>}
      {reporte?.reportes.map(r => <section style={s.report} key={`${r.cabecera.establecimiento.id}-${r.cabecera.producto_id}`}>
        <div style={s.official}><div style={s.lead}><span>{reporte.periodo}</span><strong>{r.cabecera.codigo_existencia}</strong><small>{r.cabecera.descripcion_existencia}</small></div><dl style={s.meta}><div><dt>RUC</dt><dd>{reporte.empresa.ruc}</dd></div><div><dt>Razón social</dt><dd>{reporte.empresa.razon_social}</dd></div><div><dt>Establecimiento</dt><dd>{r.cabecera.establecimiento.codigo_sunat} · {r.cabecera.establecimiento.nombre}</dd></div><div><dt>Tabla 5</dt><dd>{r.cabecera.tipo_existencia.codigo} · {r.cabecera.tipo_existencia.descripcion}</dd></div><div><dt>Tabla 6</dt><dd>{r.cabecera.unidad_medida.codigo} · {r.cabecera.unidad_medida.descripcion}</dd></div><div><dt>Método</dt><dd>{r.cabecera.metodo_valuacion}</dd></div></dl></div>
        <div style={s.tableWrap}><table style={s.table}><thead><tr><th rowSpan={2}>Fecha</th><th colSpan={3}>Documento</th><th rowSpan={2}>Tipo op.</th><th colSpan={3}>Entradas</th><th colSpan={3}>Salidas</th><th colSpan={3}>Saldo final</th></tr><tr><th>Tipo</th><th>Serie</th><th>Número</th><th>Cantidad</th><th>Costo unit.</th><th>Costo total</th><th>Cantidad</th><th>Costo unit.</th><th>Costo total</th><th>Cantidad</th><th>Costo unit.</th><th>Costo total</th></tr></thead><tbody>{r.movimientos.map(m => <tr key={m.movimiento_id}><td>{m.fecha_emision}</td><td>{m.documento.tipo_documento}</td><td>{m.documento.serie || '—'}</td><td>{m.documento.numero || '—'}</td><td>{m.tipo_operacion || '—'}</td><td>{n(m.entrada?.cantidad)}</td><td>{n(m.entrada?.costo_unitario)}</td><td>{n(m.entrada?.costo_total)}</td><td>{n(m.salida?.cantidad)}</td><td>{n(m.salida?.costo_unitario)}</td><td>{n(m.salida?.costo_total)}</td><td>{n(m.saldo_final.cantidad)}</td><td>{n(m.saldo_final.costo_unitario)}</td><td>{n(m.saldo_final.costo_total)}</td></tr>)}</tbody></table></div>
        {r.microdiferencia_cierre !== '0.00000000' && <p style={s.note}>Microdiferencia oficial asignada al establecimiento principal: S/ {r.microdiferencia_cierre}</p>}
      </section>)}
    </> : <section style={s.pilot}>
      <form style={s.form} onSubmit={comparar}><h2 style={s.h2}>Contraste con el proceso actual</h2><p style={s.copy}>Captura los valores validados por el contador. El lado FACT-KARD nunca se toma del formulario.</p><div style={s.two}>{selectorPeriodo}{selectorProducto}</div><button type="button" style={s.link} onClick={consultarReal}>Consultar valores FACT-KARD</button><div style={s.formGrid}>{Object.entries({ cantidad_esperada: 'Cantidad esperada', cpp_esperado: 'CPP esperado', valor_esperado: 'Valor esperado', tiempo_manual_segundos: 'Tiempo manual (segundos)', tiempo_factkard_segundos: 'Tiempo FACT-KARD (segundos)' }).map(([key, label]) => <label style={s.field} key={key}>{label}<input required inputMode="decimal" style={s.input} value={form[key as keyof typeof form]} onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))} /></label>)}</div><button style={s.primary} disabled={busy}>{busy ? 'Comparando…' : 'Comparar resultados'}</button></form>
      <aside style={s.result}><h2 style={s.h2}>Resultado FACT-KARD</h2>{!real && <p style={s.muted}>Consulta un producto para ver los valores oficiales.</p>}{real && <><span style={s.source}>{real.fuente.replaceAll('_', ' ')} · {real.estado_periodo}</span><div style={s.metrics}><div><span>Cantidad</span><strong>{real.cantidad_factkard}</strong></div><div><span>CPP</span><strong>{real.cpp_factkard}</strong></div><div><span>Valor</span><strong>S/ {real.valor_factkard}</strong></div></div></>}{resultado && <div style={resultado.cuadra_100 ? s.match : s.mismatch}><strong>{resultado.cuadra_100 ? 'COINCIDE 100%' : 'REQUIERE CONCILIACIÓN'}</strong><p>Δ Cantidad {resultado.diferencias.cantidad}<br />Δ CPP {resultado.diferencias.cpp}<br />Δ Valor {resultado.diferencias.valor}</p><b>Reducción de tiempo: {resultado.reduccion_porcentaje}%</b></div>}</aside>
    </section>}
  </main>;
};

const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 20, color: '#172033' }, hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20 }, title: { margin: 0, fontSize: 30, letterSpacing: '-0.025em' }, subtitle: { margin: '7px 0 0', color: '#5c667a' }, safe: { color: '#286248', background: '#edf7f1', padding: '8px 12px', borderRadius: 999, fontSize: 12 }, tabs: { display: 'flex', gap: 4, borderBottom: '1px solid #dce1e8' }, tab: { border: 0, background: 'transparent', padding: 12, color: '#697386', cursor: 'pointer' }, active: { border: 0, borderBottom: '2px solid #194b7a', background: 'transparent', padding: 12, color: '#143c62', fontWeight: 700, cursor: 'pointer' }, error: { padding: 12, background: '#fff1f0', color: '#8d2c27', borderRadius: 12 }, filters: { display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.3fr auto auto', gap: 12, alignItems: 'end', background: '#f5f7fa', padding: 16, borderRadius: 14 }, field: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 650, color: '#4b566b' }, input: { minHeight: 40, border: '1px solid #cfd6df', borderRadius: 9, background: '#fff', padding: '8px 10px', color: '#172033' }, primary: { minHeight: 40, border: 0, borderRadius: 9, padding: '0 16px', background: '#174a78', color: '#fff', fontWeight: 700, cursor: 'pointer' }, secondary: { minHeight: 40, border: '1px solid #9db0c2', borderRadius: 9, padding: '0 16px', background: '#fff', color: '#174a78', fontWeight: 700, cursor: 'pointer' }, empty: { minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8, color: '#697386', background: '#f8fafc', borderRadius: 14 }, report: { background: '#fff', borderRadius: 14, boxShadow: '0 8px 28px rgba(23,32,51,.08)', overflow: 'hidden' }, official: { display: 'grid', gridTemplateColumns: '240px 1fr', background: '#173d60', color: '#fff' }, lead: { display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, background: '#102f4b' }, meta: { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(150px,1fr))', margin: 0, padding: 18, gap: 14 }, tableWrap: { overflowX: 'auto' }, table: { width: '100%', minWidth: 1220, borderCollapse: 'collapse', fontSize: 12, fontVariantNumeric: 'tabular-nums' }, note: { margin: 0, padding: 10, background: '#fff8df', color: '#765c0d' }, pilot: { display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(320px,.8fr)', gap: 18 }, form: { padding: 24, background: '#fff', borderRadius: 14, boxShadow: '0 8px 28px rgba(23,32,51,.08)' }, result: { padding: 24, borderRadius: 14, background: '#102f4b', color: '#fff' }, h2: { margin: 0, fontSize: 19 }, copy: { color: '#697386' }, two: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '18px 0' }, link: { marginTop: 12, border: 0, background: 'transparent', color: '#246292', fontWeight: 700, cursor: 'pointer' }, muted: { color: '#c3d1dd' }, source: { display: 'inline-block', marginTop: 16, padding: 7, background: '#234d70', borderRadius: 7, fontSize: 11 }, metrics: { display: 'grid', gap: 1, marginTop: 18 }, match: { marginTop: 22, padding: 18, borderRadius: 12, background: '#dff4e8', color: '#185b3d' }, mismatch: { marginTop: 22, padding: 18, borderRadius: 12, background: '#fff1cf', color: '#755612' },
};

export default Formato131Page;
