import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Loader2,
  XCircle,
  Search,
  CalendarCheck2,
  Users,
  GraduationCap,
  Download,
  Filter,
  Send,
  Info,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  getCompletedEntries,
  getSCCourses,
  postSelectedRosterEntries,
  relookupAllProfessions,
  type CompletedEntry,
  type Course,
  type ReportStatus,
  type RosterPipelineEntry,
} from '@/lib/api'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { getTenantAccessProfile, normalizeStateCode } from '@/lib/auth'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
import { usesCombinedCompletedTab } from '@/lib/ceBrokerPipeline'
import { useActiveStateCode } from '@/lib/useActiveStateCode'

const COMPLETED_ENTRIES_CACHE_KEY = 'exceedce.completed.entries.cache.v1'
// A cold load fetches every course plus per-user licences, which can exceed the default API timeout.
const COMPLETED_REQUEST_TIMEOUT_MS = 120000
// Live posting resolves professions (CE Broker / LLR) per attendee, so allow long runs.
const POST_REQUEST_TIMEOUT_MS = 10 * 60 * 1000

type ReportStatusFilter = ReportStatus | 'all'

const REPORT_STATUS_META: Record<ReportStatus, { label: string; badge: string; dot: string; description: string }> = {
  not_reported: {
    label: 'Not reported',
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
    description: 'Completed in ExceedCE but not yet reported to CE Broker.',
  },
  reported: {
    label: 'Reported',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    description: 'Accepted by CE Broker (or already on file there).',
  },
  failed: {
    label: 'Failed',
    badge: 'border-red-200 bg-red-50 text-red-700',
    dot: 'bg-red-500',
    description: 'CE Broker rejected the report. See the message below, then post again.',
  },
  skipped: {
    label: 'Skipped',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
    dot: 'bg-amber-500',
    description: 'Not sent, for example because of a missing license number.',
  },
  dry_run: {
    label: 'Dry run only',
    badge: 'border-violet-200 bg-violet-50 text-violet-700',
    dot: 'bg-violet-500',
    description: 'Previewed in a dry run. Nothing was sent to CE Broker yet.',
  },
}

const STATUS_FILTER_ORDER: ReportStatusFilter[] = ['all', 'not_reported', 'reported', 'failed', 'skipped', 'dry_run']

function readCachedCompletedEntries(stateCode: string): CompletedEntry[] {
  try {
    const raw = localStorage.getItem(`${COMPLETED_ENTRIES_CACHE_KEY}.${stateCode}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.entries) ? parsed.entries : []
  } catch {
    return []
  }
}

function writeCachedCompletedEntries(stateCode: string, entries: CompletedEntry[]) {
  try {
    localStorage.setItem(`${COMPLETED_ENTRIES_CACHE_KEY}.${stateCode}`, JSON.stringify({
      savedAt: Date.now(),
      entries,
    }))
  } catch {
    // Ignore client-side storage failures.
  }
}

function hasUsableLicense(entry: CompletedEntry) {
  const license = String(entry.license_number || '').trim()
  return Boolean(license) && !/^(n\/?a|none|null|-+|0+)$/i.test(license)
}

function getReportStatus(entry: CompletedEntry): ReportStatus {
  return entry.report_status || 'not_reported'
}

function canPostEntry(entry: CompletedEntry) {
  return getReportStatus(entry) !== 'reported' && hasUsableLicense(entry)
}

function toRosterEntry(entry: CompletedEntry): RosterPipelineEntry {
  return {
    id: entry.id,
    user_id: entry.user_id,
    first_name: entry.first_name,
    last_name: entry.last_name,
    email: entry.email,
    course_id: entry.course_id,
    course_name: entry.course_name,
    licenseNumber: entry.license_number,
    completion_date: entry.date_completed_iso || entry.date_completed,
  }
}

function ReportStatusBadge({ entry }: { entry: CompletedEntry }) {
  const status = getReportStatus(entry)
  const meta = REPORT_STATUS_META[status]
  return (
    <div className="space-y-1">
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>
      {entry.reported_at && status !== 'not_reported' && (
        <p className="whitespace-nowrap text-[11px] text-muted-foreground">{formatDate(entry.reported_at)}</p>
      )}
      {entry.report_message && (status === 'failed' || status === 'skipped') && (
        <p className="max-w-[150px] truncate text-[11px] text-muted-foreground" title={entry.report_message}>
          {entry.report_message}
        </p>
      )}
    </div>
  )
}

export function CompletedPage() {
  const tenant = getTenantAccessProfile()
  const activeStateCode = useActiveStateCode()
  const combined = usesCombinedCompletedTab(activeStateCode)
  const [courses, setCourses] = useState<Course[]>([])
  const [entries, setEntries] = useState<CompletedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [totalEntries, setTotalEntries] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [summary, setSummary] = useState<{ uniqueUsers?: number; courses?: number }>({})
  const [statusCounts, setStatusCounts] = useState<Partial<Record<ReportStatus, number>>>({})
  const [courseFilter, setCourseFilter] = useState('all')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [searchTerm, setSearchTerm] = useState('')
  const [reportStatus, setReportStatus] = useState<ReportStatusFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [dryRun, setDryRun] = useState(true)
  const [posting, setPosting] = useState(false)
  const [postingIds, setPostingIds] = useState<Record<string, boolean>>({})
  const [confirmEntries, setConfirmEntries] = useState<CompletedEntry[] | null>(null)
  const [postResult, setPostResult] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [detailEntry, setDetailEntry] = useState<CompletedEntry | null>(null)
  const [fixingProfessions, setFixingProfessions] = useState(false)

  const fetchCourseList = async () => {
    const data = await getSCCourses()
    setCourses(data)
  }

  const fetchCompletedEntries = async (options: {
    page?: number
    perPage?: number
    stateCode?: string
    forceRefresh?: boolean
    reportStatus?: ReportStatusFilter
    resetFilters?: boolean
  } = {}) => {
    const targetPage = options.page ?? page
    const targetPerPage = options.perPage ?? perPage
    const targetStatus = options.reportStatus ?? reportStatus
    const stateCodeForCache = normalizeStateCode(options.stateCode || getTenantAccessProfile().stateCode || 'SC')
    const filters = options.resetFilters
      ? {}
      : {
          courseId: courseFilter === 'all' ? undefined : Number(courseFilter),
          fromDate: dateRange.fromDate || undefined,
          toDate: dateRange.toDate || undefined,
          search: searchTerm.trim() || undefined,
        }

    setLoading(true)
    setError(null)
    setWarning(null)
    try {
      const response = await getCompletedEntries({
        ...filters,
        resolveProfession: true,
        page: targetPage,
        perPage: targetPerPage,
        refresh: options.forceRefresh,
        reportStatus: usesCombinedCompletedTab(stateCodeForCache) ? targetStatus : 'all',
        timeoutMs: COMPLETED_REQUEST_TIMEOUT_MS,
      })
      setEntries(response.entries)
      setTotalEntries(response.total)
      setTotalPages(response.totalPages || 1)
      setSummary({ uniqueUsers: response.unique_users, courses: response.courses_in_result })
      setStatusCounts(response.report_status_counts || {})
      setPage(response.page || targetPage)
      setPerPage(response.perPage || targetPerPage)
      setSelectedIds({})
      writeCachedCompletedEntries(stateCodeForCache, response.entries)
    } catch (err) {
      const fallbackEntries = readCachedCompletedEntries(stateCodeForCache)
      if (fallbackEntries.length > 0) {
        setEntries(fallbackEntries)
        setTotalEntries(fallbackEntries.length)
        setTotalPages(1)
        setSummary({})
        setStatusCounts({})
        setWarning('Live completed records timed out. Showing the latest cached snapshot.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch completed users')
      }
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }

  useEffect(() => {
    setReportStatus('all')
    setSelectedIds({})
    setPostResult(null)
    async function initialize() {
      try {
        await Promise.all([
          fetchCourseList(),
          fetchCompletedEntries({ page: 1, stateCode: activeStateCode, forceRefresh: true, reportStatus: 'all' }),
        ])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize completed page')
        setLoading(false)
      }
    }
    initialize()
  }, [activeStateCode])

  const handleApplyFilters = async () => {
    await fetchCompletedEntries({ page: 1 })
  }

  const handleResetFilters = async () => {
    setCourseFilter('all')
    setDateRange({ fromDate: '', toDate: '' })
    setSearchTerm('')
    setReportStatus('all')
    await fetchCompletedEntries({ page: 1, reportStatus: 'all', resetFilters: true })
  }

  const handleStatusFilter = async (status: ReportStatusFilter) => {
    setReportStatus(status)
    await fetchCompletedEntries({ page: 1, reportStatus: status })
  }

  const exportExcel = async () => {
    // Export every record matching the current filters, not just the visible page.
    const [XLSX, { formatDataWorksheet }, allResponse] = await Promise.all([
      import('xlsx-js-style'),
      import('@/lib/excelFormatting'),
      getCompletedEntries({
        courseId: courseFilter === 'all' ? undefined : Number(courseFilter),
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
        search: searchTerm.trim() || undefined,
        resolveProfession: true,
        reportStatus: combined ? reportStatus : 'all',
        timeoutMs: COMPLETED_REQUEST_TIMEOUT_MS,
      }),
    ])
    const worksheetData = allResponse.entries.map((entry) => ({
      User: entry.full_name || `${entry.first_name} ${entry.last_name}`.trim(),
      'User ID': entry.user_id ?? '',
      Email: entry.email || '',
      Course: entry.course_name || '',
      'CEB Course ID': entry.ceb_course_id || '',
      License: entry.license_number || '',
      Profession: entry.licensee_profession || '',
      'Completed Date': entry.date_completed_iso || entry.date_completed || '',
      ...(combined
        ? {
            'CE Broker Status': REPORT_STATUS_META[getReportStatus(entry)].label,
            'Reported At': entry.reported_at ? formatDateTime(entry.reported_at) : '',
            'CE Broker Message': entry.report_message || '',
          }
        : {}),
    }))
    const headers = [
      'User', 'User ID', 'Email', 'Course', 'CEB Course ID', 'License', 'Profession', 'Completed Date',
      ...(combined ? ['CE Broker Status', 'Reported At', 'CE Broker Message'] : []),
    ]
    const worksheet = XLSX.utils.json_to_sheet(worksheetData, { header: headers })
    formatDataWorksheet(worksheet, {
      headerRow: 0,
      dataEndRow: worksheetData.length,
      columnWidths: [28, 12, 32, 44, 16, 18, 24, 20, ...(combined ? [18, 22, 44] : [])],
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Completed Users')
    XLSX.writeFile(workbook, `completed-users-${activeStateCode.toLowerCase()}.xlsx`)
  }

  const runPost = async (targets: CompletedEntry[]) => {
    const postable = targets.filter(canPostEntry)
    if (postable.length === 0) return

    setPosting(true)
    setPostResult(null)
    setPostingIds(Object.fromEntries(postable.map((entry) => [entry.id, true])))
    try {
      const result = await postSelectedRosterEntries({
        entries: postable.map(toRosterEntry),
        dryRun,
        timeoutMs: POST_REQUEST_TIMEOUT_MS,
      })
      const done = result.summary?.successful ?? 0
      const failed = result.summary?.failed ?? 0
      const skipped = result.summary?.skipped ?? 0
      setPostResult({
        tone: failed > 0 ? 'error' : 'success',
        message: dryRun
          ? `Dry run finished for ${postable.length} completion(s): ${done} ready to report, ${failed} failed, ${skipped} skipped. Nothing was sent to CE Broker.`
          : `Posted ${postable.length} completion(s) to CE Broker: ${done} reported, ${failed} failed, ${skipped} skipped.`,
      })
      await fetchCompletedEntries()
    } catch (err) {
      setPostResult({ tone: 'error', message: err instanceof Error ? err.message : 'Posting to CE Broker failed' })
    } finally {
      setPosting(false)
      setPostingIds({})
    }
  }

  const requestPost = (targets: CompletedEntry[]) => {
    const postable = targets.filter(canPostEntry)
    if (postable.length === 0) return
    if (dryRun) {
      void runPost(postable)
      return
    }
    setConfirmEntries(postable)
  }

  const handleFixProfessions = async () => {
    setFixingProfessions(true)
    setPostResult(null)
    try {
      const result = await relookupAllProfessions()
      setPostResult({
        tone: result.success ? 'success' : 'error',
        message: result.success
          ? `Professions updated for ${result.successful}/${result.total} licenses.${result.multiple > 0 ? ` ${result.multiple} had multiple professions.` : ''}${result.failed > 0 ? ` ${result.failed} failed.` : ''}`
          : 'Failed to re-lookup professions',
      })
      await fetchCompletedEntries()
    } catch (err) {
      setPostResult({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to re-lookup professions' })
    } finally {
      setFixingProfessions(false)
    }
  }

  const totalUsers = useMemo(() => {
    if (summary.uniqueUsers !== undefined) return summary.uniqueUsers
    const ids = new Set(entries.map((entry) => String(entry.user_id || `${entry.email}:${entry.full_name}`)))
    return ids.size
  }, [entries, summary.uniqueUsers])

  const totalCourses = useMemo(() => {
    if (summary.courses !== undefined) return summary.courses
    const ids = new Set(entries.map((entry) => entry.course_id))
    return ids.size
  }, [entries, summary.courses])

  const postableEntries = useMemo(() => entries.filter(canPostEntry), [entries])
  const selectedEntries = useMemo(() => entries.filter((entry) => selectedIds[entry.id]), [entries, selectedIds])
  const allSelected = postableEntries.length > 0 && postableEntries.every((entry) => selectedIds[entry.id])
  const allStatusesTotal = Object.values(statusCounts).reduce((sum, value) => sum + (value || 0), 0)

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds({})
      return
    }
    setSelectedIds(Object.fromEntries(postableEntries.map((entry) => [entry.id, true])))
  }

  const statTiles = [
    {
      label: 'Completed Records',
      value: totalEntries.toLocaleString(),
      icon: CalendarCheck2,
      accent: 'from-emerald-500 to-green-500',
      ring: 'ring-emerald-200',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Unique Users',
      value: totalUsers.toLocaleString(),
      icon: Users,
      accent: 'from-blue-500 to-indigo-500',
      ring: 'ring-blue-200',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Courses in Result',
      value: totalCourses.toLocaleString(),
      icon: GraduationCap,
      accent: 'from-amber-500 to-orange-500',
      ring: 'ring-amber-200',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ]

  if (loading && !hasLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading completed records...</span>
      </div>
    )
  }

  if (error && entries.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <p className="font-medium text-red-600">{error}</p>
        <Button onClick={handleApplyFilters}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn space-y-6">
      {warning && (
        <Alert>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {postResult && (
        <Alert variant={postResult.tone === 'error' ? 'destructive' : 'default'}>
          {postResult.tone === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <AlertTitle>{postResult.tone === 'error' ? 'Needs attention' : 'Done'}</AlertTitle>
          <AlertDescription>{postResult.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck2 className="h-5 w-5" />
              Completed Users
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search user, email, course..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleApplyFilters()
                    }
                  }}
                  className="pl-9"
                />
              </div>

              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All State Courses ({courses.length})</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DateRangeFilter
                value={dateRange}
                onChange={setDateRange}
                showLabels={false}
              />

              <Button size="sm" onClick={handleApplyFilters} disabled={loading}>
                <Filter className="mr-2 h-4 w-4" />
                Apply
              </Button>

              <Button size="sm" variant="outline" onClick={handleResetFilters} disabled={loading}>
                Reset
              </Button>
              <Button size="sm" variant="outline" onClick={exportExcel} disabled={entries.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
              {combined && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleFixProfessions}
                  disabled={fixingProfessions}
                  title="Re-check license professions with CE Broker"
                >
                  {fixingProfessions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Fix Professions
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className="mb-4 text-base">{tenant.stateName} Completed Records</CardTitle>

          {combined && (
            <div className="mb-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by CE Broker status">
                <span className="mr-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">CE Broker status</span>
                {STATUS_FILTER_ORDER.map((status) => {
                  const active = reportStatus === status
                  const count = status === 'all' ? allStatusesTotal : statusCounts[status] || 0
                  const label = status === 'all' ? 'All' : REPORT_STATUS_META[status].label
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void handleStatusFilter(status)}
                      disabled={loading}
                      aria-pressed={active}
                      title={status === 'all' ? 'Show every completion' : REPORT_STATUS_META[status].description}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                        active
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {status !== 'all' && <span className={`h-1.5 w-1.5 rounded-full ${REPORT_STATUS_META[status].dot}`} />}
                      {label}
                      <span className={`tabular-nums ${active ? 'text-blue-100' : 'text-slate-400'}`}>{count.toLocaleString()}</span>
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Switch id="completed-dry-run" checked={dryRun} onCheckedChange={setDryRun} disabled={posting} />
                  <Label htmlFor="completed-dry-run" className="text-sm">
                    Dry run
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      {dryRun ? '(preview only, nothing is sent to CE Broker)' : '(live: posts go to CE Broker)'}
                    </span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedEntries.length > 0 ? `${selectedEntries.length} selected` : 'Select completions to post'}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => requestPost(selectedEntries)}
                    disabled={posting || loading || selectedEntries.length === 0}
                  >
                    {posting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {dryRun ? 'Dry run selected' : 'Post selected'} ({selectedEntries.length})
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4">
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={totalEntries}
              pageSize={perPage}
              onPageChange={(nextPage) => void fetchCompletedEntries({ page: nextPage })}
              onPageSizeChange={(size) => void fetchCompletedEntries({ page: 1, perPage: size })}
            />
          </div>

          <div className="relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-16 backdrop-blur-[1px]">
                <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Loading...
                </span>
              </div>
            )}

            {entries.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No completed users found for selected filters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {combined && (
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          aria-label="Select all completions on this page that can be posted"
                          checked={allSelected}
                          disabled={postableEntries.length === 0 || posting}
                          onChange={toggleSelectAll}
                        />
                      </TableHead>
                    )}
                    <TableHead>User</TableHead>
                    {!combined && <TableHead>Email</TableHead>}
                    <TableHead>Course</TableHead>
                    <TableHead>License</TableHead>
                    {!combined && <TableHead>Profession</TableHead>}
                    <TableHead className="whitespace-nowrap">{combined ? 'Completed' : 'Completed Date'}</TableHead>
                    {combined && <TableHead>CE Broker Status</TableHead>}
                    {combined && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const postable = canPostEntry(entry)
                    const status = getReportStatus(entry)
                    return (
                      <TableRow key={entry.id} data-state={selectedIds[entry.id] ? 'selected' : undefined}>
                        {combined && (
                          <TableCell>
                            <input
                              type="checkbox"
                              aria-label={`Select ${entry.full_name || entry.email}`}
                              checked={!!selectedIds[entry.id]}
                              disabled={!postable || posting}
                              title={postable ? undefined : status === 'reported' ? 'Already reported' : 'No license number on file'}
                              onChange={(e) => setSelectedIds((prev) => ({ ...prev, [entry.id]: e.target.checked }))}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="font-medium">{entry.full_name || `${entry.first_name} ${entry.last_name}`.trim()}</div>
                          {combined && <div className="text-xs text-muted-foreground">{entry.email || 'No email'}</div>}
                          <div className="text-xs text-muted-foreground">User ID: {entry.user_id ?? 'N/A'}</div>
                        </TableCell>
                        {!combined && <TableCell>{entry.email || 'N/A'}</TableCell>}
                        <TableCell>
                          <div className={`${combined ? 'max-w-[230px]' : 'max-w-[320px]'} truncate font-medium`} title={entry.course_name}>
                            {entry.course_name}
                          </div>
                          {entry.ceb_course_id && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              CEB: {entry.ceb_course_id}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap">{entry.license_number || 'N/A'}</div>
                          {combined && entry.licensee_profession && (
                            <Badge variant="outline" className="mt-1 text-xs" title="Profession">
                              {entry.licensee_profession}
                            </Badge>
                          )}
                        </TableCell>
                        {!combined && <TableCell>{entry.licensee_profession || 'N/A'}</TableCell>}
                        <TableCell className="whitespace-nowrap">
                          {entry.date_completed_iso
                            ? formatDate(entry.date_completed_iso)
                            : entry.date_completed || 'N/A'}
                        </TableCell>
                        {combined && (
                          <TableCell>
                            <ReportStatusBadge entry={entry} />
                          </TableCell>
                        )}
                        {combined && (
                          <TableCell className="whitespace-nowrap text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetailEntry(entry)}
                              aria-label="View CE Broker details"
                              title="CE Broker details"
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                            {status !== 'reported' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => requestPost([entry])}
                                disabled={!postable || posting || loading}
                                title={postable ? (dryRun ? 'Dry run this completion' : 'Post this completion to CE Broker') : 'No license number on file'}
                              >
                                {postingIds[entry.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {dryRun ? 'Dry run' : 'Post'}
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(confirmEntries)} onOpenChange={(open) => !open && setConfirmEntries(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Post to CE Broker?
            </DialogTitle>
            <DialogDescription className="pt-1">
              {confirmEntries?.length === 1
                ? 'This completion will be reported to CE Broker now. This cannot be undone from the dashboard.'
                : `${confirmEntries?.length || 0} completions will be reported to CE Broker now. This cannot be undone from the dashboard.`}
            </DialogDescription>
          </DialogHeader>
          {confirmEntries && confirmEntries.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border bg-slate-50 p-3 text-sm">
              {confirmEntries.slice(0, 20).map((entry) => (
                <li key={entry.id} className="truncate">
                  <span className="font-medium">{entry.full_name || entry.email}</span>
                  <span className="text-muted-foreground"> · {entry.course_name}</span>
                </li>
              ))}
              {confirmEntries.length > 20 && (
                <li className="text-xs text-muted-foreground">and {confirmEntries.length - 20} more</li>
              )}
            </ul>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmEntries(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const targets = confirmEntries || []
                setConfirmEntries(null)
                void runPost(targets)
              }}
            >
              <Send className="h-4 w-4" />
              Post to CE Broker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailEntry)} onOpenChange={(open) => !open && setDetailEntry(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl">
          {detailEntry && (
            <>
              <DialogHeader className="text-left">
                <DialogTitle>CE Broker reporting details</DialogTitle>
                <DialogDescription>
                  {detailEntry.full_name || detailEntry.email} · {detailEntry.course_name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border bg-slate-50 px-4 py-3">
                  <ReportStatusBadge entry={detailEntry} />
                  <p className="mt-2 text-xs text-muted-foreground">{REPORT_STATUS_META[getReportStatus(detailEntry)].description}</p>
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">Student</dt>
                    <dd className="font-medium">{detailEntry.full_name || `${detailEntry.first_name} ${detailEntry.last_name}`.trim()}</dd>
                    <dd className="text-xs text-muted-foreground">{detailEntry.email || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">License</dt>
                    <dd className="font-medium">{detailEntry.license_number || 'N/A'}</dd>
                    <dd className="text-xs text-muted-foreground">{detailEntry.licensee_profession || 'Profession unknown'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">Course</dt>
                    <dd className="font-medium">{detailEntry.course_name}</dd>
                    <dd className="text-xs text-muted-foreground">
                      ExceedCE ID: {detailEntry.course_id} · CE Broker ID: {detailEntry.ceb_course_id || 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">Completed / last attempt</dt>
                    <dd className="font-medium">
                      {detailEntry.date_completed_iso ? formatDate(detailEntry.date_completed_iso) : detailEntry.date_completed || 'N/A'}
                    </dd>
                    <dd className="text-xs text-muted-foreground">
                      {detailEntry.reported_at ? `Last attempt ${formatDateTime(detailEntry.reported_at)}` : 'Never attempted'}
                    </dd>
                  </div>
                </dl>
                {(detailEntry.report_message || detailEntry.report_error_code) && (
                  <div className={`rounded-lg border px-4 py-3 ${getReportStatus(detailEntry) === 'failed' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                    <p className="text-sm font-semibold">CE Broker message</p>
                    {detailEntry.report_error_code && <p className="text-xs">Code: {detailEntry.report_error_code}</p>}
                    {detailEntry.report_message && <p className="mt-1 break-words text-sm">{detailEntry.report_message}</p>}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
