/**
 * Bloque 17B — "Preparación SUNAT": muestra SOLO el estado (ambiente, credenciales, certificado).
 * No hay campos para usuario/clave SOL ni certificado: se configuran en el servidor (backend/.env).
 * Todavía no se conecta a SUNAT.
 */
import { useEffect, useState } from 'react'
import { CheckCircle2, CircleDashed, ShieldCheck } from 'lucide-react'
import { obtenerEstadoSunat, type EstadoSunat } from '../../api/empresas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { AlertaFormulario } from '../ui/alerta-formulario'
import { mensajesDeErrorApi } from '../../utils/errores'
import { filasEstadoSunat } from '../../utils/estadoSunat'

export function PreparacionSunatCard() {
  const [estado, setEstado] = useState<EstadoSunat | null>(null)
  const [error, setError] = useState<string[] | null>(null)

  useEffect(() => {
    let vigente = true
    obtenerEstadoSunat()
      .then((e) => { if (vigente) setEstado(e) })
      .catch((e) => { if (vigente) setError(mensajesDeErrorApi(e, 'No se pudo consultar el estado SUNAT.')) })
    return () => { vigente = false }
  }, [])

  return (
    <Card data-testid="preparacion-sunat">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Preparación SUNAT</CardTitle>
        <CardDescription>
          Credenciales y certificado se configuran solo en el servidor (variables de entorno), nunca aquí.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <AlertaFormulario titulo="No disponible" mensajes={error} />}
        {estado && (
          <>
            <dl className="space-y-1.5 text-xs">
              {filasEstadoSunat(estado).map((f) => (
                <div key={f.etiqueta} className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">{f.etiqueta}</dt>
                  <dd className={`flex items-center gap-1 font-medium ${f.ok ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {f.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
                    {f.valor}
                  </dd>
                </div>
              ))}
            </dl>
            {estado.faltantes.length > 0 && (
              <p className="text-[11px] text-slate-500" data-testid="sunat-faltantes">
                Falta definir: {estado.faltantes.map((f) => <code key={f} className="mx-0.5 rounded bg-slate-100 px-1">{f}</code>)}
              </p>
            )}
            {estado.advertencias.map((a) => <p key={a} className="text-[11px] text-amber-700">{a}</p>)}
          </>
        )}
      </CardContent>
    </Card>
  )
}
