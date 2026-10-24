import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ShieldCheck,
  Search,
  Filter,
  RotateCcw,
  Code2,
  AlertCircle,
  User,
  Scale,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getAuditoriaApi, type AuditoriaItem } from '../../api/auditoria'
import type { AxiosError } from 'axios'
import { PageHeader } from '../../components/ui/page-header'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'

export const AuditoriaPage: React.FC = () => {
  const { empresaActiva } = useAuth()
  const [logs, setLogs] = useState<AuditoriaItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Filtros
  const [filtroEntidad, setFiltroEntidad] = useState<string>('')
  const [filtroAccion, setFiltroAccion] = useState<string>('')

  // Modal de Detalle JSON
  const [selectedLog, setSelectedLog] = useState<AuditoriaItem | null>(null)

  const fetchAuditoria = useCallback(async () => {
    if (!empresaActiva) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMsg(null)
      const data = await getAuditoriaApi({
        entidad: filtroEntidad,
        accion: filtroAccion,
      })
      setLogs(data)
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      if (axiosErr.response?.data?.detail) {
        setErrorMsg(axiosErr.response.data.detail)
      } else {
        setErrorMsg('Error al consultar los registros de auditoría.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [empresaActiva, filtroEntidad, filtroAccion])

  useEffect(() => {
    fetchAuditoria()
  }, [fetchAuditoria])

  const handleClearFilters = () => {
    setFiltroEntidad('')
    setFiltroAccion('')
  }

  const formatFecha = (isoString: string): string => {
    try {
      const date = new Date(isoString)
      return date.toLocaleString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    } catch {
      return isoString
    }
  }

  const getActionBadgeVariant = (accion: string): 'success' | 'info' | 'destructive' | 'warning' | 'neutral' => {
    const act = accion.toUpperCase()
    if (act.includes('CREAR') || act.includes('ASIGNAR') || act.includes('REVISADO')) {
      return 'success'
    }
    if (act.includes('MODIFICAR') || act.includes('ACTUALIZAR')) {
      return 'info'
    }
    if (act.includes('ELIMINAR') || act.includes('EXTORNO') || act.includes('ANULAR') || act.includes('BLOQUEAR')) {
      return 'destructive'
    }
    return 'warning'
  }

  const formatJson = useMemo(() => {
    return (data: Record<string, unknown> | null | undefined): string => {
      if (!data || Object.keys(data).length === 0) return '{\n  // Sin datos registrados\n}'
      return JSON.stringify(data, null, 2)
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de Auditoría Inmutable"
        description={`Bitácora legal de trazabilidad y eventos operacionales para ${
          empresaActiva ? `${empresaActiva.razon_social} (RUC ${empresaActiva.ruc})` : 'la empresa seleccionada'
        }.`}
        icon={<ShieldCheck className="h-5 w-5" />}
        badge={
          <Badge variant="success" dot className="font-semibold shadow-2xs">
            Inmutable por Trigger PostgreSQL
          </Badge>
        }
        actions={
          <Button variant="outline" size="sm" onClick={fetchAuditoria} isLoading={isLoading}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Actualizar
          </Button>
        }
      />

      {/* Regla contable informativa */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100/60 text-indigo-600">
          <Scale className="h-4 w-4" />
        </div>
        <div className="text-xs text-slate-600 leading-relaxed">
          <strong className="text-slate-900 font-semibold">Garantía de Fidelidad Contable:</strong> Todo evento operacional,
          confirmación en Kardex, asignación de permisos, cierre y extorno genera un registro persistente con{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800">valor_anterior</code> y{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800">valor_nuevo</code>. Los triggers
          SQL inalterables <code className="font-mono text-[11px]">trg_auditoria_no_update</code> y{' '}
          <code className="font-mono text-[11px]">trg_auditoria_no_delete</code> impiden cualquier alteración física en base de datos.
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="w-full sm:w-64">
                <Input
                  id="filtro-entidad"
                  type="text"
                  placeholder="Filtrar por Entidad (ej. DOCUMENTO)"
                  value={filtroEntidad}
                  onChange={(e) => setFiltroEntidad(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>

              <div className="w-full sm:w-64">
                <Input
                  id="filtro-accion"
                  type="text"
                  placeholder="Filtrar por Acción (ej. CREAR)"
                  value={filtroAccion}
                  onChange={(e) => setFiltroAccion(e.target.value)}
                  leftIcon={<Filter className="h-4 w-4" />}
                />
              </div>

              {(filtroEntidad || filtroAccion) && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-slate-500">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Limpiar
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="neutral" className="font-mono font-semibold">
                {logs.length} {logs.length === 1 ? 'registro' : 'registros'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error alert */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-700 animate-in fade-in"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span className="font-medium leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {/* Tabla de Auditoría */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 text-xs">
              <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
              <span>Cargando eventos de auditoría inmutable...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              <p className="font-semibold text-sm text-slate-700 mb-1">No se encontraron registros de auditoría</p>
              <p>
                {filtroEntidad || filtroAccion
                  ? 'Intenta ajustar o limpiar los filtros de búsqueda.'
                  : 'No se han registrado operaciones para esta empresa activa.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead className="w-40">Fecha y Hora</TableHead>
                  <TableHead className="w-36">Usuario</TableHead>
                  <TableHead className="w-40">Acción</TableHead>
                  <TableHead className="w-40">Entidad</TableHead>
                  <TableHead numeric className="w-24">Reg. ID</TableHead>
                  <TableHead>Motivo / Descripción</TableHead>
                  <TableHead className="w-24 text-center">Diff JSON</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const hasJsonDiff = !!(log.valor_anterior || log.valor_nuevo)
                  return (
                    <TableRow key={log.id}>
                      <TableCell numeric className="font-semibold text-slate-900">
                        #{log.id}
                      </TableCell>
                      <TableCell numeric className="text-slate-600 whitespace-nowrap">
                        {formatFecha(log.fecha)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                          <User className="h-3 w-3 text-slate-400" />
                          {log.usuario_username || `ID ${log.usuario_id || 'Sistema'}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.accion)} size="sm">
                          {log.accion}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-800 font-medium">
                          {log.entidad}
                        </code>
                      </TableCell>
                      <TableCell numeric className="font-semibold text-slate-700">
                        {log.registro_id !== null && log.registro_id !== undefined ? log.registro_id : '—'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-slate-600">
                        {log.motivo || <span className="text-slate-400 italic">Sin motivo especificado</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasJsonDiff ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => setSelectedLog(log)}
                            title="Ver diferencias JSON"
                            className="font-mono text-[11px] gap-1"
                          >
                            <Code2 className="h-3 w-3" /> Ver
                          </Button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Visor JSON Diferencial */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          maxWidth="4xl"
          icon={<Code2 className="h-5 w-5" />}
          title={`Detalle de Cambios — Registro #${selectedLog.id}`}
          description={`Entidad: ${selectedLog.entidad} • Acción: ${selectedLog.accion}`}
          footer={
            <Button variant="secondary" size="sm" onClick={() => setSelectedLog(null)}>
              Cerrar Visor
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Panel Valor Anterior */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Valor Anterior (Before)
                  </span>
                </div>
                <pre className="rounded-lg border border-rose-200 bg-rose-50/40 p-3.5 font-mono text-[11px] text-slate-800 overflow-x-auto max-h-80 leading-relaxed">
                  {formatJson(selectedLog.valor_anterior)}
                </pre>
              </div>

              {/* Panel Valor Nuevo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Valor Nuevo (After)
                  </span>
                </div>
                <pre className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3.5 font-mono text-[11px] text-slate-800 overflow-x-auto max-h-80 leading-relaxed">
                  {formatJson(selectedLog.valor_nuevo)}
                </pre>
              </div>
            </div>

            {selectedLog.motivo && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <strong className="text-slate-900">Motivo registrado:</strong> {selectedLog.motivo}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default AuditoriaPage
