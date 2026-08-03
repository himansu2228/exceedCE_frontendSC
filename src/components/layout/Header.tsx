import { Menu, RefreshCw, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocation } from 'react-router-dom'
import { NotificationsDropdown } from './NotificationsDropdown'
import { getCurrentAuthUser, getTenantAccessProfile } from '@/lib/auth'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/courses': 'Courses',
  '/submissions': 'Submissions',
  '/completed': 'Completed',
  '/pipeline': 'CE Broker Pipeline',
  '/roster-posting': 'Roster Post',
  '/logs': 'Activity Logs',
  '/settings': 'Settings',
  '/sales/dashboard': 'Sales Dashboard',
  '/sales/reports': 'Sales Reports',
  '/sales/analytics': 'Sales Analytics',
}

interface HeaderProps {
  onRefresh?: () => void
  isLoading?: boolean
  onMenuClick?: () => void
  mobileMenuOpen?: boolean
}

export function Header({ onRefresh, isLoading, onMenuClick, mobileMenuOpen }: HeaderProps) {
  const location = useLocation()
  const authUser = getCurrentAuthUser()
  const tenant = getTenantAccessProfile()
  const title = pageTitles[location.pathname] || (tenant.isSuperAdmin ? 'Sales' : 'Dashboard')
  const roleLabel = tenant.isSuperAdmin ? 'Super Admin' : `${tenant.stateName} Admin`

  return (
    <header className="brand-header relative flex h-16 items-center justify-between px-4 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label={mobileMenuOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>

        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">{title}</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
            {tenant.isSuperAdmin
              ? 'ExceedCE Global Business Command Center'
              : `ExceedCE ${tenant.stateName} Operations Console`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}

        <NotificationsDropdown />

        <div className="hidden items-center gap-2 rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-1.5 shadow-[0_8px_24px_-14px_rgba(15,23,42,0.35)] backdrop-blur-md sm:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-amber-500 text-white shadow-[0_8px_18px_-8px_rgba(37,99,235,0.8)]">
            <User className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-foreground">{authUser?.username || roleLabel}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
