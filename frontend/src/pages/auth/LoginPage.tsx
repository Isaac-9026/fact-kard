import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, User, Lock, AlertCircle, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { RUTA_INICIAL } from '../../navegacion'
import { loginApi } from '../../api/auth'
import type { AxiosError } from 'axios'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin_demo')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!username.trim() || !password) {
      setErrorMsg('Por favor ingrese su usuario y contraseña.')
      return
    }

    try {
      setIsLoading(true)
      const data = await loginApi({
        username: username.trim(),
        password,
      })

      login(data.token ?? null, data.usuario, data.empresas)
      navigate(RUTA_INICIAL)
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>
      if (axiosError.response?.data?.detail) {
        setErrorMsg(axiosError.response.data.detail)
      } else if (axiosError.message === 'Network Error') {
        setErrorMsg('Error de conexión: No se pudo contactar al servidor backend.')
      } else {
        setErrorMsg('Error al iniciar sesión. Verifique sus credenciales.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50 overflow-hidden font-sans">
      {/* Background technical accounting pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(#94a3b8 1px, transparent 1px), radial-gradient(#cbd5e1 1px, #f8fafc 1px)',
          backgroundSize: '32px 32px',
          backgroundPosition: '0 0, 16px 16px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Main Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-8 shadow-xl shadow-slate-200/60">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20 mb-4">
              <Boxes className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">FACT-KARD</h1>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Sistema de Gestión y Kardex Permanente Valorizado SUNAT
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-700 animate-in fade-in"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username-input" required>
                Usuario o Identificador
              </Label>
              <Input
                id="username-input"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: admin_demo"
                required
                disabled={isLoading}
                leftIcon={<User className="h-4 w-4" />}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password-input" required>
                Contraseña
              </Label>
              <Input
                id="password-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                leftIcon={<Lock className="h-4 w-4" />}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              className="w-full mt-2 font-semibold shadow-md shadow-indigo-600/15"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Iniciando sesión...
                </>
              ) : (
                'Ingresar al Sistema'
              )}
            </Button>
          </form>

          {/* Compliance features badge list */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Multi-empresa estricto</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>CPP con 6 decimales</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Auditoría inmutable</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Formato 13.1 SUNAT</span>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col items-center gap-1 text-center">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
              <span>Conexión segura SSL/TLS</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              FACT-KARD v1.0 • R.S. N.° 234-2006/SUNAT
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
