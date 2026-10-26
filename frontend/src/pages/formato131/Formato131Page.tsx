import React, { useEffect, useState } from 'react';
import { obtenerEstablecimientos, type Establecimiento } from '../../api/empresas';
import { getProductos, type Producto } from '../../api/inventario';
import { obtenerPeriodos, type Periodo } from '../../api/periodos';
import {
  compararPiloto,
  descargarFormato131,
  obtenerFormato131,
  obtenerPiloto,
  type Formato131Response,
  type PilotoReal,
  type PilotoResultado,
} from '../../api/formato131';
import { useAuth } from '../../context/AuthContext';
import {
  FileCheck2,
  FileDown,
  Search,
  Scale,
  Gauge,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Inbox,
  Loader2,
  ShieldCheck,
  TrendingDown,
  Info,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { filaSaldoFinal, filaSaldoInicial } from '../../utils/formato131Saldos';

const apiError = (error: unknown) => {
  const data = (error as { response?: { data?: Record<string, string | string[]> | string } }).response?.data;
  if (!data || typeof data === 'string') return 'No se pudo completar la operación. Intente nuevamente.';
  return Object.values(data).flat().join(' ');
};


const n = (value?: string | null) => (value !== null && value !== undefined && value !== '' ? value : '—');

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
  const [form, setForm] = useState({
    cantidad_esperada: '',
    cpp_esperado: '',
    valor_esperado: '',
    tiempo_manual_segundos: '',
    tiempo_factkard_segundos: '',
  });
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([obtenerPeriodos(), obtenerEstablecimientos(), getProductos()])
      .then(([p, e, pr]) => {
        if (!active) return;
        setPeriodos(p);
        setEstablecimientos(e);
        setProductos(pr);
        setPeriodo(p[0] ? String(p[0].id) : '');
        setProducto(pr[0] ? String(pr[0].id) : '');
      })
      .catch((e) => active && setError(apiError(e)));
    return () => {
      active = false;
    };
  }, [empresaActiva?.id]);

  const consultar = async () => {
    if (!periodo) return setError('Selecciona un período contable para generar el reporte.');
    setBusy(true);
    setError('');
    try {
      setReporte(
        await obtenerFormato131({
          periodo_id: periodo,
          establecimiento_id: establecimiento || undefined,
          producto_id: producto || undefined,
        })
      );
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const descargarExcel = async () => {
    if (!periodo) return setError('Selecciona un período contable.');
    setExporting(true);
    setError('');
    try {
      await descargarFormato131({
        periodo_id: periodo,
        establecimiento_id: establecimiento || undefined,
        producto_id: producto || undefined,
      });
    } catch (e) {
      setError(apiError(e));
    } finally {
      setExporting(false);
    }
  };

  const consultarReal = async () => {
    if (!periodo || !producto) return setError('Seleccione un período y un producto.');
    setBusy(true);
    setError('');
    setResultado(null);
    try {
      setReal(await obtenerPiloto(periodo, producto));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const comparar = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await compararPiloto({
        periodo_id: periodo,
        producto_id: producto,
        ...form,
      });
      setReal(data);
      setResultado(data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Encabezado principal */}
      <PageHeader
        title="Formato 13.1 SUNAT y Conciliación Paralela"
        description={`Registro de Inventario Permanente Valorizado (Res. SUNAT 234-2006) · ${
          empresaActiva?.razon_social ?? 'Empresa Activa'
        }${empresaActiva?.ruc ? ` · RUC: ${empresaActiva.ruc}` : ''}`}
        icon={FileCheck2}
        badge={
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="success" dot>Normativa SUNAT</Badge>
            <Badge variant="neutral" className="font-mono text-xs">CPP Móvil</Badge>
          </div>
        }
        actions={
          <Button
            type="button"
            variant="success"
            size="sm"
            disabled={!periodo || busy || exporting}
            onClick={descargarExcel}
            className="shadow-xs"
            title="Exportar archivo oficial en formato Excel (.xlsx)"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
            )}
            {exporting ? 'Generando Excel...' : 'Exportar Oficial (.xlsx)'}
          </Button>
        }
      />

      {/* 2. Alertas */}
      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error al consultar</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* 3. Navegación de Pestañas */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'formato' | 'piloto')}>
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="formato" className="gap-2">
            <FileCheck2 className="h-4 w-4" />
            Formato 13.1 SUNAT
          </TabsTrigger>
          <TabsTrigger value="piloto" className="gap-2">
            <Gauge className="h-4 w-4" />
            Piloto Paralelo
          </TabsTrigger>
        </TabsList>

        {/* ==================================================================== */}
        {/* PESTAÑA 1: REPORTE REGLAMENTARIO FORMATO 13.1 */}
        {/* ==================================================================== */}
        <TabsContent value="formato" className="space-y-5 pt-2">
          {/* Barra de Filtros */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Search className="h-4 w-4 text-indigo-600" />
                Parámetros de Emisión Oficial
              </CardTitle>
              <CardDescription className="text-xs">
                Genere el reporte reglamentario por período contable, establecimiento físico y producto
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="f131-periodo">Período Contable</Label>
                  <Select
                    id="f131-periodo"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                  >
                    <option value="">Seleccione un período...</option>
                    {periodos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.anio}-{String(p.mes).padStart(2, '0')} · {p.estado}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="f131-establecimiento">Establecimiento SUNAT</Label>
                  <Select
                    id="f131-establecimiento"
                    value={establecimiento}
                    onChange={(e) => setEstablecimiento(e.target.value)}
                  >
                    <option value="">Todos los establecimientos</option>
                    {establecimientos.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.codigo_sunat} · {e.nombre}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="f131-producto">Producto / Existencia</Label>
                  <Select
                    id="f131-producto"
                    value={producto}
                    onChange={(e) => setProducto(e.target.value)}
                  >
                    <option value="">Todos los productos</option>
                    {productos.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.codigo_interno} · {pr.descripcion}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={busy || !periodo}
                    onClick={consultar}
                    className="w-full"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Search className="h-4 w-4 mr-1.5" />}
                    {busy ? 'Consultando...' : 'Consultar Libro'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estado Inicial o Vacío */}
          {!reporte && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-16 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <FileCheck2 className="h-6 w-6 text-slate-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Seleccione los filtros para generar el reporte</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                El Formato 13.1 reglamentario se genera con encabezados oficiales de Tablas SUNAT (5, 6, 10, 12) y cálculo de CPP móvil.
              </p>
            </div>
          )}

          {reporte && reporte.reportes.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <Inbox className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Sin movimientos registrados</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                No existen operaciones para el período y filtros seleccionados.
              </p>
            </div>
          )}

          {/* Listado de reportes oficiales por existencia */}
          {reporte?.reportes.map((r) => (
            <Card key={`${r.cabecera.establecimiento.id}-${r.cabecera.producto_id}`} className="overflow-hidden">
              {/* Recuadro Oficial de Datos de Cabecera SUNAT */}
              <div className="bg-slate-900 text-white p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 mb-3 border-b border-slate-800 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-indigo-950/80 text-indigo-200 border-indigo-700 text-xs">
                        FORMATO 13.1 SUNAT
                      </Badge>
                      <span className="font-mono text-xs text-slate-300">Período: {reporte.periodo}</span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1">
                      <span className="font-mono text-indigo-400 mr-2">{r.cabecera.codigo_existencia}</span>
                      {r.cabecera.descripcion_existencia}
                    </h3>
                  </div>

                  {reporte.fuente_cierre && (
                    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      <span className="text-slate-300">Cierre v{reporte.fuente_cierre.version} · Hash:</span>
                      <code className="font-mono text-[11px] text-emerald-300">
                        {reporte.fuente_cierre.hash.slice(0, 12)}…
                      </code>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">RUC:</span>
                    <span className="font-mono font-semibold text-slate-200">{reporte.empresa.ruc}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Razón Social:</span>
                    <span className="text-slate-200 truncate block" title={reporte.empresa.razon_social}>
                      {reporte.empresa.razon_social}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Establecimiento:</span>
                    <span className="text-slate-200 font-mono">
                      {r.cabecera.establecimiento.codigo_sunat} · {r.cabecera.establecimiento.nombre}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tabla 5 (Existencia):</span>
                    <span className="text-slate-200">
                      {r.cabecera.tipo_existencia.codigo} · {r.cabecera.tipo_existencia.descripcion}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Tabla 6 (Unidad):</span>
                    <span className="text-slate-200">
                      {r.cabecera.unidad_medida.codigo} · {r.cabecera.unidad_medida.descripcion}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Método Valuación:</span>
                    <span className="text-emerald-400 font-semibold">{r.cabecera.metodo_valuacion}</span>
                  </div>
                </div>
              </div>

              {/* Tabla Oficial de Movimientos SUNAT */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider text-center border-b border-slate-200">
                      <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-200 w-24">Fecha</th>
                      <th colSpan={3} className="py-1.5 px-3 border-r border-slate-200 bg-slate-50">
                        Documento de Traslado / Comprobante
                      </th>
                      <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-200 w-24">Tipo Op.</th>
                      <th colSpan={3} className="py-1.5 px-3 border-r border-emerald-100 bg-emerald-50/80 text-emerald-900">
                        Entradas
                      </th>
                      <th colSpan={3} className="py-1.5 px-3 border-r border-amber-100 bg-amber-50/80 text-amber-900">
                        Salidas
                      </th>
                      <th colSpan={3} className="py-1.5 px-3 bg-indigo-50/80 text-indigo-950">
                        Saldo Final
                      </th>
                    </tr>
                    <tr className="bg-slate-50 text-[10px] font-semibold text-slate-600 border-b border-slate-200">
                      {/* Documento */}
                      <th className="py-1.5 px-2 text-center">Tipo</th>
                      <th className="py-1.5 px-2 text-center">Serie</th>
                      <th className="py-1.5 px-2 text-center border-r border-slate-200">Número</th>

                      {/* Entradas */}
                      <th className="py-1.5 px-2.5 text-right bg-emerald-50/30">Cantidad</th>
                      <th className="py-1.5 px-2.5 text-right bg-emerald-50/30">Costo Unit.</th>
                      <th className="py-1.5 px-2.5 text-right bg-emerald-50/30 border-r border-emerald-100">Costo Total</th>

                      {/* Salidas */}
                      <th className="py-1.5 px-2.5 text-right bg-amber-50/30">Cantidad</th>
                      <th className="py-1.5 px-2.5 text-right bg-amber-50/30">Costo Unit.</th>
                      <th className="py-1.5 px-2.5 text-right bg-amber-50/30 border-r border-amber-100">Costo Total</th>

                      {/* Saldo Final */}
                      <th className="py-1.5 px-2.5 text-right bg-indigo-50/30">Cantidad</th>
                      <th className="py-1.5 px-2.5 text-right bg-indigo-50/30">Costo Unit.</th>
                      <th className="py-1.5 px-2.5 text-right bg-indigo-50/30 font-bold text-slate-900">Costo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-[11px]">
                    {(() => {
                      const ini = filaSaldoInicial(r);
                      return (
                        <tr className="bg-slate-50 font-semibold text-slate-800">
                          <td colSpan={11} className="py-2 px-3 text-right font-sans text-[11px] uppercase tracking-wide text-slate-600">
                            Saldo inicial
                          </td>
                          <td className="py-2 px-2.5 text-right bg-indigo-50/20">{ini.cantidad}</td>
                          <td className="py-2 px-2.5 text-right bg-indigo-50/20">{ini.costoUnitario}</td>
                          <td className="py-2 px-2.5 text-right bg-indigo-50/20 font-bold">{ini.costoTotal}</td>
                        </tr>
                      );
                    })()}
                    {r.movimientos.length === 0 && (
                      <tr>
                        <td colSpan={14} className="py-2 px-3 text-center font-sans text-slate-400">Sin movimientos en el período</td>
                      </tr>
                    )}
                    {r.movimientos.map((m) => (
                      <tr key={m.movimiento_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-700 whitespace-nowrap">{m.fecha_emision}</td>
                        <td className="py-2 px-2 text-center">{m.documento.tipo_documento}</td>
                        <td className="py-2 px-2 text-center text-slate-600">{m.documento.serie || '—'}</td>
                        <td className="py-2 px-2 text-center border-r border-slate-200 text-slate-800">{m.documento.numero || '—'}</td>
                        <td className="py-2 px-3 text-center border-r border-slate-200 font-sans font-medium text-slate-700">
                          {m.tipo_operacion || '—'}
                        </td>

                        {/* Entradas */}
                        <td className="py-2 px-2.5 text-right bg-emerald-50/10 text-emerald-800">{n(m.entrada?.cantidad)}</td>
                        <td className="py-2 px-2.5 text-right bg-emerald-50/10 text-slate-600">{n(m.entrada?.costo_unitario)}</td>
                        <td className="py-2 px-2.5 text-right bg-emerald-50/10 border-r border-emerald-100 font-semibold text-emerald-800">
                          {n(m.entrada?.costo_total)}
                        </td>

                        {/* Salidas */}
                        <td className="py-2 px-2.5 text-right bg-amber-50/10 text-rose-800">{n(m.salida?.cantidad)}</td>
                        <td className="py-2 px-2.5 text-right bg-amber-50/10 text-slate-600">{n(m.salida?.costo_unitario)}</td>
                        <td className="py-2 px-2.5 text-right bg-amber-50/10 border-r border-amber-100 font-semibold text-rose-800">
                          {n(m.salida?.costo_total)}
                        </td>

                        {/* Saldo Final */}
                        <td className="py-2 px-2.5 text-right bg-indigo-50/10 font-medium text-slate-900">{n(m.saldo_final.cantidad)}</td>
                        <td className="py-2 px-2.5 text-right bg-indigo-50/10 text-slate-700">{n(m.saldo_final.costo_unitario)}</td>
                        <td className="py-2 px-2.5 text-right bg-indigo-50/10 font-bold text-slate-950">
                          {n(m.saldo_final.costo_total)}
                        </td>
                      </tr>
                    ))}
                    {(() => {
                      const fin = filaSaldoFinal(r);
                      return (
                        <tr className="bg-indigo-50/40 font-semibold text-slate-900 border-t-2 border-indigo-100">
                          <td colSpan={11} className="py-2 px-3 text-right font-sans text-[11px] uppercase tracking-wide text-indigo-900">
                            Saldo final
                          </td>
                          <td className="py-2 px-2.5 text-right">{fin.cantidad}</td>
                          <td className="py-2 px-2.5 text-right">{fin.costoUnitario}</td>
                          <td className="py-2 px-2.5 text-right font-bold">{fin.costoTotal}</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Microdiferencia de cierre si aplica */}
              {r.microdiferencia_cierre !== '0.00000000' && (
                <div className="bg-amber-50/80 border-t border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Microdiferencia oficial asignada al establecimiento principal:</strong> S/{' '}
                    <code className="font-mono">{r.microdiferencia_cierre}</code> (absorbida por redondeo contable).
                  </span>
                </div>
              )}
            </Card>
          ))}
        </TabsContent>

        {/* ==================================================================== */}
        {/* PESTAÑA 2: LABORATORIO DE PILOTO PARALELO */}
        {/* ==================================================================== */}
        <TabsContent value="piloto" className="pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Formulario de Contraste */}
            <Card className="lg:col-span-7">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-indigo-600" />
                  Contraste con el Proceso Actual / Sistema Anterior
                </CardTitle>
                <CardDescription className="text-xs">
                  Ingrese los valores calculados manualmente por el contador o extraídos del ERP previo para validar la exactitud de FACT-KARD.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={comparar} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="piloto-periodo">Período a Evaluar</Label>
                      <Select
                        id="piloto-periodo"
                        value={periodo}
                        onChange={(e) => setPeriodo(e.target.value)}
                      >
                        <option value="">Seleccione...</option>
                        {periodos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.anio}-{String(p.mes).padStart(2, '0')} · {p.estado}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="piloto-producto">Producto de Muestra</Label>
                      <Select
                        id="piloto-producto"
                        value={producto}
                        onChange={(e) => setProducto(e.target.value)}
                      >
                        <option value="">Seleccione...</option>
                        {productos.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pr.codigo_interno} · {pr.descripcion}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={consultarReal}
                      disabled={busy || !periodo || !producto}
                      className="text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Consultar valores FACT-KARD en tiempo real
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                    <div className="space-y-1.5">
                      <Label htmlFor="piloto-cant">Cantidad Esperada</Label>
                      <Input
                        id="piloto-cant"
                        required
                        inputMode="decimal"
                        value={form.cantidad_esperada}
                        onChange={(e) => setForm((v) => ({ ...v, cantidad_esperada: e.target.value }))}
                        placeholder="Ej. 100.00"
                        className="font-mono tabular-nums"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="piloto-cpp">CPP Esperado (PEN)</Label>
                      <Input
                        id="piloto-cpp"
                        required
                        inputMode="decimal"
                        value={form.cpp_esperado}
                        onChange={(e) => setForm((v) => ({ ...v, cpp_esperado: e.target.value }))}
                        placeholder="Ej. 12.500000"
                        className="font-mono tabular-nums"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="piloto-val">Valor Esperado (S/)</Label>
                      <Input
                        id="piloto-val"
                        required
                        inputMode="decimal"
                        value={form.valor_esperado}
                        onChange={(e) => setForm((v) => ({ ...v, valor_esperado: e.target.value }))}
                        placeholder="Ej. 1250.00"
                        className="font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="piloto-t-man">Tiempo Manual Previo (segundos)</Label>
                      <Input
                        id="piloto-t-man"
                        required
                        inputMode="numeric"
                        value={form.tiempo_manual_segundos}
                        onChange={(e) => setForm((v) => ({ ...v, tiempo_manual_segundos: e.target.value }))}
                        placeholder="Ej. 1800 (30 min)"
                        className="font-mono tabular-nums"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="piloto-t-fk">Tiempo FACT-KARD (segundos)</Label>
                      <Input
                        id="piloto-t-fk"
                        required
                        inputMode="numeric"
                        value={form.tiempo_factkard_segundos}
                        onChange={(e) => setForm((v) => ({ ...v, tiempo_factkard_segundos: e.target.value }))}
                        placeholder="Ej. 5 (5 seg)"
                        className="font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={busy}
                      className="w-full"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Gauge className="h-4 w-4 mr-1.5" />}
                      {busy ? 'Comparando...' : 'Comparar Resultados y Medir Eficiencia'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Panel de Resultados y Métrica de Eficiencia */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="bg-slate-900 text-white border-slate-800">
                <CardHeader className="pb-3 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      Resultado Oficial FACT-KARD
                    </CardTitle>
                    {real && (
                      <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 text-xs">
                        {real.fuente.replaceAll('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {!real ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Seleccione período y producto para contrastar los valores oficiales del motor contable.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                          <span className="text-[11px] text-slate-400 block mb-1">Cantidad</span>
                          <span className="font-mono text-base font-bold text-white tabular-nums">
                            {real.cantidad_factkard}
                          </span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                          <span className="text-[11px] text-slate-400 block mb-1">CPP (PEN)</span>
                          <span className="font-mono text-base font-bold text-indigo-300 tabular-nums">
                            {real.cpp_factkard}
                          </span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                          <span className="text-[11px] text-slate-400 block mb-1">Saldo Valor</span>
                          <span className="font-mono text-base font-bold text-emerald-400 tabular-nums">
                            S/ {real.valor_factkard}
                          </span>
                        </div>
                      </div>

                      {/* Cuadro de Cuadre y Conciliación */}
                      {resultado && (
                        <div
                          className={`rounded-xl p-4 border ${
                            resultado.cuadra_100
                              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                              : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {resultado.cuadra_100 ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-amber-400" />
                            )}
                            <strong className="text-sm tracking-wide">
                              {resultado.cuadra_100 ? 'CUADRE CONTABLE PERFECTO (100%)' : 'REQUIERE CONCILIACIÓN'}
                            </strong>
                          </div>

                          <div className="grid grid-cols-3 gap-2 font-mono text-xs tabular-nums py-2 border-y border-white/10 my-2">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Δ Cantidad:</span>
                              <span className="font-bold">{resultado.diferencias.cantidad}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Δ CPP:</span>
                              <span className="font-bold">{resultado.diferencias.cpp}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Δ Valor:</span>
                              <span className="font-bold">{resultado.diferencias.valor}</span>
                            </div>
                          </div>

                          {/* Métrica de Eficiencia */}
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-xs text-slate-300 flex items-center gap-1.5">
                              <TrendingDown className="h-4 w-4 text-emerald-400" />
                              Reducción de Tiempo Operativo:
                            </span>
                            <span className="font-mono text-lg font-black text-emerald-400 tabular-nums">
                              {resultado.reduccion_porcentaje}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Formato131Page;
