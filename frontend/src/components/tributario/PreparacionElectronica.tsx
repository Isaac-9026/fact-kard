/**
 * Bloque 17A — sección "Preparación para emisión electrónica" del detalle de un comprobante de
 * venta: estado derivado (LISTO_PARA_EMISION / NO_PREPARADO), errores, advertencias y, en notas,
 * el motivo tributario (catálogo 09/10). No genera XML ni envía nada a SUNAT.
 */
import { useCallback, useEffect, useState } from 'react'
import { FileCheck2, RefreshCw } from 'lucide-react'
import { cambiarMotivoNota, obtenerValidacionElectronica, type Documento, type ValidacionElectronica } from '../../api/documentos'
import { obtenerMotivosNota, type MotivoNota } from '../../api/catalogos'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { AlertaFormulario } from '../ui/alerta-formulario'
import { ResultadoValidacion } from './ResultadoValidacion'
import { mensajesDeErrorApi } from '../../utils/errores'
import { diferirCarga } from '../../utils/efectos'
import { ETIQUETA_PREPARACION, catalogoMotivo } from '../../utils/tributario'

interface Props {
  documento: Documento
  esAdmin: boolean
  onActualizado: (doc: Documento) => void
}

export function PreparacionElectronica({ documento, esAdmin, onActualizado }: Props) {
  const [resultado, setResultado] = useState<ValidacionElectronica | null>(null)
  const [errores, setErrores] = useState<string[] | null>(null)
  const [motivos, setMotivos] = useState<MotivoNota[]>([])
  const [motivo, setMotivo] = useState(documento.motivo_nota_codigo ?? '')
  const [guardando, setGuardando] = useState(false)
  const catalogo = catalogoMotivo(documento.tipo_comprobante_codigo)
  const puedeEditarMotivo = esAdmin && Boolean(catalogo) && documento.estado !== 'ANULADO'

  const validar = useCallback(async () => {
    try {
      setResultado(await obtenerValidacionElectronica(documento.id))
      setErrores(null)
    } catch (e) {
      setErrores(mensajesDeErrorApi(e, 'No se pudo validar el comprobante.'))
    }
  }, [documento.id])
  useEffect(() => { diferirCarga(validar) }, [validar, documento.motivo_nota_codigo])

  useEffect(() => {
    if (!catalogo || !puedeEditarMotivo) return
    obtenerMotivosNota(catalogo).then(setMotivos).catch(() => setMotivos([]))
  }, [catalogo, puedeEditarMotivo])

  const guardarMotivo = async () => {
    if (!motivo) return
    setGuardando(true)
    try {
      onActualizado(await cambiarMotivoNota(documento.id, motivo))
    } catch (e) {
      setErrores(mensajesDeErrorApi(e, 'No se pudo guardar el motivo.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-3" data-testid="preparacion-electronica">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <FileCheck2 className="h-4 w-4" /> Preparación para emisión electrónica
        </h4>
        <Button type="button" size="xs" variant="ghost" onClick={validar} title="Volver a validar">
          <RefreshCw className="h-3.5 w-3.5" /> Validar
        </Button>
      </div>
      <p className="text-[11px] text-slate-500">Revisión previa: todavía no se genera XML ni se envía a SUNAT.</p>

      {catalogo && (
        <div className="text-xs text-slate-700">
          Motivo (catálogo {catalogo}):{' '}
          <strong data-testid="motivo-nota-actual">
            {documento.motivo_nota_codigo ? `${documento.motivo_nota_codigo} — ${documento.motivo_nota_descripcion}` : 'sin motivo'}
          </strong>
        </div>
      )}
      {puedeEditarMotivo && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="motivo-nota-editar">{documento.motivo_nota_codigo ? 'Corregir motivo' : 'Registrar motivo'}</Label>
            <Select id="motivo-nota-editar" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="">Seleccione…</option>
              {motivos.map((m) => <option key={m.codigo} value={m.codigo}>{m.codigo} — {m.descripcion}</option>)}
            </Select>
          </div>
          <Button type="button" size="sm" variant="secondary" isLoading={guardando}
            disabled={!motivo || motivo === documento.motivo_nota_codigo} onClick={guardarMotivo}>
            Guardar motivo
          </Button>
        </div>
      )}

      {errores && <AlertaFormulario titulo="No se pudo completar la operación" mensajes={errores} />}
      {resultado && (
        <ResultadoValidacion
          listo={resultado.listo}
          errores={resultado.errores}
          advertencias={resultado.advertencias}
          etiquetaListo={ETIQUETA_PREPARACION.LISTO_PARA_EMISION}
          etiquetaNoListo={ETIQUETA_PREPARACION.NO_PREPARADO}
        />
      )}
    </section>
  )
}
