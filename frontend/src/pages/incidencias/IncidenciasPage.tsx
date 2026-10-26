import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Lock,
  History,
  Eye,
  Play,
  Check,
  X,
} from 'lucide-react'
import {
  obtenerIncidenciasPaginadas,
  obtenerRecalculosPaginados,
  resolverIncidencia,
  ejecutarRecalculo,
  type Incidencia,
  type Recalculo,
} from '../../api/kardex'
import { getProductos, type Producto } from '../../api/inventario'
import { useAuth } from '../../context/useAuth'
import { PageHeader } from '../../components/ui/page-header'
import { Button } from '../../components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Label } from '../../components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { Modal } from '../../components/ui/modal'
import { fechaCalendarioLocal } from '../../utils/date'
import { diferirCarga } from '../../utils/efectos'
import { Paginacion } from '../../components/ui/paginacion'
import {
  PAGE_SIZE_DEFECTO, claveConsulta, irAPagina, paginaVigente, paramsPaginacion, type EstadoPagina,
} from '../../utils/paginacion'

export const IncidenciasPage: React.FC = () => {
  const { empresaActiva, usuario } = useAuth()
  const [tab, setTab] = useState<'incidencias' | 'recalculos'>('incidencias')
  const [incidencias, setIncidencias] = useState<Incidencia[]>([])
  const [recalculos, setRecalculos] = useState<Recalculo[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  // Bloque 7: paginación en el servidor; la página vuelve a 1 al cambiar de empresa.
  const [totalIncidencias, setTotalIncidencias] = useState(0)
  const [totalRecalculos, setTotalRecalculos] = useState(0)
  const [pagIncidencias, setPagIncidencias] = useState<EstadoPagina>({ clave: '', page: 1 })
  const [pagRecalculos, setPagRecalculos] = useState<EstadoPagina>({ clave: '', page: 1 })
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Formulario de Recálculo Manual
  const [recalculoProducto, setRecalculoProducto] = useState<string>('')
  const [recalculoFecha, setRecalculoFecha] = useState<string>(() => fechaCalendarioLocal())
  const [ejecutandoRecalculo, setEjecutandoRecalculo] = useState<boolean>(false)

  // Modal de Detalle de Recálculo
  const [recalculoSeleccionado, setRecalculoSeleccionado] = useState<Recalculo | null>(null)

  const esAdmin = Boolean(usuario?.es_admin_global || empresaActiva?.rol === 'ADMIN')

  const claveEmpresa = claveConsulta(empresaActiva?.id)
  const pageIncidencias = paginaVigente(pagIncidencias, claveEmpresa)
  const pageRecalculos = paginaVigente(pagRecalculos, claveEmpresa)

  const cargar = useCallback(async () => {
    if (!empresaActiva) return
    setLoading(true)
    try {
      const [listaIncidencias, listaRecalculos] = await Promise.all([
        obtenerIncidenciasPaginadas(paramsPaginacion(pageIncidencias)),
        obtenerRecalculosPaginados(paramsPaginacion(pageRecalculos)),
      ])
      setIncidencias(listaIncidencias.results)
      setTotalIncidencias(listaIncidencias.count)
      setRecalculos(listaRecalculos.results)
      setTotalRecalculos(listaRecalculos.count)
    } catch {
      setError('No se pudo cargar la información del motor Kardex.')
    } finally {
      setLoading(false)
    }
  }, [empresaActiva, pageIncidencias, pageRecalculos])

  useEffect(() => {
    diferirCarga(cargar)
  }, [cargar])

  // Catálogo de productos para el formulario de recálculo (no depende de la página).
  useEffect(() => {
    if (!empresaActiva) return
    let ignorar = false
    getProductos()
      .then((lista) => {
        if (!ignorar) setProductos(lista)
      })
      .catch(() => {
        if (!ignorar) setError('No se pudo cargar la información del motor Kardex.')
      })
    return () => {
      ignorar = true
    }
  }, [empresaActiva])

  const cambiarEstado = async (id: number, nuevoEstado: 'RESUELTA' | 'DESCARTADA') => {
    setError(null)
    setSuccess(null)
    try {
      await resolverIncidencia(id, nuevoEstado)
      setSuccess(`Incidencia #${id} marcada como ${nuevoEstado}.`)
      await cargar()
    } catch {
      setError('No se pudo actualizar el estado de la incidencia.')
    }
  }

  const handleEjecutarRecalculo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recalculoProducto || !recalculoFecha) {
      setError('Debe seleccionar el producto y la fecha desde la cual recalcular.')
      return
    }
    setError(null)
    setSuccess(null)
    setEjecutandoRecalculo(true)
    try {
      await ejecutarRecalculo(Number(recalculoProducto), recalculoFecha)
      setSuccess('Recálculo cronológico ejecutado exitosamente.')
      await cargar()
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const msg = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data)
        setError(`Error al ejecutar recálculo: ${msg}`)
      } else {
        setError('Ocurrió un error al ejecutar el recálculo.')
      }
    } finally {
      setEjecutandoRecalculo(false)
    }
  }

  const getNombreProducto = (id: number) => {
    const prod = productos.find((p) => p.id === id)
    return prod ? `${prod.codigo_interno} — ${prod.descripcion}` : `Producto #${id}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidencias y Recálculos de Kardex"
        description={`Supervisión de inconsistencias contables, validación de bloqueo de cierres y motor de recálculo cronológico para ${
          empresaActiva?.razon_social ?? 'la empresa activa'
        }.`}
        icon={<AlertTriangle className="h-5 w-5" />}
        badge={
          <Badge variant="info">Control de Calidad • Fase 7</Badge>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => void cargar()} isLoading={loading}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Actualizar
          </Button>
        }
      />

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-700 animate-in fade-in"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span className="font-medium leading-relaxed">{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs text-emerald-700 animate-in fade-in"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <span className="font-medium leading-relaxed">{success}</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(val) => setTab(val as 'incidencias' | 'recalculos')}>
        <TabsList>
          <TabsTrigger value="incidencias" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
            Incidencias Contables ({totalIncidencias})
          </TabsTrigger>
          <TabsTrigger value="recalculos" icon={<History className="h-3.5 w-3.5" />}>
            Historial de Recálculos Cronológicos ({totalRecalculos})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INCIDENCIAS */}
        <TabsContent value="incidencias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bandeja de Incidencias Contables</CardTitle>
              <CardDescription>
                Las inconsistencias con bloqueo de cierre impiden legalmente el cierre mensual hasta ser subsanadas o descartadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-12 text-slate-400 text-xs">
                  Cargando incidencias...
                </div>
              ) : incidencias.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="font-bold text-slate-800 text-sm">No hay incidencias registradas</p>
                  <p className="text-xs text-slate-500 max-w-sm mt-0.5">
                    El inventario y los movimientos contables no presentan inconsistencias ni descalces.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Tipo</TableHead>
                      <TableHead className="w-28">Severidad</TableHead>
                      <TableHead>Descripción de la Inconsistencia</TableHead>
                      <TableHead className="w-36 text-center">Bloquea Cierre</TableHead>
                      <TableHead className="w-28">Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidencias.map((i) => {
                      const sevVariant =
                        i.severidad === 'CRITICA' || i.severidad === 'ERROR'
                          ? 'destructive'
                          : i.severidad === 'ADVERTENCIA'
                          ? 'warning'
                          : 'info'

                      return (
                        <TableRow key={i.id}>
                          <TableCell>
                            <code className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                              {i.tipo}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant={sevVariant} size="sm">
                              {i.severidad}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-800 text-xs">{i.descripcion}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Detectado: {new Date(i.detectado_en).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {i.bloquea_cierre ? (
                              <Badge variant="destructive" className="gap-1 font-bold">
                                <Lock className="h-3 w-3" /> BLOQUEA
                              </Badge>
                            ) : (
                              <Badge variant="neutral">No</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                i.estado === 'RESUELTA'
                                  ? 'success'
                                  : i.estado === 'DESCARTADA'
                                  ? 'neutral'
                                  : 'warning'
                              }
                              dot
                            >
                              {i.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {esAdmin && i.estado === 'PENDIENTE' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  onClick={() => void cambiarEstado(i.id, 'RESUELTA')}
                                  className="text-emerald-700 hover:bg-emerald-50"
                                >
                                  <Check className="h-3 w-3 mr-1" /> Resolver
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => void cambiarEstado(i.id, 'DESCARTADA')}
                                  className="text-slate-500 hover:text-slate-700"
                                >
                                  <X className="h-3 w-3 mr-1" /> Descartar
                                </Button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
              {totalIncidencias > 0 && (
                <Paginacion
                  page={pageIncidencias}
                  pageSize={PAGE_SIZE_DEFECTO}
                  count={totalIncidencias}
                  enPagina={incidencias.length}
                  cargando={loading}
                  etiqueta="incidencias"
                  onCambiarPagina={(page) => setPagIncidencias(irAPagina(claveEmpresa, page))}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: RECÁLCULOS */}
        <TabsContent value="recalculos" className="space-y-6">
          {/* Formulario Ejecutar Recálculo Manual */}
          {esAdmin && (
            <Card className="border-indigo-100 bg-indigo-50/20 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ejecutar Recálculo Cronológico</CardTitle>
                <CardDescription>
                  Reevalúa el orden de prioridad y recalcula el CPP hacia adelante ante documentos extemporáneos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEjecutarRecalculo} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label required>Producto a Recalcular</Label>
                    <Select
                      required
                      value={recalculoProducto}
                      onChange={(e) => setRecalculoProducto(e.target.value)}
                    >
                      <option value="">Seleccionar Producto...</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.codigo_interno} · {p.descripcion}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label required>Fecha Inicial del Recálculo</Label>
                    <Input
                      required
                      type="date"
                      value={recalculoFecha}
                      onChange={(e) => setRecalculoFecha(e.target.value)}
                      className="font-mono tabular-nums"
                    />
                  </div>

                  <Button type="submit" variant="primary" isLoading={ejecutandoRecalculo}>
                    <Play className="h-4 w-4 mr-1.5" /> Ejecutar Recálculo
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Tabla de Historial de Recálculos */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Recálculos Cronológicos ({totalRecalculos})</CardTitle>
              <CardDescription>
                Trazabilidad de recálculos de CPP activados de forma manual o automática por el motor M2.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16"># ID</TableHead>
                    <TableHead>Producto Recalculado</TableHead>
                    <TableHead className="w-32">Fecha Desde</TableHead>
                    <TableHead className="w-44">Fecha Ejecución</TableHead>
                    <TableHead className="w-28">Estado</TableHead>
                    <TableHead numeric className="w-28">Movs Afectados</TableHead>
                    <TableHead className="text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recalculos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                        No hay registros de recálculo ejecutados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recalculos.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell numeric className="font-bold text-slate-900">
                          #{r.id}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800">
                          {getNombreProducto(r.producto)}
                        </TableCell>
                        <TableCell numeric className="text-slate-600">
                          {r.fecha_desde}
                        </TableCell>
                        <TableCell numeric className="text-slate-500 text-xs">
                          {new Date(r.ejecutado_en).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.estado === 'COMPLETADO' ? 'success' : 'destructive'} dot>
                            {r.estado}
                          </Badge>
                        </TableCell>
                        <TableCell numeric className="font-bold text-indigo-700">
                          {r.detalles?.length || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => setRecalculoSeleccionado(r)}
                          >
                            <Eye className="h-3 w-3 mr-1" /> Ver Diff
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <Paginacion
                page={pageRecalculos}
                pageSize={PAGE_SIZE_DEFECTO}
                count={totalRecalculos}
                enPagina={recalculos.length}
                cargando={loading}
                etiqueta="recálculos"
                onCambiarPagina={(page) => setPagRecalculos(irAPagina(claveEmpresa, page))}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Visor de Detalle de Recálculo */}
      {recalculoSeleccionado && (
        <Modal
          isOpen={Boolean(recalculoSeleccionado)}
          onClose={() => setRecalculoSeleccionado(null)}
          maxWidth="4xl"
          icon={<History className="h-5 w-5" />}
          title={`Detalle de Recálculo #${recalculoSeleccionado.id}`}
          description={`Producto: ${getNombreProducto(recalculoSeleccionado.producto)} • Fecha Desde: ${recalculoSeleccionado.fecha_desde}`}
          footer={
            <Button variant="secondary" onClick={() => setRecalculoSeleccionado(null)}>
              Cerrar Visor
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span>
                Movimientos Reevaluados:{' '}
                <strong className="font-mono text-indigo-600 font-bold">
                  {recalculoSeleccionado.detalles?.length || 0}
                </strong>
              </span>
              <span>
                Estado:{' '}
                <Badge variant="success" size="sm">
                  {recalculoSeleccionado.estado}
                </Badge>
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Movimiento ID</TableHead>
                  <TableHead numeric>CPP Anterior</TableHead>
                  <TableHead className="w-10 text-center">→</TableHead>
                  <TableHead numeric>CPP Nuevo</TableHead>
                  <TableHead numeric>Diferencia Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recalculoSeleccionado.detalles?.map((det) => (
                  <TableRow key={det.movimiento_id}>
                    <TableCell numeric className="font-bold text-slate-800">
                      Mov #{det.movimiento_id}
                    </TableCell>
                    <TableCell numeric className="text-slate-500 font-mono">
                      S/ {Number(det.cpp_anterior || 0).toFixed(6)}
                    </TableCell>
                    <TableCell className="text-center font-bold text-indigo-600">→</TableCell>
                    <TableCell numeric className="font-bold text-indigo-950 font-mono">
                      S/ {Number(det.cpp_nuevo || 0).toFixed(6)}
                    </TableCell>
                    <TableCell numeric className="font-mono text-slate-700">
                      S/ {(Number(det.saldo_nuevo || 0) - Number(det.saldo_anterior || 0)).toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default IncidenciasPage
