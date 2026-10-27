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
  Menu,
  X,
  SlidersHorizontal,
  Database,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { Badge } from '../components/ui/badge'
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from '../components/ui/sidebar'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '../components/ui/collapsible'
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

const ICONOS_SECCION: Record<string, LucideIcon> = {
  INICIO: LayoutDashboard,
  CONFIGURACIÓN: SlidersHorizontal,
  MAESTROS: Database,
  'INVENTARIO INICIAL': Layers,
  OPERACIONES: ArrowLeftRight,
  KARDEX: BookOpenCheck,
  'CIERRE Y REPORTES': FileCheck2,
  SEGURIDAD: ShieldCheck,
}

interface NavSectionGroupProps {
  section: (typeof NAV_SECCIONES)[number]
  compacto: boolean
  onItemClick: () => void
  currentPath: string
}

const NavSectionGroup: React.FC<NavSectionGroupProps> = ({
  section,
  compacto,
  onItemClick,
  currentPath,
}) => {
  const tieneActivo = section.items.some(
    (item) => currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path))
  )
  const [open, setOpen] = useState(true)
  const SectionIcon = ICONOS_SECCION[section.title] || Boxes

  React.useEffect(() => {
    if (tieneActivo) {
      setOpen(true)
    }
  }, [tieneActivo, currentPath])

  if (compacto) {
    return (
      <SidebarGroup key={section.title} className="py-1">
        <SidebarSeparator />
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {section.items.map((item) => {
              const ItemIcon = ICONOS[item.icono]
              return (
                <SidebarMenuItem key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={onItemClick}
                    title={item.label}
                    className={({ isActive }) =>
                      `peer/menu-button flex w-full items-center justify-center rounded-lg py-1.5 text-xs font-medium transition-colors select-none outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-2xs border border-indigo-100/60'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`
                    }
                  >
                    <ItemIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  </NavLink>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <Collapsible
      key={section.title}
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarGroup className="py-1">
        <SidebarGroupLabel className="p-0 h-auto">
          <CollapsibleTrigger className="flex h-7 w-full items-center justify-between rounded-md px-2 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 transition-colors cursor-pointer select-none group/trigger">
            <div className="flex items-center gap-2 min-w-0">
              <SectionIcon
                className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover/trigger:text-slate-900 transition-colors"
                strokeWidth={1.75}
              />
              <span className="text-[11px] font-bold tracking-wider uppercase truncate text-slate-700 group-hover/trigger:text-slate-900">
                {section.title}
              </span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover/trigger:text-slate-800 transition-transform duration-200 ease-out group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>

        <CollapsibleContent>
          <div className="ml-3.5 pl-2 my-0.5 border-l border-slate-200/80">
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
                  const ItemIcon = ICONOS[item.icono]
                  return (
                    <SidebarMenuItem key={item.path}>
                      <NavLink
                        to={item.path}
                        onClick={onItemClick}
                        className={({ isActive }) =>
                          `peer/menu-button flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors select-none outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-2xs border border-indigo-100/70'
                              : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                          }`
                        }
                      >
                        <ItemIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </div>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

export const MainLayout: React.FC = () => {
  const { usuario, empresaActiva, empresasDisponibles, seleccionarEmpresa, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  // Bloque 9: en móvil (< md) la barra lateral es un panel que se abre sobre el contenido.
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)
  // Con el panel móvil abierto siempre se muestran las etiquetas.
  const compacto = collapsed && !menuMovilAbierto

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
      {/* 1. SIDEBAR IZQUIERDO (shadcn sidebar) */}
      <Sidebar
        id="menu-principal"
        collapsed={compacto}
        mobileOpen={menuMovilAbierto}
        onCloseMobile={() => setMenuMovilAbierto(false)}
      >
        {/* Branding (SidebarHeader) */}
        <SidebarHeader>
          <div className="flex items-center gap-3 overflow-hidden w-full">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Boxes className="h-5 w-5" strokeWidth={1.75} />
            </div>
            {!compacto && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-bold tracking-tight text-slate-900 font-sans">FACT-KARD</span>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">ERP Kardex SUNAT v1.0</span>
              </div>
            )}
          </div>
        </SidebarHeader>

        {/* Navigation list (SidebarContent) */}
        <SidebarContent>
          {NAV_SECCIONES.map((section) => (
            <NavSectionGroup
              key={section.title}
              section={section}
              compacto={compacto}
              onItemClick={() => setMenuMovilAbierto(false)}
              currentPath={location.pathname}
            />
          ))}
        </SidebarContent>

        {/* Sidebar Footer */}
        <SidebarFooter className="border-t border-slate-100 bg-slate-50/50 p-2.5">
          {!compacto ? (
            <div className="flex items-center gap-2.5 rounded-lg bg-white p-2.5 border border-slate-200/80 shadow-2xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 font-semibold text-xs shadow-2xs">
                {usuario?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-xs font-semibold text-slate-800 truncate">
                  {usuario?.username || 'Usuario'}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {esAdmin ? 'Administrador' : 'Operador'}
                </span>
              </div>
            </div>
          ) : (
            <div
              className="flex justify-center"
              title={`${usuario?.username || 'Usuario'} (${esAdmin ? 'ADMIN' : 'USUARIO'})`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200/80 text-indigo-700 font-semibold text-xs shadow-2xs select-none">
                {usuario?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>

      {/* 2. ÁREA PRINCIPAL */}
      {/* min-w-0: sin esto una tabla ancha estira toda la columna y la página entera se desborda */}
      <div className={`flex min-w-0 flex-1 flex-col transition-all duration-200 ease-in-out ${collapsed ? 'md:pl-18' : 'md:pl-64'}`}>
        {/* Topbar Superior Fijo */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-3 sm:px-6 backdrop-blur-xs">
          {/* Left: Collapse Button + Breadcrumb */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
              className="md:hidden rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label={menuMovilAbierto ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuMovilAbierto}
              aria-controls="menu-principal"
            >
              {menuMovilAbierto ? <X className="h-4 w-4" strokeWidth={1.75} /> : <Menu className="h-4 w-4" strokeWidth={1.75} />}
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:inline-flex rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>

            <div className="hidden sm:block h-4 w-px bg-slate-200" />

            <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
              <span className="hidden lg:inline font-medium text-slate-400">{activeInfo.section}</span>
              <ChevronRight className="hidden lg:inline h-3 w-3 text-slate-300" />
              <div className="flex min-w-0 items-center gap-1.5 font-semibold text-slate-800">
                <activeInfo.Icon className="h-3.5 w-3.5 shrink-0 text-indigo-600" strokeWidth={1.75} />
                <span className="truncate">{activeInfo.item}</span>
              </div>
            </div>
          </div>

          {/* Right: Empresa Activa Selector, User Badge & Logout */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            {/* Selector de Empresa */}
            {empresasDisponibles && empresasDisponibles.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 shadow-2xs">
                <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" strokeWidth={1.75} />
                <select
                  aria-label="Seleccionar empresa activa"
                  value={empresaActiva?.id || ''}
                  onChange={(e) => seleccionarEmpresa(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[96px] sm:max-w-[150px] lg:max-w-[220px] truncate"
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
              className="gap-1.5 font-semibold py-1 px-2.5 hidden lg:inline-flex items-center select-none"
            >
              <Shield
                className={`h-3.5 w-3.5 shrink-0 ${esAdmin ? 'text-indigo-600' : 'text-slate-500'}`}
                strokeWidth={2}
              />
              <span className="leading-none text-[11px] tracking-wide">{esAdmin ? 'ADMIN' : 'USUARIO'}</span>
            </Badge>

            {/* Usuario Avatar & Name */}
            <div className="hidden lg:flex items-center gap-2 pl-1 border-l border-slate-200">
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
              <span className="hidden lg:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* 3. CONTENIDO DE LA PÁGINA */}
        <main className="min-w-0 flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
