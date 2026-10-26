import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Warehouse, RotateCcw, Search, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { obtenerSaldosActuales } from '../../api/kardex'
import { getAlmacenes, getProductos } from '../../api/inventario'
import { construirFilasStock, type FilaStock } from '../../utils/stockActual'
import { diferirCarga } from '../../utils/efectos'
import { mensajeDeError } from '../../utils/errores'
import { PageHeader } from '../../components/ui/page-header'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'

const formatQty = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const formatCost = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
const formatMoney = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Inventario (stock actual): lectura de los saldos vigentes que mantiene el motor Kardex
 * (/api/kardex/saldos-actuales/). Para movimientos y saldos a una fecha: Kardex Valorizado.
 */
export const StockActualPage: React.FC = () => {
  const { empresaActiva } = useAuth()
  const [filas, setFilas] = useState<FilaStock[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarSinStock, setMostrarSinStock] = useState(false)

  const empresaId = empresaActiva?.id
  const cargar = useCallback(async () => {
    if (!empresaId) return
    setCargando(true)
    setError(null)
    try {
      const [saldos, productos, almacenes] = await Promise.all([obtenerSaldosActuales(), getProductos(), getAlmacenes()])
      setFilas(construirFilasStock(saldos.saldos_cpp, saldos.stocks_almacen, productos, almacenes, { incluirSinStock: true }))
    } catch (err) {
      setError(mensajeDeError(err, ['detail'], 'No se pudo cargar el stock actual.'))
    } finally {
      setCargando(false)
    }
  }, [empresaId])

  useEffect(() => {
    diferirCarga(cargar)
  }, [cargar])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas.filter((f) => {
      if (!mostrarSinStock && f.cantidad === 0 && f.valor === 0) return false
      if (!q) return true
      return f.codigo.toLowerCase().includes(q) || f.descripcion.toLowerCase().includes(q)
    })
  }, [filas, busqueda, mostrarSinStock])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description={`Stock y valor vigentes por producto y almacén según el motor Kardex (CPP en PEN) · ${
          empresaActiva?.razon_social ?? 'Empresa activa'
        }`}
        icon={<Warehouse className="h-5 w-5" />}
        badge={<Badge variant="neutral">Solo lectura</Badge>}
        actions={
          <Button variant="outline" size="sm" onClick={() => void cargar()} isLoading={cargando}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Actualizar
          </Button>
        }
      />

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span className="font-medium leading-relaxed">{error}</span>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-full sm:w-80">
              <Input
                placeholder="Buscar por código o descripción"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 select-none">
              <input type="checkbox" checked={mostrarSinStock} onChange={(e) => setMostrarSinStock(e.target.checked)} />
              Mostrar productos sin stock
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-3 px-4 border-b border-slate-100 bg-slate-50/50">
            <span className="text-xs font-semibold text-slate-600">
              <strong className="font-mono text-slate-900">{visibles.length}</strong> producto(s)
            </span>
            {cargando && <span className="text-xs text-slate-400">Actualizando datos...</span>}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-20">Unidad</TableHead>
                <TableHead numeric className="w-32">Cantidad</TableHead>
                <TableHead numeric className="w-32">CPP (PEN)</TableHead>
                <TableHead numeric className="w-32">Valor (PEN)</TableHead>
                <TableHead>Por almacén</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                    {cargando ? 'Cargando stock...' : 'No hay productos con stock para los filtros seleccionados.'}
                  </TableCell>
                </TableRow>
              ) : (
                visibles.map((f) => (
                  <TableRow key={f.productoId}>
                    <TableCell className="font-mono text-xs font-semibold text-slate-900">{f.codigo}</TableCell>
                    <TableCell className="text-slate-700">{f.descripcion}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{f.unidad || '—'}</TableCell>
                    <TableCell numeric className="font-semibold text-slate-900">{formatQty(f.cantidad)}</TableCell>
                    <TableCell numeric className="text-slate-600">{formatCost(f.cpp)}</TableCell>
                    <TableCell numeric className="font-semibold text-slate-900">S/ {formatMoney(f.valor)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {f.almacenes.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          f.almacenes.map((a) => (
                            <Badge key={a.almacenId} variant="neutral" size="sm">
                              {a.almacen}: {formatQty(a.cantidad)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
