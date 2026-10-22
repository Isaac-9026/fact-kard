import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

import {
  createAlmacen,
  createProducto,
  createProductoUnidad,
  createTercero,
  getAlmacenes,
  getProductos,
  getProductoUnidades,
  getTerceros,
  getTiposExistencia,
  getUnidadesMedida,
  updateAlmacen,
  updateProducto,
  updateProductoUnidad,
  updateTercero,
  type Almacen,
  type EstadoMaestro,
  type FiltroTercero,
  type Producto,
  type ProductoUnidad,
  type Tercero,
  type TipoExistencia,
  type UnidadMedida,
} from '../../api/inventario';
import {
  obtenerEstablecimientos,
  type Establecimiento,
} from '../../api/empresas';
import { useAuth } from '../../context/AuthContext';
import './MaestrosInventarioPage.css';

type TabId = 'productos' | 'terceros' | 'almacenes';

const PRODUCTO_INICIAL = {
  codigo_interno: '',
  descripcion: '',
  tipo_existencia_codigo: '',
  unidad_base_codigo: '',
  estado: 'ACTIVO' as EstadoMaestro,
};

const TERCERO_INICIAL = {
  tipo_documento: '6',
  numero_documento: '',
  razon_social: '',
  nombre_comercial: '',
  direccion: '',
  telefono: '',
  correo: '',
  es_cliente: true,
  es_proveedor: false,
  estado: 'ACTIVO' as EstadoMaestro,
};

const ALMACEN_INICIAL = {
  establecimiento: '',
  codigo: '',
  nombre: '',
  activo: true,
};

const UNIDAD_INICIAL = {
  unidad_codigo: '',
  factor_a_base: '',
  es_base: false,
};

const extraerError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return 'No se pudo completar la operación.';
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return 'No se pudo completar la operación.';

  return Object.entries(data)
    .map(([campo, detalle]) => {
      const texto = Array.isArray(detalle) ? detalle.join(' ') : String(detalle);
      return campo === 'detail' || campo === 'non_field_errors' ? texto : `${campo}: ${texto}`;
    })
    .join(' ');
};

const EstadoBadge = ({ activo }: { activo: boolean }) => (
  <span className={`mi-badge ${activo ? 'mi-badge--success' : 'mi-badge--muted'}`}>
    {activo ? 'Activo' : 'Inactivo'}
  </span>
);

export const MaestrosInventarioPage = () => {
  const { empresaActiva } = useAuth();
  const esAdmin = empresaActiva?.rol === 'ADMIN';
  const [tab, setTab] = useState<TabId>('productos');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [tiposExistencia, setTiposExistencia] = useState<TipoExistencia[]>([]);
  const [unidadesMedida, setUnidadesMedida] = useState<UnidadMedida[]>([]);
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [catalogosLoading, setCatalogosLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [productoForm, setProductoForm] = useState(PRODUCTO_INICIAL);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);
  const [productoFormVisible, setProductoFormVisible] = useState(false);
  const [productoUnidades, setProductoUnidades] = useState<ProductoUnidad[]>([]);
  const [productoUnidadesActivo, setProductoUnidadesActivo] = useState<Producto | null>(null);
  const [unidadForm, setUnidadForm] = useState(UNIDAD_INICIAL);
  const [unidadEditando, setUnidadEditando] = useState<ProductoUnidad | null>(null);
  const [unidadesLoading, setUnidadesLoading] = useState(false);

  const [terceroForm, setTerceroForm] = useState(TERCERO_INICIAL);
  const [terceroEditando, setTerceroEditando] = useState<Tercero | null>(null);
  const [terceroFormVisible, setTerceroFormVisible] = useState(false);
  const [tipoTercero, setTipoTercero] = useState<'todos' | FiltroTercero>('todos');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');

  const [almacenForm, setAlmacenForm] = useState(ALMACEN_INICIAL);
  const [almacenEditando, setAlmacenEditando] = useState<Almacen | null>(null);
  const [almacenFormVisible, setAlmacenFormVisible] = useState(false);
  const editorRef = useRef<HTMLElement | null>(null);
  const devolverFocoRef = useRef<HTMLElement | null>(null);
  const unidadesRequestRef = useRef(0);
  const productoUnidadesActivoIdRef = useRef<number | null>(null);

  const limpiarMensajes = () => {
    setError('');
    setSuccess('');
  };

  const recordarFoco = () => {
    devolverFocoRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  };

  const devolverFoco = () => {
    window.requestAnimationFrame(() => devolverFocoRef.current?.focus());
  };

  const cerrarProductoForm = () => {
    setProductoFormVisible(false);
    devolverFoco();
  };

  const cerrarTerceroForm = () => {
    setTerceroFormVisible(false);
    devolverFoco();
  };

  const cerrarAlmacenForm = () => {
    setAlmacenFormVisible(false);
    devolverFoco();
  };

  const cerrarUnidades = () => {
    unidadesRequestRef.current += 1;
    productoUnidadesActivoIdRef.current = null;
    setProductoUnidadesActivo(null);
    setProductoUnidades([]);
    setUnidadEditando(null);
    setUnidadForm(UNIDAD_INICIAL);
  };

  const cerrarFormularios = useCallback(() => {
    unidadesRequestRef.current += 1;
    productoUnidadesActivoIdRef.current = null;
    setProductoFormVisible(false);
    setProductoEditando(null);
    setProductoForm(PRODUCTO_INICIAL);
    setProductoUnidadesActivo(null);
    setProductoUnidades([]);
    setUnidadEditando(null);
    setUnidadForm(UNIDAD_INICIAL);
    setTerceroFormVisible(false);
    setTerceroEditando(null);
    setTerceroForm(TERCERO_INICIAL);
    setAlmacenFormVisible(false);
    setAlmacenEditando(null);
    setAlmacenForm(ALMACEN_INICIAL);
  }, []);

  const cargarProductos = useCallback(async () => setProductos(await getProductos()), []);
  const cargarTerceros = useCallback(async () => {
    setTerceros(await getTerceros({
      tipo: tipoTercero === 'todos' ? undefined : tipoTercero,
      search: search || undefined,
    }));
  }, [search, tipoTercero]);
  const cargarAlmacenes = useCallback(async () => setAlmacenes(await getAlmacenes()), []);

  useEffect(() => {
    cerrarFormularios();
    setProductos([]);
    setTerceros([]);
    setAlmacenes([]);
    setTiposExistencia([]);
    setUnidadesMedida([]);
    setEstablecimientos([]);
    limpiarMensajes();
  }, [cerrarFormularios, empresaActiva?.id]);

  useEffect(() => {
    if (!productoFormVisible && !terceroFormVisible && !almacenFormVisible) return;
    window.requestAnimationFrame(() => {
      editorRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    });
  }, [almacenFormVisible, productoFormVisible, terceroFormVisible]);

  useEffect(() => {
    if (!empresaActiva) return;
    let ignorar = false;
    const cargarCatalogos = async () => {
      setCatalogosLoading(true);
      try {
        const [tipos, unidades, locales] = await Promise.all([
          getTiposExistencia(),
          getUnidadesMedida(),
          obtenerEstablecimientos(),
        ]);
        if (!ignorar) {
          setTiposExistencia(tipos);
          setUnidadesMedida(unidades);
          setEstablecimientos(locales);
        }
      } catch (err) {
        if (!ignorar) setError(extraerError(err));
      } finally {
        if (!ignorar) setCatalogosLoading(false);
      }
    };
    void cargarCatalogos();
    return () => { ignorar = true; };
  }, [empresaActiva]);

  useEffect(() => {
    if (!empresaActiva) return;
    let ignorar = false;
    const cargarTab = async () => {
      setLoading(true);
      setError('');
      try {
        if (tab === 'productos') {
          const data = await getProductos();
          if (!ignorar) setProductos(data);
        } else if (tab === 'terceros') {
          const data = await getTerceros({
            tipo: tipoTercero === 'todos' ? undefined : tipoTercero,
            search: search || undefined,
          });
          if (!ignorar) setTerceros(data);
        } else {
          const data = await getAlmacenes();
          if (!ignorar) setAlmacenes(data);
        }
      } catch (err) {
        if (!ignorar) setError(extraerError(err));
      } finally {
        if (!ignorar) setLoading(false);
      }
    };
    void cargarTab();
    return () => { ignorar = true; };
  }, [empresaActiva, search, tab, tipoTercero]);

  const ejecutar = async (accion: () => Promise<void>, mensaje: string) => {
    setSaving(true);
    limpiarMensajes();
    try {
      await accion();
      setSuccess(mensaje);
      return true;
    } catch (err) {
      setError(extraerError(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const refrescarDespuesDeGuardar = async (accion: () => Promise<void>) => {
    try {
      await accion();
    } catch {
      setError('El cambio se guardó, pero no se pudo actualizar la lista. Recarga la página para ver el resultado confirmado.');
    }
  };

  const abrirNuevo = () => {
    recordarFoco();
    limpiarMensajes();
    if (tab === 'productos') {
      setProductoEditando(null);
      setProductoForm(PRODUCTO_INICIAL);
      setProductoFormVisible(true);
    } else if (tab === 'terceros') {
      setTerceroEditando(null);
      setTerceroForm(TERCERO_INICIAL);
      setTerceroFormVisible(true);
    } else {
      setAlmacenEditando(null);
      setAlmacenForm(ALMACEN_INICIAL);
      setAlmacenFormVisible(true);
    }
  };

  const editarProducto = (producto: Producto) => {
    recordarFoco();
    setProductoEditando(producto);
    setProductoForm({
      codigo_interno: producto.codigo_interno,
      descripcion: producto.descripcion,
      tipo_existencia_codigo: producto.tipo_existencia_codigo,
      unidad_base_codigo: '',
      estado: producto.estado,
    });
    setProductoFormVisible(true);
  };

  const guardarProducto = (event: FormEvent) => {
    event.preventDefault();
    void (async () => {
      const guardado = await ejecutar(async () => {
        if (productoEditando) {
          await updateProducto(productoEditando.id, {
            codigo_interno: productoForm.codigo_interno,
            descripcion: productoForm.descripcion,
            tipo_existencia_codigo: productoForm.tipo_existencia_codigo,
            estado: productoForm.estado,
          });
        } else {
          await createProducto(productoForm);
        }
      }, productoEditando ? 'Producto actualizado.' : 'Producto creado con su unidad base.');
      if (!guardado) return;
      cerrarProductoForm();
      setProductoEditando(null);
      setProductoForm(PRODUCTO_INICIAL);
      await refrescarDespuesDeGuardar(cargarProductos);
    })();
  };

  const gestionarUnidades = async (producto: Producto) => {
    const requestId = ++unidadesRequestRef.current;
    productoUnidadesActivoIdRef.current = producto.id;
    setProductoUnidadesActivo(producto);
    setProductoUnidades([]);
    setUnidadEditando(null);
    setUnidadForm(UNIDAD_INICIAL);
    setUnidadesLoading(true);
    limpiarMensajes();
    try {
      const unidades = await getProductoUnidades(producto.id);
      if (requestId === unidadesRequestRef.current) setProductoUnidades(unidades);
    } catch (err) {
      if (requestId === unidadesRequestRef.current) setError(extraerError(err));
    } finally {
      if (requestId === unidadesRequestRef.current) setUnidadesLoading(false);
    }
  };

  const editarUnidad = (unidad: ProductoUnidad) => {
    setUnidadEditando(unidad);
    setUnidadForm({
      unidad_codigo: unidad.unidad_codigo,
      factor_a_base: unidad.factor_a_base,
      es_base: unidad.es_base,
    });
  };

  const guardarUnidad = (event: FormEvent) => {
    event.preventDefault();
    if (!productoUnidadesActivo) return;
    const productoId = productoUnidadesActivo.id;
    const requestId = ++unidadesRequestRef.current;
    void (async () => {
      const guardado = await ejecutar(async () => {
        if (unidadEditando) {
          await updateProductoUnidad(productoId, unidadEditando.id, unidadForm);
        } else {
          await createProductoUnidad(productoId, { ...unidadForm, es_base: false });
        }
      }, unidadEditando ? 'Presentación actualizada.' : 'Presentación agregada.');
      if (!guardado) return;
      if (productoUnidadesActivoIdRef.current === productoId) {
        setUnidadEditando(null);
        setUnidadForm(UNIDAD_INICIAL);
      }
      await refrescarDespuesDeGuardar(async () => {
        const [unidades] = await Promise.all([
          getProductoUnidades(productoId),
          cargarProductos(),
        ]);
        if (
          requestId === unidadesRequestRef.current
          && productoUnidadesActivoIdRef.current === productoId
        ) setProductoUnidades(unidades);
      });
    })();
  };

  const editarTercero = (tercero: Tercero) => {
    recordarFoco();
    setTerceroEditando(tercero);
    setTerceroForm({
      tipo_documento: tercero.tipo_documento,
      numero_documento: tercero.numero_documento,
      razon_social: tercero.razon_social,
      nombre_comercial: tercero.nombre_comercial ?? '',
      direccion: tercero.direccion ?? '',
      telefono: tercero.telefono ?? '',
      correo: tercero.correo ?? '',
      es_cliente: tercero.es_cliente,
      es_proveedor: tercero.es_proveedor,
      estado: tercero.estado,
    });
    setTerceroFormVisible(true);
  };

  const terceroSinRol = !terceroForm.es_cliente && !terceroForm.es_proveedor;
  const guardarTercero = (event: FormEvent) => {
    event.preventDefault();
    if (terceroSinRol) return;
    void (async () => {
      const guardado = await ejecutar(async () => {
        if (terceroEditando) await updateTercero(terceroEditando.id, terceroForm);
        else await createTercero(terceroForm);
      }, terceroEditando ? 'Tercero actualizado.' : 'Tercero creado.');
      if (!guardado) return;
      cerrarTerceroForm();
      setTerceroEditando(null);
      setTerceroForm(TERCERO_INICIAL);
      await refrescarDespuesDeGuardar(cargarTerceros);
    })();
  };

  const editarAlmacen = (almacen: Almacen) => {
    recordarFoco();
    setAlmacenEditando(almacen);
    setAlmacenForm({
      establecimiento: String(almacen.establecimiento),
      codigo: almacen.codigo,
      nombre: almacen.nombre,
      activo: almacen.activo,
    });
    setAlmacenFormVisible(true);
  };

  const guardarAlmacen = (event: FormEvent) => {
    event.preventDefault();
    void (async () => {
      const payload = {
        establecimiento: Number(almacenForm.establecimiento),
        codigo: almacenForm.codigo,
        nombre: almacenForm.nombre,
        activo: almacenForm.activo,
      };
      const guardado = await ejecutar(async () => {
        if (almacenEditando) await updateAlmacen(almacenEditando.id, payload);
        else await createAlmacen(payload);
      }, almacenEditando ? 'Almacén actualizado.' : 'Almacén creado.');
      if (!guardado) return;
      cerrarAlmacenForm();
      setAlmacenEditando(null);
      setAlmacenForm(ALMACEN_INICIAL);
      await refrescarDespuesDeGuardar(cargarAlmacenes);
    })();
  };

  const conteoActivo = useMemo(() => {
    if (tab === 'productos') return productos.length;
    if (tab === 'terceros') return terceros.length;
    return almacenes.length;
  }, [almacenes.length, productos.length, tab, terceros.length]);

  if (!empresaActiva) {
    return <div className="mi-empty mi-empty--blocking">
      <div className="mi-empty__mark" aria-hidden="true">FK</div>
      <h1>Selecciona una empresa</h1>
      <p>Los maestros de inventario siempre operan dentro de una empresa activa.</p>
      <Link to="/empresas" className="mi-button mi-button--primary">Ir a empresas</Link>
    </div>;
  }

  return <div className="mi-page">
    <header className="mi-header">
      <div>
        <h1>Maestros de inventario</h1>
        <p>{empresaActiva.razon_social} <span aria-hidden="true">·</span> RUC {empresaActiva.ruc}</p>
      </div>
      <div className="mi-header__actions">
        <span className={`mi-access ${esAdmin ? 'mi-access--admin' : ''}`}>
          {esAdmin ? 'Edición habilitada' : 'Modo consulta'}
        </span>
        <button className="mi-button mi-button--primary" type="button" onClick={abrirNuevo} disabled={!esAdmin || (tab === 'almacenes' && catalogosLoading)} title={!esAdmin ? 'Requiere rol ADMIN' : undefined}>
          Nuevo {tab === 'productos' ? 'producto' : tab === 'terceros' ? 'tercero' : 'almacén'}
        </button>
      </div>
    </header>

    <nav className="mi-tabs" role="tablist" aria-label="Maestros de inventario">
      {([
        ['productos', 'Productos y unidades'],
        ['terceros', 'Terceros'],
        ['almacenes', 'Almacenes'],
      ] as const).map(([id, label]) => <button key={id} id={`tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} className="mi-tab" onClick={() => { setTab(id); cerrarFormularios(); limpiarMensajes(); }}>
        {label}
      </button>)}
    </nav>

    <div className="mi-toolbar">
      <div><strong>{conteoActivo}</strong> {conteoActivo === 1 ? 'registro' : 'registros'}</div>
      {tab === 'terceros' && <form className="mi-search" onSubmit={(event) => { event.preventDefault(); setSearch(searchDraft.trim()); }} role="search">
        <div className="mi-segmented" aria-label="Filtrar terceros">
          {(['todos', 'cliente', 'proveedor'] as const).map((tipo) => <button key={tipo} type="button" aria-pressed={tipoTercero === tipo} onClick={() => setTipoTercero(tipo)}>{tipo === 'todos' ? 'Todos' : tipo === 'cliente' ? 'Clientes' : 'Proveedores'}</button>)}
        </div>
        <label className="mi-search__field"><span className="mi-sr-only">Buscar tercero</span><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Documento o razón social" /></label>
        <button className="mi-button mi-button--secondary" type="submit">Buscar</button>
        {(search || searchDraft) && <button className="mi-button mi-button--ghost" type="button" onClick={() => { setSearchDraft(''); setSearch(''); }}>Limpiar</button>}
      </form>}
    </div>

    {error && <div className="mi-alert mi-alert--error" role="alert"><strong>Atención.</strong><span>{error}</span></div>}
    {success && <div className="mi-alert mi-alert--success" role="status"><strong>Listo.</strong><span>{success}</span></div>}

    {loading ? <div className="mi-loading" role="status"><span className="mi-loading__bar" />Cargando registros…</div> : <>
      {tab === 'productos' && <section id="panel-productos" role="tabpanel" aria-labelledby="tab-productos" className="mi-workspace">
        <div className="mi-table-shell">
          <table className="mi-table"><thead><tr><th>Código interno</th><th>Descripción</th><th>Tipo existencia SUNAT</th><th>Unidad base</th><th>Estado</th><th className="mi-table__actions">Acciones</th></tr></thead><tbody>
            {productos.map((producto) => <tr key={producto.id}><td className="mi-code">{producto.codigo_interno}</td><td className="mi-table__main">{producto.descripcion}</td><td><span className="mi-code">{producto.tipo_existencia_codigo}</span><small>{producto.tipo_existencia_descripcion}</small></td><td>{producto.unidad_base ? <><span className="mi-code">{producto.unidad_base.codigo}</span><small>{producto.unidad_base.descripcion}</small></> : <span className="mi-badge mi-badge--danger">Sin unidad base</span>}</td><td><EstadoBadge activo={producto.estado === 'ACTIVO'} /></td><td className="mi-table__actions"><button type="button" className="mi-link-button" onClick={() => void gestionarUnidades(producto)}>Gestionar unidades</button>{esAdmin && <button type="button" className="mi-link-button" onClick={() => editarProducto(producto)}>Editar</button>}</td></tr>)}
          </tbody></table>
          {productos.length === 0 && <EmptyState titulo="Aún no hay productos" detalle="Crea el primer producto con su unidad base para iniciar el catálogo." accion={esAdmin ? abrirNuevo : undefined} />}
        </div>
        {productoFormVisible && <aside ref={editorRef} className="mi-editor" aria-label={productoEditando ? 'Editar producto' : 'Crear producto'}><EditorHeader titulo={productoEditando ? 'Editar producto' : 'Nuevo producto'} detalle={productoEditando ? productoEditando.codigo_interno : 'La unidad base se creará con factor 1.00000000.'} onClose={cerrarProductoForm} /><form onSubmit={guardarProducto} className="mi-form">
          <Field label="Código interno"><input required maxLength={50} value={productoForm.codigo_interno} onChange={(e) => setProductoForm({ ...productoForm, codigo_interno: e.target.value })} /></Field>
          <Field label="Descripción"><textarea required maxLength={250} rows={3} value={productoForm.descripcion} onChange={(e) => setProductoForm({ ...productoForm, descripcion: e.target.value })} /></Field>
          <Field label="Tipo de existencia SUNAT"><select required value={productoForm.tipo_existencia_codigo} onChange={(e) => setProductoForm({ ...productoForm, tipo_existencia_codigo: e.target.value })}><option value="">Seleccionar</option>{tiposExistencia.map((tipo) => <option key={tipo.codigo} value={tipo.codigo}>{tipo.codigo} — {tipo.descripcion}</option>)}</select></Field>
          {!productoEditando && <Field label="Unidad base" hint="Se registrará exactamente con factor 1.00000000."><select required value={productoForm.unidad_base_codigo} onChange={(e) => setProductoForm({ ...productoForm, unidad_base_codigo: e.target.value })}><option value="">Seleccionar</option>{unidadesMedida.map((unidad) => <option key={unidad.codigo} value={unidad.codigo}>{unidad.codigo} — {unidad.descripcion}</option>)}</select></Field>}
          <Field label="Estado"><select value={productoForm.estado} onChange={(e) => setProductoForm({ ...productoForm, estado: e.target.value as EstadoMaestro })}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></Field>
          <FormActions saving={saving} label={productoEditando ? 'Guardar cambios' : 'Crear producto'} onCancel={cerrarProductoForm} />
        </form></aside>}
      </section>}

      {tab === 'terceros' && <section id="panel-terceros" role="tabpanel" aria-labelledby="tab-terceros" className="mi-workspace">
        <div className="mi-table-shell"><table className="mi-table"><thead><tr><th>Documento</th><th>Razón social</th><th>Cliente</th><th>Proveedor</th><th>Estado</th><th className="mi-table__actions">Acciones</th></tr></thead><tbody>
          {terceros.map((tercero) => <tr key={tercero.id}><td><small>{tercero.tipo_documento}</small><span className="mi-code">{tercero.numero_documento}</span></td><td className="mi-table__main">{tercero.razon_social}{tercero.nombre_comercial && <small>{tercero.nombre_comercial}</small>}</td><td>{tercero.es_cliente ? <span className="mi-check">Sí</span> : <span className="mi-muted">—</span>}</td><td>{tercero.es_proveedor ? <span className="mi-check">Sí</span> : <span className="mi-muted">—</span>}</td><td><EstadoBadge activo={tercero.estado === 'ACTIVO'} /></td><td className="mi-table__actions">{esAdmin && <button type="button" className="mi-link-button" onClick={() => editarTercero(tercero)}>Editar</button>}</td></tr>)}
        </tbody></table>{terceros.length === 0 && <EmptyState titulo="Sin terceros para este filtro" detalle={search ? 'Prueba con otro documento o razón social.' : 'Registra clientes y proveedores en una sola ficha.'} accion={esAdmin && !search ? abrirNuevo : undefined} />}</div>
        {terceroFormVisible && <aside ref={editorRef} className="mi-editor"><EditorHeader titulo={terceroEditando ? 'Editar tercero' : 'Nuevo tercero'} detalle="Cliente, proveedor o ambos." onClose={cerrarTerceroForm} /><form onSubmit={guardarTercero} className="mi-form">
          <div className="mi-form__two"><Field label="Tipo documento"><input required maxLength={20} value={terceroForm.tipo_documento} onChange={(e) => setTerceroForm({ ...terceroForm, tipo_documento: e.target.value })} /></Field><Field label="Número"><input required maxLength={20} value={terceroForm.numero_documento} onChange={(e) => setTerceroForm({ ...terceroForm, numero_documento: e.target.value })} /></Field></div>
          <Field label="Razón social"><input required maxLength={200} value={terceroForm.razon_social} onChange={(e) => setTerceroForm({ ...terceroForm, razon_social: e.target.value })} /></Field>
          <Field label="Nombre comercial"><input maxLength={200} value={terceroForm.nombre_comercial} onChange={(e) => setTerceroForm({ ...terceroForm, nombre_comercial: e.target.value })} /></Field>
          <div className="mi-form__two"><Field label="Teléfono"><input maxLength={50} value={terceroForm.telefono} onChange={(e) => setTerceroForm({ ...terceroForm, telefono: e.target.value })} /></Field><Field label="Correo"><input type="email" maxLength={254} value={terceroForm.correo} onChange={(e) => setTerceroForm({ ...terceroForm, correo: e.target.value })} /></Field></div>
          <Field label="Dirección"><textarea rows={2} maxLength={300} value={terceroForm.direccion} onChange={(e) => setTerceroForm({ ...terceroForm, direccion: e.target.value })} /></Field>
          <fieldset className={`mi-role-choice ${terceroSinRol ? 'mi-role-choice--invalid' : ''}`}><legend>Relación comercial</legend><label><input type="checkbox" checked={terceroForm.es_cliente} onChange={(e) => setTerceroForm({ ...terceroForm, es_cliente: e.target.checked })} /> Cliente</label><label><input type="checkbox" checked={terceroForm.es_proveedor} onChange={(e) => setTerceroForm({ ...terceroForm, es_proveedor: e.target.checked })} /> Proveedor</label>{terceroSinRol && <p role="alert">Selecciona al menos una opción.</p>}</fieldset>
          <Field label="Estado"><select value={terceroForm.estado} onChange={(e) => setTerceroForm({ ...terceroForm, estado: e.target.value as EstadoMaestro })}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></Field>
          <FormActions saving={saving} disabled={terceroSinRol} label={terceroEditando ? 'Guardar cambios' : 'Crear tercero'} onCancel={cerrarTerceroForm} />
        </form></aside>}
      </section>}

      {tab === 'almacenes' && <section id="panel-almacenes" role="tabpanel" aria-labelledby="tab-almacenes" className="mi-workspace">
        <div className="mi-table-shell"><table className="mi-table"><thead><tr><th>Código</th><th>Nombre</th><th>Establecimiento</th><th>Estado</th><th className="mi-table__actions">Acciones</th></tr></thead><tbody>
          {almacenes.map((almacen) => <tr key={almacen.id}><td className="mi-code">{almacen.codigo}</td><td className="mi-table__main">{almacen.nombre}</td><td><span className="mi-code">{almacen.establecimiento_codigo}</span><small>{almacen.establecimiento_nombre}</small></td><td><EstadoBadge activo={almacen.activo} /></td><td className="mi-table__actions">{esAdmin && <button type="button" className="mi-link-button" onClick={() => editarAlmacen(almacen)}>Editar</button>}</td></tr>)}
        </tbody></table>{almacenes.length === 0 && <EmptyState titulo="Aún no hay almacenes" detalle={establecimientos.length ? 'Crea un almacén vinculado a un establecimiento SUNAT.' : 'Primero crea un establecimiento para esta empresa.'} accion={esAdmin && establecimientos.length ? abrirNuevo : undefined} enlace={!establecimientos.length ? '/empresas' : undefined} />}</div>
        {almacenFormVisible && <aside ref={editorRef} className="mi-editor"><EditorHeader titulo={almacenEditando ? 'Editar almacén' : 'Nuevo almacén'} detalle="El establecimiento debe pertenecer a la empresa activa." onClose={cerrarAlmacenForm} /><form onSubmit={guardarAlmacen} className="mi-form">
          <Field label="Código"><input required maxLength={50} value={almacenForm.codigo} onChange={(e) => setAlmacenForm({ ...almacenForm, codigo: e.target.value })} /></Field>
          <Field label="Nombre"><input required maxLength={150} value={almacenForm.nombre} onChange={(e) => setAlmacenForm({ ...almacenForm, nombre: e.target.value })} /></Field>
          <Field label="Establecimiento"><select required value={almacenForm.establecimiento} onChange={(e) => setAlmacenForm({ ...almacenForm, establecimiento: e.target.value })}><option value="">Seleccionar</option>{establecimientos.filter((e) => e.activo || Number(almacenForm.establecimiento) === e.id).map((e) => <option key={e.id} value={e.id}>{e.codigo_sunat} — {e.nombre}{e.activo ? '' : ' (inactivo)'}</option>)}</select></Field>
          <label className="mi-switch"><input type="checkbox" checked={almacenForm.activo} onChange={(e) => setAlmacenForm({ ...almacenForm, activo: e.target.checked })} /><span>Almacén activo</span></label>
          <FormActions saving={saving} label={almacenEditando ? 'Guardar cambios' : 'Crear almacén'} onCancel={cerrarAlmacenForm} />
        </form></aside>}
      </section>}
    </>}

    {productoUnidadesActivo && <section className="mi-units" aria-labelledby="titulo-unidades">
      <EditorHeader titulo={`Unidades · ${productoUnidadesActivo.codigo_interno}`} detalle={productoUnidadesActivo.descripcion} onClose={cerrarUnidades} titleId="titulo-unidades" />
      <div className="mi-units__layout"><div className="mi-table-shell"><table className="mi-table mi-table--units"><thead><tr><th>Unidad</th><th>Factor a base</th><th>Tipo</th><th className="mi-table__actions">Acciones</th></tr></thead><tbody>{productoUnidades.map((unidad) => <tr key={unidad.id}><td><span className="mi-code">{unidad.unidad_codigo}</span><small>{unidad.unidad_descripcion}</small></td><td className="mi-factor">{unidad.factor_a_base}</td><td>{unidad.es_base ? <span className="mi-badge mi-badge--base">Unidad base</span> : 'Presentación'}</td><td className="mi-table__actions">{esAdmin && <button className="mi-link-button" type="button" onClick={() => editarUnidad(unidad)}>Editar</button>}</td></tr>)}</tbody></table>{unidadesLoading && <div className="mi-loading">Cargando unidades…</div>}</div>
      {esAdmin && <form onSubmit={guardarUnidad} className="mi-unit-form"><h3>{unidadEditando ? 'Editar presentación' : 'Agregar presentación'}</h3><Field label="Unidad"><select required value={unidadForm.unidad_codigo} onChange={(e) => setUnidadForm({ ...unidadForm, unidad_codigo: e.target.value })}><option value="">Seleccionar</option>{unidadesMedida.map((unidad) => <option key={unidad.codigo} value={unidad.codigo}>{unidad.codigo} — {unidad.descripcion}</option>)}</select></Field><Field label="Factor a base" hint={unidadForm.es_base ? 'La unidad base siempre equivale a 1.00000000.' : 'Usa hasta 8 decimales; por ejemplo 6.00000000.'}><input required inputMode="decimal" pattern="^\d+(\.\d{1,8})?$" value={unidadForm.factor_a_base} disabled={unidadForm.es_base} onChange={(e) => setUnidadForm({ ...unidadForm, factor_a_base: e.target.value })} /></Field>{unidadForm.es_base && <span className="mi-badge mi-badge--base">Unidad base protegida</span>}<FormActions saving={saving} label={unidadEditando ? 'Guardar unidad' : 'Agregar unidad'} onCancel={() => { setUnidadEditando(null); setUnidadForm(UNIDAD_INICIAL); }} /></form>}
      </div>
    </section>}
  </div>;
};

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => <label className="mi-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;

const EditorHeader = ({ titulo, detalle, onClose, titleId }: { titulo: string; detalle: string; onClose: () => void; titleId?: string }) => <div className="mi-editor__header"><div><h2 id={titleId}>{titulo}</h2><p>{detalle}</p></div><button type="button" className="mi-close" onClick={onClose}>Cerrar</button></div>;

const FormActions = ({ saving, disabled = false, label, onCancel }: { saving: boolean; disabled?: boolean; label: string; onCancel: () => void }) => <div className="mi-form__actions"><button className="mi-button mi-button--primary" disabled={saving || disabled}>{saving ? 'Guardando…' : label}</button><button className="mi-button mi-button--ghost" type="button" onClick={onCancel}>Cancelar</button></div>;

const EmptyState = ({ titulo, detalle, accion, enlace }: { titulo: string; detalle: string; accion?: () => void; enlace?: string }) => <div className="mi-empty"><div className="mi-empty__line" aria-hidden="true" /><h2>{titulo}</h2><p>{detalle}</p>{accion && <button type="button" className="mi-button mi-button--secondary" onClick={accion}>Crear registro</button>}{enlace && <Link className="mi-button mi-button--secondary" to={enlace}>Gestionar establecimientos</Link>}</div>;

export default MaestrosInventarioPage;
