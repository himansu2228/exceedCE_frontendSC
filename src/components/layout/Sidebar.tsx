import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  CalendarCheck2,
  Workflow,
  ClipboardList,
  BarChart3,
  FileSpreadsheet,
  ChartColumnBig,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getTenantAccessProfile, signOut, setActiveState, normalizeStateCode } from '@/lib/auth'

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

const superAdminSalesItems = [
  { path: '/sales/dashboard', icon: BarChart3, label: 'Sales Dashboard' },
  { path: '/sales/reports', icon: FileSpreadsheet, label: 'Sales Reports' },
  { path: '/sales/analytics', icon: ChartColumnBig, label: 'Sales Analytics' },
]

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const tenant = getTenantAccessProfile()
  const isSuperAdmin = tenant.isSuperAdmin

  const tenantNavItems = isSuperAdmin
    ? superAdminSalesItems
    : navItems

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
        <img
          src={collapsed ? '/exceedce.com-favicon.ico' : 'https://exceedce-v4.s3.amazonaws.com/public/exceedcelogo-92e2adb1fbbffd331d17d2f64ebd4410.png'}
          alt="ExceedCE logo"
          className={cn('relative h-10 w-auto object-contain', collapsed && 'h-8 w-8')}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {!collapsed && tenant.allowedStates && (
          <div className="px-1 pb-2">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">Active State</p>
            <Select
              value={tenant.stateCode}
              onValueChange={(code) => {
                setActiveState(code)
                window.location.reload()
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
            <p>{tenant.isSuperAdmin ? 'Global Control Tower' : `${tenant.stateName} Pipeline`}</p>
            <p className="mt-1">v1.0.0</p>
          </div>
        )}
      </div>
    </aside>
  )
}
