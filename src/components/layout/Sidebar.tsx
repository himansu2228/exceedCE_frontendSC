import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  CalendarCheck2,
  Workflow,
  ClipboardList,
  BarChart3,
  BadgeCheck,
  X,
  ShoppingCart,
  Users2,
  Boxes,
  Wallet,
  Receipt,
  RotateCcw,
  FileSpreadsheet,
  ListChecks,
  ShieldAlert,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Zap,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getTenantAccessProfile, signOut, setActiveState, normalizeStateCode } from '@/lib/auth'
import { apiUrl } from '@/lib/api'
import { getHiddenPipelineTabLabel } from '@/lib/ceBrokerPipeline'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/courses', icon: GraduationCap, label: 'Courses' },
  { path: '/submissions', icon: Users, label: 'Submissions' },
  { path: '/completed', icon: CalendarCheck2, label: 'Completed' },
  { path: '/pipeline', icon: Workflow, label: 'CE Broker Pipeline' },
  { path: '/roster-posting', icon: ClipboardList, label: 'Roster Post' },
  { path: '/logs', icon: FileText, label: 'Logs' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

type NavItem =
  | { path: string; icon: typeof LayoutDashboard; label: string }
  | {
      label: string
      icon: typeof LayoutDashboard
      children: Array<{ path: string; label: string }>
    }

const getSuperAdminSalesItems = (): NavItem[] => {
  const items: NavItem[] = [
    { path: '/sales/dashboard', icon: BarChart3, label: 'Sales Dashboard' },
    { path: '/sales/reports', icon: FileSpreadsheet, label: 'Sales Reports' },
    { path: '/sales/orders', icon: ShoppingCart, label: 'Orders' },
    { path: '/sales/customers', icon: Users2, label: 'Customers' },
    { path: '/sales/products', icon: Boxes, label: 'Products / Courses' },
    { path: '/sales/revenue', icon: Wallet, label: 'Revenue' },
    { path: '/sales/transactions', icon: Receipt, label: 'Transactions' },
    { path: '/sales/refunds', icon: RotateCcw, label: 'Refunds' },
  ]

  // Only show Sync Logs and Failed Syncs in development
  if (import.meta.env.DEV) {
    items.push(
      { path: '/sales/sync-logs', icon: ListChecks, label: 'Sync Logs' },
      { path: '/sales/failed-syncs', icon: ShieldAlert, label: 'Failed Syncs' }
    )
  }

  items.push(
    {
      label: 'CBA',
      icon: Zap,
      children: [
        { path: '/sales/cba', label: 'CBA Master List' },
        { path: '/sales/cba-sales', label: 'Out-of-State Sales' },
        { path: '/sales/cba-completion', label: 'CBA Completion' },
      ],
    },
    { path: '/sales/crcbr', icon: Target, label: 'CRCBR' },
    { path: '/sales/settings', icon: Settings, label: 'Sales Settings' }
  )

  return items
}

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [cbaMenuOpen, setCbaMenuOpen] = useState(false)
  const [activeStateCode, setActiveStateCode] = useState(() => normalizeStateCode(getTenantAccessProfile().stateCode || 'SC'))
  const location = useLocation()
  const navigate = useNavigate()
  const tenant = getTenantAccessProfile()
  const isSuperAdmin = tenant.isSuperAdmin

  useEffect(() => {
    const syncActiveState = () => {
      const currentTenant = getTenantAccessProfile()
      const normalized = normalizeStateCode(currentTenant.stateCode || 'SC')
      setActiveStateCode((previous) => (previous === normalized ? previous : normalized))
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'exceedce-active-state') {
        syncActiveState()
      }
    }

    const onActiveStateChanged = () => {
      syncActiveState()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('exceedce:active-state-changed', onActiveStateChanged as EventListener)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('exceedce:active-state-changed', onActiveStateChanged as EventListener)
    }
  }, [])

  const maskedPipelineLabel = getHiddenPipelineTabLabel(activeStateCode)

  const tenantNavItems = useMemo<NavItem[]>(() => {
    if (isSuperAdmin) return getSuperAdminSalesItems()
    return navItems.map((item) => {
      if (item.path !== '/pipeline') return item
      return {
        ...item,
        label: maskedPipelineLabel,
      }
    })
  }, [isSuperAdmin, maskedPipelineLabel])

  const handleLogout = () => {
    signOut()
    onMobileClose()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className={cn(
        'brand-sidebar fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 text-white transition-all duration-300 lg:relative lg:translate-x-0',
        collapsed ? 'w-16' : 'w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Logo */}
      <div className="relative flex h-16 items-center justify-center border-b border-white/10 px-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
        <div className="pointer-events-none absolute -top-10 left-1/2 h-24 w-40 -translate-x-1/2 rounded-full bg-blue-500/30 blur-2xl" />
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close sidebar"
          className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-slate-200 shadow-sm backdrop-blur-sm transition-colors hover:border-white/30 hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 sm:right-3 sm:top-3 sm:h-9 sm:w-9 lg:hidden"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <img
          src={collapsed ? '/exceedce.com-favicon.ico' : 'https://exceedce-v4.s3.amazonaws.com/public/exceedcelogo-92e2adb1fbbffd331d17d2f64ebd4410.png'}
          alt="ExceedCE logo"
          className={cn('relative h-10 max-w-[calc(100%-3rem)] w-auto object-contain', collapsed && 'h-8 w-8')}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {!collapsed && tenant.allowedStates && (
          <div className="px-1 pb-2">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">Active State</p>
            <Select
              value={activeStateCode}
              onValueChange={(code) => {
                // Stop any active pipeline run in the previous state scope before switching.
                fetch(apiUrl('/api/pipeline/stop'), { method: 'POST' }).catch(() => {})
                fetch(apiUrl('/api/roster-pipeline/stop'), { method: 'POST' }).catch(() => {})
                setActiveState(code)
                setActiveStateCode(normalizeStateCode(code))
              }}
            >
              <SelectTrigger className="h-8 w-full border-white/15 bg-white/10 text-xs text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tenant.allowedStates.map((name) => {
                  const code = normalizeStateCode(name)
                  return (
                    <SelectItem key={code} value={code}>
                      {name}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        )}
        {tenantNavItems.map((item) => {
          if ('children' in item) {
            const isCbaActive = item.children.some((child) => location.pathname === child.path || location.pathname.startsWith(`${child.path}/`))
            const isExpanded = cbaMenuOpen

            if (collapsed) {
              return (
                <NavLink
                  key={item.label}
                  to={item.children[0].path}
                  onClick={onMobileClose}
                  title={item.label}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isCbaActive
                      ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 text-white shadow-[0_14px_30px_-14px_rgba(37,99,235,0.9)] ring-1 ring-blue-400/40'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', isCbaActive && 'text-amber-300')} />
                </NavLink>
              )
            }

            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => setCbaMenuOpen((open) => !open)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isCbaActive
                      ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 text-white shadow-[0_14px_30px_-14px_rgba(37,99,235,0.9)] ring-1 ring-blue-400/40'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', isCbaActive && 'text-amber-300')} />
                  <span>{item.label}</span>
                  <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
                </button>
                {isExpanded && (
                  <div className="ml-5 mt-1 space-y-1 border-l border-white/15 pl-2">
                    {item.children.map((child) => {
                      const isActive = location.pathname === child.path || location.pathname.startsWith(`${child.path}/`)
                      return (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          onClick={onMobileClose}
                          className={cn(
                            'flex rounded-md px-3 py-2 text-xs font-medium transition-all duration-200',
                            isActive ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          {child.label}
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 text-white shadow-[0_14px_30px_-14px_rgba(37,99,235,0.9)] ring-1 ring-blue-400/40'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-amber-300')} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 hidden h-6 w-6 rounded-full border border-white/20 bg-slate-900/90 text-white shadow-[0_8px_20px_-8px_rgba(15,23,42,0.9)] hover:bg-slate-800 lg:inline-flex"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Footer */}
      <div className={cn('border-t border-white/10 p-4', collapsed && 'px-2')}>
        <Button
          type="button"
          variant="ghost"
          onClick={handleLogout}
          title="Logout"
          className={cn(
            'mb-3 flex w-full items-center rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-2.5 text-red-200 backdrop-blur-md transition-colors hover:bg-red-500/30 hover:text-red-100',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2 text-sm font-medium">Logout</span>}
        </Button>

        {!collapsed && (
          <div className="text-xs text-slate-400">
            <p>{tenant.isSuperAdmin ? 'Global Control Tower' : `${maskedPipelineLabel} Workspace`}</p>
            <p className="mt-1">v1.0.0</p>
          </div>
        )}
      </div>
    </aside>
  )
}
