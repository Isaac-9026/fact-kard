import React, { useEffect, useState, useMemo, useCallback, type FormEvent } from 'react';
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
import { filtrosKardexDesdeFormulario } from '../../utils/kardexFiltros';
import {
  BookOpenCheck,
  FileDown,
  Package,
  Scale,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  RotateCcw,
  Loader2,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import {
  SIN_DATO, filaSaldoInicialKardex, guardarPeriodo, leerPeriodoGuardado, periodoInicialKardex, textoCppFinal,
  type SaldoInicialProducto,
} from '../../utils/kardexVista';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, KpiCard } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Label } from '../../components/ui/label';

const formatQty = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

const formatCost = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num.toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
};

const formatMoney = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (isNaN(num)) return String(val);
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
  const [saldosIniciales, setSaldosIniciales] = useState<SaldoInicialProducto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const saldoInicial = filaSaldoInicialKardex(resumen, saldosIniciales);

  // Ejecución de la consulta contable con una instantánea estable de filtros.
  const cargarKardex = useCallback(async (filtros: KardexFiltros) => {
    setLoading(true);
    setError(null);
    try {
      const res = await obtenerKardexValorizado(filtros);
      setMovimientos(res.movimientos);
      setResumen(res.resumen);
      setSaldosIniciales(res.saldos_iniciales ?? []);
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
  }, []);

  // Carga inicial de catálogos y del reporte de la empresa activa.
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

          // Bloque 4: última selección válida de esta pestaña; si no, el último abierto.
          const inicial = periodoInicialKardex(persData, leerPeriodoGuardado(empresaActiva?.id));
          setPeriodoId(inicial);
          void cargarKardex({ periodo_id: inicial ? Number(inicial) : undefined });
        }
      } catch (err) {
        console.error('Error al cargar catálogos de Kardex', err);
      }
    };
    cargarCatalogos();
    return () => {
      isMounted = false;
    };
  }, [empresaActiva?.id, cargarKardex]);

  const handleActualizarConsulta = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const filtros = filtrosKardexDesdeFormulario(new FormData(event.currentTarget));
    setProductoId(filtros.producto_id ? String(filtros.producto_id) : '');
    setPeriodoId(filtros.periodo_id ? String(filtros.periodo_id) : '');
    setAlmacenId(filtros.almacen_id ? String(filtros.almacen_id) : '');
    setTipoOperacionId(filtros.tipo_operacion_id ? String(filtros.tipo_operacion_id) : '');
    setFechaDesde(filtros.fecha_desde ?? '');
    setFechaHasta(filtros.fecha_hasta ?? '');
    guardarPeriodo(empresaActiva?.id, filtros.periodo_id ? String(filtros.periodo_id) : '');
    void cargarKardex(filtros);
  };

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
    void cargarKardex({});
  };

  const productoSeleccionado = useMemo(() => {
    if (!productoId) return null;
    return productos.find((p) => String(p.id) === String(productoId));
  }, [productoId, productos]);

  return (
    <div className="space-y-6">
      {/* 1. Encabezado principal */}
      <PageHeader
        title="Consulta de Kardex Permanente Valorizado"
        description={`Control contable con Costo Promedio Ponderado Móvil (CPP Global en PEN) · ${
          empresaActiva?.razon_social ?? 'Empresa Activa'
        }${empresaActiva?.ruc ? ` · RUC: ${empresaActiva.ruc}` : ''}`}
        icon={BookOpenCheck}
        badge={
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="info">Fase 8 · Bloque 5</Badge>
            <Badge variant="success" dot>SUNAT Formato 13.1</Badge>
          </div>
        }
        actions={
          <Button
            type="button"
            onClick={handleExportarExcel}
            disabled={exporting || loading}
            variant="success"
            className="shadow-sm"
            title="Descargar libro Excel con 4 hojas oficiales (Kardex, Movimientos, Incidencias, Saldos)"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <FileDown className="h-4 w-4 mr-1.5" />
            )}
            {exporting ? 'Generando Excel...' : 'Exportar Excel Oficial (.xlsx)'}
          </Button>
        }
      />

      {/* 2. Tarjetas KPI de Resumen Superior */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <KpiCard
          title="Stock Total Empresa"
          value={loading ? '...' : formatQty(resumen?.saldo_final_cantidad)}
          subtitle={
            productoSeleccionado
              ? `${productoSeleccionado.codigo_interno} (Unidad Base)`
              : 'Balance físico acumulado'
          }
          icon={Package}
        />
        <KpiCard
          title="CPP Vigente (PEN)"
          value={loading ? '...' : resumen ? textoCppFinal(resumen.cpp_final, formatCost) : SIN_DATO}
          subtitle="Costo Promedio Ponderado Móvil (6 dec.)"
          icon={Scale}
        />
        <KpiCard
          title="Saldo Valorizado"
          value={loading ? '...' : `S/ ${formatMoney(resumen?.saldo_final_valor)}`}
          subtitle="Valor monetario contable en PEN"
          icon={Coins}
        />
        <KpiCard
          title="Total Entradas"
          value={loading ? '...' : formatQty(resumen?.total_entradas_cantidad)}
          subtitle={loading ? '...' : `Valor: S/ ${formatMoney(resumen?.total_entradas_valor)}`}
          icon={ArrowDownLeft}
        />
        <KpiCard
          title="Total Salidas"
          value={loading ? '...' : formatQty(resumen?.total_salidas_cantidad)}
          subtitle={loading ? '...' : `Valor: S/ ${formatMoney(resumen?.total_salidas_valor)}`}
          icon={ArrowUpRight}
        />
      </div>

      {/* 3. Barra de Filtros Oficiales */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Filter className="h-4 w-4 text-indigo-600" />
                Filtros de Consulta Contable
              </CardTitle>
              <CardDescription className="text-xs">
                Filtre por producto, período contable, almacén o rango de fechas
              </CardDescription>
            </div>
            {productoSeleccionado && (
              <Badge variant="neutral" className="text-xs font-mono">
                {productoSeleccionado.codigo_interno} — {productoSeleccionado.descripcion}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleActualizarConsulta} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Producto */}
              <div className="lg:col-span-2 space-y-1.5">
                <Label htmlFor="kardex-producto">Producto</Label>
                <Select
                  id="kardex-producto"
                  name="producto_id"
                  value={productoId}
                  onChange={(e) => setProductoId(e.target.value)}
                >
                  <option value="">Todos los productos</option>
                  {productos.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.codigo_interno} — {prod.descripcion}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Período */}
              <div className="space-y-1.5">
                <Label htmlFor="kardex-periodo">Período Contable</Label>
                <Select
                  id="kardex-periodo"
                  name="periodo_id"
                  value={periodoId}
                  onChange={(e) => setPeriodoId(e.target.value)}
                >
                  <option value="">Todos los períodos</option>
                  {periodos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.anio}-{String(p.mes).padStart(2, '0')} ({p.estado})
                    </option>
                  ))}
                </Select>
              </div>

              {/* Almacén */}
              <div className="space-y-1.5">
                <Label htmlFor="kardex-almacen">Almacén</Label>
                <Select
                  id="kardex-almacen"
                  name="almacen_id"
                  value={almacenId}
                  onChange={(e) => setAlmacenId(e.target.value)}
                >
                  <option value="">Todos (Consolidado)</option>
                  {almacenes.map((alm) => (
                    <option key={alm.id} value={alm.id}>
                      {alm.codigo} — {alm.nombre}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Tipo de Operación */}
              <div className="space-y-1.5">
                <Label htmlFor="kardex-operacion">Tipo de Operación</Label>
                <Select
                  id="kardex-operacion"
                  name="tipo_operacion_id"
                  value={tipoOperacionId}
                  onChange={(e) => setTipoOperacionId(e.target.value)}
                >
                  <option value="">Todas las operaciones</option>
                  {tiposOperacion.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.codigo_sunat || op.codigo_interno} — {op.descripcion}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Fechas */}
              <div className="space-y-1.5">
                <Label htmlFor="kardex-desde">Fecha Desde</Label>
                <Input
                  id="kardex-desde"
                  type="date"
                  name="fecha_desde"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kardex-hasta">Fecha Hasta</Label>
                <Input
                  id="kardex-hasta"
                  type="date"
                  name="fecha_hasta"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLimpiarFiltros}
                disabled={loading}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Limpiar Filtros
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                )}
                {loading ? 'Consultando...' : 'Actualizar Consulta'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 4. Mensaje de Error */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error al consultar Kardex Valorizado</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* 5. Tabla Oficial de Kardex Valorizado */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-slate-200 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-slate-700" />
              Movimientos Contables Registrados
            </CardTitle>
            <CardDescription className="text-xs">
              <span className="font-mono font-semibold text-slate-900">{movimientos.length}</span>{' '}
              movimiento(s) valorizados cronológicamente por el motor CPP
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Entrada
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Salida
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              Ajuste Valor
            </span>
          </div>
        </CardHeader>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-slate-900 mb-3" />
            <p className="text-sm font-medium">Procesando y valorizando movimientos de Kardex...</p>
          </div>
        ) : movimientos.length === 0 && !saldoInicial.mostrar ? (
          <div className="py-16 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <Inbox className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No se encontraron movimientos registrados</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              No hay operaciones registradas para los filtros seleccionados o el producto aún no tiene movimientos confirmados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                {/* Nivel 1: Agrupación oficial con estilo B2B */}
                <tr className="text-[11px] font-bold uppercase tracking-wider text-center border-b border-slate-200">
                  <th colSpan={5} className="py-2 px-3 bg-slate-100 text-slate-700 border-r border-slate-200">
                    Datos de la Operación
                  </th>
                  <th colSpan={3} className="py-2 px-3 bg-emerald-50/80 text-emerald-900 border-r border-emerald-100">
                    Entradas
                  </th>
                  <th colSpan={3} className="py-2 px-3 bg-amber-50/80 text-amber-900 border-r border-amber-100">
                    Salidas
                  </th>
                  <th colSpan={3} className="py-2 px-3 bg-indigo-50/80 text-indigo-950 font-extrabold">
                    Saldo Final Valorizado
                  </th>
                </tr>

                {/* Nivel 2: Subcolumnas */}
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                  <th className="py-2 px-3 text-center w-24">Fecha</th>
                  <th className="py-2 px-3">Documento Ref.</th>
                  <th className="py-2 px-3">Tipo Operación</th>
                  <th className="py-2 px-3 text-center w-24">Naturaleza</th>
                  <th className="py-2 px-3 border-r border-slate-200">Almacén</th>

                  {/* Entradas */}
                  <th className="py-2 px-3 text-right bg-emerald-50/40">Cantidad</th>
                  <th className="py-2 px-3 text-right bg-emerald-50/40">Costo Unit.</th>
                  <th className="py-2 px-3 text-right bg-emerald-50/40 border-r border-emerald-100">Valor Total</th>

                  {/* Salidas */}
                  <th className="py-2 px-3 text-right bg-amber-50/40">Cantidad</th>
                  <th className="py-2 px-3 text-right bg-amber-50/40">Costo Unit.</th>
                  <th className="py-2 px-3 text-right bg-amber-50/40 border-r border-amber-100">Valor Total</th>

                  {/* Saldo Final */}
                  <th className="py-2 px-3 text-right bg-indigo-50/40">Cantidad</th>
                  <th className="py-2 px-3 text-right bg-indigo-50/40">C.P.P.</th>
                  <th className="py-2 px-3 text-right bg-indigo-50/40 font-bold text-slate-900">Valor Total</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {saldoInicial.mostrar && (
                  <tr className="bg-slate-50/70 font-semibold text-slate-700">
                    <td colSpan={11} className="py-2 px-3 text-right">
                      SALDO INICIAL
                      {resumen?.ambito_saldo === 'ALMACEN' && (
                        <span className="ml-2 text-[10px] font-normal text-slate-500">(stock del almacén × CPP global)</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatQty(saldoInicial.cantidad)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCost(saldoInicial.cpp)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">S/ {formatMoney(saldoInicial.valor)}</td>
                  </tr>
                )}
                {saldoInicial.mostrar && movimientos.length === 0 && (
                  <tr>
                    <td colSpan={14} className="py-3 px-3 text-center text-slate-400">
                      Sin movimientos en el rango; el saldo final es el saldo inicial.
                    </td>
                  </tr>
                )}
                {movimientos.map((mov) => {
                  const isEntrada = mov.naturaleza === 'ENTRADA';
                  const isSalida = mov.naturaleza === 'SALIDA';
                  const isAjuste = mov.naturaleza === 'AJUSTE_VALOR';

                  return (
                    <tr
                      key={mov.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Fecha */}
                      <td className="py-2 px-3 text-center font-mono tabular-nums whitespace-nowrap text-slate-700">
                        {mov.fecha}
                      </td>

                      {/* Documento Ref */}
                      <td className="py-2 px-3 font-medium text-slate-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono tabular-nums">{mov.documento_referencia || '—'}</span>
                          {mov.es_extorno && (
                            <Badge variant="warning" size="xs">EXTORNO</Badge>
                          )}
                          {mov.generado_por_motor && (
                            <Badge variant="info" size="xs">MOTOR</Badge>
                          )}
                        </div>
                      </td>

                      {/* Tipo Operación */}
                      <td className="py-2 px-3 max-w-[200px]" title={mov.tipo_operacion_descripcion}>
                        <div className="truncate">
                          <span className="font-mono font-semibold text-slate-900">{mov.tipo_operacion_codigo}</span>{' '}
                          <span className="text-slate-500 text-[11px]">{mov.tipo_operacion_descripcion}</span>
                        </div>
                      </td>

                      {/* Naturaleza */}
                      <td className="py-2 px-3 text-center">
                        <Badge
                          variant={isEntrada ? 'success' : isSalida ? 'destructive' : 'info'}
                          size="xs"
                        >
                          {mov.naturaleza}
                        </Badge>
                      </td>

                      {/* Almacén */}
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-600 truncate max-w-[150px]">
                        <span className="font-mono">{mov.almacen_codigo}</span> - {mov.almacen_nombre}
                      </td>

                      {/* Bloque Entradas */}
                      <td className={`py-2 px-3 text-right font-mono tabular-nums bg-emerald-50/20 ${
                        isEntrada || (isAjuste && mov.entrada_valor) ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                      }`}>
                        {formatQty(mov.entrada_cantidad)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums bg-emerald-50/20 text-slate-600">
                        {formatCost(mov.entrada_costo_unitario)}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono tabular-nums bg-emerald-50/20 border-r border-emerald-100 ${
                        isEntrada || (isAjuste && mov.entrada_valor) ? 'text-emerald-700 font-bold' : 'text-slate-400'
                      }`}>
                        {mov.entrada_valor ? `S/ ${formatMoney(mov.entrada_valor)}` : '—'}
                      </td>

                      {/* Bloque Salidas */}
                      <td className={`py-2 px-3 text-right font-mono tabular-nums bg-amber-50/20 ${
                        isSalida || (isAjuste && mov.salida_valor) ? 'text-rose-700 font-semibold' : 'text-slate-400'
                      }`}>
                        {formatQty(mov.salida_cantidad)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums bg-amber-50/20 text-slate-600">
                        {formatCost(mov.salida_costo_unitario)}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono tabular-nums bg-amber-50/20 border-r border-amber-100 ${
                        isSalida || (isAjuste && mov.salida_valor) ? 'text-rose-700 font-bold' : 'text-slate-400'
                      }`}>
                        {mov.salida_valor ? `S/ ${formatMoney(mov.salida_valor)}` : '—'}
                      </td>

                      {/* Bloque Saldo Final */}
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 bg-indigo-50/20">
                        {formatQty(mov.saldo_cantidad)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800 bg-indigo-50/20">
                        {formatCost(mov.cpp)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-950 bg-indigo-50/20">
                        S/ {formatMoney(mov.saldo_valor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Pie de tabla con totales oficiales */}
              {resumen && (
                <tfoot>
                  <tr className="bg-slate-100/90 font-semibold border-t-2 border-slate-900 text-xs">
                    <td colSpan={5} className="py-2.5 px-3 text-right font-bold text-slate-900 border-r border-slate-200">
                      TOTALES DEL PERÍODO:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-800 bg-emerald-50/50">
                      {formatQty(resumen.total_entradas_cantidad)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400 bg-emerald-50/50">—</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-800 bg-emerald-50/50 border-r border-emerald-200">
                      S/ {formatMoney(resumen.total_entradas_valor)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-rose-800 bg-amber-50/50">
                      {formatQty(resumen.total_salidas_cantidad)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400 bg-amber-50/50">—</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-rose-800 bg-amber-50/50 border-r border-amber-200">
                      S/ {formatMoney(resumen.total_salidas_valor)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-extrabold text-slate-950 bg-indigo-50/50">
                      {formatQty(resumen.saldo_final_cantidad)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 bg-indigo-50/50">
                      {formatCost(resumen.cpp_final)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-extrabold text-slate-950 bg-indigo-50/50">
                      S/ {formatMoney(resumen.saldo_final_valor)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
