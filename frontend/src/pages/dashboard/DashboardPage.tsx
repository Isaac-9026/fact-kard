import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  CalendarRange,
  Package,
  Coins,
  ShoppingCart,
  Receipt,
  AlertTriangle,
  Lock,
  Plus,
  BookOpenCheck,
  RotateCcw,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { obtenerPeriodos } from '../../api/periodos'
import { obtenerKardexValorizado } from '../../api/reportes'
import { obtenerDocumentosPaginados } from '../../api/documentos'
import { obtenerIncidencias } from '../../api/kardex'
import { obtenerCierres } from '../../api/cierres'
import { ACCESOS_RAPIDOS } from '../../navegacion'
import { diferirCarga } from '../../utils/efectos'
import { leerPeriodoGuardado } from '../../utils/kardexVista'
import { filtrosApiDocumentos } from '../../utils/vistaDocumentos'
import {
  SIN_DATO, contarPendientes, etiquetaPeriodo, periodoActivo, resumenUltimoCierre, textoODato,
  type PeriodoDashboard, type ResumenCierre,
} from '../../utils/dashboard'
import { PageHeader } from '../../components/ui/page-header'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, KpiCard } from '../../components/ui/card'
import { Button } from '../../components/ui/button'

const formatQty = (v: string | number) =>
  Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const formatMoney = (v: string | number) =>
  `S/ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface DatosDashboard {
  periodo: PeriodoDashboard | null
  stockTotal: string | null
  valorTotal: string | null
  compras: number | null
  ventas: number | null
  incidenciasPendientes: number | null
  ultimoCierre: ResumenCierre | null
  sinCierres: boolean
}

const VACIO: DatosDashboard = {
  periodo: null, stockTotal: null, valorTotal: null, compras: null, ventas: null,
  incidenciasPendientes: null, ultimoCierre: null, sinCierres: false,
}

const ICONOS_ACCESO = [ShoppingCart, Receipt, BookOpenCheck, AlertTriangle]

/** Cuenta los comprobantes confirmados de una clase en el período (conteo paginado, sin notas). */
const contarConfirmados = async (clase: 'COMPRA' | 'VENTA', periodoId: number) => {
  const pagina = await obtenerDocumentosPaginados(
    filtrosApiDocumentos(clase, { periodo: periodoId, estado: 'CONFIRMADO' as const }),
    { page: 1, page_size: 1 },
  )
  return pagina.count
}

/**
 * Pantalla inicial. Cada dato sale de un endpoint existente; si una consulta falla o el
 * dato no existe se muestra "—" (nunca un valor inventado).
 */
export const DashboardPage: React.FC = () => {
  const { empresaActiva } = useAuth()
  const navigate = useNavigate()
  const [datos, setDatos] = useState<DatosDashboard>(VACIO)
  const [cargando, setCargando] = useState(true)
  const [errores, setErrores] = useState<string[]>([])

  const empresaId = empresaActiva?.id
  const cargar = useCallback(async () => {
    if (!empresaId) return
    setCargando(true)
    const fallas: string[] = []
    const valor = async <T,>(nombre: string, promesa: Promise<T>): Promise<T | null> => {
      try {
        return await promesa
      } catch {
        fallas.push(nombre)
        return null
      }
    }

    const [periodos, kardex, incidencias, cierres] = await Promise.all([
      valor('períodos', obtenerPeriodos()),
      // Sin filtros = saldo vigente de la empresa; solo se pide 1 fila (el resumen es del rango completo).
      valor('stock y valor', obtenerKardexValorizado({}, { page: 1, page_size: 1 })),
      valor('incidencias', obtenerIncidencias()),
      valor('cierres', obtenerCierres()),
    ])
    const periodo = periodos ? periodoActivo(periodos, leerPeriodoGuardado(empresaId)) : null
    const [compras, ventas] = periodo
      ? await Promise.all([
          valor('compras', contarConfirmados('COMPRA', periodo.id)),
          valor('ventas', contarConfirmados('VENTA', periodo.id)),
        ])
      : [null, null]

    setDatos({
      periodo,
      stockTotal: kardex?.resumen?.saldo_final_cantidad ?? null,
      valorTotal: kardex?.resumen?.saldo_final_valor ?? null,
      compras,
      ventas,
      incidenciasPendientes: incidencias ? contarPendientes(incidencias) : null,
      ultimoCierre: cierres ? resumenUltimoCierre(cierres) : null,
      sinCierres: Boolean(cierres && cierres.length === 0),
    })
    setErrores(fallas)
    setCargando(false)
  }, [empresaId])

  useEffect(() => {
    diferirCarga(cargar)
  }, [cargar])

  const v = (texto: string) => (cargando ? '...' : texto)
  const etiqueta = etiquetaPeriodo(datos.periodo)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen de la empresa activa: período, inventario valorizado, operaciones del período, incidencias y último cierre."
        icon={<LayoutDashboard className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => void cargar()} isLoading={cargando}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Actualizar
          </Button>
        }
      />

      {errores.length > 0 && !cargando && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-800">
          No se pudo consultar: {errores.join(', ')}. Esos datos se muestran como “{SIN_DATO}”.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" data-testid="dashboard-kpis">
        <KpiCard
          title="Empresa activa"
          value={<span className="text-base">{empresaActiva?.razon_social ?? SIN_DATO}</span>}
          subtitle={empresaActiva ? `RUC ${empresaActiva.ruc} · ${empresaActiva.rol}` : undefined}
          icon={Building2}
        />
        <KpiCard
          title="Período activo"
          value={v(etiqueta)}
          subtitle={datos.periodo ? `Estado: ${datos.periodo.estado}` : 'Sin período abierto'}
          icon={CalendarRange}
        />
        <KpiCard
          title="Stock total"
          value={v(textoODato(datos.stockTotal, formatQty))}
          subtitle="Unidades base · saldo vigente"
          icon={Package}
        />
        <KpiCard
          title="Valor del inventario"
          value={v(textoODato(datos.valorTotal, formatMoney))}
          subtitle="Saldo valorizado CPP en PEN"
          icon={Coins}
        />
        <KpiCard
          title="Compras del período"
          value={v(textoODato(datos.compras))}
          subtitle={`Confirmadas · ${etiqueta}`}
          icon={ShoppingCart}
        />
        <KpiCard
          title="Ventas del período"
          value={v(textoODato(datos.ventas))}
          subtitle={`Confirmadas · ${etiqueta}`}
          icon={Receipt}
        />
        <KpiCard
          title="Incidencias pendientes"
          value={v(textoODato(datos.incidenciasPendientes))}
          subtitle={!cargando && datos.incidenciasPendientes ? 'Requieren revisión' : 'Motor Kardex'}
          icon={AlertTriangle}
        />
        <KpiCard
          title="Último cierre"
          value={<span className="text-base">{v(datos.ultimoCierre?.titulo ?? (datos.sinCierres ? 'Sin cierres' : SIN_DATO))}</span>}
          subtitle={datos.ultimoCierre?.detalle}
          icon={Lock}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accesos rápidos</CardTitle>
          <CardDescription>Operaciones frecuentes del flujo diario.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5">
            {ACCESOS_RAPIDOS.map((acceso, i) => {
              const Icono = ICONOS_ACCESO[i] ?? Plus
              return (
                <Button
                  key={acceso.to}
                  variant={i < 2 ? 'primary' : 'outline'}
                  onClick={() => navigate(acceso.to)}
                  data-acceso={acceso.to}
                >
                  <Icono className="h-4 w-4 mr-1.5" /> {acceso.label}
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
