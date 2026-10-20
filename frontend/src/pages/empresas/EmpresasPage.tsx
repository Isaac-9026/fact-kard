import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import {
  actualizarConfigEmpresa, actualizarEstablecimiento, crearEmpresa, crearEstablecimiento,
  obtenerConfigEmpresa, obtenerEmpresas, obtenerEstablecimientos, obtenerMonedas,
  type ConfigEmpresa, type Empresa, type Establecimiento, type Moneda,
} from '../../api/empresas';
import { useAuth } from '../../context/AuthContext';

const mensajeError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') return Object.values(data).flat().join(' ');
  }
  return 'No se pudo completar la operación.';
};

export const EmpresasPage: React.FC = () => {
  const { empresaActiva, seleccionarEmpresa } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [config, setConfig] = useState<ConfigEmpresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mostrarEmpresa, setMostrarEmpresa] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [empresaForm, setEmpresaForm] = useState({ ruc: '', razon_social: '', nombre_comercial: '', direccion: '', moneda_base_codigo: 'PEN' });
  const [establecimientoForm, setEstablecimientoForm] = useState({ codigo_sunat: '', nombre: '', activo: true });
  const [configForm, setConfigForm] = useState({ tolerancia_residuo_pen: '0.05000000', decimales_calculo: 6, establecimiento_principal: '' });

  const cargarDatosEmpresa = useCallback(async () => {
    if (!empresaActiva) { setEstablecimientos([]); setConfig(null); return; }
    const [lista, configuracion] = await Promise.all([obtenerEstablecimientos(), obtenerConfigEmpresa()]);
    setEstablecimientos(lista);
    setConfig(configuracion);
    setConfigForm({
      tolerancia_residuo_pen: configuracion.tolerancia_residuo_pen,
      decimales_calculo: configuracion.decimales_calculo,
      establecimiento_principal: configuracion.establecimiento_principal?.toString() ?? '',
    });
  }, [empresaActiva]);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true); setError('');
      try {
        const [listaEmpresas, listaMonedas] = await Promise.all([obtenerEmpresas(), obtenerMonedas()]);
        setEmpresas(listaEmpresas); setMonedas(listaMonedas); await cargarDatosEmpresa();
      } catch (err) { setError(mensajeError(err)); } finally { setLoading(false); }
    };
    void cargar();
  }, [cargarDatosEmpresa]);

  const ejecutar = async (accion: () => Promise<void>, mensaje: string) => {
    setSaving(true); setError(''); setSuccess('');
    try { await accion(); setSuccess(mensaje); } catch (err) { setError(mensajeError(err)); } finally { setSaving(false); }
  };

  const guardarEmpresa = (event: FormEvent) => {
    event.preventDefault();
    void ejecutar(async () => {
      const nueva = await crearEmpresa(empresaForm);
      setEmpresas((actuales) => [...actuales, nueva]);
      setEmpresaForm({ ruc: '', razon_social: '', nombre_comercial: '', direccion: '', moneda_base_codigo: 'PEN' });
      setMostrarEmpresa(false);
    }, 'Empresa creada y configurada correctamente.');
  };

  const guardarEstablecimiento = (event: FormEvent) => {
    event.preventDefault();
    void ejecutar(async () => {
      if (editando) await actualizarEstablecimiento(editando, establecimientoForm);
      else await crearEstablecimiento(establecimientoForm);
      setEstablecimientoForm({ codigo_sunat: '', nombre: '', activo: true }); setEditando(null);
      setEstablecimientos(await obtenerEstablecimientos());
    }, editando ? 'Establecimiento actualizado.' : 'Establecimiento creado.');
  };

  const guardarConfig = (event: FormEvent) => {
    event.preventDefault();
    void ejecutar(async () => {
      const actualizada = await actualizarConfigEmpresa({
        tolerancia_residuo_pen: configForm.tolerancia_residuo_pen,
        decimales_calculo: configForm.decimales_calculo,
        establecimiento_principal: configForm.establecimiento_principal ? Number(configForm.establecimiento_principal) : null,
      });
      setConfig(actualizada);
    }, 'Configuración actualizada.');
  };

  if (loading) return <p style={styles.notice}>Cargando empresas y configuración…</p>;

  return <div style={styles.container}>
    <div style={styles.pageHeader}><div><h2 style={styles.pageTitle}>Empresas y configuración</h2><p style={styles.muted}>Administra empresas, establecimientos SUNAT y parámetros contables.</p></div><button type="button" style={styles.primaryButton} onClick={() => setMostrarEmpresa((v) => !v)}>{mostrarEmpresa ? 'Cancelar' : '+ Nueva empresa'}</button></div>
    {error && <div role="alert" style={{ ...styles.alert, ...styles.error }}>{error}</div>}
    {success && <div role="status" style={{ ...styles.alert, ...styles.success }}>{success}</div>}

    {mostrarEmpresa && <form onSubmit={guardarEmpresa} style={styles.card}><h3 style={styles.cardTitle}>Crear empresa</h3><div style={styles.formGrid}>
      <Campo label="RUC"><input required minLength={11} maxLength={11} style={styles.input} value={empresaForm.ruc} onChange={(e) => setEmpresaForm({ ...empresaForm, ruc: e.target.value })} /></Campo>
      <Campo label="Razón social"><input required style={styles.input} value={empresaForm.razon_social} onChange={(e) => setEmpresaForm({ ...empresaForm, razon_social: e.target.value })} /></Campo>
      <Campo label="Nombre comercial"><input style={styles.input} value={empresaForm.nombre_comercial} onChange={(e) => setEmpresaForm({ ...empresaForm, nombre_comercial: e.target.value })} /></Campo>
      <Campo label="Dirección"><input style={styles.input} value={empresaForm.direccion} onChange={(e) => setEmpresaForm({ ...empresaForm, direccion: e.target.value })} /></Campo>
      <Campo label="Moneda base"><select style={styles.input} value={empresaForm.moneda_base_codigo} onChange={(e) => setEmpresaForm({ ...empresaForm, moneda_base_codigo: e.target.value })}>{monedas.map((m) => <option key={m.codigo} value={m.codigo}>{m.codigo} — {m.nombre}</option>)}</select></Campo>
    </div><button disabled={saving} style={styles.primaryButton}>Crear empresa</button></form>}

    <section style={styles.card}><h3 style={styles.cardTitle}>Empresas disponibles ({empresas.length})</h3>{empresas.length === 0 ? <p style={styles.muted}>No tienes empresas asignadas.</p> : <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>RUC</th><th style={styles.th}>Razón social</th><th style={styles.th}>Rol</th><th style={styles.th}>Estado</th><th style={styles.th}></th></tr></thead><tbody>{empresas.map((e) => <tr key={e.id}><td style={styles.td}>{e.ruc}</td><td style={styles.td}>{e.razon_social}</td><td style={styles.td}>{e.rol}</td><td style={styles.td}>{e.estado}</td><td style={styles.td}><button type="button" style={styles.secondaryButton} onClick={() => seleccionarEmpresa(e.id)} disabled={empresaActiva?.id === e.id}>{empresaActiva?.id === e.id ? 'Activa' : 'Seleccionar'}</button></td></tr>)}</tbody></table></div>}</section>

    {!empresaActiva ? <div style={styles.notice}>Selecciona una empresa activa para administrar su configuración y establecimientos.</div> : <>
      <div style={styles.activeBanner}><strong>Empresa activa:</strong> {empresaActiva.razon_social} · RUC {empresaActiva.ruc} · Rol {empresaActiva.rol}</div>
      <div style={styles.twoColumns}>
        <form onSubmit={guardarConfig} style={styles.card}><h3 style={styles.cardTitle}>Configuración contable</h3>
          <Campo label="Tolerancia de residuo PEN"><input required inputMode="decimal" pattern="^\d+(\.\d{1,8})?$" style={styles.input} value={configForm.tolerancia_residuo_pen} onChange={(e) => setConfigForm({ ...configForm, tolerancia_residuo_pen: e.target.value })} /></Campo>
          <Campo label="Decimales de cálculo"><input required type="number" min={2} max={8} style={styles.input} value={configForm.decimales_calculo} onChange={(e) => setConfigForm({ ...configForm, decimales_calculo: Number(e.target.value) })} /></Campo>
          <Campo label="Establecimiento principal"><select style={styles.input} value={configForm.establecimiento_principal} onChange={(e) => setConfigForm({ ...configForm, establecimiento_principal: e.target.value })}><option value="">Sin asignar</option>{establecimientos.map((e) => <option key={e.id} value={e.id}>{e.codigo_sunat} — {e.nombre}</option>)}</select></Campo>
          <div style={styles.fixedValues}><span>Redondeo: <strong>{config?.regla_redondeo ?? 'ROUND_HALF_UP'}</strong></span><span>Método: <strong>{config?.metodo_valuacion ?? 'CPP'}</strong></span></div><button disabled={saving} style={styles.primaryButton}>Guardar configuración</button>
        </form>
        <form onSubmit={guardarEstablecimiento} style={styles.card}><h3 style={styles.cardTitle}>{editando ? 'Editar establecimiento' : 'Nuevo establecimiento SUNAT'}</h3>
          <Campo label="Código SUNAT"><input required maxLength={20} style={styles.input} value={establecimientoForm.codigo_sunat} onChange={(e) => setEstablecimientoForm({ ...establecimientoForm, codigo_sunat: e.target.value })} /></Campo>
          <Campo label="Nombre"><input required maxLength={150} style={styles.input} value={establecimientoForm.nombre} onChange={(e) => setEstablecimientoForm({ ...establecimientoForm, nombre: e.target.value })} /></Campo>
          <label style={styles.checkbox}><input type="checkbox" checked={establecimientoForm.activo} onChange={(e) => setEstablecimientoForm({ ...establecimientoForm, activo: e.target.checked })} /> Activo</label>
          <div style={styles.actions}><button disabled={saving} style={styles.primaryButton}>{editando ? 'Actualizar' : 'Crear'}</button>{editando && <button type="button" style={styles.secondaryButton} onClick={() => { setEditando(null); setEstablecimientoForm({ codigo_sunat: '', nombre: '', activo: true }); }}>Cancelar</button>}</div>
        </form>
      </div>
      <section style={styles.card}><h3 style={styles.cardTitle}>Establecimientos ({establecimientos.length})</h3>{establecimientos.length === 0 ? <p style={styles.muted}>Aún no hay establecimientos.</p> : establecimientos.map((e) => <div key={e.id} style={styles.listRow}><div><strong>{e.codigo_sunat}</strong> · {e.nombre}<span style={styles.muted}> · {e.activo ? 'Activo' : 'Inactivo'}</span></div><button type="button" style={styles.secondaryButton} onClick={() => { setEditando(e.id); setEstablecimientoForm({ codigo_sunat: e.codigo_sunat, nombre: e.nombre, activo: e.activo }); }}>Editar</button></div>)}</section>
    </>}
  </div>;
};

const Campo: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label style={styles.label}>{label}{children}</label>;
const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: '1.25rem' }, pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' },
  pageTitle: { fontSize: '1.5rem', color: 'var(--text-primary)' }, cardTitle: { fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }, muted: { color: 'var(--text-muted)', fontSize: '0.875rem' },
  card: { display: 'flex', flexDirection: 'column', gap: '0.9rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem' }, formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }, twoColumns: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }, input: { padding: '0.55rem 0.65rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }, checkbox: { display: 'flex', gap: '0.5rem', color: 'var(--text-secondary)' },
  primaryButton: { alignSelf: 'flex-start', padding: '0.55rem 1rem', border: 0, borderRadius: '6px', background: 'var(--accent-primary)', color: '#fff', fontWeight: 600 }, secondaryButton: { padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', color: 'var(--text-secondary)' }, actions: { display: 'flex', gap: '0.6rem' }, fixedValues: { display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.85rem' },
  tableWrap: { overflowX: 'auto' }, table: { width: '100%', borderCollapse: 'collapse' }, th: { textAlign: 'left', padding: '0.6rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }, td: { padding: '0.6rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }, listRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.65rem 0', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' },
  activeBanner: { padding: '0.8rem 1rem', borderRadius: '7px', background: 'rgba(59,130,246,.12)', color: 'var(--text-primary)', border: '1px solid rgba(59,130,246,.3)' }, notice: { padding: '1rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '8px' }, alert: { padding: '0.75rem 1rem', borderRadius: '6px' }, error: { color: '#fecaca', background: 'rgba(220,38,38,.18)' }, success: { color: '#bbf7d0', background: 'rgba(22,163,74,.18)' },
};
export default EmpresasPage;
