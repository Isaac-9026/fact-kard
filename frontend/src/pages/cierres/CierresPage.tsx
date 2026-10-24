import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  compararCierres,
  ejecutarCierre,
  obtenerCierres,
  type CierrePeriodo,
  type DiferenciaCierre,
} from '../../api/cierres';
import { obtenerPeriodos, reabrirPeriodo, type Periodo } from '../../api/periodos';
import {
  abrirReapertura,
  cancelarReapertura,
  ejecutarReapertura,
  estadoReaperturaInicial,
  etiquetaEstadoCierre,
} from '../../utils/reaperturaPeriodo';
import {
  Lock,
  Unlock,
  RotateCcw,
  ShieldCheck,
  Fingerprint,
  GitCompare,
  AlertCircle,
  CheckCircle2,
  Check,
  X,
  FileCheck2,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Label } from '../../components/ui/label';

const etiqueta = (p: { anio: number; mes: number }) => `${p.anio}-${String(p.mes).padStart(2, '0')}`;
const dinero = (v: string | number | undefined) =>
  Number(v || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cant = (v: string | number | undefined) =>
  Number(v || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const cpp = (v: string | number | undefined) =>
  Number(v || 0).toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 6 });

export const CierresPage: React.FC = () => {
  const { empresaActiva, usuario } = useAuth();
  const admin = Boolean(usuario?.es_admin_global || empresaActiva?.rol === 'ADMIN');
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [cierres, setCierres] = useState<CierrePeriodo[]>([]);
  const [periodoId, setPeriodoId] = useState('');
  const [seleccion, setSeleccion] = useState<CierrePeriodo | null>(null);
  const [diferencias, setDiferencias] = useState<DiferenciaCierre[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [reapertura, setReapertura] = useState(estadoReaperturaInicial);

  const periodo = useMemo(() => periodos.find((p) => p.id === Number(periodoId)), [periodos, periodoId]);

  const cargar = async () => {
    if (!empresaActiva) return;
    setOcupado(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([obtenerPeriodos(), obtenerCierres()]);
      setPeriodos(p);
      setCierres(c);
      setSeleccion(c[0] || null);
    } catch {
      setError('No fue posible cargar los períodos y snapshots.');
    } finally {
      setOcupado(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [empresaActiva?.id]);

  const cerrar = async () => {
    if (!periodo || !confirm(`¿Cerrar oficialmente el período ${etiqueta(periodo)}? Esta acción calculará saldos inmutables con hash SHA-256.`)) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await ejecutarCierre(periodo.id);
      setMensaje([r.mensaje, ...r.advertencias].join(' '));
      await cargar();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'El cierre no pudo completarse.');
      setOcupado(false);
    }
  };

  const abrirModalReapertura = () => {
    if (periodo) setReapertura(abrirReapertura(periodo));
  };

  const confirmarReapertura = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReapertura((actual) => ({ ...actual, enviando: true, error: null }));
    const resultado = await ejecutarReapertura({ ...reapertura, enviando: true, error: null }, reabrirPeriodo);
    setReapertura(resultado.estado);
    if (resultado.respuesta) {
      setMensaje(
        `${resultado.respuesta.mensaje} ${resultado.respuesta.periodos_desactualizados} período(s) posterior(es) desactualizado(s).`
      );
      await cargar();
    }
  };

  const ver = async (c: CierrePeriodo) => {
    setSeleccion(c);
    setDiferencias([]);
    try {
      setDiferencias((await compararCierres(c.periodo)).comparacion_ultimas_versiones);
    } catch {
      setError('No fue posible comparar las versiones de cierre.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Encabezado principal */}
      <PageHeader
        title="Cierres Contables y Snapshots de Existencias"
        description={`Control oficial de inventario inmutable y CPP · ${
          empresaActiva?.razon_social || 'Empresa activa'
        }${empresaActiva?.ruc ? ` · RUC: ${empresaActiva.ruc}` : ''}`}
        icon={Lock}
        badge={
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="neutral" className="font-mono text-xs">
              Algoritmo SHA-256
            </Badge>
            <Badge variant="info">Fase 9 · Bloque 5</Badge>
          </div>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={cargar}
            disabled={ocupado}
            className="shadow-xs"
          >
            {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
            Actualizar
          </Button>
        }
      />

      {/* 2. Alertas de Feedback */}
      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error en la operación</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {mensaje && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Operación completada con éxito</p>
            <p className="mt-0.5">{mensaje}</p>
          </div>
        </div>
      )}

      {/* 3. Panel de Operación del Período con Checklist de Cierre */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-indigo-600" />
                Operación de Cierre y Reapertura de Período
              </CardTitle>
              <CardDescription className="text-xs">
                El cierre calcula saldos contables, genera snapshots y congela los movimientos mediante un hash SHA-256.
              </CardDescription>
            </div>
            {periodo && (
              <Badge
                variant={
                  periodo.estado === 'ABIERTO'
                    ? 'success'
                    : periodo.estado === 'CERRADO'
                    ? 'neutral'
                    : 'destructive'
                }
                dot
              >
                {etiqueta(periodo)} · {periodo.estado}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="periodo-cierre-select">Seleccionar Período Contable</Label>
              <Select
                id="periodo-cierre-select"
                value={periodoId}
                onChange={(e) => setPeriodoId(e.target.value)}
              >
                <option value="">Seleccione un período para operar...</option>
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {etiqueta(p)} — Estado: {p.estado}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                disabled={!admin || ocupado || !periodo || periodo.estado === 'CERRADO'}
                onClick={cerrar}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                title={!admin ? 'Requiere rol de Administrador' : 'Cerrar período y generar snapshot inmutable'}
              >
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                Ejecutar Cierre
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!admin || ocupado || !periodo || periodo.estado !== 'CERRADO'}
                onClick={abrirModalReapertura}
                className="flex-1"
                title={!admin ? 'Requiere rol de Administrador' : 'Reabrir período contable'}
              >
                <Unlock className="h-3.5 w-3.5 mr-1.5" />
                Reabrir
              </Button>
            </div>
          </div>

          {/* Checklist visual de pre-requisitos de cierre */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
            <span className="font-semibold text-slate-800 block mb-2">Checklist de Reglas de Control para Cierre Oficial:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-slate-600">
              <div className="flex items-center gap-1.5">
                {periodo ? (
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-slate-300 shrink-0" />
                )}
                <span>Período seleccionado</span>
              </div>
              <div className="flex items-center gap-1.5">
                {periodo?.estado === 'ABIERTO' ? (
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-slate-300 shrink-0" />
                )}
                <span>Estado vigente ABIERTO</span>
              </div>
              <div className="flex items-center gap-1.5">
                {admin ? (
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-rose-500 shrink-0" />
                )}
                <span>Rol ADMIN Contable ({admin ? 'Autorizado' : 'Requerido'})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Snapshots SHA-256 Inmutables</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Historial de Snapshots */}
      <Card>
        <CardHeader className="py-3 px-4 border-b border-slate-200 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-indigo-600" />
              Historial de Snapshots de Cierre
            </CardTitle>
            <CardDescription className="text-xs">
              Haga clic sobre un snapshot para inspeccionar el desglose de saldos o compararlo con su versión previa
            </CardDescription>
          </div>
          <Badge variant="neutral" className="text-xs font-mono">
            {cierres.length} snapshot(s)
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {!cierres.length ? (
            <div className="py-12 text-center text-xs text-slate-500">
              {ocupado ? 'Cargando snapshots de cierre...' : 'Aún no existen cierres registrados para esta empresa.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-3">Período</th>
                    <th className="py-2.5 px-3 text-center">Versión</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Usuario Cierre</th>
                    <th className="py-2.5 px-3 text-right">Valor Total Inventario</th>
                    <th className="py-2.5 px-3">Hash SHA-256 Inmutable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cierres.map((c) => {
                    const isSelected = seleccion?.id === c.id;
                    const esVigente = etiquetaEstadoCierre(c.vigente, c.periodo_info.estado) === 'Vigente';
                    return (
                      <tr
                        key={c.id}
                        onClick={() => void ver(c)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50/70 font-medium' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                          {etiqueta(c.periodo_info)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant="info" size="xs">
                            v{c.version_calculo}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            variant={esVigente ? 'success' : 'neutral'}
                            size="xs"
                            dot={esVigente}
                          >
                            {etiquetaEstadoCierre(c.vigente, c.periodo_info.estado)}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                          {new Date(c.cerrado_en).toLocaleString('es-PE')}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {c.cerrado_por_username}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          S/ {dinero(c.snapshot_resumen.valor_total_inventario_pen)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600" title={c.hash_resultado}>
                            <Fingerprint className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <code className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {c.hash_resultado.slice(0, 16)}…
                            </code>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Detalle de Snapshot Seleccionado y Comparador */}
      {seleccion && (
        <Card>
          <CardHeader className="py-3 px-4 border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Detalle de Cierre {etiqueta(seleccion.periodo_info)} · Versión v{seleccion.version_calculo}
                </CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">Hash SHA-256 Completo:</span>
                <code className="font-mono text-[10px] bg-slate-100 px-2 py-1 rounded border border-slate-200 text-slate-700 select-all">
                  {seleccion.hash_resultado}
                </code>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Tabla de saldos por establecimiento y producto */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3">Establecimiento</th>
                    <th className="py-2.5 px-3 text-right">Cantidad Final</th>
                    <th className="py-2.5 px-3 text-right">CPP Vigente</th>
                    <th className="py-2.5 px-3 text-right">Valor Total PEN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {seleccion.detalles.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3">
                        <span className="font-mono font-semibold text-slate-900">{d.producto_codigo}</span>{' '}
                        <span className="text-slate-600">· {d.producto_descripcion}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{d.establecimiento_nombre}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800 font-medium">
                        {cant(d.saldo_cantidad)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                        {cpp(d.cpp_pen)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        S/ {dinero(d.saldo_valor_pen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Comparador de versiones de cierre */}
            {diferencias.length > 0 && (
              <div className="border-t border-slate-200 pt-4 pb-2 px-4 bg-slate-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <GitCompare className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Comparador de Diferencias Entre las Dos Últimas Versiones de Cierre
                  </h3>
                </div>
                <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <th className="py-2 px-2.5">Prod ID</th>
                        <th className="py-2 px-2.5">Estab ID</th>
                        <th className="py-2 px-2.5 text-right">Cant. Ant.</th>
                        <th className="py-2 px-2.5 text-right">Cant. Nueva</th>
                        <th className="py-2 px-2.5 text-right font-bold">Δ Cantidad</th>
                        <th className="py-2 px-2.5 text-right">CPP Ant.</th>
                        <th className="py-2 px-2.5 text-right">CPP Nuevo</th>
                        <th className="py-2 px-2.5 text-right font-bold">Δ CPP</th>
                        <th className="py-2 px-2.5 text-right">Valor Ant.</th>
                        <th className="py-2 px-2.5 text-right">Valor Nuevo</th>
                        <th className="py-2 px-2.5 text-right font-bold">Δ Valor PEN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-[11px]">
                      {diferencias.map((d) => {
                        const deltaCant = Number(d.diferencia.cantidad || 0);
                        const deltaValor = Number(d.diferencia.valor_pen || 0);
                        return (
                          <tr key={`${d.producto_id}-${d.establecimiento_id}`} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2.5 font-sans font-medium">{d.producto_id}</td>
                            <td className="py-1.5 px-2.5 font-sans">{d.establecimiento_id}</td>
                            <td className="py-1.5 px-2.5 text-right text-slate-500">{cant(d.version_anterior.saldo_cantidad)}</td>
                            <td className="py-1.5 px-2.5 text-right text-slate-800">{cant(d.version_nueva.saldo_cantidad)}</td>
                            <td className={`py-1.5 px-2.5 text-right font-bold ${deltaCant !== 0 ? 'text-amber-700 bg-amber-50/50' : 'text-slate-400'}`}>
                              {cant(d.diferencia.cantidad)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right text-slate-500">{cpp(d.version_anterior.cpp_pen)}</td>
                            <td className="py-1.5 px-2.5 text-right text-slate-800">{cpp(d.version_nueva.cpp_pen)}</td>
                            <td className="py-1.5 px-2.5 text-right font-bold text-slate-700">{cpp(d.diferencia.cpp_pen)}</td>
                            <td className="py-1.5 px-2.5 text-right text-slate-500">S/ {dinero(d.version_anterior.saldo_valor_pen)}</td>
                            <td className="py-1.5 px-2.5 text-right text-slate-800">S/ {dinero(d.version_nueva.saldo_valor_pen)}</td>
                            <td className={`py-1.5 px-2.5 text-right font-bold ${deltaValor !== 0 ? 'text-indigo-800 bg-indigo-50/50' : 'text-slate-400'}`}>
                              S/ {dinero(d.diferencia.valor_pen)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 6. Modal de Reapertura de Período */}
      {reapertura.abierto && reapertura.periodo && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reapertura-title"
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
                  <Unlock className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="reapertura-title" className="text-base font-semibold text-slate-900">
                    Reabrir Período {etiqueta(reapertura.periodo)}
                  </h2>
                  <p className="text-xs text-slate-500">
                    El snapshot actual v{seleccion?.version_calculo || 1} permanecerá inmutable en el historial contable.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal"
                disabled={reapertura.enviando}
                onClick={() => setReapertura(cancelarReapertura())}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form noValidate onSubmit={confirmarReapertura} className="mt-4 space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Advertencia Contable:</strong> La reapertura de este período marcará como <em>DESACTUALIZADOS</em> todos los períodos posteriores, requiriendo un recálculo cronológico de CPP.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="motivo-reapertura">
                  Motivo de Reapertura <span className="text-rose-500">*</span>
                </Label>
                <textarea
                  id="motivo-reapertura"
                  autoFocus
                  maxLength={500}
                  rows={4}
                  value={reapertura.motivo}
                  onChange={(e) =>
                    setReapertura((actual) => ({ ...actual, motivo: e.target.value, error: null }))
                  }
                  placeholder="Explique la justificación o corrección contable que requiere reabrir este período..."
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 resize-y"
                />
                <span className="text-[11px] text-slate-400 text-right block">
                  {reapertura.motivo.length} / 500 caracteres
                </span>
              </div>

              {reapertura.error && (
                <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {reapertura.error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reapertura.enviando}
                  onClick={() => setReapertura(cancelarReapertura())}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={reapertura.enviando}
                >
                  {reapertura.enviando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {reapertura.enviando ? 'Reabriendo período...' : 'Confirmar Reapertura'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default CierresPage;
