import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

import { obtenerTiposOperacion, type TipoOperacion } from '../../api/catalogos';
import { getAlmacenes, getProductos, type Almacen, type Producto } from '../../api/inventario';
import {
  anularNotaInterna,
  confirmarNotaInterna,
  confirmarSaldoInicial,
  createNotaInterna,
  createSaldoInicial,
  getNotaInterna,
  getNotasInternas,
  getSaldoInicial,
  getSaldosIniciales,
  updateNotaInterna,
  updateSaldoInicial,
  type EstadoNotaInterna,
  type EstadoSaldoInicial,
  type NotaInterna,
  type NotaInternaDetallePayload,
  type NotaInternaFiltros,
  type SaldoInicial,
  type SaldoInicialFiltros,
} from '../../api/operaciones';
import { obtenerPeriodos, type Periodo } from '../../api/periodos';
import { useAuth } from '../../context/AuthContext';
import { campoFechaNotaInterna, formularioNotaTrasRespuesta } from '../../utils/notaInternaForm';
import './OperacionesInternasPage.css';

type TabId = 'saldos' | 'notas';

const TIPOS_ESTANDAR = new Set(['MERMA', 'DESMEDRO', 'CONSUMO_INTERNO', 'RETIRO']);
const TIPOS_ADMIN = new Set(['AJUSTE_INGRESO', 'AJUSTE_SALIDA', 'AJUSTE_VALOR_MANUAL']);

const SALDO_INICIAL = {
  periodo: '', almacen: '', producto: '', cantidad: '', valor_pen: '',
};

const LINEA_INICIAL = (): NotaInternaDetallePayload => ({
  producto: 0,
  cantidad_base: '',
  costo_unitario_pen: null,
  valor_ajuste_pen: null,
});

const NOTA_INICIAL = {
  almacen: '', periodo: '', tipo_operacion: '', fecha: '', motivo: '',
  responsable: '', observacion: '', archivo_sustento: '',
  detalles: [LINEA_INICIAL()],
};

const extraerError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return 'No se pudo completar la operación.';
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return 'No se pudo completar la operación.';
  return Object.entries(data).map(([campo, detalle]) => {
    if (Array.isArray(detalle)) return `${campo}: ${detalle.join(' ')}`;
    if (detalle && typeof detalle === 'object') return `${campo}: ${JSON.stringify(detalle)}`;
    return campo === 'detail' || campo === 'non_field_errors'
      ? String(detalle)
      : `${campo}: ${String(detalle)}`;
  }).join(' ');
};

const decimalComoFraccion = (valor: string) => {
  const limpio = valor.trim();
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  const negativo = limpio.startsWith('-');
  const sinSigno = negativo ? limpio.slice(1) : limpio;
  const [entero, decimales = ''] = sinSigno.split('.');
  const escala = 10n ** BigInt(decimales.length);
  const numero = BigInt(`${entero}${decimales}` || '0') * (negativo ? -1n : 1n);
  return { numero, escala };
};

const dividirASeisDecimales = (valor: string, cantidad: string) => {
  const dividendo = decimalComoFraccion(valor);
  const divisor = decimalComoFraccion(cantidad);
  if (!dividendo || !divisor || divisor.numero === 0n) return '0.000000';
  const negativo = (dividendo.numero < 0n) !== (divisor.numero < 0n);
  const numerador = (dividendo.numero < 0n ? -dividendo.numero : dividendo.numero)
    * divisor.escala * 1_000_000n;
  const denominador = dividendo.escala
    * (divisor.numero < 0n ? -divisor.numero : divisor.numero);
  let resultado = numerador / denominador;
  if ((numerador % denominador) * 2n >= denominador) resultado += 1n;
  const texto = resultado.toString().padStart(7, '0');
  const formateado = `${texto.slice(0, -6)}.${texto.slice(-6)}`;
  return negativo && resultado !== 0n ? `-${formateado}` : formateado;
};

const etiquetaPeriodo = (periodo: Periodo) =>
  `${periodo.anio}-${String(periodo.mes).padStart(2, '0')} · ${periodo.estado}`;

const BadgeEstado = ({ estado }: { estado: EstadoSaldoInicial | EstadoNotaInterna }) => (
  <span className={`oi-badge oi-badge--${estado.toLowerCase()}`}>{estado}</span>
);

export const OperacionesInternasPage = () => {
  const { empresaActiva } = useAuth();
  const esAdmin = empresaActiva?.rol === 'ADMIN';
  const [tab, setTab] = useState<TabId>('saldos');
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [tiposOperacion, setTiposOperacion] = useState<TipoOperacion[]>([]);
  const [saldos, setSaldos] = useState<SaldoInicial[]>([]);
  const [notas, setNotas] = useState<NotaInterna[]>([]);
  const [loading, setLoading] = useState(false);
  const [catalogosLoading, setCatalogosLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saldoFiltros, setSaldoFiltros] = useState({ periodo: '', almacen: '', producto: '', estado: '' });
  const [notaFiltros, setNotaFiltros] = useState({ periodo: '', almacen: '', tipo: '', estado: '', search: '' });
  const [saldoForm, setSaldoForm] = useState(SALDO_INICIAL);
  const [saldoEditando, setSaldoEditando] = useState<SaldoInicial | null>(null);
  const [saldoFormVisible, setSaldoFormVisible] = useState(false);
  const [notaForm, setNotaForm] = useState(NOTA_INICIAL);
  const [notaEditando, setNotaEditando] = useState<NotaInterna | null>(null);
  const [notaFormVisible, setNotaFormVisible] = useState(false);
  const editorRef = useRef<HTMLElement | null>(null);
  const focoAnteriorRef = useRef<HTMLElement | null>(null);
  const requestRef = useRef(0);

  const periodosAbiertos = useMemo(
    () => periodos.filter((periodo) => periodo.estado === 'ABIERTO'),
    [periodos],
  );
  const periodoNotaSeleccionado = useMemo(
    () => periodosAbiertos.find((periodo) => String(periodo.id) === notaForm.periodo),
    [notaForm.periodo, periodosAbiertos],
  );
  const tiposInternos = useMemo(() => tiposOperacion.filter((tipo) =>
    tipo.activo
    && tipo.es_interna
    && tipo.origen_requerido === 'NOTA_INTERNA'
    && (TIPOS_ESTANDAR.has(tipo.codigo_interno) || TIPOS_ADMIN.has(tipo.codigo_interno))), [tiposOperacion]);
  const tiposSeleccionables = useMemo(
    () => tiposInternos.filter((tipo) => esAdmin || TIPOS_ESTANDAR.has(tipo.codigo_interno)),
    [esAdmin, tiposInternos],
  );
  const cppInformativo = useMemo(
    () => dividirASeisDecimales(saldoForm.valor_pen, saldoForm.cantidad),
    [saldoForm.cantidad, saldoForm.valor_pen],
  );
  const recursosFaltantes = useMemo(() => {
    const faltantes: string[] = [];
    if (!periodosAbiertos.length) faltantes.push('períodos abiertos');
    if (!almacenes.length) faltantes.push('almacenes');
    if (!productos.length) faltantes.push('productos');
    if (tab === 'notas' && !tiposSeleccionables.length) faltantes.push('tipos de operación internos');
    return faltantes;
  }, [almacenes.length, periodosAbiertos.length, productos.length, tab, tiposSeleccionables.length]);

  const limpiarMensajes = () => { setError(''); setSuccess(''); };
  const recordarFoco = () => {
    focoAnteriorRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
  };
  const devolverFoco = () => window.requestAnimationFrame(() => focoAnteriorRef.current?.focus());
  const cerrarFormularios = useCallback(() => {
    setSaldoFormVisible(false);
    setSaldoEditando(null);
    setSaldoForm(SALDO_INICIAL);
    setNotaFormVisible(false);
    setNotaEditando(null);
    setNotaForm(NOTA_INICIAL);
  }, []);

  const filtrosSaldoApi = useCallback((): SaldoInicialFiltros => ({
    periodo_id: saldoFiltros.periodo ? Number(saldoFiltros.periodo) : undefined,
    almacen_id: saldoFiltros.almacen ? Number(saldoFiltros.almacen) : undefined,
    producto_id: saldoFiltros.producto ? Number(saldoFiltros.producto) : undefined,
    estado: saldoFiltros.estado ? saldoFiltros.estado as EstadoSaldoInicial : undefined,
  }), [saldoFiltros]);

  const filtrosNotaApi = useCallback((): NotaInternaFiltros => ({
    periodo_id: notaFiltros.periodo ? Number(notaFiltros.periodo) : undefined,
    almacen_id: notaFiltros.almacen ? Number(notaFiltros.almacen) : undefined,
    tipo_operacion: notaFiltros.tipo || undefined,
    estado: notaFiltros.estado ? notaFiltros.estado as EstadoNotaInterna : undefined,
    search: notaFiltros.search.trim() || undefined,
  }), [notaFiltros]);

  const cargarLista = useCallback(async () => {
    if (!empresaActiva) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');
    try {
      if (tab === 'saldos') {
        const data = await getSaldosIniciales(filtrosSaldoApi());
        if (requestId === requestRef.current) setSaldos(data);
      } else {
        const data = await getNotasInternas(filtrosNotaApi());
        if (requestId === requestRef.current) setNotas(data);
      }
    } catch (err) {
      if (requestId === requestRef.current) setError(extraerError(err));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [empresaActiva, filtrosNotaApi, filtrosSaldoApi, tab]);

  useEffect(() => {
    requestRef.current += 1;
    cerrarFormularios();
    setPeriodos([]); setAlmacenes([]); setProductos([]); setTiposOperacion([]);
    setSaldos([]); setNotas([]); limpiarMensajes();
    if (!empresaActiva) return;
    let ignorar = false;
    setCatalogosLoading(true);
    Promise.all([obtenerPeriodos(), getAlmacenes(), getProductos(), obtenerTiposOperacion()])
      .then(([nuevosPeriodos, nuevosAlmacenes, nuevosProductos, nuevosTipos]) => {
        if (ignorar) return;
        setPeriodos(nuevosPeriodos);
        setAlmacenes(nuevosAlmacenes);
        setProductos(nuevosProductos);
        setTiposOperacion(nuevosTipos);
      })
      .catch((err) => { if (!ignorar) setError(extraerError(err)); })
      .finally(() => { if (!ignorar) setCatalogosLoading(false); });
    return () => { ignorar = true; };
  }, [cerrarFormularios, empresaActiva?.id]);

  useEffect(() => { void cargarLista(); }, [cargarLista]);

  useEffect(() => {
    if (!saldoFormVisible && !notaFormVisible) return;
    window.requestAnimationFrame(() => {
      editorRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    });
  }, [notaFormVisible, saldoFormVisible]);

  const ejecutar = async (accion: () => Promise<void>, mensaje: string) => {
    setSaving(true); limpiarMensajes();
    try { await accion(); setSuccess(mensaje); return true; }
    catch (err) { setError(extraerError(err)); return false; }
    finally { setSaving(false); }
  };

  const refrescar = async () => {
    try { await cargarLista(); }
    catch { setError('El cambio se guardó, pero la lista no pudo actualizarse. Recarga la página.'); }
  };

  const abrirNuevo = () => {
    recordarFoco(); limpiarMensajes();
    if (tab === 'saldos') {
      setSaldoEditando(null); setSaldoForm(SALDO_INICIAL); setSaldoFormVisible(true);
    } else {
      setNotaEditando(null); setNotaForm(NOTA_INICIAL); setNotaFormVisible(true);
    }
  };

  const cerrarSaldo = () => { setSaldoFormVisible(false); devolverFoco(); };
  const cerrarNota = () => { setNotaFormVisible(false); devolverFoco(); };

  const editarSaldo = async (saldo: SaldoInicial) => {
    recordarFoco(); limpiarMensajes();
    try {
      const detalle = await getSaldoInicial(saldo.id);
      setSaldoEditando(detalle);
      setSaldoForm({
        periodo: String(detalle.periodo), almacen: String(detalle.almacen),
        producto: String(detalle.producto), cantidad: detalle.cantidad,
        valor_pen: detalle.valor_pen,
      });
      setSaldoFormVisible(true);
    } catch (err) { setError(extraerError(err)); }
  };

  const guardarSaldo = (event: FormEvent) => {
    event.preventDefault();
    void (async () => {
      const payload = {
        periodo: Number(saldoForm.periodo), almacen: Number(saldoForm.almacen),
        producto: Number(saldoForm.producto), cantidad: saldoForm.cantidad,
        valor_pen: saldoForm.valor_pen,
      };
      const guardado = await ejecutar(async () => {
        if (saldoEditando) await updateSaldoInicial(saldoEditando.id, payload);
        else await createSaldoInicial(payload);
      }, saldoEditando ? 'Saldo inicial actualizado.' : 'Saldo inicial creado.');
      if (!guardado) return;
      cerrarSaldo(); setSaldoEditando(null); setSaldoForm(SALDO_INICIAL);
      await refrescar();
    })();
  };

  const editarNota = async (nota: NotaInterna) => {
    recordarFoco(); limpiarMensajes();
    try {
      const detalle = await getNotaInterna(nota.id);
      setNotaEditando(detalle);
      setNotaForm({
        almacen: String(detalle.almacen), periodo: String(detalle.periodo),
        tipo_operacion: String(detalle.tipo_operacion), fecha: detalle.fecha,
        motivo: detalle.motivo, responsable: detalle.responsable ?? '',
        observacion: detalle.observacion ?? '', archivo_sustento: detalle.archivo_sustento ?? '',
        detalles: detalle.detalles.map((linea) => ({
          producto: linea.producto, cantidad_base: linea.cantidad_base,
          costo_unitario_pen: linea.costo_unitario_pen,
          valor_ajuste_pen: linea.valor_ajuste_pen,
        })),
      });
      setNotaFormVisible(true);
    } catch (err) { setError(extraerError(err)); }
  };

  const actualizarLinea = (indice: number, cambio: Partial<NotaInternaDetallePayload>) => {
    setNotaForm((actual) => ({
      ...actual,
      detalles: actual.detalles.map((linea, posicion) =>
        posicion === indice ? { ...linea, ...cambio } : linea),
    }));
  };

  const guardarNota = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const campoFecha = campoFechaNotaInterna(new FormData(event.currentTarget).get('fecha'));
    if (!campoFecha.fecha) {
      setError('La fecha debe tener el formato YYYY-MM-DD.');
      return;
    }
    if (!notaForm.detalles.length || notaForm.detalles.some((linea) => !linea.producto)) {
      setError('Cada línea debe tener un producto y la nota debe contener al menos una línea.');
      return;
    }
    void (async () => {
      const formularioEnviado = { ...notaForm, ...campoFecha };
      const payload = {
        almacen: Number(formularioEnviado.almacen), periodo: Number(formularioEnviado.periodo),
        tipo_operacion: Number(formularioEnviado.tipo_operacion), fecha: formularioEnviado.fecha,
        motivo: formularioEnviado.motivo, responsable: formularioEnviado.responsable || null,
        observacion: formularioEnviado.observacion || null,
        archivo_sustento: formularioEnviado.archivo_sustento || null,
        detalles: formularioEnviado.detalles.map((linea) => ({
          ...linea,
          costo_unitario_pen: esAdmin ? linea.costo_unitario_pen || null : null,
          valor_ajuste_pen: esAdmin ? linea.valor_ajuste_pen || null : null,
        })),
      };
      const guardado = await ejecutar(async () => {
        if (notaEditando) await updateNotaInterna(notaEditando.id, payload);
        else await createNotaInterna(payload);
      }, notaEditando ? 'Nota interna actualizada.' : 'Nota interna creada.');
      const formularioConservado = formularioNotaTrasRespuesta(formularioEnviado, guardado);
      if (formularioConservado) {
        setNotaForm(formularioConservado);
        return;
      }
      cerrarNota(); setNotaEditando(null); setNotaForm(NOTA_INICIAL);
      await refrescar();
    })();
  };

  const notaRequiereAdmin = (nota: NotaInterna) =>
    TIPOS_ADMIN.has(nota.tipo_operacion_codigo)
    || nota.detalles.some((linea) => linea.costo_unitario_pen !== null || linea.valor_ajuste_pen !== null);

  const anularNota = async (nota: NotaInterna) => {
    if (!window.confirm(`¿Anular la nota interna #${nota.id}? Esta acción no confirma ni genera Kardex.`)) return;
    const guardado = await ejecutar(
      async () => { await anularNotaInterna(nota.id); },
      `Nota interna #${nota.id} anulada.`,
    );
    if (guardado) await refrescar();
  };

  const confirmarSaldo = async (saldo: SaldoInicial) => {
    if (!window.confirm(`¿Confirmar el saldo inicial de ${saldo.producto_codigo}?`)) return;
    const guardado = await ejecutar(
      async () => { await confirmarSaldoInicial(saldo.id); },
      'Saldo inicial confirmado y aplicado al Kardex.',
    );
    if (guardado) await refrescar();
  };

  const confirmarNota = async (nota: NotaInterna) => {
    if (!window.confirm(`¿Confirmar la nota interna #${nota.id}?`)) return;
    const guardado = await ejecutar(
      async () => { await confirmarNotaInterna(nota.id); },
      `Nota interna #${nota.id} confirmada y aplicada al Kardex.`,
    );
    if (guardado) await refrescar();
  };

  const seleccionarPeriodoNota = (periodoId: string) => {
    setNotaForm((actual) => ({
      ...actual,
      periodo: periodoId,
    }));
  };

  if (!empresaActiva) return <div className="oi-empty oi-empty--blocking">
    <div className="oi-empty__mark" aria-hidden="true">OI</div>
    <h1>Selecciona una empresa</h1>
    <p>Los saldos iniciales y notas internas siempre pertenecen a una empresa activa.</p>
    <Link to="/empresas" className="oi-button oi-button--primary">Ir a empresas</Link>
  </div>;

  const tienePermisoCrear = tab === 'notas' || esAdmin;
  const puedeCrear = tienePermisoCrear && recursosFaltantes.length === 0;

  return <div className="oi-page">
    <header className="oi-header">
      <div><h1>Operaciones internas</h1><p>{empresaActiva.razon_social} · Captura en borrador, sin impacto en Kardex.</p></div>
      <div className="oi-header__actions">
        <span className={`oi-access ${esAdmin ? 'oi-access--admin' : ''}`}>{esAdmin ? 'Control administrativo' : 'Operación estándar'}</span>
        <button type="button" className="oi-button oi-button--primary" onClick={abrirNuevo} disabled={!puedeCrear || catalogosLoading} title={!tienePermisoCrear ? 'Los saldos iniciales requieren rol ADMIN' : recursosFaltantes.length ? `Faltan: ${recursosFaltantes.join(', ')}` : undefined}>Nuevo {tab === 'saldos' ? 'saldo' : 'nota'}</button>
      </div>
    </header>

    <nav className="oi-tabs" role="tablist" aria-label="Operaciones internas">
      <button id="tab-saldos" type="button" role="tab" aria-selected={tab === 'saldos'} aria-controls="panel-saldos" onClick={() => { setTab('saldos'); cerrarFormularios(); limpiarMensajes(); }}>Saldos iniciales</button>
      <button id="tab-notas" type="button" role="tab" aria-selected={tab === 'notas'} aria-controls="panel-notas" onClick={() => { setTab('notas'); cerrarFormularios(); limpiarMensajes(); }}>Notas internas</button>
    </nav>

    {error && <div className="oi-alert oi-alert--error" role="alert"><strong>Atención.</strong><span>{error}</span></div>}
    {success && <div className="oi-alert oi-alert--success" role="status"><strong>Listo.</strong><span>{success}</span></div>}
    {!catalogosLoading && recursosFaltantes.length > 0 && <div className="oi-alert oi-alert--warning" role="status"><strong>Configuración pendiente.</strong><span>Para crear registros faltan {recursosFaltantes.join(', ')}.</span></div>}

    {tab === 'saldos' && <section id="panel-saldos" role="tabpanel" aria-labelledby="tab-saldos">
      <div className="oi-toolbar">
        <span><strong>{saldos.length}</strong> registros</span>
        <div className="oi-filters" aria-label="Filtros de saldos iniciales">
          <SelectFiltro label="Período" value={saldoFiltros.periodo} onChange={(periodo) => setSaldoFiltros({ ...saldoFiltros, periodo })} opciones={periodos.map((p) => ({ value: String(p.id), label: etiquetaPeriodo(p) }))} />
          <SelectFiltro label="Almacén" value={saldoFiltros.almacen} onChange={(almacen) => setSaldoFiltros({ ...saldoFiltros, almacen })} opciones={almacenes.map((a) => ({ value: String(a.id), label: `${a.codigo} · ${a.nombre}` }))} />
          <SelectFiltro label="Producto" value={saldoFiltros.producto} onChange={(producto) => setSaldoFiltros({ ...saldoFiltros, producto })} opciones={productos.map((p) => ({ value: String(p.id), label: `${p.codigo_interno} · ${p.descripcion}` }))} />
          <SelectFiltro label="Estado" value={saldoFiltros.estado} onChange={(estado) => setSaldoFiltros({ ...saldoFiltros, estado })} opciones={[{ value: 'BORRADOR', label: 'Borrador' }, { value: 'CONFIRMADO', label: 'Confirmado' }]} />
        </div>
      </div>
      <div className={`oi-workspace ${saldoFormVisible ? 'oi-workspace--editing' : ''}`}>
        <TablaSaldos saldos={saldos} loading={loading} esAdmin={Boolean(esAdmin)} onEditar={(saldo) => void editarSaldo(saldo)} onConfirmar={(saldo) => void confirmarSaldo(saldo)} onNuevo={puedeCrear ? abrirNuevo : undefined} />
        {saldoFormVisible && <aside ref={editorRef} className="oi-editor" aria-label={saldoEditando ? 'Editar saldo inicial' : 'Crear saldo inicial'}>
          <EditorHeader titulo={saldoEditando ? 'Editar saldo inicial' : 'Nuevo saldo inicial'} detalle="El backend calculará y conservará el CPP definitivo." onClose={cerrarSaldo} />
          <form className="oi-form" onSubmit={guardarSaldo}>
            <Campo label="Período"><select required value={saldoForm.periodo} onChange={(e) => setSaldoForm({ ...saldoForm, periodo: e.target.value })}><option value="">Seleccionar período abierto</option>{periodosAbiertos.map((p) => <option key={p.id} value={p.id}>{etiquetaPeriodo(p)}</option>)}</select></Campo>
            <Campo label="Almacén"><select required value={saldoForm.almacen} onChange={(e) => setSaldoForm({ ...saldoForm, almacen: e.target.value })}><option value="">Seleccionar almacén</option>{almacenes.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>)}</select></Campo>
            <Campo label="Producto"><select required value={saldoForm.producto} onChange={(e) => setSaldoForm({ ...saldoForm, producto: e.target.value })}><option value="">Seleccionar producto</option>{productos.map((p) => <option key={p.id} value={p.id}>{p.codigo_interno} · {p.descripcion}</option>)}</select></Campo>
            <div className="oi-form__two"><Campo label="Cantidad"><input required inputMode="decimal" pattern="^\d+(\.\d{1,8})?$" value={saldoForm.cantidad} onChange={(e) => setSaldoForm({ ...saldoForm, cantidad: e.target.value })} /></Campo><Campo label="Valor total PEN"><input required inputMode="decimal" pattern="^-?\d+(\.\d{1,8})?$" value={saldoForm.valor_pen} onChange={(e) => setSaldoForm({ ...saldoForm, valor_pen: e.target.value })} /></Campo></div>
            <div className="oi-calculation"><span>CPP inicial informativo</span><strong>S/ {cppInformativo}</strong><small>Redondeo ROUND_HALF_UP a 6 decimales.</small></div>
            <FormActions saving={saving} label={saldoEditando ? 'Guardar cambios' : 'Crear saldo'} onCancel={cerrarSaldo} />
          </form>
        </aside>}
      </div>
    </section>}

    {tab === 'notas' && <section id="panel-notas" role="tabpanel" aria-labelledby="tab-notas">
      <div className="oi-toolbar">
        <span><strong>{notas.length}</strong> registros</span>
        <div className="oi-filters" aria-label="Filtros de notas internas">
          <SelectFiltro label="Período" value={notaFiltros.periodo} onChange={(periodo) => setNotaFiltros({ ...notaFiltros, periodo })} opciones={periodos.map((p) => ({ value: String(p.id), label: etiquetaPeriodo(p) }))} />
          <SelectFiltro label="Almacén" value={notaFiltros.almacen} onChange={(almacen) => setNotaFiltros({ ...notaFiltros, almacen })} opciones={almacenes.map((a) => ({ value: String(a.id), label: `${a.codigo} · ${a.nombre}` }))} />
          <SelectFiltro label="Tipo" value={notaFiltros.tipo} onChange={(tipo) => setNotaFiltros({ ...notaFiltros, tipo })} opciones={tiposInternos.map((t) => ({ value: t.codigo_interno, label: t.descripcion }))} />
          <SelectFiltro label="Estado" value={notaFiltros.estado} onChange={(estado) => setNotaFiltros({ ...notaFiltros, estado })} opciones={[{ value: 'BORRADOR', label: 'Borrador' }, { value: 'CONFIRMADO', label: 'Confirmado' }, { value: 'ANULADO', label: 'Anulado' }]} />
          <label className="oi-filter"><span>Buscar</span><input value={notaFiltros.search} onChange={(e) => setNotaFiltros({ ...notaFiltros, search: e.target.value })} placeholder="Motivo o responsable" /></label>
        </div>
      </div>
      <div className={`oi-workspace ${notaFormVisible ? 'oi-workspace--note-editing' : ''}`}>
        <TablaNotas notas={notas} loading={loading} esAdmin={Boolean(esAdmin)} onEditar={(nota) => void editarNota(nota)} onAnular={(nota) => void anularNota(nota)} onConfirmar={(nota) => void confirmarNota(nota)} requiereAdmin={notaRequiereAdmin} onNuevo={puedeCrear ? abrirNuevo : undefined} />
        {notaFormVisible && <aside ref={editorRef} className="oi-editor oi-editor--wide" aria-label={notaEditando ? 'Editar nota interna' : 'Crear nota interna'}>
          <EditorHeader titulo={notaEditando ? `Editar nota #${notaEditando.id}` : 'Nueva nota interna'} detalle={esAdmin ? 'Operaciones estándar y ajustes manuales.' : 'Solo operaciones estándar sin costos manuales.'} onClose={cerrarNota} />
          <form className="oi-form" onSubmit={guardarNota}>
            <div className="oi-form__three"><Campo label="Período"><select required value={notaForm.periodo} onChange={(e) => seleccionarPeriodoNota(e.target.value)}><option value="">Seleccionar</option>{periodosAbiertos.map((p) => <option key={p.id} value={p.id}>{etiquetaPeriodo(p)}</option>)}</select></Campo><Campo label="Almacén"><select required value={notaForm.almacen} onChange={(e) => setNotaForm((actual) => ({ ...actual, almacen: e.target.value }))}><option value="">Seleccionar</option>{almacenes.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>)}</select></Campo><Campo label="Fecha"><input required name="fecha" type="date" min={periodoNotaSeleccionado?.fecha_inicio} max={periodoNotaSeleccionado?.fecha_fin} value={notaForm.fecha} onChange={(e) => setNotaForm((actual) => ({ ...actual, fecha: e.target.value }))} /></Campo></div>
            <Campo label="Tipo de operación"><select required value={notaForm.tipo_operacion} onChange={(e) => setNotaForm((actual) => ({ ...actual, tipo_operacion: e.target.value }))}><option value="">Seleccionar tipo interno</option>{tiposSeleccionables.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.codigo_interno} · {tipo.descripcion}</option>)}</select></Campo>
            <Campo label="Motivo"><textarea required maxLength={500} rows={2} value={notaForm.motivo} onChange={(e) => setNotaForm((actual) => ({ ...actual, motivo: e.target.value }))} /></Campo>
            <div className="oi-form__two"><Campo label="Responsable"><input maxLength={200} value={notaForm.responsable} onChange={(e) => setNotaForm((actual) => ({ ...actual, responsable: e.target.value }))} /></Campo><Campo label="Sustento" hint="Ruta o referencia documental; este bloque no almacena binarios."><input maxLength={500} value={notaForm.archivo_sustento} onChange={(e) => setNotaForm((actual) => ({ ...actual, archivo_sustento: e.target.value }))} /></Campo></div>
            <Campo label="Observación"><textarea rows={2} value={notaForm.observacion} onChange={(e) => setNotaForm((actual) => ({ ...actual, observacion: e.target.value }))} /></Campo>
            <div className="oi-lines-header"><div><h3>Detalle de productos</h3><p>{notaForm.detalles.length} {notaForm.detalles.length === 1 ? 'línea' : 'líneas'} en borrador</p></div><button type="button" className="oi-button oi-button--secondary" onClick={() => setNotaForm((actual) => ({ ...actual, detalles: [...actual.detalles, LINEA_INICIAL()] }))}>Agregar línea</button></div>
            <div className="oi-lines">
              {notaForm.detalles.map((linea, indice) => <div className={`oi-line ${esAdmin ? '' : 'oi-line--standard'}`} key={indice}>
                <span className="oi-line__number">{indice + 1}</span>
                <Campo label="Producto"><select required value={linea.producto || ''} onChange={(e) => actualizarLinea(indice, { producto: Number(e.target.value) })}><option value="">Seleccionar producto</option>{productos.map((p) => <option key={p.id} value={p.id}>{p.codigo_interno} · {p.descripcion}</option>)}</select></Campo>
                <Campo label="Cantidad base"><input required inputMode="decimal" pattern="^\d+(\.\d{1,8})?$" value={linea.cantidad_base} onChange={(e) => actualizarLinea(indice, { cantidad_base: e.target.value })} /></Campo>
                {esAdmin && <Campo label="Costo unitario PEN"><input inputMode="decimal" pattern="^-?\d+(\.\d{1,8})?$" value={linea.costo_unitario_pen ?? ''} onChange={(e) => actualizarLinea(indice, { costo_unitario_pen: e.target.value || null })} /></Campo>}
                {esAdmin && <Campo label="Valor ajuste PEN"><input inputMode="decimal" pattern="^-?\d+(\.\d{1,8})?$" value={linea.valor_ajuste_pen ?? ''} onChange={(e) => actualizarLinea(indice, { valor_ajuste_pen: e.target.value || null })} /></Campo>}
                <button type="button" className="oi-remove" onClick={() => setNotaForm((actual) => ({ ...actual, detalles: actual.detalles.filter((_, posicion) => posicion !== indice) }))} disabled={notaForm.detalles.length === 1}>Eliminar</button>
              </div>)}
            </div>
            <FormActions saving={saving} label={notaEditando ? 'Guardar nota' : 'Crear nota'} onCancel={cerrarNota} />
          </form>
        </aside>}
      </div>
    </section>}
  </div>;
};

const Campo = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => <label className="oi-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;

const SelectFiltro = ({ label, value, onChange, opciones }: { label: string; value: string; onChange: (value: string) => void; opciones: { value: string; label: string }[] }) => <label className="oi-filter"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}><option value="">Todos</option>{opciones.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}</select></label>;

const EditorHeader = ({ titulo, detalle, onClose }: { titulo: string; detalle: string; onClose: () => void }) => <div className="oi-editor__header"><div><h2>{titulo}</h2><p>{detalle}</p></div><button type="button" className="oi-close" onClick={onClose}>Cerrar</button></div>;

const FormActions = ({ saving, label, onCancel }: { saving: boolean; label: string; onCancel: () => void }) => <div className="oi-form__actions"><button className="oi-button oi-button--primary" disabled={saving}>{saving ? 'Guardando…' : label}</button><button type="button" className="oi-button oi-button--ghost" onClick={onCancel} disabled={saving}>Cancelar</button></div>;

const EmptyState = ({ title, detail, onNuevo }: { title: string; detail: string; onNuevo?: () => void }) => <div className="oi-empty"><div className="oi-empty__line" /><h2>{title}</h2><p>{detail}</p>{onNuevo && <button type="button" className="oi-button oi-button--secondary" onClick={onNuevo}>Crear registro</button>}</div>;

const TablaSaldos = ({ saldos, loading, esAdmin, onEditar, onConfirmar, onNuevo }: { saldos: SaldoInicial[]; loading: boolean; esAdmin: boolean; onEditar: (saldo: SaldoInicial) => void; onConfirmar: (saldo: SaldoInicial) => void; onNuevo?: () => void }) => <div className="oi-table-shell">{loading ? <div className="oi-loading" role="status">Cargando saldos iniciales…</div> : <><table className="oi-table oi-table--saldos"><thead><tr><th>Período</th><th>Almacén</th><th>Producto</th><th>Unidad base</th><th className="oi-number">Cantidad</th><th className="oi-number">Valor total PEN</th><th className="oi-number">CPP inicial</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{saldos.map((saldo) => <tr key={saldo.id}><td>{saldo.periodo_descripcion}</td><td><strong>{saldo.almacen_codigo}</strong><small>{saldo.almacen_nombre}</small></td><td><strong>{saldo.producto_codigo}</strong><small>{saldo.producto_descripcion}</small></td><td>{saldo.unidad_base_codigo ?? '—'}</td><td className="oi-number">{saldo.cantidad}</td><td className="oi-number">S/ {saldo.valor_pen}</td><td className="oi-number">S/ {saldo.cpp_inicial}</td><td><BadgeEstado estado={saldo.estado} /></td><td className="oi-actions">{esAdmin && saldo.estado === 'BORRADOR' ? <><button type="button" className="oi-link" onClick={() => onEditar(saldo)}>Editar</button><button type="button" className="oi-link" onClick={() => onConfirmar(saldo)}>Confirmar Saldo Inicial</button></> : <span className="oi-muted">—</span>}</td></tr>)}</tbody></table>{!saldos.length && <EmptyState title="Sin saldos iniciales" detail="No hay registros que coincidan con los filtros actuales." onNuevo={onNuevo} />}</>}</div>;

const TablaNotas = ({ notas, loading, esAdmin, onEditar, onAnular, onConfirmar, requiereAdmin, onNuevo }: { notas: NotaInterna[]; loading: boolean; esAdmin: boolean; onEditar: (nota: NotaInterna) => void; onAnular: (nota: NotaInterna) => void; onConfirmar: (nota: NotaInterna) => void; requiereAdmin: (nota: NotaInterna) => boolean; onNuevo?: () => void }) => <div className="oi-table-shell">{loading ? <div className="oi-loading" role="status">Cargando notas internas…</div> : <><table className="oi-table oi-table--notas"><thead><tr><th>ID</th><th>Fecha</th><th>Período</th><th>Almacén</th><th>Tipo</th><th>Motivo</th><th>Responsable</th><th>Estado</th><th className="oi-number">Líneas</th><th>Acciones</th></tr></thead><tbody>{notas.map((nota) => { const puedeGestionar = nota.estado === 'BORRADOR' && (esAdmin || !requiereAdmin(nota)); return <tr key={nota.id}><td className="oi-code">#{nota.id}</td><td>{nota.fecha}</td><td>{nota.periodo_descripcion}</td><td><strong>{nota.almacen_codigo}</strong><small>{nota.almacen_nombre}</small></td><td><span className="oi-code">{nota.tipo_operacion_codigo}</span><small>{nota.tipo_operacion_descripcion}</small></td><td className="oi-table__main">{nota.motivo}</td><td>{nota.responsable || '—'}</td><td><BadgeEstado estado={nota.estado} /></td><td className="oi-number">{nota.numero_lineas}</td><td className="oi-actions">{puedeGestionar ? <><button type="button" className="oi-link" onClick={() => onEditar(nota)}>Editar</button><button type="button" className="oi-link" onClick={() => onConfirmar(nota)}>Confirmar Nota Interna</button><button type="button" className="oi-link oi-link--danger" onClick={() => onAnular(nota)}>Anular</button></> : <span className="oi-muted">—</span>}</td></tr>; })}</tbody></table>{!notas.length && <EmptyState title="Sin notas internas" detail="Registra una merma, consumo, retiro o ajuste en estado borrador." onNuevo={onNuevo} />}</>}</div>;

export default OperacionesInternasPage;
