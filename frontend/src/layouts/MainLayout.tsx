import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Boxes,
  LayoutDashboard,
  FileSpreadsheet,
  ClipboardList,
  ArrowLeftRight,
  ScanLine,
  BookOpenCheck,
  Lock,
  FileCheck2,
  AlertTriangle,
  Package,
  Warehouse,
  Users,
  Layers,
  CalendarRange,
  Globe,
  Building2,
  ShieldCheck,
  ShoppingCart,
  Receipt,
  FileMinus,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  User as UserIcon,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { Badge } from '../components/ui/badge'
import { NAV_SECCIONES, itemActivo, type IconoNav } from '../navegacion'

// El orden y las rutas del menú viven en src/navegacion.ts (probado con node --test).
const ICONOS: Record<IconoNav, LucideIcon> = {
  dashboard: LayoutDashboard,
  empresas: Building2,
  periodos: CalendarRange,
  catalogos: Globe,
  productos: Package,
  almacenes: Warehouse,
  terceros: Users,
  saldoInicial: ClipboardList,
  inventario: Layers,
  compras: ShoppingCart,
  ventas: Receipt,
  comprobantes: FileSpreadsheet,
  notas: FileMinus,
  transferencias: ArrowLeftRight,
  captura: ScanLine,
  kardex: BookOpenCheck,
  incidencias: AlertTriangle,
  cierres: Lock,
  formato131: FileCheck2,
  auditoria: ShieldCheck,
}

export const MainLayout: React.FC = () => {
  const { usuario, empresaActiva, empresasDisponibles, seleccionarEmpresa, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Sección y opción activas para el encabezado
  const getActiveInfo = () => {
    const activo = itemActivo(location.pathname)
    if (activo) return { section: activo.seccion.title, item: activo.item.label, Icon: ICONOS[activo.item.icono] }
    return { section: 'INICIO', item: 'Dashboard', Icon: LayoutDashboard }
  }

  const activeInfo = getActiveInfo()
  const esAdmin = Boolean(usuario?.es_admin_global || empresaActiva?.rol === 'ADMIN')

  return (
    <div className="flex min-h-screen bg-slate-50/60 font-sans text-slate-900 antialiased">
      {/* 1. SIDEBAR IZQUIERDO */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200/80 bg-white transition-all duration-200 ease-in-out shadow-xs ${
          collapsed ? 'w-18' : 'w-64'
        }`}
      >
        {/* Branding */}
        <div className="flex h-16 items-center px-4 border-b border-slate-100">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Boxes className="h-5 w-5" strokeWidth={1.75} />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-bold tracking-tight text-slate-900 font-sans">FACT-KARD</span>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">ERP Kardex SUNAT v1.0</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {NAV_SECCIONES.map((section) => (
            <div key={section.title} className="space-y-1">
              {!collapsed ? (
                <div className="px-2 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  {section.title}
                </div>
              ) : (
                <div className="my-2 border-t border-slate-100" />
              )}
              {section.items.map((item) => {
                const ItemIcon = ICONOS[item.icono]
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors select-none ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-2xs border border-indigo-100/60'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      } ${collapsed ? 'justify-center px-0' : ''}`
                    }
                  >
                    <ItemIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer info */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-100 bg-slate-50/50">
            <div className="rounded-lg bg-white p-2.5 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  SUNAT Res. 234-2006
                </span>
                <span className="text-[10px] font-mono text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  CPP 6 DEC
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* 2. ÁREA PRINCIPAL */}
      <div className={`flex flex-1 flex-col transition-all duration-200 ease-in-out ${collapsed ? 'pl-18' : 'pl-64'}`}>
        {/* Topbar Superior Fijo */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur-xs">
          {/* Left: Collapse Button + Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>

            <div className="h-4 w-px bg-slate-200" />

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-medium text-slate-400">{activeInfo.section}</span>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <activeInfo.Icon className="h-3.5 w-3.5 text-indigo-600" strokeWidth={1.75} />
                <span>{activeInfo.item}</span>
              </div>
            </div>
          </div>

          {/* Right: Empresa Activa Selector, User Badge & Logout */}
          <div className="flex items-center gap-3">
            {/* Selector de Empresa */}
            {empresasDisponibles && empresasDisponibles.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 shadow-2xs">
                <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" strokeWidth={1.75} />
                <select
                  aria-label="Seleccionar empresa activa"
                  value={empresaActiva?.id || ''}
                  onChange={(e) => seleccionarEmpresa(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[220px] truncate"
                >
                  {empresasDisponibles.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.ruc} — {emp.razon_social}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Rol Badge */}
            <Badge
              variant={esAdmin ? 'info' : 'neutral'}
              size="sm"
              className="gap-1.5 font-semibold py-1 px-2.5 inline-flex items-center select-none"
            >
              <Shield
                className={`h-3.5 w-3.5 shrink-0 ${esAdmin ? 'text-indigo-600' : 'text-slate-500'}`}
                strokeWidth={2}
              />
              <span className="leading-none text-[11px] tracking-wide">{esAdmin ? 'ADMIN' : 'USUARIO'}</span>
            </Badge>

            {/* Usuario Avatar & Name */}
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300/60 shadow-2xs">
                <UserIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </div>
              <span className="hidden sm:inline-block text-xs font-medium text-slate-700 max-w-[120px] truncate">
                {usuario?.username || 'Usuario'}
              </span>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors shadow-2xs cursor-pointer ml-1"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* 3. CONTENIDO DE LA PÁGINA */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
