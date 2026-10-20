import { useCallback, useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { getAlmacenes, getProductos, type Almacen, type Producto } from '../../api/inventario';
import { confirmarTransferencia, createTransferencia, getTransferencias, type Transferencia } from '../../api/transferencias';
import { useAuth } from '../../context/AuthContext';

const lineaVacia = () => ({ producto: '', cantidad_base: '' });
const errorApi = (error: unknown) => {
  if (!axios.isAxiosError(error)) return 'No se pudo completar la operación.';
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  return data && typeof data === 'object' ? Object.values(data).flat().join(' ') : 'No se pudo completar la operación.';
};

export const TransferenciasPage = () => {
  const { empresaActiva } = useAuth();
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [form, setForm] = useState({ almacen_origen: '', almacen_destino: '', fecha: '', detalles: [lineaVacia()] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const cargar = useCallback(async () => {
    if (!empresaActiva) return;
    setLoading(true);
    try {
      const [lista, nuevosAlmacenes, nuevosProductos] = await Promise.all([getTransferencias(), getAlmacenes(), getProductos()]);
      setTransferencias(lista); setAlmacenes(nuevosAlmacenes); setProductos(nuevosProductos);
    } catch (err) { setError(errorApi(err)); }
    finally { setLoading(false); }
  }, [empresaActiva?.id]);

  useEffect(() => { void cargar(); }, [cargar]);

  const guardar = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSuccess('');
    if (form.almacen_origen === form.almacen_destino) { setError('El almacén destino debe ser distinto del origen.'); return; }
    setSaving(true);
    try {
      await createTransferencia({
        almacen_origen: Number(form.almacen_origen), almacen_destino: Number(form.almacen_destino), fecha: form.fecha,
        detalles: form.detalles.map((linea) => ({ producto: Number(linea.producto), cantidad_base: linea.cantidad_base })),
      });
      setForm({ almacen_origen: '', almacen_destino: '', fecha: '', detalles: [lineaVacia()] });
      setSuccess('Transferencia creada en BORRADOR.'); await cargar();
    } catch (err) { setError(errorApi(err)); }
    finally { setSaving(false); }
  };

  const confirmar = async (transferencia: Transferencia) => {
    if (!window.confirm(`¿Confirmar traslado #${transferencia.id}?`)) return;
    setSaving(true); setError(''); setSuccess('');
    try { await confirmarTransferencia(transferencia.id); setSuccess('Traslado confirmado.'); await cargar(); }
    catch (err) { setError(errorApi(err)); }
    finally { setSaving(false); }
  };

  const actualizarLinea = (indice: number, campo: 'producto' | 'cantidad_base', valor: string) => setForm((actual) => ({
    ...actual, detalles: actual.detalles.map((linea, posicion) => posicion === indice ? { ...linea, [campo]: valor } : linea),
  }));

  return <div style={styles.container}>
    <header><h1 style={styles.title}>Transferencias entre almacenes</h1><p style={styles.muted}>Traslados atómicos sin alterar el CPP global de {empresaActiva?.razon_social ?? 'la empresa activa'}.</p></header>
    {error && <div role="alert" style={styles.error}>{error}</div>}{success && <div role="status" style={styles.success}>{success}</div>}
    <form onSubmit={guardar} style={styles.card}><h2 style={styles.subtitle}>Nueva transferencia</h2>
      <div style={styles.grid}>
        <label>Origen<select required value={form.almacen_origen} onChange={(e) => setForm({ ...form, almacen_origen: e.target.value })}><option value="">Seleccionar</option>{almacenes.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>)}</select></label>
        <label>Destino<select required value={form.almacen_destino} onChange={(e) => setForm({ ...form, almacen_destino: e.target.value })}><option value="">Seleccionar</option>{almacenes.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>)}</select></label>
        <label>Fecha<input required type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label>
      </div>
      {form.detalles.map((linea, indice) => <div key={indice} style={styles.linea}><select required value={linea.producto} onChange={(e) => actualizarLinea(indice, 'producto', e.target.value)}><option value="">Producto</option>{productos.map((p) => <option key={p.id} value={p.id}>{p.codigo_interno} · {p.descripcion}</option>)}</select><input required inputMode="decimal" pattern="^\d+(\.\d{1,8})?$" placeholder="Cantidad" value={linea.cantidad_base} onChange={(e) => actualizarLinea(indice, 'cantidad_base', e.target.value)} />{form.detalles.length > 1 && <button type="button" onClick={() => setForm({ ...form, detalles: form.detalles.filter((_, posicion) => posicion !== indice) })}>Quitar</button>}</div>)}
      <div style={styles.actions}><button type="button" onClick={() => setForm({ ...form, detalles: [...form.detalles, lineaVacia()] })}>Agregar producto</button><button disabled={saving}>{saving ? 'Guardando…' : 'Crear transferencia'}</button></div>
    </form>
    <section style={styles.card}><h2 style={styles.subtitle}>Transferencias ({transferencias.length})</h2>{loading ? <p>Cargando…</p> : <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th>ID</th><th>Fecha</th><th>Origen</th><th>Destino</th><th>Ítems</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{transferencias.map((t) => <tr key={t.id}><td>#{t.id}</td><td>{t.fecha}</td><td>{t.almacen_origen_nombre}</td><td>{t.almacen_destino_nombre}</td><td>{t.numero_lineas}</td><td>{t.estado}</td><td>{t.estado === 'BORRADOR' ? <button disabled={saving} onClick={() => void confirmar(t)}>Confirmar Traslado</button> : '—'}</td></tr>)}</tbody></table></div>}</section>
  </div>;
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '1.25rem' }, title: { margin: 0, color: 'var(--text-primary)' }, subtitle: { margin: 0, color: 'var(--text-primary)' }, muted: { color: 'var(--text-muted)' }, card: { display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: 10, background: 'var(--bg-secondary)' }, grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '1rem' }, linea: { display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '.75rem' }, actions: { display: 'flex', gap: '.75rem', justifyContent: 'space-between' }, tableWrap: { overflowX: 'auto' }, table: { width: '100%', textAlign: 'left', borderCollapse: 'collapse' }, error: { padding: '.75rem', color: '#fecaca', background: 'rgba(220,38,38,.18)' }, success: { padding: '.75rem', color: '#bbf7d0', background: 'rgba(22,163,74,.18)' },
};

export default TransferenciasPage;
