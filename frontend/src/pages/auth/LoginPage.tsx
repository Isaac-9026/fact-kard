import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { RUTA_INICIAL } from '../../navegacion'
import { loginApi } from '../../api/auth'
import type { AxiosError } from 'axios'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent } from '../../components/ui/card'

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 md:p-10 font-sans">
      <div className="w-full max-w-sm md:max-w-3xl">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
            <CardContent className="grid p-0 md:grid-cols-2">
              <form onSubmit={handleSubmit} className="p-6 md:p-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col items-center text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                      Bienvenido de nuevo
                    </h1>
                    <p className="text-balance text-sm text-slate-500">
                      Inicie sesión en su cuenta FACT-KARD
                    </p>
                  </div>

                  {errorMsg && (
                    <div
                      className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
                      role="alert"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                      <span className="font-medium leading-relaxed">{errorMsg}</span>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="username-input" required>
                      Usuario o Email
                    </Label>
                    <Input
                      id="username-input"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin_demo"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <Label htmlFor="password-input" required>
                        Contraseña
                      </Label>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          alert('Para restablecer su contraseña, contacte al administrador del sistema.')
                        }}
                        className="ml-auto text-sm text-slate-500 underline-offset-2 hover:underline"
                      >
                        ¿Olvidó su contraseña?
                      </a>
                    </div>
                    <Input
                      id="password-input"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isLoading}
                    className="w-full font-medium"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Iniciando sesión...
                      </>
                    ) : (
                      'Iniciar Sesión'
                    )}
                  </Button>

                  <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-slate-200">
                    <span className="relative z-10 bg-white px-2 text-xs text-slate-500">
                      O continuar con
                    </span>
                  </div>

                  {/* Botones de proveedores de la plantilla shadcn login-04 (bloqueados según la especificación) */}
                  <div className="grid grid-cols-3 gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full opacity-60 cursor-not-allowed border-slate-200"
                      disabled
                      title="Acceso con Apple no disponible"
                    >
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path
                          d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="sr-only">Iniciar sesión con Apple</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full opacity-60 cursor-not-allowed border-slate-200"
                      disabled
                      title="Acceso con Google no disponible"
                    >
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path
                          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="sr-only">Iniciar sesión con Google</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full opacity-60 cursor-not-allowed border-slate-200"
                      disabled
                      title="Acceso con Meta no disponible"
                    >
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path
                          d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="sr-only">Iniciar sesión con Meta</span>
                    </Button>
                  </div>

                  <div className="text-center text-sm text-slate-500">
                    ¿No tiene una cuenta?{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        alert('El registro de usuarios lo gestiona el administrador de su empresa.')
                      }}
                      className="underline underline-offset-4 text-slate-900 hover:text-indigo-600 font-medium"
                    >
                      Contactar soporte
                    </a>
                  </div>
                </div>
              </form>

              {/* Columna Derecha: Panel de imagen de shadcn login-04 */}
              <div className="relative hidden bg-slate-100 md:block border-l border-slate-100">
                <img
                  src="/placeholder.svg"
                  alt="FACT-KARD"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </CardContent>
          </Card>

          <div className="text-balance text-center text-xs text-slate-500 [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-slate-900">
            Al continuar, acepta los <a href="#" onClick={(e) => e.preventDefault()}>Términos del Servicio</a> y la{' '}
            <a href="#" onClick={(e) => e.preventDefault()}>Política de Privacidad</a> de FACT-KARD.
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
