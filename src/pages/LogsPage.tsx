import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  Filter,
  Loader2,
} from 'lucide-react'
import { getLogsPaginated, type LogEntry } from '@/lib/api'
import { PaginationControls } from '@/components/ui/pagination-controls'

const levelIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
}

const levelColors: Record<string, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
}

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [totalLogs, setTotalLogs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Fetch logs from API
  const fetchLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getLogsPaginated({
        page,
        perPage,
        search: searchTerm.trim() || undefined,
        level: levelFilter,
      })
      setLogs(data.items)
      setTotalLogs(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchLogs()
  }, [page, perPage, searchTerm, levelFilter])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const statTiles = [
    {
      label: 'Success',
      value: logs.filter((l) => l.level === 'success').length.toLocaleString(),
      icon: CheckCircle2,
      accent: 'from-emerald-500 to-green-500',
      ring: 'ring-emerald-200',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Errors',
      value: logs.filter((l) => l.level === 'error').length.toLocaleString(),
      icon: XCircle,
      accent: 'from-rose-500 to-red-500',
      ring: 'ring-rose-200',
      bg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
    {
      label: 'Warnings',
      value: logs.filter((l) => l.level === 'warning').length.toLocaleString(),
      icon: AlertTriangle,
      accent: 'from-amber-500 to-yellow-500',
      ring: 'ring-amber-200',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Info',
      value: logs.filter((l) => l.level === 'info').length.toLocaleString(),
      icon: Info,
      accent: 'from-blue-500 to-indigo-500',
      ring: 'ring-blue-200',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading logs...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <p className="text-red-600 font-medium">{error}</p>
        <Button onClick={fetchLogs}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {statTiles.map((tile) => (
          <Card key={tile.label} className="relative overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-[6px]">
            <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${tile.accent}`} />
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-[11px]">{tile.label}</p>
                  <p className="mt-1 text-xl font-semibold leading-tight text-foreground sm:text-2xl">{tile.value}</p>
                </div>
                <div className={`rounded-md p-1.5 ring-1 ${tile.ring} ${tile.bg}`}>
                  <tile.icon className={`h-3.5 w-3.5 ${tile.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Activity Logs
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setPage(1)
                  }}
                  className="pl-9"
                />
              </div>
              <Select value={levelFilter} onValueChange={(value) => {
                setLevelFilter(value)
                setPage(1)
              }}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchLogs}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-4 rounded-xl border border-border/70 bg-card/60 p-4 transition-colors hover:bg-muted/30"
              >
                {/* Level Icon */}
                <div className="mt-0.5">{levelIcons[log.level]}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={levelColors[log.level]} variant="outline">
                      {log.level.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(log.timestamp)} at {formatTime(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{log.message}</p>
                  {Object.keys(log.details).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(log.details).map(([key, value]) => (
                        <span
                          key={key}
                          className="rounded px-2 py-1 text-xs bg-muted"
                        >
                          <span className="text-muted-foreground">{key}:</span>{' '}
                          <span className="font-mono">{String(value)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground font-mono">
                    {formatTime(log.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {logs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No logs found matching your criteria</p>
            </div>
          )}

          <div className="mt-4">
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={totalLogs}
              pageSize={perPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPerPage(size)
                setPage(1)
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
