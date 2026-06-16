import { RefreshCw, User } from 'lucide-react'
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
}

export function Header({ onRefresh, isLoading }: HeaderProps) {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Dashboard'

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">
          ExceedCE → CE Broker Automation System
        </p>
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

        <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
            <User className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-slate-900">Admin</p>
            <p className="text-xs text-slate-500">Provider #32093</p>
          </div>
        </div>
      </div>
    </header>
  )
}
