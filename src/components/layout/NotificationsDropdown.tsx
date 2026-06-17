import { useState, useEffect } from 'react'
import { Bell, CheckCircle2, XCircle, AlertTriangle, Info, Check, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useNavigate } from 'react-router-dom'
import { buildApiUrl, getNotifications, markAllNotificationsRead, clearAllNotifications, markNotificationsRead } from '@/lib/api'
import type { Notification } from '@/lib/api'

// Helper to format relative time
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

const typeIcons: Record<Notification['type'], React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
}

const typeBgColors: Record<Notification['type'], string> = {
  success: 'bg-green-50',
  error: 'bg-red-50',
  warning: 'bg-yellow-50',
  info: 'bg-blue-50',
}

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  // Real-time notifications using Server-Sent Events (SSE)
  useEffect(() => {
    let eventSource: EventSource | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    
    function connectSSE() {
      // Use the API proxy path for SSE
      eventSource = new EventSource(buildApiUrl('/api/notifications/stream'))
      
      eventSource.onopen = () => {
        console.log('[SSE] Connected to notifications stream')
        setLoading(false)
      }
      
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          
          if (payload.type === 'notifications') {
            // Full notifications update
            setNotifications(payload.data)
            setLoading(false)
          } else if (payload.type === 'new-notification') {
            // Single new notification - add to top of list
            setNotifications(prev => {
              const exists = prev.some(n => n.id === payload.data.id)
              if (exists) return prev
              return [payload.data, ...prev].slice(0, 10)
            })
          }
        } catch (err) {
          console.error('[SSE] Failed to parse message:', err)
        }
      }
      
      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error)
        eventSource?.close()
        
        // Reconnect after 5 seconds
        reconnectTimeout = setTimeout(() => {
          console.log('[SSE] Attempting to reconnect...')
          connectSSE()
        }, 5000)
      }
    }
    
    // Start SSE connection
    connectSSE()
    
    // Fallback: Initial fetch in case SSE takes time
    getNotifications(10)
      .then(data => {
        setNotifications(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch notifications:', err)
        setLoading(false)
      })
    
    // Cleanup on unmount
    return () => {
      eventSource?.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [])

  // Calculate unread count based on server-provided read status
  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = async (id: number) => {
    try {
      await markNotificationsRead([id])
      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      ))
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsRead()
      // Update local state - mark all as read
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }

  const clearAll = async () => {
    try {
      await clearAllNotifications()
      // Clear local state
      setNotifications([])
    } catch (err) {
      console.error('Failed to clear all notifications:', err)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id)
    if (notification.link) {
      navigate(notification.link)
      setOpen(false)
    }
  }

  const isRead = (notification: Notification) => notification.read

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.preventDefault()
                markAllAsRead()
              }}
            >
              <Check className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin opacity-40" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No notifications
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex cursor-pointer flex-col items-start gap-1 p-3 ${
                  !isRead(notification) ? typeBgColors[notification.type] : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex w-full items-start gap-2">
                  <span className="mt-0.5">{typeIcons[notification.type]}</span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm ${!isRead(notification) ? 'font-medium' : ''}`}>
                        {notification.title}
                      </p>
                      {notification.link && (
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(notification.timestamp)}
                    </p>
                  </div>
                  {!isRead(notification) && (
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between p-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/logs')
                  setOpen(false)
                }}
              >
                View all activity
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={(e) => {
                  e.preventDefault()
                  clearAll()
                }}
              >
                Clear all
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
