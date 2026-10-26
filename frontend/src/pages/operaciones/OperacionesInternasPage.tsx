import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import {
  ClipboardList,
  PackagePlus,
  FileWarning,
  Plus,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Ban,
  Building2,
  Save,
  Search,
  Trash2,
} from 'lucide-react'

import { obtenerTiposOperacion, type TipoOperacion } from '../../api/catalogos'
import { getAlmacenes, getProductos, type Almacen, type Producto } from '../../api/inventario'
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
} from '../../api/operaciones'
import { obtenerPeriodos, type Periodo } from '../../api/periodos'
import { useAuth } from '../../context/useAuth'
import { campoFechaNotaInterna, formularioNotaTrasRespuesta } from '../../utils/notaInternaForm'
import { PageHeader } from '../../components/ui/page-header'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Label } from '../../components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { Modal } from '../../components/ui/modal'
import { diferirCarga } from '../../utils/efectos'
import { formatearDecimal } from '../../utils/decimal'

type TabId = 'saldos' | 'notas'

const TIPOS_ESTANDAR = new Set(['MERMA', 'DESMEDRO', 'CONSUMO_INTERNO', 'RETIRO'])
const TIPOS_ADMIN = new Set(['AJUSTE_INGRESO', 'AJUSTE_SALIDA', 'AJUSTE_VALOR_MANUAL'])

const SALDO_INICIAL = {
  periodo: '',
  almacen: '',
  producto: '',
  cantidad: '',
  valor_pen: '',
}

const LINEA_INICIAL = (): NotaInternaDetallePayload => ({
  producto: 0,
  cantidad_base: '',
  costo_unitario_pen: null,
  valor_ajuste_pen: null,
})

const NOTA_INICIAL = {
  almacen: '',
  periodo: '',
  tipo_operacion: '',
  fecha: '',
  motivo: '',
  responsable: '',
  observacion: '',
  archivo_sustento: '',
  detalles: [LINEA_INICIAL()],
}

const extraerError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return 'No se pudo completar la operación.'
  const data = error.response?.data
  if (typeof data === 'string') return data
  if (!data || typeof data !== 'object') return 'No se pudo completar la operación.'
  return Object.entries(data)
    .map(([campo, detalle]) => {
      if (Array.isArray(detalle)) return `${campo}: ${detalle.join(' ')}`
      if (detalle && typeof detalle === 'object') return `${campo}: ${JSON.stringify(detalle)}`
      return campo === 'detail' || campo === 'non_field_errors'
        ? String(detalle)
        : `${campo}: ${String(detalle)}`
    })
    .join(' ')
}

const decimalComoFraccion = (valor: string) => {
  const limpio = valor.trim()
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null
  const negativo = limpio.startsWith('-')
  const sinSigno = negativo ? limpio.slice(1) : limpio
  const [entero, decimales = ''] = sinSigno.split('.')
  const escala = 10n ** BigInt(decimales.length)
  const numero = BigInt(`${entero}${decimales}` || '0') * (negativo ? -1n : 1n)
  return { numero, escala }
}

const dividirASeisDecimales = (valor: string, cantidad: string) => {
  const dividendo = decimalComoFraccion(valor)
  const divisor = decimalComoFraccion(cantidad)
  if (!dividendo || !divisor || divisor.numero === 0n) return '0.000000'
  const negativo = (dividendo.numero < 0n) !== (divisor.numero < 0n)
  const numerador =
    (dividendo.numero < 0n ? -dividendo.numero : dividendo.numero) * divisor.escala * 1_000_000n
  const denominador = dividendo.escala * (divisor.numero < 0n ? -divisor.numero : divisor.numero)
  let resultado = numerador / denominador
  if ((numerador % denominador) * 2n >= denominador) resultado += 1n
  const texto = resultado.toString().padStart(7, '0')
  const formateado = `${texto.slice(0, -6)}.${texto.slice(-6)}`
  return negativo && resultado !== 0n ? `-${formateado}` : formateado
}

const etiquetaPeriodo = (periodo: Periodo) =>
  `${periodo.anio}-${String(periodo.mes).padStart(2, '0')} · ${periodo.estado}`

export const OperacionesInternasPage = () => {
  const { empresaActiva } = useAuth()
  const esAdmin = empresaActiva?.rol === 'ADMIN'
  const [tab, setTab] = useState<TabId>('saldos')
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [tiposOperacion, setTiposOperacion] = useState<TipoOperacion[]>([])
  const [saldos, setSaldos] = useState<SaldoInicial[]>([])
  const [notas, setNotas] = useState<NotaInterna[]>([])
  const [loading, setLoading] = useState(false)
  const [catalogosLoading, setCatalogosLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saldoFiltros, setSaldoFiltros] = useState({ periodo: '', almacen: '', producto: '', estado: '' })
  const [notaFiltros, setNotaFiltros] = useState({ periodo: '', almacen: '', tipo: '', estado: '', search: '' })
  const [saldoForm, setSaldoForm] = useState(SALDO_INICIAL)
  const [saldoEditando, setSaldoEditando] = useState<SaldoInicial | null>(null)
  const [saldoFormVisible, setSaldoFormVisible] = useState(false)
  const [notaForm, setNotaForm] = useState(NOTA_INICIAL)
  const [notaEditando, setNotaEditando] = useState<NotaInterna | null>(null)
  const [notaFormVisible, setNotaFormVisible] = useState(false)
  const requestRef = useRef(0)

  const periodosAbiertos = useMemo(
    () => periodos.filter((periodo) => periodo.estado === 'ABIERTO'),
    [periodos]
  )
  const periodoNotaSeleccionado = useMemo(
    () => periodosAbiertos.find((periodo) => String(periodo.id) === notaForm.periodo),
    [notaForm.periodo, periodosAbiertos]
  )
  const tiposInternos = useMemo(
    () =>
      tiposOperacion.filter(
        (tipo) =>
          tipo.activo &&
          tipo.es_interna &&
          tipo.origen_requerido === 'NOTA_INTERNA' &&
          (TIPOS_ESTANDAR.has(tipo.codigo_interno) || TIPOS_ADMIN.has(tipo.codigo_interno))
      ),
    [tiposOperacion]
  )
  const tiposSeleccionables = useMemo(
    () => tiposInternos.filter((tipo) => esAdmin || TIPOS_ESTANDAR.has(tipo.codigo_interno)),
    [esAdmin, tiposInternos]
  )
  const cppInformativo = useMemo(
    () => dividirASeisDecimales(saldoForm.valor_pen, saldoForm.cantidad),
    [saldoForm.cantidad, saldoForm.valor_pen]
  )
  const recursosFaltantes = useMemo(() => {
    const faltantes: string[] = []
    if (!periodosAbiertos.length) faltantes.push('períodos abiertos')
    if (!almacenes.length) faltantes.push('almacenes')
    if (!productos.length) faltantes.push('productos')
    if (tab === 'notas' && !tiposSeleccionables.length) faltantes.push('tipos de operación internos')
    return faltantes
  }, [almacenes.length, periodosAbiertos.length, productos.length, tab, tiposSeleccionables.length])

  const limpiarMensajes = () => {
    setError('')
    setSuccess('')
  }

  const cerrarFormularios = useCallback(() => {
    setSaldoFormVisible(false)
    setSaldoEditando(null)
    setSaldoForm(SALDO_INICIAL)
    setNotaFormVisible(false)
    setNotaEditando(null)
    setNotaForm(NOTA_INICIAL)
  }, [])

  const filtrosSaldoApi = useCallback(
    (): SaldoInicialFiltros => ({
      periodo_id: saldoFiltros.periodo ? Number(saldoFiltros.periodo) : undefined,
      almacen_id: saldoFiltros.almacen ? Number(saldoFiltros.almacen) : undefined,
      producto_id: saldoFiltros.producto ? Number(saldoFiltros.producto) : undefined,
      estado: saldoFiltros.estado ? (saldoFiltros.estado as EstadoSaldoInicial) : undefined,
    }),
    [saldoFiltros]
  )

  const filtrosNotaApi = useCallback(
    (): NotaInternaFiltros => ({
      periodo_id: notaFiltros.periodo ? Number(notaFiltros.periodo) : undefined,
      almacen_id: notaFiltros.almacen ? Number(notaFiltros.almacen) : undefined,
      tipo_operacion: notaFiltros.tipo || undefined,
      estado: notaFiltros.estado ? (notaFiltros.estado as EstadoNotaInterna) : undefined,
      search: notaFiltros.search.trim() || undefined,
    }),
    [notaFiltros]
  )

  const cargarLista = useCallback(async () => {
    if (!empresaActiva) return
    const requestId = ++requestRef.current
    setLoading(true)
    setError('')
    try {
      if (tab === 'saldos') {
        const data = await getSaldosIniciales(filtrosSaldoApi())
        if (requestId === requestRef.current) setSaldos(data)
      } else {
        const data = await getNotasInternas(filtrosNotaApi())
        if (requestId === requestRef.current) setNotas(data)
      }
    } catch (err) {
      if (requestId === requestRef.current) setError(extraerError(err))
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [empresaActiva, filtrosNotaApi, filtrosSaldoApi, tab])

  const empresaId = empresaActiva?.id
  useEffect(() => {
    requestRef.current += 1
    let ignorar = false
    // Vaciar los datos de la empresa anterior y cargar los catálogos de la nueva.
    diferirCarga(() => {
      if (ignorar) return
      cerrarFormularios()
      setPeriodos([])
      setAlmacenes([])
      setProductos([])
      setTiposOperacion([])
      setSaldos([])
      setNotas([])
      limpiarMensajes()
      if (!empresaId) return
      setCatalogosLoading(true)
      Promise.all([obtenerPeriodos(), getAlmacenes(), getProductos(), obtenerTiposOperacion()])
        .then(([nuevosPeriodos, nuevosAlmacenes, nuevosProductos, nuevosTipos]) => {
          if (ignorar) return
          setPeriodos(nuevosPeriodos)
          setAlmacenes(nuevosAlmacenes)
          setProductos(nuevosProductos)
          setTiposOperacion(nuevosTipos)
        })
        .catch((err) => {
          if (!ignorar) setError(extraerError(err))
        })
        .finally(() => {
          if (!ignorar) setCatalogosLoading(false)
        })
    })
    return () => {
      ignorar = true
    }
  }, [cerrarFormularios, empresaId])

  useEffect(() => {
    diferirCarga(cargarLista)
  }, [cargarLista])

  const ejecutar = async (accion: () => Promise<void>, mensaje: string) => {
    setSaving(true)
    limpiarMensajes()
    try {
      await accion()
      setSuccess(mensaje)
      return true
    } catch (err) {
      setError(extraerError(err))
      return false
    } finally {
      setSaving(false)
    }
  }

  const refrescar = async () => {
    try {
      await cargarLista()
    } catch {
      setError('El cambio se guardó, pero la lista no pudo actualizarse. Recarga la página.')
    }
  }

  const abrirNuevo = () => {
    limpiarMensajes()
    if (tab === 'saldos') {
      setSaldoEditando(null)
      setSaldoForm(SALDO_INICIAL)
      setSaldoFormVisible(true)
    } else {
      setNotaEditando(null)
      setNotaForm(NOTA_INICIAL)
      setNotaFormVisible(true)
    }
  }

  const cerrarSaldo = () => {
    setSaldoFormVisible(false)
  }
  const cerrarNota = () => {
    setNotaFormVisible(false)
  }

  const editarSaldo = async (saldo: SaldoInicial) => {
    limpiarMensajes()
    try {
      const detalle = await getSaldoInicial(saldo.id)
      setSaldoEditando(detalle)
      setSaldoForm({
        periodo: String(detalle.periodo),
        almacen: String(detalle.almacen),
        producto: String(detalle.producto),
        cantidad: detalle.cantidad,
        valor_pen: detalle.valor_pen,
      })
      setSaldoFormVisible(true)
    } catch (err) {
      setError(extraerError(err))
    }
  }

  const guardarSaldo = (event: FormEvent) => {
    event.preventDefault()
    void (async () => {
      const payload = {
        periodo: Number(saldoForm.periodo),
        almacen: Number(saldoForm.almacen),
        producto: Number(saldoForm.producto),
        cantidad: saldoForm.cantidad,
        valor_pen: saldoForm.valor_pen,
      }
      const guardado = await ejecutar(async () => {
        if (saldoEditando) await updateSaldoInicial(saldoEditando.id, payload)
        else await createSaldoInicial(payload)
      }, saldoEditando ? 'Saldo inicial actualizado.' : 'Saldo inicial creado.')
      if (!guardado) return
      cerrarSaldo()
      setSaldoEditando(null)
      setSaldoForm(SALDO_INICIAL)
      await refrescar()
    })()
  }

  const editarNota = async (nota: NotaInterna) => {
    limpiarMensajes()
    try {
      const detalle = await getNotaInterna(nota.id)
      setNotaEditando(detalle)
      setNotaForm({
        almacen: String(detalle.almacen),
        periodo: String(detalle.periodo),
        tipo_operacion: String(detalle.tipo_operacion),
        fecha: detalle.fecha,
        motivo: detalle.motivo,
        responsable: detalle.responsable ?? '',
        observacion: detalle.observacion ?? '',
        archivo_sustento: detalle.archivo_sustento ?? '',
        detalles: detalle.detalles.map((linea) => ({
          producto: linea.producto,
          cantidad_base: linea.cantidad_base,
          costo_unitario_pen: linea.costo_unitario_pen,
          valor_ajuste_pen: linea.valor_ajuste_pen,
        })),
      })
      setNotaFormVisible(true)
    } catch (err) {
      setError(extraerError(err))
    }
  }

  const actualizarLinea = (indice: number, cambio: Partial<NotaInternaDetallePayload>) => {
    setNotaForm((actual) => ({
      ...actual,
      detalles: actual.detalles.map((linea, posicion) =>
        posicion === indice ? { ...linea, ...cambio } : linea
      ),
    }))
  }

  const guardarNota = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const campoFecha = campoFechaNotaInterna(new FormData(event.currentTarget).get('fecha'))
    if (!campoFecha.fecha) {
      setError('La fecha debe tener el formato YYYY-MM-DD.')
      return
    }
    if (!notaForm.detalles.length || notaForm.detalles.some((linea) => !linea.producto)) {
      setError('Cada línea debe tener un producto y la nota debe contener al menos una línea.')
      return
    }
    void (async () => {
      const formularioEnviado = { ...notaForm, ...campoFecha }
      const payload = {
        almacen: Number(formularioEnviado.almacen),
        periodo: Number(formularioEnviado.periodo),
        tipo_operacion: Number(formularioEnviado.tipo_operacion),
        fecha: formularioEnviado.fecha,
        motivo: formularioEnviado.motivo,
        responsable: formularioEnviado.responsable || null,
        observacion: formularioEnviado.observacion || null,
        archivo_sustento: formularioEnviado.archivo_sustento || null,
        detalles: formularioEnviado.detalles.map((linea) => ({
          ...linea,
          costo_unitario_pen: esAdmin ? linea.costo_unitario_pen || null : null,
          valor_ajuste_pen: esAdmin ? linea.valor_ajuste_pen || null : null,
        })),
      }
      const guardado = await ejecutar(async () => {
        if (notaEditando) await updateNotaInterna(notaEditando.id, payload)
        else await createNotaInterna(payload)
      }, notaEditando ? 'Nota interna actualizada.' : 'Nota interna creada.')
      const formularioConservado = formularioNotaTrasRespuesta(formularioEnviado, guardado)
      if (formularioConservado) {
        setNotaForm(formularioConservado)
        return
      }
      cerrarNota()
      setNotaEditando(null)
      setNotaForm(NOTA_INICIAL)
      await refrescar()
    })()
  }

  const notaRequiereAdmin = (nota: NotaInterna) =>
    TIPOS_ADMIN.has(nota.tipo_operacion_codigo) ||
    nota.detalles.some((linea) => linea.costo_unitario_pen !== null || linea.valor_ajuste_pen !== null)

  const anularNota = async (nota: NotaInterna) => {
    if (!window.confirm(`¿Anular la nota interna #${nota.id}? Esta acción no confirma ni genera Kardex.`))
      return
    const guardado = await ejecutar(async () => {
      await anularNotaInterna(nota.id)
    }, `Nota interna #${nota.id} anulada.`)
    if (guardado) await refrescar()
  }

  const confirmarSaldo = async (saldo: SaldoInicial) => {
    if (!window.confirm(`¿Confirmar el saldo inicial de ${saldo.producto_codigo}? Impactará stock en Kardex.`))
      return
    const guardado = await ejecutar(async () => {
      await confirmarSaldoInicial(saldo.id)
    }, 'Saldo inicial confirmado y aplicado al Kardex.')
    if (guardado) await refrescar()
  }

  const confirmarNota = async (nota: NotaInterna) => {
    if (!window.confirm(`¿Confirmar la nota interna #${nota.id}? Impactará stock y CPP en Kardex.`))
      return
    const guardado = await ejecutar(async () => {
      await confirmarNotaInterna(nota.id)
    }, `Nota interna #${nota.id} confirmada y aplicada al Kardex.`)
    if (guardado) await refrescar()
  }

  const seleccionarPeriodoNota = (periodoId: string) => {
    setNotaForm((actual) => ({
      ...actual,
      periodo: periodoId,
    }))
  }

  if (!empresaActiva) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-slate-200">
        <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
          <Building2 className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Selecciona una Empresa Activa</h2>
        <p className="text-xs text-slate-500 mb-4 max-w-sm">
          Los saldos iniciales y notas internas siempre operan bajo aislamiento multi-tenant estricto.
        </p>
        <Link to="/empresas">
          <Button variant="primary">Ir a Empresas</Button>
        </Link>
      </div>
    )
  }

  const tienePermisoCrear = tab === 'notas' || esAdmin
  const puedeCrear = tienePermisoCrear && recursosFaltantes.length === 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operaciones Internas de Inventario"
        description="Captura de saldos iniciales y notas de merma, desmedro, consumo interno y ajustes valorizados."
        icon={<ClipboardList className="h-5 w-5" />}
        badge={
          <Badge variant={esAdmin ? 'info' : 'neutral'}>
            {esAdmin ? 'Control Administrativo (ADMIN)' : 'Operación Estándar'}
          </Badge>
        }
        actions={
          <Button
            variant="primary"
            onClick={abrirNuevo}
            disabled={!puedeCrear || catalogosLoading}
            title={
              !tienePermisoCrear
                ? 'Los saldos iniciales requieren rol ADMIN'
                : recursosFaltantes.length
                ? `Faltan: ${recursosFaltantes.join(', ')}`
                : undefined
            }
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo {tab === 'saldos' ? 'Saldo Inicial' : 'Nota Interna'}
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

      {!catalogosLoading && recursosFaltantes.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <span>
            <strong>Configuración pendiente:</strong> Para crear registros faltan {recursosFaltantes.join(', ')}.
          </span>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(val) => {
          setTab(val as TabId)
          cerrarFormularios()
          limpiarMensajes()
        }}
      >
        <TabsList>
          <TabsTrigger value="saldos" icon={<PackagePlus className="h-3.5 w-3.5" />}>
            Saldos Iniciales ({saldos.length})
          </TabsTrigger>
          <TabsTrigger value="notas" icon={<FileWarning className="h-3.5 w-3.5" />}>
            Notas Internas: Mermas, Desmedros y Ajustes ({notas.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SALDOS INICIALES */}
        <TabsContent value="saldos" className="space-y-4">
          {/* Barra de Filtros */}
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label>Período</Label>
                  <Select
                    value={saldoFiltros.periodo}
                    onChange={(e) => setSaldoFiltros({ ...saldoFiltros, periodo: e.target.value })}
                  >
                    <option value="">Todos los períodos</option>
                    {periodos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {etiquetaPeriodo(p)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Almacén</Label>
                  <Select
                    value={saldoFiltros.almacen}
                    onChange={(e) => setSaldoFiltros({ ...saldoFiltros, almacen: e.target.value })}
                  >
                    <option value="">Todos los almacenes</option>
                    {almacenes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.codigo} · {a.nombre}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Producto</Label>
                  <Select
                    value={saldoFiltros.producto}
                    onChange={(e) => setSaldoFiltros({ ...saldoFiltros, producto: e.target.value })}
                  >
                    <option value="">Todos los productos</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo_interno} · {p.descripcion}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Estado</Label>
                  <Select
                    value={saldoFiltros.estado}
                    onChange={(e) => setSaldoFiltros({ ...saldoFiltros, estado: e.target.value })}
                  >
                    <option value="">Todos los estados</option>
                    <option value="BORRADOR">Borrador</option>
                    <option value="CONFIRMADO">Confirmado</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de Saldos */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Unidad Base</TableHead>
                    <TableHead numeric>Cantidad</TableHead>
                    <TableHead numeric>Valor Total PEN</TableHead>
                    <TableHead numeric>CPP Inicial</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                        Cargando saldos iniciales...
                      </TableCell>
                    </TableRow>
                  ) : saldos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                        No hay saldos iniciales registrados para los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    saldos.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-semibold text-slate-800">{s.periodo_descripcion}</TableCell>
                        <TableCell>
                          <span className="font-mono text-xs font-bold text-slate-900">{s.almacen_codigo}</span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-xs">{s.almacen_nombre}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs font-bold text-slate-900">{s.producto_codigo}</span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-xs">{s.producto_descripcion}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {s.unidad_base_codigo || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell numeric className="font-bold text-slate-800">
                          {formatearDecimal(s.cantidad, { min: 4, max: 8 })}
                        </TableCell>
                        <TableCell numeric className="font-bold text-slate-900">
                          S/ {formatearDecimal(s.valor_pen)}
                        </TableCell>
                        <TableCell numeric className="font-bold text-indigo-700">
                          S/ {formatearDecimal(s.cpp_inicial, { min: 6, max: 6 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.estado === 'CONFIRMADO' ? 'success' : 'warning'} dot>
                            {s.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {esAdmin && s.estado === 'BORRADOR' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={() => void editarSaldo(s)}
                              >
                                <Pencil className="h-3 w-3 mr-1 text-slate-500" /> Editar
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                variant="primary"
                                onClick={() => void confirmarSaldo(s)}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar
                              </Button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: NOTAS INTERNAS */}
        <TabsContent value="notas" className="space-y-4">
          {/* Barra de Filtros */}
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <Label>Período</Label>
                  <Select
                    value={notaFiltros.periodo}
                    onChange={(e) => setNotaFiltros({ ...notaFiltros, periodo: e.target.value })}
                  >
                    <option value="">Todos los períodos</option>
                    {periodos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {etiquetaPeriodo(p)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Almacén</Label>
                  <Select
                    value={notaFiltros.almacen}
                    onChange={(e) => setNotaFiltros({ ...notaFiltros, almacen: e.target.value })}
                  >
                    <option value="">Todos los almacenes</option>
                    {almacenes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.codigo} · {a.nombre}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Tipo de Operación</Label>
                  <Select
                    value={notaFiltros.tipo}
                    onChange={(e) => setNotaFiltros({ ...notaFiltros, tipo: e.target.value })}
                  >
                    <option value="">Todos los tipos</option>
                    {tiposInternos.map((t) => (
                      <option key={t.id} value={t.codigo_interno}>
                        {t.codigo_interno} · {t.descripcion}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Estado</Label>
                  <Select
                    value={notaFiltros.estado}
                    onChange={(e) => setNotaFiltros({ ...notaFiltros, estado: e.target.value })}
                  >
                    <option value="">Todos los estados</option>
                    <option value="BORRADOR">Borrador</option>
                    <option value="CONFIRMADO">Confirmado</option>
                    <option value="ANULADO">Anulado</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Buscar Motivo / Responsable</Label>
                  <Input
                    placeholder="Merma, Ajuste..."
                    value={notaFiltros.search}
                    onChange={(e) => setNotaFiltros({ ...notaFiltros, search: e.target.value })}
                    leftIcon={<Search className="h-4 w-4" />}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de Notas */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16"># ID</TableHead>
                    <TableHead className="w-24">Fecha</TableHead>
                    <TableHead className="w-32">Período</TableHead>
                    <TableHead className="w-36">Almacén</TableHead>
                    <TableHead className="w-48">Tipo de Operación</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="w-32">Responsable</TableHead>
                    <TableHead className="w-28">Estado</TableHead>
                    <TableHead numeric className="w-16">Líneas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-slate-400 text-xs">
                        No hay notas internas registradas para los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    notas.map((nota) => {
                      const puedeGestionar = nota.estado === 'BORRADOR' && (esAdmin || !notaRequiereAdmin(nota))
                      return (
                        <TableRow key={nota.id}>
                          <TableCell numeric className="font-bold text-slate-900">
                            #{nota.id}
                          </TableCell>
                          <TableCell numeric className="text-slate-600">
                            {nota.fecha}
                          </TableCell>
                          <TableCell className="text-slate-700 text-xs">{nota.periodo_descripcion}</TableCell>
                          <TableCell>
                            <span className="font-mono text-xs font-bold text-slate-900">{nota.almacen_codigo}</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-xs">{nota.almacen_nombre}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <Badge
                                variant={
                                  nota.tipo_operacion_codigo.includes('AJUSTE')
                                    ? 'warning'
                                    : 'info'
                                }
                                size="sm"
                              >
                                {nota.tipo_operacion_codigo}
                              </Badge>
                              <span className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                                {nota.tipo_operacion_descripcion}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-slate-800 text-xs max-w-xs truncate">
                            {nota.motivo}
                          </TableCell>
                          <TableCell className="text-slate-600 text-xs">{nota.responsable || '—'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                nota.estado === 'CONFIRMADO'
                                  ? 'success'
                                  : nota.estado === 'ANULADO'
                                  ? 'destructive'
                                  : 'warning'
                              }
                              dot
                            >
                              {nota.estado}
                            </Badge>
                          </TableCell>
                          <TableCell numeric className="font-bold text-slate-700">
                            {nota.numero_lineas}
                          </TableCell>
                          <TableCell className="text-right">
                            {puedeGestionar ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  onClick={() => void editarNota(nota)}
                                >
                                  <Pencil className="h-3 w-3 mr-1 text-slate-500" /> Editar
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="primary"
                                  onClick={() => void confirmarNota(nota)}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => void anularNota(nota)}
                                  className="text-rose-600 hover:bg-rose-50"
                                >
                                  <Ban className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Saldo Inicial */}
      {saldoFormVisible && (
        <Modal
          isOpen={saldoFormVisible}
          onClose={cerrarSaldo}
          title={saldoEditando ? 'Editar Saldo Inicial' : 'Registrar Saldo Inicial'}
          description="Afecta el inventario de apertura del período. El CPP se calculará de forma definitiva."
          icon={<PackagePlus className="h-5 w-5" />}
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={cerrarSaldo}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={guardarSaldo} isLoading={saving}>
                <Save className="h-4 w-4 mr-1.5" />
                {saldoEditando ? 'Guardar Cambios' : 'Crear Saldo'}
              </Button>
            </div>
          }
        >
          <form onSubmit={guardarSaldo} className="space-y-4">
            <div className="space-y-1.5">
              <Label required>Período Contable Abierto</Label>
              <Select
                required
                value={saldoForm.periodo}
                onChange={(e) => setSaldoForm({ ...saldoForm, periodo: e.target.value })}
              >
                <option value="">Seleccionar Período Abierto</option>
                {periodosAbiertos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {etiquetaPeriodo(p)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label required>Almacén Físico</Label>
                <Select
                  required
                  value={saldoForm.almacen}
                  onChange={(e) => setSaldoForm({ ...saldoForm, almacen: e.target.value })}
                >
                  <option value="">Seleccionar Almacén</option>
                  {almacenes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigo} · {a.nombre}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label required>Producto en Existencia</Label>
                <Select
                  required
                  value={saldoForm.producto}
                  onChange={(e) => setSaldoForm({ ...saldoForm, producto: e.target.value })}
                >
                  <option value="">Seleccionar Producto</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codigo_interno} · {p.descripcion}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label required>Cantidad Inicial (Unidad Base)</Label>
                <Input
                  required
                  inputMode="decimal"
                  pattern="^\d+(\.\d{1,8})?$"
                  placeholder="Ej. 100.00000000"
                  value={saldoForm.cantidad}
                  onChange={(e) => setSaldoForm({ ...saldoForm, cantidad: e.target.value })}
                  className="font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <Label required>Valor Total PEN</Label>
                <Input
                  required
                  inputMode="decimal"
                  pattern="^-?\d+(\.\d{1,8})?$"
                  placeholder="Ej. 2500.00"
                  value={saldoForm.valor_pen}
                  onChange={(e) => setSaldoForm({ ...saldoForm, valor_pen: e.target.value })}
                  className="font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 flex items-center justify-between">
              <div>
                <span className="text-xs text-indigo-900 font-semibold block">CPP Inicial Informativo:</span>
                <span className="text-[10px] text-slate-500">Cálculo ROUND_HALF_UP a 6 decimales</span>
              </div>
              <strong className="font-mono text-base text-indigo-700 tabular-nums">
                S/ {cppInformativo}
              </strong>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Nota Interna */}
      {notaFormVisible && (
        <Modal
          isOpen={notaFormVisible}
          onClose={cerrarNota}
          maxWidth="4xl"
          title={notaEditando ? `Editar Nota Interna #${notaEditando.id}` : 'Nueva Nota Interna de Inventario'}
          description={
            esAdmin
              ? 'Habilitado para operaciones estándar y ajustes valorizados manuales.'
              : 'Operaciones estándar (mermas, desmedros, consumos).'
          }
          icon={<FileWarning className="h-5 w-5" />}
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={cerrarNota}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const form = document.getElementById('form-nota-interna') as HTMLFormElement
                  if (form) form.requestSubmit()
                }}
                isLoading={saving}
              >
                <Save className="h-4 w-4 mr-1.5" />
                {notaEditando ? 'Guardar Nota' : 'Crear Nota'}
              </Button>
            </div>
          }
        >
          <form id="form-nota-interna" onSubmit={guardarNota} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label required>Período Contable</Label>
                <Select
                  required
                  value={notaForm.periodo}
                  onChange={(e) => seleccionarPeriodoNota(e.target.value)}
                >
                  <option value="">Seleccionar Período</option>
                  {periodosAbiertos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {etiquetaPeriodo(p)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <Label required>Almacén</Label>
                <Select
                  required
                  value={notaForm.almacen}
                  onChange={(e) => setNotaForm((actual) => ({ ...actual, almacen: e.target.value }))}
                >
                  <option value="">Seleccionar Almacén</option>
                  {almacenes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigo} · {a.nombre}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <Label required>Fecha</Label>
                <Input
                  required
                  name="fecha"
                  type="date"
                  min={periodoNotaSeleccionado?.fecha_inicio}
                  max={periodoNotaSeleccionado?.fecha_fin}
                  value={notaForm.fecha}
                  onChange={(e) => setNotaForm((actual) => ({ ...actual, fecha: e.target.value }))}
                  className="font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label required>Tipo de Operación Interna</Label>
              <Select
                required
                value={notaForm.tipo_operacion}
                onChange={(e) => setNotaForm((actual) => ({ ...actual, tipo_operacion: e.target.value }))}
              >
                <option value="">Seleccionar Tipo de Operación</option>
                {tiposSeleccionables.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.codigo_interno} · {tipo.descripcion}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label required>Motivo o Justificación</Label>
              <textarea
                required
                maxLength={500}
                rows={2}
                placeholder="Explicación detallada de la merma, desmedro o ajuste..."
                value={notaForm.motivo}
                onChange={(e) => setNotaForm((actual) => ({ ...actual, motivo: e.target.value }))}
                className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-900 shadow-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Responsable / Operador</Label>
                <Input
                  maxLength={200}
                  placeholder="Nombre de quien reporta o autoriza"
                  value={notaForm.responsable}
                  onChange={(e) => setNotaForm((actual) => ({ ...actual, responsable: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Referencia o Sustento</Label>
                <Input
                  maxLength={500}
                  placeholder="N° Acta, Informe o Ticket"
                  value={notaForm.archivo_sustento}
                  onChange={(e) => setNotaForm((actual) => ({ ...actual, archivo_sustento: e.target.value }))}
                />
              </div>
            </div>

            {/* Líneas de Detalle */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Líneas de Detalle de Productos
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {notaForm.detalles.length} {notaForm.detalles.length === 1 ? 'línea' : 'líneas'} en borrador
                  </span>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() =>
                    setNotaForm((actual) => ({
                      ...actual,
                      detalles: [...actual.detalles, LINEA_INICIAL()],
                    }))
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Agregar Línea
                </Button>
              </div>

              <div className="space-y-2">
                {notaForm.detalles.map((linea, indice) => (
                  <div
                    key={indice}
                    className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50"
                  >
                    <span className="font-mono text-xs font-bold text-slate-400 px-1">{indice + 1}</span>

                    <div className="flex-1 space-y-1">
                      <Label required>Producto</Label>
                      <Select
                        required
                        value={linea.producto || ''}
                        onChange={(e) => actualizarLinea(indice, { producto: Number(e.target.value) })}
                      >
                        <option value="">Seleccionar Producto</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.codigo_interno} · {p.descripcion}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="w-full sm:w-32 space-y-1">
                      <Label required>Cantidad Base</Label>
                      <Input
                        required
                        inputMode="decimal"
                        pattern="^\d+(\.\d{1,8})?$"
                        placeholder="1.0000"
                        value={linea.cantidad_base}
                        onChange={(e) => actualizarLinea(indice, { cantidad_base: e.target.value })}
                        className="font-mono tabular-nums"
                      />
                    </div>

                    {esAdmin && (
                      <div className="w-full sm:w-32 space-y-1">
                        <Label>Costo Unit. PEN</Label>
                        <Input
                          inputMode="decimal"
                          pattern="^-?\d+(\.\d{1,8})?$"
                          placeholder="Auto"
                          value={linea.costo_unitario_pen ?? ''}
                          onChange={(e) =>
                            actualizarLinea(indice, { costo_unitario_pen: e.target.value || null })
                          }
                          className="font-mono tabular-nums"
                        />
                      </div>
                    )}

                    {esAdmin && (
                      <div className="w-full sm:w-32 space-y-1">
                        <Label>Valor Ajuste PEN</Label>
                        <Input
                          inputMode="decimal"
                          pattern="^-?\d+(\.\d{1,8})?$"
                          placeholder="Auto"
                          value={linea.valor_ajuste_pen ?? ''}
                          onChange={(e) =>
                            actualizarLinea(indice, { valor_ajuste_pen: e.target.value || null })
                          }
                          className="font-mono tabular-nums"
                        />
                      </div>
                    )}

                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={notaForm.detalles.length === 1}
                      onClick={() =>
                        setNotaForm((actual) => ({
                          ...actual,
                          detalles: actual.detalles.filter((_, posicion) => posicion !== indice),
                        }))
                      }
                      className="text-slate-400 hover:text-rose-600 self-center sm:self-end mb-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default OperacionesInternasPage
