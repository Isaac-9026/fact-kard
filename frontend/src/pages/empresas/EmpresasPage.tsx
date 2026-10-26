import React, { useCallback, useEffect, useState, type FormEvent } from 'react'
import axios from 'axios'
import {
  Building2,
  MapPin,
  Sliders,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Save,
  Check,
} from 'lucide-react'
import {
  actualizarConfigEmpresa,
  actualizarEstablecimiento,
  crearEmpresa,
  crearEstablecimiento,
  obtenerConfigEmpresa,
  obtenerEstablecimientos,
  obtenerMonedas,
  type ConfigEmpresa,
  type Establecimiento,
  type Moneda,
} from '../../api/empresas'
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
import { diferirCarga } from '../../utils/efectos'

const mensajeError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data === 'string') return data
    if (data && typeof data === 'object') return Object.values(data).flat().join(' ')
  }
  return 'No se pudo completar la operación.'
}

export const EmpresasPage: React.FC = () => {
  const {
    empresaActiva,
    empresasDisponibles,
    registrarEmpresaDisponible,
    refrescarEmpresasDisponibles,
    seleccionarEmpresa,
  } = useAuth()
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([])
  const [config, setConfig] = useState<ConfigEmpresa | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mostrarEmpresa, setMostrarEmpresa] = useState(false)
  const [editando, setEditando] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('empresas')

  const [empresaForm, setEmpresaForm] = useState({
    ruc: '',
    razon_social: '',
    nombre_comercial: '',
    direccion: '',
    moneda_base_codigo: 'PEN',
  })
  const [establecimientoForm, setEstablecimientoForm] = useState({
    codigo_sunat: '',
    nombre: '',
    activo: true,
  })
  const [configForm, setConfigForm] = useState({
    tolerancia_residuo_pen: '0.05000000',
    decimales_calculo: 6,
    establecimiento_principal: '',
  })

  const cargarDatosEmpresa = useCallback(async () => {
    if (!empresaActiva) {
      setEstablecimientos([])
      setConfig(null)
      return
    }
    const [lista, configuracion] = await Promise.all([obtenerEstablecimientos(), obtenerConfigEmpresa()])
    setEstablecimientos(lista)
    setConfig(configuracion)
    setConfigForm({
      tolerancia_residuo_pen: configuracion.tolerancia_residuo_pen,
      decimales_calculo: configuracion.decimales_calculo,
      establecimiento_principal: configuracion.establecimiento_principal?.toString() ?? '',
    })
  }, [empresaActiva])

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      setError('')
      try {
        const [, listaMonedas] = await Promise.all([refrescarEmpresasDisponibles(), obtenerMonedas()])
        setMonedas(listaMonedas)
      } catch (err) {
        setError(mensajeError(err))
      } finally {
        setLoading(false)
      }
    }
    void cargar()
  }, [refrescarEmpresasDisponibles])

  useEffect(() => {
    const cargar = async () => {
      if (!empresaActiva) {
        setEstablecimientos([])
        setConfig(null)
        return
      }
      setError('')
      try {
        await cargarDatosEmpresa()
      } catch (err) {
        setError(mensajeError(err))
      }
    }
    diferirCarga(cargar)
  }, [cargarDatosEmpresa, empresaActiva])

  const ejecutar = async (accion: () => Promise<void>, mensaje: string) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await accion()
      setSuccess(mensaje)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setSaving(false)
    }
  }

  const guardarEmpresa = (event: FormEvent) => {
    event.preventDefault()
    void ejecutar(async () => {
      const nueva = await crearEmpresa(empresaForm)
      registrarEmpresaDisponible(nueva)
      setEmpresaForm({ ruc: '', razon_social: '', nombre_comercial: '', direccion: '', moneda_base_codigo: 'PEN' })
      setMostrarEmpresa(false)
    }, 'Empresa creada y configurada correctamente.')
  }

  const guardarEstablecimiento = (event: FormEvent) => {
    event.preventDefault()
    void ejecutar(async () => {
      if (editando) await actualizarEstablecimiento(editando, establecimientoForm)
      else await crearEstablecimiento(establecimientoForm)
      setEstablecimientoForm({ codigo_sunat: '', nombre: '', activo: true })
      setEditando(null)
      setEstablecimientos(await obtenerEstablecimientos())
    }, editando ? 'Establecimiento actualizado.' : 'Establecimiento creado.')
  }

  const guardarConfig = (event: FormEvent) => {
    event.preventDefault()
    void ejecutar(async () => {
      const actualizada = await actualizarConfigEmpresa({
        tolerancia_residuo_pen: configForm.tolerancia_residuo_pen,
        decimales_calculo: configForm.decimales_calculo,
        establecimiento_principal: configForm.establecimiento_principal ? Number(configForm.establecimiento_principal) : null,
      })
      setConfig(actualizada)
    }, 'Configuración contable actualizada exitosamente.')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 text-sm">
        Cargando empresas y configuración…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas y Configuración"
        description="Administra organizaciones multi-tenant, establecimientos anexos SUNAT y parámetros de motor contable."
        icon={<Building2 className="h-5 w-5" />}
        actions={
          <Button
            variant={mostrarEmpresa ? 'secondary' : 'primary'}
            onClick={() => setMostrarEmpresa((v) => !v)}
          >
            {mostrarEmpresa ? (
              <>
                <X className="h-4 w-4 mr-1.5" /> Cancelar
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" /> Nueva Empresa
              </>
            )}
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

      {mostrarEmpresa && (
        <Card className="border-indigo-200/80 shadow-md">
          <CardHeader>
            <CardTitle>Registrar Nueva Empresa</CardTitle>
            <CardDescription>Crea una nueva organización con aislamiento estricto en base de datos.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={guardarEmpresa} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label required>RUC (11 dígitos)</Label>
                  <Input
                    required
                    minLength={11}
                    maxLength={11}
                    className="font-mono tabular-nums"
                    placeholder="20100000001"
                    value={empresaForm.ruc}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, ruc: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label required>Razón Social</Label>
                  <Input
                    required
                    placeholder="EMPRESA MODELO S.A.C."
                    value={empresaForm.razon_social}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, razon_social: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nombre Comercial</Label>
                  <Input
                    placeholder="NOMBRE COMERCIAL"
                    value={empresaForm.nombre_comercial}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, nombre_comercial: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Dirección Fiscal</Label>
                  <Input
                    placeholder="AV. EJEMPLO 123, LIMA"
                    value={empresaForm.direccion}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, direccion: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Moneda Base</Label>
                  <Select
                    value={empresaForm.moneda_base_codigo}
                    onChange={(e) => setEmpresaForm({ ...empresaForm, moneda_base_codigo: e.target.value })}
                  >
                    {monedas.map((m) => (
                      <option key={m.codigo} value={m.codigo}>
                        {m.codigo} — {m.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" isLoading={saving}>
                  <Save className="h-4 w-4 mr-1.5" /> Registrar Empresa
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="empresas" icon={<Building2 className="h-3.5 w-3.5" />}>
            Empresas Asignadas ({empresasDisponibles.length})
          </TabsTrigger>
          <TabsTrigger value="establecimientos" icon={<MapPin className="h-3.5 w-3.5" />}>
            Establecimientos SUNAT ({establecimientos.length})
          </TabsTrigger>
          <TabsTrigger value="configuracion" icon={<Sliders className="h-3.5 w-3.5" />}>
            Parámetros del Motor (ConfigEmpresa)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EMPRESAS ASIGNADAS */}
        <TabsContent value="empresas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Empresas Asignadas</CardTitle>
              <CardDescription>
                Empresas a las que tu usuario tiene acceso mediante <code className="font-mono text-slate-700">usuario_empresa</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {empresasDisponibles.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No tienes empresas asignadas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RUC</TableHead>
                      <TableHead>Razón Social</TableHead>
                      <TableHead>Rol Asignado</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empresasDisponibles.map((e) => {
                      const esActiva = empresaActiva?.id === e.id
                      return (
                        <TableRow key={e.id} className={esActiva ? 'bg-indigo-50/40' : undefined}>
                          <TableCell numeric className="font-semibold text-slate-900">{e.ruc}</TableCell>
                          <TableCell className="font-medium text-slate-900">{e.razon_social}</TableCell>
                          <TableCell>
                            <Badge variant={e.rol === 'ADMIN' ? 'info' : 'neutral'}>{e.rol}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="success" dot>ACTIVA</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant={esActiva ? 'secondary' : 'outline'}
                              disabled={esActiva}
                              onClick={() => seleccionarEmpresa(e.id)}
                            >
                              {esActiva ? (
                                <>
                                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Activa
                                </>
                              ) : (
                                'Seleccionar'
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: ESTABLECIMIENTOS ANEXOS SUNAT */}
        <TabsContent value="establecimientos" className="space-y-6">
          {!empresaActiva ? (
            <div className="p-8 text-center text-sm text-slate-500 rounded-xl border border-slate-200 bg-white">
              Selecciona una empresa activa para administrar sus establecimientos SUNAT.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Formulario */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>{editando ? 'Editar Establecimiento' : 'Nuevo Establecimiento SUNAT'}</CardTitle>
                  <CardDescription>Código de 4 dígitos (0000 = Principal).</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={guardarEstablecimiento} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label required>Código SUNAT (ej. 0000, 0001)</Label>
                      <Input
                        required
                        maxLength={20}
                        placeholder="0000"
                        className="font-mono tabular-nums"
                        value={establecimientoForm.codigo_sunat}
                        onChange={(e) => setEstablecimientoForm({ ...establecimientoForm, codigo_sunat: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label required>Nombre del Establecimiento</Label>
                      <Input
                        required
                        maxLength={150}
                        placeholder="OFICINA PRINCIPAL / PLANTA"
                        value={establecimientoForm.nombre}
                        onChange={(e) => setEstablecimientoForm({ ...establecimientoForm, nombre: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="est-activo"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        checked={establecimientoForm.activo}
                        onChange={(e) => setEstablecimientoForm({ ...establecimientoForm, activo: e.target.checked })}
                      />
                      <Label htmlFor="est-activo" className="cursor-pointer">
                        Establecimiento Activo
                      </Label>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button type="submit" variant="primary" isLoading={saving} className="flex-1">
                        {editando ? 'Actualizar' : 'Crear'}
                      </Button>
                      {editando && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setEditando(null)
                            setEstablecimientoForm({ codigo_sunat: '', nombre: '', activo: true })
                          }}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Lista */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Establecimientos Registrados ({establecimientos.length})</CardTitle>
                  <CardDescription>Puntos de venta y sucursales declaradas ante SUNAT.</CardDescription>
                </CardHeader>
                <CardContent>
                  {establecimientos.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">Aún no hay establecimientos registrados.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código SUNAT</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {establecimientos.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell numeric className="font-semibold text-slate-900">{e.codigo_sunat}</TableCell>
                            <TableCell className="font-medium text-slate-900">{e.nombre}</TableCell>
                            <TableCell>
                              <Badge variant={e.activo ? 'success' : 'neutral'} dot>
                                {e.activo ? 'ACTIVO' : 'INACTIVO'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditando(e.id)
                                  setEstablecimientoForm({
                                    codigo_sunat: e.codigo_sunat,
                                    nombre: e.nombre,
                                    activo: e.activo,
                                  })
                                }}
                              >
                                Editar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: PARÁMETROS DEL MOTOR (ConfigEmpresa) */}
        <TabsContent value="configuracion" className="space-y-4">
          {!empresaActiva ? (
            <div className="p-8 text-center text-sm text-slate-500 rounded-xl border border-slate-200 bg-white">
              Selecciona una empresa activa para consultar su configuración contable.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Parámetros de Cálculo Contable y Kardex</CardTitle>
                  <CardDescription>
                    Políticas matemáticas del motor CPP y tolerancia de residuos según R.S. N.° 234-2006.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={guardarConfig} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label required>Tolerancia de Residuo PEN</Label>
                        <Input
                          required
                          inputMode="decimal"
                          pattern="^\d+(\.\d{1,8})?$"
                          className="font-mono tabular-nums"
                          value={configForm.tolerancia_residuo_pen}
                          onChange={(e) => setConfigForm({ ...configForm, tolerancia_residuo_pen: e.target.value })}
                        />
                        <p className="text-[10px] text-slate-400">Residuo contable absorbible (máx. S/ 0.05000000).</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label required>Decimales de Cálculo (Operativos)</Label>
                        <Input
                          required
                          type="number"
                          min={2}
                          max={8}
                          className="font-mono tabular-nums"
                          value={configForm.decimales_calculo}
                          onChange={(e) => setConfigForm({ ...configForm, decimales_calculo: Number(e.target.value) })}
                        />
                        <p className="text-[10px] text-slate-400">Estándar nacional: 6 decimales para CPP.</p>
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Establecimiento Principal (Receptor de Ajustes de Redondeo)</Label>
                        <Select
                          value={configForm.establecimiento_principal}
                          onChange={(e) => setConfigForm({ ...configForm, establecimiento_principal: e.target.value })}
                        >
                          <option value="">Sin asignar</option>
                          {establecimientos.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.codigo_sunat} — {e.nombre}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button type="submit" variant="primary" isLoading={saving}>
                        <Save className="h-4 w-4 mr-1.5" /> Guardar Configuración
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Panel de Políticas Inmutables */}
              <Card className="lg:col-span-1 bg-slate-50/50">
                <CardHeader>
                  <CardTitle className="text-sm">Reglas Inmutables del Motor</CardTitle>
                  <CardDescription>Políticas fijas impuestas por la normativa fiscal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-xs text-slate-600">Método de Valuación:</span>
                    <Badge variant="info" className="font-mono">{config?.metodo_valuacion ?? 'CPP'}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-xs text-slate-600">Regla de Redondeo:</span>
                    <Badge variant="neutral" className="font-mono">{config?.regla_redondeo ?? 'ROUND_HALF_UP'}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-xs text-slate-600">Almacenamiento en BD:</span>
                    <Badge variant="neutral" className="font-mono">8 DECIMALES</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-xs text-slate-600">Triggers de Modificación:</span>
                    <Badge variant="success" dot>ACTIVOS</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default EmpresasPage
