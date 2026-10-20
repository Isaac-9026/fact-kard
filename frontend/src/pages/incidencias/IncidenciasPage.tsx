import { useCallback, useEffect, useState } from 'react';
import { obtenerIncidencias, obtenerRecalculos, resolverIncidencia, type Incidencia, type Recalculo } from '../../api/kardex';
import { useAuth } from '../../context/AuthContext';

export const IncidenciasPage = () => {
  const { empresaActiva } = useAuth();
  const [tab, setTab] = useState<'incidencias' | 'recalculos'>('incidencias');
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [recalculos, setRecalculos] = useState<Recalculo[]>([]);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => {
    if (!empresaActiva) return;
    try { const [i, r] = await Promise.all([obtenerIncidencias(), obtenerRecalculos()]); setIncidencias(i); setRecalculos(r); }
    catch { setError('No se pudo cargar la información del motor Kardex.'); }
  }, [empresaActiva?.id]);
  useEffect(() => { void cargar(); }, [cargar]);
  const cambiarEstado = async (id: number, estado: 'RESUELTA' | 'DESCARTADA') => {
    try { await resolverIncidencia(id, estado); await cargar(); } catch { setError('No se pudo actualizar la incidencia.'); }
  };
  return <div style={styles.container}>
    <header><h1>Incidencias y recálculos</h1><p>Control del motor para {empresaActiva?.razon_social}.</p></header>
    {error && <div role="alert">{error}</div>}
    <nav style={styles.tabs}><button onClick={() => setTab('incidencias')}>INCIDENCIAS</button><button onClick={() => setTab('recalculos')}>RECÁLCULOS</button></nav>
    {tab === 'incidencias' ? <table style={styles.table}><thead><tr><th>Tipo</th><th>Severidad</th><th>Descripción</th><th>Bloquea cierre</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{incidencias.map((i) => <tr key={i.id}><td>{i.tipo}</td><td>{i.severidad}</td><td>{i.descripcion}</td><td>{i.bloquea_cierre ? 'Sí' : 'No'}</td><td>{i.estado}</td><td>{empresaActiva?.rol === 'ADMIN' && i.estado === 'PENDIENTE' ? <><button onClick={() => void cambiarEstado(i.id, 'RESUELTA')}>Resolver</button><button onClick={() => void cambiarEstado(i.id, 'DESCARTADA')}>Descartar</button></> : '—'}</td></tr>)}</tbody></table>
      : <table style={styles.table}><thead><tr><th>Producto</th><th>Fecha desde</th><th>Estado</th><th>Versión</th><th>Ejecución</th><th>Cambios</th></tr></thead><tbody>{recalculos.map((r) => <tr key={r.id}><td>{r.producto}</td><td>{r.fecha_desde}</td><td>{r.estado}</td><td>{r.version}</td><td>{new Date(r.ejecutado_en).toLocaleString()}</td><td>{r.detalles.length}</td></tr>)}</tbody></table>}
  </div>;
};
const styles: Record<string, React.CSSProperties> = { container: { display: 'flex', flexDirection: 'column', gap: '1rem' }, tabs: { display: 'flex', gap: '.5rem' }, table: { width: '100%', textAlign: 'left', background: 'var(--bg-secondary)', borderCollapse: 'collapse' } };
export default IncidenciasPage;
