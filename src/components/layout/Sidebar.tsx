import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Workflow,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/courses', icon: GraduationCap, label: 'Courses' },
  { path: '/submissions', icon: Users, label: 'Submissions' },
  { path: '/pipeline', icon: Workflow, label: 'CE Broker Pipeline' },
  { path: '/logs', icon: FileText, label: 'Logs' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-slate-900 text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-slate-700 px-4">
        <img
          src="https://exceedce-v4.s3.amazonaws.com/public/exceedcelogo-92e2adb1fbbffd331d17d2f64ebd4410.png"
          alt="ExceedCE logo"
          className={cn('h-10 w-auto object-contain', collapsed && 'h-8')}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-slate-800 text-white hover:bg-slate-700"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Footer */}
      <div className={cn('border-t border-slate-700 p-4', collapsed && 'px-2')}>
        {!collapsed && (
          <div className="text-xs text-slate-400">
            <p>South Carolina Pipeline</p>
            <p className="mt-1">v1.0.0</p>
          </div>
        )}
      </div>
    </aside>
  )
}
