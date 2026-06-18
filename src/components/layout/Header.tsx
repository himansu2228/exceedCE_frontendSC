import { Menu, RefreshCw, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocation } from 'react-router-dom'
import { NotificationsDropdown } from './NotificationsDropdown'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/courses': 'Courses',
  '/submissions': 'Submissions',
  '/pipeline': 'CE Broker Pipeline',
  '/logs': 'Activity Logs',
  '/settings': 'Settings',
}

interface HeaderProps {
  onRefresh?: () => void
  isLoading?: boolean
  onMenuClick?: () => void
  mobileMenuOpen?: boolean
}

export function Header({ onRefresh, isLoading, onMenuClick, mobileMenuOpen }: HeaderProps) {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Dashboard'

  return (
    <header className="brand-header flex h-16 items-center justify-between border-b border-border/80 px-4 backdrop-blur-sm sm:px-6">
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
          ExceedCE → CE Broker Automation System
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

        <div className="hidden items-center gap-2 rounded-lg bg-muted px-3 py-1.5 sm:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-foreground">Admin</p>
            <p className="text-xs text-muted-foreground">Provider #32093</p>
          </div>
        </div>
      </div>
    </header>
  )
}
