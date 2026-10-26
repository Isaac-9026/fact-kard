import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CONFIG_VISTAS, claseInicialNuevo, filtrosApiDocumentos, tiposComprobanteDeVista, type VistaDocumentos,
} from '../../utils/vistaDocumentos'
import {
  FileSpreadsheet,
  Plus,
  Eye,
  CheckCheck,
  CheckCircle2,
  Ban,
  Search,
  AlertCircle,
  Trash2,
  Receipt,
} from 'lucide-react'
import {
  obtenerDocumentos,
  obtenerDocumentosPaginados,
  obtenerDocumento,
  crearDocumento,
  revisarDocumento,
  confirmarDocumento,
  anularDocumento,
} from '../../api/documentos'
import type {
  Documento,
  ClaseDocumento,
  EstadoDocumental,
  EstadoRevision,
  CrearDocumentoPayload,
} from '../../api/documentos'
import { obtenerPeriodos } from '../../api/periodos'
import type { Periodo } from '../../api/periodos'
import {
  obtenerTiposComprobante,
  obtenerTiposOperacion,
  resolverTipoCambio,
} from '../../api/catalogos'
import type {
  TipoComprobante,
  TipoOperacion,
  TipoCambioResolverResult,
} from '../../api/catalogos'
import {
  getProductos,
  getProductoUnidades,
  getAlmacenes,
  getTerceros,
} from '../../api/inventario'
import type {
  Producto,
  ProductoUnidad,
  Almacen,
  Tercero,
} from '../../api/inventario'
import { useAuth } from '../../context/useAuth'
import { fechaCalendarioLocal } from '../../utils/date'
import { PageHeader } from '../../components/ui/page-header'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { cantidadBase, importeLinea, totalesDocumento } from '../../utils/documentoCalculo'
import { esMayorQueCero, formatearDecimal } from '../../utils/decimal'
import { AFECTACIONES_IGV, TASA_IGV_POR_DEFECTO_PCT, igvEditable, igvSugerido, tasaVigente, type AfectacionIgv, type TasaIgvVigencia } from '../../utils/afectacionIgv'
import { obtenerConfigEmpresa } from '../../api/empresas'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Label } from '../../components/ui/label'
import { Modal } from '../../components/ui/modal'
import { Paginacion } from '../../components/ui/paginacion'
import { diferirCarga } from '../../utils/efectos'
import { useValorDiferido } from '../../utils/useValorDiferido'
import {
  PAGE_SIZE_DEFECTO, claveConsulta, irAPagina, paginaVigente, paramsPaginacion, type EstadoPagina,
} from '../../utils/paginacion'

interface LineaFormulario {
  tempId: string
  productoId: number | ''
  productoUnidadId: number | ''
  almacenId: number | ''
  tipoOperacionId: number | ''
  cantidadOriginal: string
  precioUnitario: string
  igv: string
  afectacionIgv: AfectacionIgv
  esBonificacion: boolean
  descripcionOriginal: string
  detalleOrigenId?: number | ''
  unidadesDisponibles: ProductoUnidad[]
  /** Texto decimal tal como lo entrega la API (sin pasar por float). */
  factorConversion: string
}

export interface DocumentosPageProps {
  /**
   * Navegación por flujo: Compras, Ventas y Notas reutilizan esta misma pantalla con
   * filtros fijos (utils/vistaDocumentos.ts). 'TODOS' = Comprobantes, sin cambios.
   */
  vista?: VistaDocumentos
}

export const DocumentosPage: React.FC<DocumentosPageProps> = ({ vista = 'TODOS' }) => {
  const { empresaActiva } = useAuth()
  const configVista = CONFIG_VISTAS[vista]
  const [searchParams, setSearchParams] = useSearchParams()

  // Master Data
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [tiposComprobante, setTiposComprobante] = useState<TipoComprobante[]>([])
  const [tiposOperacion, setTiposOperacion] = useState<TipoOperacion[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [terceros, setTerceros] = useState<Tercero[]>([])
  // Bloque 4: tasa del IGV configurada para la empresa (solo para sugerir; valida el backend)
  const [tasaIgvActual, setTasaIgvActual] = useState<string>(TASA_IGV_POR_DEFECTO_PCT)
  const [tasasIgv, setTasasIgv] = useState<TasaIgvVigencia[]>([])

  // Filters
  const [filtroClase, setFiltroClase] = useState<ClaseDocumento | ''>('')
  const [filtroPeriodo, setFiltroPeriodo] = useState<number | ''>('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoDocumental | ''>('')
  const [filtroRevision, setFiltroRevision] = useState<EstadoRevision | ''>('')
  const [filtroBusqueda, setFiltroBusqueda] = useState('')
  const busqueda = useValorDiferido(filtroBusqueda.trim())

  // Bloque 7: los filtros se aplican en el servidor y la lista llega por páginas.
  // Cambiar de empresa o de filtro vuelve a la página 1.
  const empresaId = empresaActiva?.id
  const [totalDocumentos, setTotalDocumentos] = useState(0)
  const [estadoPagina, setEstadoPagina] = useState<EstadoPagina>({ clave: '', page: 1 })
  const claveFiltros = claveConsulta(empresaId, vista, filtroClase, filtroPeriodo, filtroEstado, filtroRevision, busqueda)
  const page = paginaVigente(estadoPagina, claveFiltros)
  // Comprobantes que pueden ser origen de una nota (lista completa, solo al registrar una nota).
  const [documentosOrigen, setDocumentosOrigen] = useState<Documento[]>([])

  // UI States
  const [cargando, setCargando] = useState(false)
  const [catalogosCargados, setCatalogosCargados] = useState(false)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)
  const [exitoGlobal, setExitoGlobal] = useState<string | null>(null)

  // Modals
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false)
  const [modalDetalleDocumento, setModalDetalleDocumento] = useState<Documento | null>(null)
  const [modalRevisionDoc, setModalRevisionDoc] = useState<Documento | null>(null)
  const [modalAnulacionDoc, setModalAnulacionDoc] = useState<Documento | null>(null)

  // Form State (New Document)
  const [formClase, setFormClase] = useState<ClaseDocumento>('COMPRA')
  const [formPeriodo, setFormPeriodo] = useState<number | ''>('')
  const [formTipoComprobante, setFormTipoComprobante] = useState<number | ''>('')
  const [formTercero, setFormTercero] = useState<number | ''>('')
  const [formSerie, setFormSerie] = useState('')
  const [formNumero, setFormNumero] = useState('')
  const [formFechaEmision, setFormFechaEmision] = useState(fechaCalendarioLocal)
  const [formMoneda, setFormMoneda] = useState<'PEN' | 'USD'>('PEN')
  const [formDocOrigen, setFormDocOrigen] = useState<number | ''>('')
  const [tcResuelto, setTcResuelto] = useState<TipoCambioResolverResult | null>(null)
  const [cargandoTc, setCargandoTc] = useState(false)
  const [guardandoDoc, setGuardandoDoc] = useState(false)

  // Detail Lines
  const [lineas, setLineas] = useState<LineaFormulario[]>([])

  // Revision Modal Action
  const [revEstadoSeleccionado, setRevEstadoSeleccionado] = useState<EstadoRevision>('REVISADO')
  const [revMotivo, setRevMotivo] = useState('')
  const [anulacionMotivo, setAnulacionMotivo] = useState('')

  // Página actual de documentos con los filtros vigentes.
  const cargarDocumentos = useCallback(async () => {
    if (!empresaId) return
    setCargando(true)
    try {
      const data = await obtenerDocumentosPaginados(
        filtrosApiDocumentos(vista, {
          clase: filtroClase || undefined,
          periodo: filtroPeriodo || undefined,
          estado: filtroEstado || undefined,
          estado_revision: filtroRevision || undefined,
          search: busqueda || undefined,
        }),
        paramsPaginacion(page),
      )
      setDocumentos(data.results)
      setTotalDocumentos(data.count)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setErrorGlobal(axiosErr.response?.data?.detail || 'Error al cargar los datos del sistema.')
    } finally {
      setCargando(false)
    }
  }, [empresaId, vista, filtroClase, filtroPeriodo, filtroEstado, filtroRevision, busqueda, page])

  useEffect(() => {
    diferirCarga(cargarDocumentos)
  }, [cargarDocumentos])

  // Cargar catálogos
  const cargarCatalogosYDocumentos = useCallback(async () => {
    setCargando(true)
    setErrorGlobal(null)
    try {
      const [pers, comps, ops, prods, alms, tercs] = await Promise.all([
        obtenerPeriodos(),
        obtenerTiposComprobante(),
        obtenerTiposOperacion(),
        getProductos(),
        getAlmacenes(),
        getTerceros(),
      ])
      setPeriodos(pers)
      setTiposComprobante(comps.filter((c) => c.activo))
      setTiposOperacion(ops.filter((o) => o.activo))
      setProductos(prods.filter((p) => p.estado === 'ACTIVO'))
      setAlmacenes(alms.filter((a) => a.activo))
      setTerceros(tercs.filter((t) => t.estado === 'ACTIVO'))

      const periodoAbierto = pers.find((p) => p.estado === 'ABIERTO')
      if (periodoAbierto) {
        setFormPeriodo(periodoAbierto.id)
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setErrorGlobal(axiosErr.response?.data?.detail || 'Error al cargar los datos del sistema.')
    } finally {
      setCargando(false)
      setCatalogosCargados(true)
    }
  }, [])

  useEffect(() => {
    diferirCarga(cargarCatalogosYDocumentos)
  }, [cargarCatalogosYDocumentos, empresaActiva?.id])

  useEffect(() => {
    obtenerConfigEmpresa()
      .then((config) => {
        setTasaIgvActual(config.tasa_igv_pct || TASA_IGV_POR_DEFECTO_PCT)
        setTasasIgv(config.tasas_igv ?? [])
      })
      .catch(() => setTasaIgvActual(TASA_IGV_POR_DEFECTO_PCT))
  }, [empresaActiva?.id])

  // Resolver Tipo de Cambio automáticamente cuando la moneda sea USD y cambie la fecha
  useEffect(() => {
    diferirCarga(() => {
      if (formMoneda === 'USD' && formFechaEmision) {
        setCargandoTc(true)
        resolverTipoCambio('USD', formFechaEmision)
          .then((res) => {
            setTcResuelto(res)
          })
          .catch(() => {
            setTcResuelto(null)
          })
          .finally(() => {
            setCargandoTc(false)
          })
      } else {
        setTcResuelto(null)
      }
    })
  }, [formMoneda, formFechaEmision])

  const tipoCompSeleccionado = useMemo(() => {
    return tiposComprobante.find((c) => c.id === formTipoComprobante)
  }, [tiposComprobante, formTipoComprobante])

  const esNota = Boolean(tipoCompSeleccionado?.es_nota)

  const rucEmisorDisplay = useMemo(() => {
    if (formClase === 'VENTA') {
      return empresaActiva?.ruc || 'RUC Empresa Activa'
    }
    const t = terceros.find((ter) => ter.id === formTercero)
    return t ? t.numero_documento : 'Pendiente de selección'
  }, [formClase, formTercero, empresaActiva?.ruc, terceros])

  const lineaVacia = useCallback((): LineaFormulario => ({
    tempId: Math.random().toString(36).substring(2, 9),
    productoId: '',
    productoUnidadId: '',
    almacenId: almacenes[0]?.id || '',
    tipoOperacionId: tiposOperacion[0]?.id || '',
    cantidadOriginal: '1.00000000',
    precioUnitario: '0.00000000',
    igv: '0.00000000',
    afectacionIgv: 'GRAVADO',
    esBonificacion: false,
    descripcionOriginal: '',
    unidadesDisponibles: [],
    factorConversion: '1',
  }), [almacenes, tiposOperacion])

  const agregarLinea = () => {
    setLineas((prev) => [...prev, lineaVacia()])
  }

  const eliminarLinea = (tempId: string) => {
    setLineas((prev) => prev.filter((l) => l.tempId !== tempId))
  }

  // Bloque 9: IGV sugerido en decimal exacto (= igv_esperado del backend), con la naturaleza
  // de la operación (un ajuste de valor sin cantidad usa el precio como base).
  const sugerirIgvLinea = (linea: LineaFormulario, tasaPct: string) => {
    const naturaleza = tiposOperacion.find((t) => t.id === linea.tipoOperacionId)?.naturaleza
    return igvSugerido(linea.afectacionIgv, linea.cantidadOriginal, linea.precioUnitario, tasaPct, naturaleza)
  }

  // Al cambiar la fecha puede cambiar la tasa vigente (Bloque 5): se vuelve a sugerir el IGV.
  const cambiarFechaEmision = (fecha: string) => {
    setFormFechaEmision(fecha)
    const tasa = tasaVigente(tasasIgv, fecha, tasaIgvActual)
    setLineas((prev) => prev.map((l) => {
      if (l.esBonificacion) return l
      const sugerido = sugerirIgvLinea(l, tasa)
      return sugerido === null ? l : { ...l, igv: sugerido }
    }))
  }

  const actualizarLinea = async (tempId: string, campo: string, valor: unknown) => {
    setLineas((prev) =>
      prev.map((l) => {
        if (l.tempId !== tempId) return l
        const actualizada = { ...l, [campo]: valor }

        if (campo === 'precioUnitario' || campo === 'cantidadOriginal' || campo === 'afectacionIgv' || campo === 'tipoOperacionId') {
          if (!actualizada.esBonificacion) {
            const sugerido = sugerirIgvLinea(actualizada, tasaVigente(tasasIgv, formFechaEmision, tasaIgvActual))
            if (sugerido !== null) actualizada.igv = sugerido
          }
        }

        if (campo === 'esBonificacion') {
          // Una bonificación es una transferencia gratuita (el backend lo exige).
          actualizada.afectacionIgv = valor === true ? 'GRATUITO' : 'GRAVADO'
          if (valor === true) {
            actualizada.precioUnitario = '0.00000000'
            actualizada.igv = '0.00000000'
          }
        }

        return actualizada
      })
    )

    if (campo === 'productoId' && valor) {
      try {
        const unidades = await getProductoUnidades(Number(valor))
        const unidadBase = unidades.find((u) => u.es_base) || unidades[0]
        setLineas((prev) =>
          prev.map((l) => {
            if (l.tempId !== tempId) return l
            return {
              ...l,
              unidadesDisponibles: unidades,
              productoUnidadId: unidadBase ? unidadBase.id : '',
              factorConversion: unidadBase ? unidadBase.factor_a_base : '1',
            }
          })
        )
      } catch {
        // Fallback silently
      }
    }

    if (campo === 'productoUnidadId' && valor) {
      setLineas((prev) =>
        prev.map((l) => {
          if (l.tempId !== tempId) return l
          const u = l.unidadesDisponibles.find((unit) => unit.id === Number(valor))
          return {
            ...l,
            factorConversion: u ? u.factor_a_base : '1',
          }
        })
      )
    }
  }

  // Totales en vivo
  // Los importes del formulario están en la moneda del comprobante (no se convierten a PEN aquí).
  const simboloMoneda = formMoneda === 'USD' ? 'US$' : 'S/'

  // Bloque 9: mismos totales que guardará el backend (decimal exacto, ROUND_HALF_UP).
  const totalesCalculados = useMemo(() => {
    const t = totalesDocumento(lineas.map((l) => ({ cantidad: l.cantidadOriginal, precio: l.precioUnitario, igv: l.igv })))
    return { subtotal: formatearDecimal(t.subtotal), igv: formatearDecimal(t.igv), total: formatearDecimal(t.total) }
  }, [lineas])

  const handleGuardarDocumento = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorGlobal(null)
    setExitoGlobal(null)

    if (!formPeriodo) {
      setErrorGlobal('Debe seleccionar un período contable.')
      return
    }
    if (!formTipoComprobante) {
      setErrorGlobal('Debe seleccionar el tipo de comprobante.')
      return
    }
    if (!formSerie.trim()) {
      setErrorGlobal('Debe ingresar la serie del comprobante.')
      return
    }
    if (!formNumero.trim()) {
      setErrorGlobal('Debe ingresar el número del comprobante.')
      return
    }
    if (formClase === 'COMPRA' && !formTercero) {
      setErrorGlobal('Debe seleccionar el proveedor del comprobante.')
      return
    }
    if (esNota && !formDocOrigen) {
      setErrorGlobal('Las Notas de Crédito / Débito requieren seleccionar un documento de origen.')
      return
    }
    if (lineas.length === 0) {
      setErrorGlobal('Debe agregar al menos una línea de detalle.')
      return
    }

    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i]
      if (!l.productoId) {
        setErrorGlobal(`Línea ${i + 1}: Debe seleccionar un producto.`)
        return
      }
      if (!l.almacenId) {
        setErrorGlobal(`Línea ${i + 1}: Debe seleccionar un almacén.`)
        return
      }
      if (!l.tipoOperacionId) {
        setErrorGlobal(`Línea ${i + 1}: Debe seleccionar un tipo de operación.`)
        return
      }
      if (!esMayorQueCero(l.cantidadOriginal)) {
        setErrorGlobal(`Línea ${i + 1}: La cantidad debe ser mayor a 0.`)
        return
      }
    }

    const payload: CrearDocumentoPayload = {
      clase: formClase,
      periodo: Number(formPeriodo),
      tipo_comprobante: Number(formTipoComprobante),
      serie: formSerie.trim(),
      numero: formNumero.trim(),
      fecha_emision: formFechaEmision,
      moneda_codigo: formMoneda,
      tercero: formTercero ? Number(formTercero) : null,
      documento_origen: formDocOrigen ? Number(formDocOrigen) : null,
      origen_captura: 'MANUAL',
      detalles: lineas.map((l) => ({
        producto: Number(l.productoId),
        producto_unidad: l.productoUnidadId ? Number(l.productoUnidadId) : null,
        almacen: Number(l.almacenId),
        tipo_operacion: Number(l.tipoOperacionId),
        cantidad_original: l.cantidadOriginal,
        precio_unitario: l.precioUnitario,
        igv: l.igv,
        afectacion_igv: l.afectacionIgv,
        es_bonificacion: l.esBonificacion,
        descripcion_original: l.descripcionOriginal,
        detalle_origen: l.detalleOrigenId ? Number(l.detalleOrigenId) : null,
      })),
    }

    setGuardandoDoc(true)
    try {
      const nuevoDoc = await crearDocumento(payload)
      setExitoGlobal(`Comprobante ${nuevoDoc.serie_normalizada}-${nuevoDoc.numero_normalizado} registrado exitosamente.`)
      setModalNuevoAbierto(false)
      setFormSerie('')
      setFormNumero('')
      setLineas([])
      await cargarDocumentos()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Record<string, unknown> } }
      const msgs = axiosErr.response?.data
      if (msgs && typeof msgs === 'object' && !('detail' in msgs)) {
        const key = Object.keys(msgs)[0]
        const val = msgs[key]
        setErrorGlobal(`${key}: ${Array.isArray(val) ? val[0] : String(val)}`)
      } else {
        setErrorGlobal((msgs as { detail?: string } | undefined)?.detail || 'Error al guardar el comprobante.')
      }
    } finally {
      setGuardandoDoc(false)
    }
  }

  const handleEjecutarRevision = async () => {
    if (!modalRevisionDoc) return
    setErrorGlobal(null)
    try {
      await revisarDocumento(modalRevisionDoc.id, revEstadoSeleccionado, revMotivo)
      setExitoGlobal(`Estado de revisión actualizado a ${revEstadoSeleccionado}.`)
      setModalRevisionDoc(null)
      setRevMotivo('')
      await cargarDocumentos()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setErrorGlobal(axiosErr.response?.data?.detail || 'Error al cambiar estado de revisión.')
    }
  }

  const handleConfirmar = async (doc: Documento) => {
    if (
      !window.confirm(
        `¿Confirmar el comprobante ${doc.serie_normalizada}-${doc.numero_normalizado}? Impactará stock en Kardex y no podrá volver a borrador.`
      )
    ) {
      return
    }
    setErrorGlobal(null)
    try {
      await confirmarDocumento(doc.id)
      setExitoGlobal(`Documento ${doc.serie_normalizada}-${doc.numero_normalizado} confirmado exitosamente en Kardex.`)
      await cargarDocumentos()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setErrorGlobal(axiosErr.response?.data?.detail || 'No se pudo confirmar el comprobante.')
    }
  }

  const handleEjecutarAnulacion = async () => {
    if (!modalAnulacionDoc || !anulacionMotivo.trim()) {
      setErrorGlobal('Debe especificar un motivo de anulación.')
      return
    }
    setErrorGlobal(null)
    try {
      await anularDocumento(modalAnulacionDoc.id, anulacionMotivo.trim())
      setExitoGlobal(`Documento ${modalAnulacionDoc.serie_normalizada}-${modalAnulacionDoc.numero_normalizado} anulado con extorno.`)
      setModalAnulacionDoc(null)
      setAnulacionMotivo('')
      await cargarDocumentos()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setErrorGlobal(axiosErr.response?.data?.detail || 'Error al anular el documento.')
    }
  }


  const documentosOrigenElegibles = useMemo(() => {
    return documentosOrigen.filter((d) => !d.es_nota)
  }, [documentosOrigen])

  // La nota necesita elegir su comprobante de origen entre todos (no solo la página visible).
  const necesitaOrigen = modalNuevoAbierto && esNota
  useEffect(() => {
    if (!necesitaOrigen) return
    let ignorar = false
    obtenerDocumentos()
      .then((docs) => {
        if (!ignorar) setDocumentosOrigen(docs)
      })
      .catch(() => {
        if (!ignorar) setDocumentosOrigen([])
      })
    return () => {
      ignorar = true
    }
  }, [necesitaOrigen, empresaId])

  // Abre el formulario de nuevo comprobante con la clase de la vista (Compras/Ventas).
  const abrirNuevo = () => {
    setFormClase((actual) => claseInicialNuevo(vista, actual))
    setModalNuevoAbierto(true)
    if (lineas.length === 0) agregarLinea()
  }

  // Acceso rápido del Dashboard: /compras?nuevo=1 abre el formulario directamente.
  // Espera a los catálogos para que la primera línea tenga almacén y tipo de operación.
  const pedirNuevo = searchParams.get('nuevo') === '1'
  useEffect(() => {
    if (!pedirNuevo || !catalogosCargados) return
    diferirCarga(() => {
      setFormClase((actual) => claseInicialNuevo(vista, actual))
      setModalNuevoAbierto(true)
      setLineas((actuales) => (actuales.length === 0 ? [lineaVacia()] : actuales))
      setSearchParams({}, { replace: true })
    })
  }, [pedirNuevo, catalogosCargados, vista, setSearchParams, lineaVacia])

  const tiposComprobanteFormulario = tiposComprobanteDeVista(vista, tiposComprobante)

  return (
    <div className="space-y-6">
      <PageHeader
        title={configVista.titulo}
        description={configVista.descripcion}
        icon={<FileSpreadsheet className="h-5 w-5" />}
        actions={
          <Button variant="primary" onClick={abrirNuevo}>
            <Plus className="h-4 w-4 mr-1.5" /> {configVista.botonNuevo}
          </Button>
        }
      />

      {errorGlobal && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-700 animate-in fade-in"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span className="font-medium leading-relaxed">{errorGlobal}</span>
        </div>
      )}

      {exitoGlobal && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs text-emerald-700 animate-in fade-in"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <span className="font-medium leading-relaxed">{exitoGlobal}</span>
        </div>
      )}

      {/* Barra de Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {!configVista.claseFija && (
              <div className="space-y-1">
                <Label>Clase</Label>
                <Select
                  value={filtroClase}
                  onChange={(e) => setFiltroClase(e.target.value as ClaseDocumento | '')}
                >
                  <option value="">Todas las clases</option>
                  <option value="COMPRA">Compras</option>
                  <option value="VENTA">Ventas</option>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Período</Label>
              <Select
                value={filtroPeriodo}
                onChange={(e) => setFiltroPeriodo(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Todos los períodos</option>
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.anio}-{String(p.mes).padStart(2, '0')} ({p.estado})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Estado Documental</Label>
              <Select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as EstadoDocumental | '')}
              >
                <option value="">Todos los estados</option>
                <option value="BORRADOR">Borrador</option>
                <option value="CONFIRMADO">Confirmado</option>
                <option value="ANULADO">Anulado</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Mesa de Revisión</Label>
              <Select
                value={filtroRevision}
                onChange={(e) => setFiltroRevision(e.target.value as EstadoRevision | '')}
              >
                <option value="">Todas las revisiones</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="EN_REVISION">EN REVISIÓN</option>
                <option value="REVISADO">REVISADO (Aprobado)</option>
                <option value="OBSERVADO">OBSERVADO</option>
              </Select>
            </div>

            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <Label>Buscar Comprobante / RUC / Tercero</Label>
              <Input
                placeholder="F001-123, 2060..., EMPRESA..."
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Documentos */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-3 px-4 border-b border-slate-100 bg-slate-50/50">
            <span className="text-xs font-semibold text-slate-600">
              Total <strong className="font-mono text-slate-900">{totalDocumentos}</strong> comprobantes
            </span>
            {cargando && <span className="text-xs text-slate-400">Actualizando datos...</span>}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Clase</TableHead>
                <TableHead className="w-40">Comprobante</TableHead>
                <TableHead className="w-24">Emisión</TableHead>
                <TableHead>Emisor / Tercero</TableHead>
                <TableHead className="w-28">Moneda / TC</TableHead>
                <TableHead numeric className="w-28">Subtotal</TableHead>
                <TableHead numeric className="w-24">IGV</TableHead>
                <TableHead numeric className="w-28">Total</TableHead>
                <TableHead className="w-32">Revisión</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead className="w-36 text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10 text-slate-400 text-xs">
                    No se encontraron comprobantes registrados para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              ) : (
                documentos.map((doc) => {
                  const esCompra = doc.clase === 'COMPRA'
                  const revVariant =
                    doc.estado_revision === 'REVISADO'
                      ? 'success'
                      : doc.estado_revision === 'OBSERVADO'
                      ? 'destructive'
                      : doc.estado_revision === 'EN_REVISION'
                      ? 'warning'
                      : 'neutral'

                  const docVariant =
                    doc.estado === 'CONFIRMADO'
                      ? 'success'
                      : doc.estado === 'ANULADO'
                      ? 'destructive'
                      : 'warning'

                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Badge variant={esCompra ? 'info' : 'success'} size="sm">
                          {doc.clase}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap font-mono tabular-nums">
                          <span className="font-bold text-slate-900">
                            {doc.tipo_comprobante_codigo || 'DOC'}: {doc.serie_normalizada}-{doc.numero_normalizado}
                          </span>
                          {doc.es_nota && <Badge variant="warning" size="sm">NOTA</Badge>}
                        </div>
                      </TableCell>
                      <TableCell numeric className="text-slate-600">
                        {doc.fecha_emision}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 text-xs truncate max-w-xs">
                            {doc.tercero_razon_social || (doc.clase === 'VENTA' ? 'CLIENTES VARIOS' : doc.ruc_emisor)}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">RUC: {doc.ruc_emisor}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-xs text-slate-800">{doc.moneda_codigo}</span>
                          {doc.moneda_codigo === 'USD' && (
                            <span className="font-mono text-[10px] text-slate-500">
                              TC: {formatearDecimal(doc.monto_tc, { min: 4, max: 4, vacio: '-' })}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell numeric className="font-medium text-slate-800">
                        {formatearDecimal(doc.subtotal)}
                      </TableCell>
                      <TableCell numeric className="text-slate-600">
                        {formatearDecimal(doc.igv)}
                      </TableCell>
                      <TableCell numeric className="font-bold text-slate-950 text-sm">
                        {formatearDecimal(doc.total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={revVariant} size="sm" dot>
                          {doc.estado_revision}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={docVariant} size="sm">
                          {doc.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Ver Detalle */}
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            title="Ver Detalle Completo"
                            onClick={async () => {
                              const fullDoc = await obtenerDocumento(doc.id)
                              setModalDetalleDocumento(fullDoc)
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-600" />
                          </Button>

                          {/* Mesa de Revisión */}
                          {doc.estado === 'BORRADOR' && (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              title="Mesa de Revisión Contable"
                              onClick={() => {
                                setModalRevisionDoc(doc)
                                setRevEstadoSeleccionado(
                                  doc.estado_revision === 'PENDIENTE' ? 'REVISADO' : doc.estado_revision
                                )
                              }}
                            >
                              <CheckCheck className="h-3.5 w-3.5 text-indigo-600" />
                            </Button>
                          )}

                          {/* Confirmar Documento */}
                          {doc.estado === 'BORRADOR' && doc.estado_revision === 'REVISADO' && (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              title="Confirmar e Impactar Kardex"
                              onClick={() => handleConfirmar(doc)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            </Button>
                          )}

                          {/* Anular Documento */}
                          {doc.estado !== 'ANULADO' && (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              title="Anular con Extorno"
                              onClick={() => setModalAnulacionDoc(doc)}
                            >
                              <Ban className="h-3.5 w-3.5 text-rose-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          {totalDocumentos > 0 && (
            <Paginacion
              page={page}
              pageSize={PAGE_SIZE_DEFECTO}
              count={totalDocumentos}
              enPagina={documentos.length}
              cargando={cargando}
              etiqueta="comprobantes"
              onCambiarPagina={(nueva) => setEstadoPagina(irAPagina(claveFiltros, nueva))}
            />
          )}
        </CardContent>
      </Card>

      {/* MODAL: NUEVO COMPROBANTE MAESTRO-DETALLE */}
      {modalNuevoAbierto && (
        <Modal
          isOpen={modalNuevoAbierto}
          onClose={() => setModalNuevoAbierto(false)}
          maxWidth="5xl"
          icon={<Receipt className="h-5 w-5" />}
          title="Registrar Comprobante Comercial"
          description="Captura manual de facturas, boletas y notas de crédito/débito con validación estricta."
          footer={
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono tabular-nums">
                <span>Subtotal: <strong className="text-slate-900">{simboloMoneda} {totalesCalculados.subtotal}</strong></span>
                <span>IGV: <strong className="text-slate-900">{simboloMoneda} {totalesCalculados.igv}</strong></span>
                <span className="text-sm">Total: <strong className="text-indigo-600 font-bold">{simboloMoneda} {totalesCalculados.total}</strong></span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setModalNuevoAbierto(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={handleGuardarDocumento} isLoading={guardandoDoc}>
                  Guardar Borrador
                </Button>
              </div>
            </div>
          }
        >
          <form onSubmit={handleGuardarDocumento} className="space-y-6">
            {/* Cabecera */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-1">
                1. Cabecera del Documento
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label required>Clase de Operación</Label>
                  <Select
                    value={formClase}
                    onChange={(e) => setFormClase(e.target.value as ClaseDocumento)}
                    disabled={Boolean(configVista.claseFija)}
                  >
                    <option value="COMPRA">COMPRA (Entrada)</option>
                    <option value="VENTA">VENTA (Salida)</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label required>Período Contable</Label>
                  <Select
                    value={formPeriodo}
                    onChange={(e) => setFormPeriodo(Number(e.target.value))}
                    required
                  >
                    <option value="">Seleccione Período...</option>
                    {periodos.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.estado === 'CERRADO'}>
                        {p.anio}-{String(p.mes).padStart(2, '0')} ({p.estado})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label required>Tipo de Comprobante</Label>
                  <Select
                    value={formTipoComprobante}
                    onChange={(e) => setFormTipoComprobante(Number(e.target.value))}
                    required
                  >
                    <option value="">Seleccione Tipo...</option>
                    {tiposComprobanteFormulario.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo_sunat} - {c.descripcion} {c.es_nota ? '(Nota)' : ''}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label required={formClase === 'COMPRA'}>
                    {formClase === 'COMPRA' ? 'Proveedor' : 'Cliente (Opcional)'}
                  </Label>
                  <Select
                    value={formTercero}
                    onChange={(e) => setFormTercero(e.target.value ? Number(e.target.value) : '')}
                    required={formClase === 'COMPRA'}
                  >
                    <option value="">Seleccione Tercero...</option>
                    {terceros
                      .filter((t) => (formClase === 'COMPRA' ? t.es_proveedor : t.es_cliente))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.numero_documento} - {t.razon_social}
                        </option>
                      ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>RUC Emisor Resuelto</Label>
                  <Input disabled value={rucEmisorDisplay} className="bg-slate-50 font-mono" />
                </div>

                <div className="space-y-1">
                  <Label required>Serie</Label>
                  <Input
                    placeholder="F001"
                    value={formSerie}
                    onChange={(e) => setFormSerie(e.target.value)}
                    required
                    className="font-mono uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <Label required>Número</Label>
                  <Input
                    placeholder="12345"
                    value={formNumero}
                    onChange={(e) => setFormNumero(e.target.value)}
                    required
                    className="font-mono tabular-nums"
                  />
                </div>

                <div className="space-y-1">
                  <Label required>Fecha de Emisión</Label>
                  <Input
                    type="date"
                    value={formFechaEmision}
                    onChange={(e) => cambiarFechaEmision(e.target.value)}
                    required
                    className="font-mono tabular-nums"
                  />
                </div>

                <div className="space-y-1">
                  <Label required>Moneda</Label>
                  <Select
                    value={formMoneda}
                    onChange={(e) => setFormMoneda(e.target.value as 'PEN' | 'USD')}
                  >
                    <option value="PEN">PEN — Soles Peruanos</option>
                    <option value="USD">USD — Dólares Americanos</option>
                  </Select>
                </div>

                {formMoneda === 'USD' && (
                  <div className="space-y-1 sm:col-span-2">
                    <Label>TC Venta SBS {cargandoTc && '⏳'}</Label>
                    <Input
                      disabled
                      value={
                        tcResuelto
                          ? `${formatearDecimal(tcResuelto.venta, { min: 4, max: 4 })} (${tcResuelto.fecha_publicacion})`
                          : 'Sin TC registrado a la fecha'
                      }
                      className={tcResuelto ? 'text-emerald-700 font-bold font-mono' : 'text-rose-600 font-mono'}
                    />
                  </div>
                )}

                {esNota && (
                  <div className="space-y-1 sm:col-span-3">
                    <Label required>Documento de Origen Referenciado (Obligatorio para NC/ND)</Label>
                    <Select
                      value={formDocOrigen}
                      onChange={(e) => setFormDocOrigen(e.target.value ? Number(e.target.value) : '')}
                      required
                    >
                      <option value="">Seleccione Factura / Boleta de Origen...</option>
                      {documentosOrigenElegibles.map((orig) => (
                        <option key={orig.id} value={orig.id}>
                          {orig.serie_normalizada}-{orig.numero_normalizado} ({orig.fecha_emision}) - {orig.tercero_razon_social} - {orig.moneda_codigo} {orig.total}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Líneas de Detalle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  2. Líneas de Detalle del Comprobante
                </h4>
                <Button type="button" variant="secondary" size="xs" onClick={agregarLinea}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar Línea
                </Button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="p-2 w-8 text-center">#</th>
                      <th className="p-2 min-w-[180px]">Producto *</th>
                      <th className="p-2 min-w-[140px]">Unidad Presentación *</th>
                      <th className="p-2 min-w-[140px]">Almacén *</th>
                      <th className="p-2 min-w-[140px]">Operación *</th>
                      <th className="p-2 w-24 text-right">Cantidad</th>
                      <th className="p-2 w-24 text-right">Precio Unit.</th>
                      <th className="p-2 min-w-[110px]">Afectación IGV</th>
                      <th className="p-2 w-20 text-right">IGV</th>
                      <th className="p-2 w-16 text-center">Bonif?</th>
                      <th className="p-2 w-20 text-right">Cant. Base</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineas.map((linea, idx) => {
                      const cantBase = formatearDecimal(cantidadBase(linea.cantidadOriginal, linea.factorConversion), { min: 2, max: 6 })

                      return (
                        <tr key={linea.tempId} className="hover:bg-slate-50/50">
                          <td className="p-2 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-2">
                            <select
                              className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-slate-900"
                              value={linea.productoId}
                              onChange={(e) => actualizarLinea(linea.tempId, 'productoId', e.target.value)}
                              required
                            >
                              <option value="">Seleccione Producto...</option>
                              {productos.map((prod) => (
                                <option key={prod.id} value={prod.id}>
                                  {prod.codigo_interno} - {prod.descripcion}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-slate-900"
                              value={linea.productoUnidadId}
                              onChange={(e) => actualizarLinea(linea.tempId, 'productoUnidadId', e.target.value)}
                              required
                            >
                              <option value="">Unidad...</option>
                              {linea.unidadesDisponibles.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.unidad_codigo} (x{u.factor_a_base})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-slate-900"
                              value={linea.almacenId}
                              onChange={(e) => actualizarLinea(linea.tempId, 'almacenId', e.target.value)}
                              required
                            >
                              {almacenes.map((alm) => (
                                <option key={alm.id} value={alm.id}>
                                  {alm.codigo} - {alm.nombre}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-slate-900"
                              value={linea.tipoOperacionId}
                              onChange={(e) => actualizarLinea(linea.tempId, 'tipoOperacionId', e.target.value)}
                              required
                            >
                              {tiposOperacion.map((op) => (
                                <option key={op.id} value={op.id}>
                                  {op.codigo_interno} - {op.descripcion}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.0001"
                              min="0.0001"
                              className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-right font-mono tabular-nums text-xs"
                              value={linea.cantidadOriginal}
                              onChange={(e) => actualizarLinea(linea.tempId, 'cantidadOriginal', e.target.value)}
                              required
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              disabled={linea.esBonificacion}
                              className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-right font-mono tabular-nums text-xs"
                              value={linea.precioUnitario}
                              onChange={(e) => actualizarLinea(linea.tempId, 'precioUnitario', e.target.value)}
                              required
                            />
                          </td>
                          <td className="p-2">
                            <select
                              className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs focus:ring-1 focus:ring-slate-900"
                              value={linea.afectacionIgv}
                              disabled={linea.esBonificacion}
                              onChange={(e) => actualizarLinea(linea.tempId, 'afectacionIgv', e.target.value)}
                            >
                              {AFECTACIONES_IGV.map((a) => (
                                <option key={a.valor} value={a.valor}>{a.etiqueta}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={linea.esBonificacion || !igvEditable(linea.afectacionIgv)}
                              className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-right font-mono tabular-nums text-xs"
                              value={linea.igv}
                              onChange={(e) => actualizarLinea(linea.tempId, 'igv', e.target.value)}
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={linea.esBonificacion}
                              onChange={(e) => actualizarLinea(linea.tempId, 'esBonificacion', e.target.checked)}
                              className="rounded text-indigo-600 cursor-pointer"
                            />
                          </td>
                          <td className="p-2 text-right font-mono tabular-nums text-slate-500 font-semibold">
                            {cantBase}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => eliminarLinea(linea.tempId)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              title="Eliminar fila"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: VER DETALLE COMPLETO */}
      {modalDetalleDocumento && (
        <Modal
          isOpen={Boolean(modalDetalleDocumento)}
          onClose={() => setModalDetalleDocumento(null)}
          maxWidth="4xl"
          icon={<Eye className="h-5 w-5" />}
          title={`Detalle de Comprobante: ${modalDetalleDocumento.serie_normalizada}-${modalDetalleDocumento.numero_normalizado}`}
          description={`Clase: ${modalDetalleDocumento.clase} • Estado: ${modalDetalleDocumento.estado} • Revisión: ${modalDetalleDocumento.estado_revision}`}
          footer={
            <Button variant="secondary" onClick={() => setModalDetalleDocumento(null)}>
              Cerrar Visor
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block">RUC Emisor:</span>
                <strong className="font-mono text-slate-800">{modalDetalleDocumento.ruc_emisor}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Tercero / Razón Social:</span>
                <strong className="text-slate-800">{modalDetalleDocumento.tercero_razon_social || '—'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Fecha Emisión:</span>
                <strong className="font-mono text-slate-800">{modalDetalleDocumento.fecha_emision}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Moneda / Total:</span>
                <strong className="font-mono text-slate-900 text-sm">
                  {modalDetalleDocumento.moneda_codigo} {formatearDecimal(modalDetalleDocumento.total)}
                </strong>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Líneas de Detalle</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead numeric>Cantidad</TableHead>
                    <TableHead numeric>Precio Unit.</TableHead>
                    <TableHead numeric>IGV</TableHead>
                    <TableHead numeric>Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modalDetalleDocumento.detalles?.map((det) => (
                    <TableRow key={det.id}>
                      <TableCell className="font-semibold text-slate-800">
                        {det.producto_codigo} — {det.producto_descripcion}
                      </TableCell>
                      <TableCell>{det.almacen_nombre || det.almacen}</TableCell>
                      <TableCell numeric className="font-bold">
                        {formatearDecimal(det.cantidad_original, { min: 2, max: 8 })}
                      </TableCell>
                      <TableCell numeric>
                        {formatearDecimal(det.precio_unitario, { min: 4, max: 8 })}
                      </TableCell>
                      <TableCell numeric>
                        {formatearDecimal(det.igv)}
                        {det.afectacion_igv && det.afectacion_igv !== 'GRAVADO' && (
                          <span className="ml-1 text-[10px] text-slate-500">{det.afectacion_igv}</span>
                        )}
                      </TableCell>
                      <TableCell numeric className="font-bold text-slate-900">
                        {formatearDecimal(importeLinea(det.cantidad_original, det.precio_unitario))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: MESA DE REVISIÓN */}
      {modalRevisionDoc && (
        <Modal
          isOpen={Boolean(modalRevisionDoc)}
          onClose={() => setModalRevisionDoc(null)}
          title={`Mesa de Revisión: ${modalRevisionDoc.serie_normalizada}-${modalRevisionDoc.numero_normalizado}`}
          description="Dictamen formal previo a la confirmación de inventario en Kardex."
          icon={<CheckCheck className="h-5 w-5 text-indigo-600" />}
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setModalRevisionDoc(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleEjecutarRevision}>
                Guardar Dictamen
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label required>Nuevo Estado de Revisión</Label>
              <Select
                value={revEstadoSeleccionado}
                onChange={(e) => setRevEstadoSeleccionado(e.target.value as EstadoRevision)}
              >
                <option value="REVISADO">REVISADO (Aprobado para confirmación en Kardex)</option>
                <option value="OBSERVADO">OBSERVADO (Contiene errores o inconsistencias)</option>
                <option value="EN_REVISION">EN REVISIÓN (Bajo análisis tributario/logístico)</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo u Observaciones</Label>
              <textarea
                rows={3}
                placeholder="Observaciones formales registradas para trazabilidad del revisor..."
                value={revMotivo}
                onChange={(e) => setRevMotivo(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-900 shadow-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: ANULACIÓN DE COMPROBANTE */}
      {modalAnulacionDoc && (
        <Modal
          isOpen={Boolean(modalAnulacionDoc)}
          onClose={() => setModalAnulacionDoc(null)}
          title={`Anular Comprobante: ${modalAnulacionDoc.serie_normalizada}-${modalAnulacionDoc.numero_normalizado}`}
          description="Esta acción anulará el comprobante y generará un movimiento de extorno en Kardex si ya estaba confirmado."
          icon={<Ban className="h-5 w-5 text-rose-600" />}
          footer={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setModalAnulacionDoc(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleEjecutarAnulacion}>
                Confirmar Anulación
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <strong>Aviso Inalterable:</strong> Todo extorno en Kardex preserva los saldos cronológicos e
                inscribe un evento en la tabla de auditoría inmutable.
              </div>
            </div>

            <div className="space-y-1.5">
              <Label required>Motivo de Anulación</Label>
              <textarea
                rows={3}
                required
                placeholder="Indique la justificación comercial/fiscal de la anulación..."
                value={anulacionMotivo}
                onChange={(e) => setAnulacionMotivo(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-900 shadow-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default DocumentosPage
