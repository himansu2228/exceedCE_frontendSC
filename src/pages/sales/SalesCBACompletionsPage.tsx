import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { CalendarCheck2, Download, RefreshCw } from 'lucide-react'
import { format, parse, parseISO, subYears } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { getCbaCompletionFunnel, type CbaCompletionFunnel, type CbaFunnelCompletion } from '@/lib/api'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'

type FunnelStage = 'enrolled' | 'started' | 'completed'

function toDateKey(value: string | null): string | null {
  if (!value) return null
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  if (iso) return iso[1]
  // ExceedCE returns completed_on as DD-Mon-YYYY (e.g. 01-Mar-2021)
  const dmy = parse(value, 'dd-MMM-yyyy', new Date())
  if (!Number.isNaN(dmy.getTime())) return format(dmy, 'yyyy-MM-dd')
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, 'yyyy-MM-dd')
}

function formatRangeLabel(range: DateRangeValue): string {
  if (!range.fromDate || !range.toDate) return 'Not selected'
  return `${format(parseISO(range.fromDate), 'MMM d, yyyy')} - ${format(parseISO(range.toDate), 'MMM d, yyyy')}`
}

function summarizeCompletions(records: CbaFunnelCompletion[], range: DateRangeValue) {
  if (!range.fromDate || !range.toDate) return null
  const inRange = records.filter((record) => {
    const key = toDateKey(record.date_completed)
    return key !== null && key >= range.fromDate && key <= range.toDate
  })
  const byCourse = new Map<string, number>()
  for (const record of inRange) byCourse.set(record.course, (byCourse.get(record.course) || 0) + 1)
  return { completions: inRange.length, students: new Set(inRange.map((record) => record.user_id)).size, byCourse }
}

function formatChange(current: number, previous: number): { delta: string; percent: string } {
  const delta = current - previous
  const sign = delta > 0 ? '+' : ''
  return {
    delta: `${sign}${delta.toLocaleString()}`,
    percent: previous > 0 ? `${sign}${((delta / previous) * 100).toFixed(1)}%` : '-',
  }
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const key = toDateKey(value)
  if (!key) return value
  return format(parseISO(key), 'MMM dd, yyyy')
}

// Old table/filters UI (row-level completions matched against the CBA roster) is disabled below;
// only the enrolled/started/completed funnel chart is shown per client request.
// import { Input } from '@/components/ui/input'
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select'
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from '@/components/ui/table'
// import { PaginationControls } from '@/components/ui/pagination-controls'
// import { Search } from 'lucide-react'
// import {
//   getCbaTabularUsers,
//   getCompletedEntries,
//   invalidateApiCache,
//   type CbaUserRow,
//   type CompletedEntry,
// } from '@/lib/api'

// type SortKey = 'date' | 'name' | 'course' | 'state'
// type SortDirection = 'asc' | 'desc'

// interface CbaCompletionRow extends CompletedEntry {
//   cbaUser: CbaUserRow
// }

// function formatDate(value: string | null): string {
//   if (!value) return '-'
//   const parsed = new Date(value)
//   if (Number.isNaN(parsed.getTime())) return value
//   return parsed.toLocaleDateString('en-US', {
//     year: 'numeric',
//     month: 'short',
//     day: '2-digit',
//   })
// }

// function normalizeId(value: string | number | null | undefined): string {
//   return String(value ?? '').trim()
// }

export function SalesCBACompletionsPage() {
  // const [rows, setRows] = useState<CbaCompletionRow[]>([])
  // const [cbaUsers, setCbaUsers] = useState<CbaUserRow[]>([])
  // const [loading, setLoading] = useState(true)
  // const [error, setError] = useState<string | null>(null)
  // const [search, setSearch] = useState('')
  // const [sortBy, setSortBy] = useState<SortKey>('date')
  // const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  // const [page, setPage] = useState(1)
  // const [perPage, setPerPage] = useState(100)

  const [funnel, setFunnel] = useState<CbaCompletionFunnel | null>(null)
  const [funnelLoading, setFunnelLoading] = useState(true)
  const [funnelError, setFunnelError] = useState<string | null>(null)
  const [stage, setStage] = useState<FunnelStage>('enrolled')

  const loadFunnel = async () => {
    setFunnelLoading(true)
    setFunnelError(null)
    try {
      const response = await getCbaCompletionFunnel()
      setFunnel(response)
    } catch (loadError) {
      setFunnel(null)
      setFunnelError(loadError instanceof Error ? loadError.message : 'Unable to load CBA funnel stats')
    } finally {
      setFunnelLoading(false)
    }
  }

  useEffect(() => {
    void loadFunnel()
  }, [])

  // const loadRows = async (refresh = false) => {
  //   setLoading(true)
  //   setError(null)
  //   if (refresh) {
  //     invalidateApiCache('/sales/cba-users')
  //     invalidateApiCache('/completions')
  //   }
  //
  //   const [completionResult, cbaResult] = await Promise.allSettled([
  //     getCompletedEntries({ allStates: true, rawFields: true, refresh, timeoutMs: 90000 }),
  //     getCbaTabularUsers(),
  //   ])
  //
  //   const completionResponse = completionResult.status === 'fulfilled' ? completionResult.value : null
  //   const cbaResponse = cbaResult.status === 'fulfilled' ? cbaResult.value : null
  //
  //   if (!completionResponse || !cbaResponse) {
  //     const messages = [
  //       completionResult.status === 'rejected' ? 'Completions: failed to load' : '',
  //       cbaResult.status === 'rejected' ? 'CBA users: failed to load' : '',
  //     ].filter(Boolean)
  //     setError(messages.join(' | ') || 'Failed to load CBA completions')
  //   }
  //
  //   const nextCbaUsers = cbaResponse?.items ?? []
  //   const cbaByUserId = new Map<string, CbaUserRow>()
  //   for (const user of nextCbaUsers) {
  //     const id = normalizeId(user.id)
  //     if (id) cbaByUserId.set(id, user)
  //   }
  //
  //   const matchedRows = (completionResponse?.entries ?? [])
  //     .map((entry) => {
  //       const user = cbaByUserId.get(normalizeId(entry.user_id))
  //       return user ? { ...entry, cbaUser: user } : null
  //     })
  //     .filter((entry): entry is CbaCompletionRow => entry !== null)
  //
  //   setCbaUsers(nextCbaUsers)
  //   setRows(matchedRows)
  //   setPage(1)
  //   setLoading(false)
  // }
  //
  // useEffect(() => {
  //   void loadRows()
  // }, [])
  //
  // const filteredRows = useMemo(() => {
  //   const searchText = search.trim().toLowerCase()
  //   if (!searchText) return rows
  //
  //   return rows.filter((row) => {
  //     const haystack = [
  //       row.user_id,
  //       row.full_name,
  //       row.email,
  //       row.course_name,
  //       row.state,
  //       row.license_number,
  //       row.licensee_profession,
  //       row.cbaUser.completion,
  //     ]
  //       .join(' ')
  //       .toLowerCase()
  //
  //     return haystack.includes(searchText)
  //   })
  // }, [rows, search])
  //
  // const sortedRows = useMemo(() => {
  //   const nextRows = [...filteredRows]
  //   nextRows.sort((a, b) => {
  //     let result = 0
  //
  //     if (sortBy === 'date') {
  //       const aTs = a.date_completed_iso ? Date.parse(a.date_completed_iso) : 0
  //       const bTs = b.date_completed_iso ? Date.parse(b.date_completed_iso) : 0
  //       result = aTs - bTs
  //     } else if (sortBy === 'name') {
  //       result = a.full_name.localeCompare(b.full_name)
  //     } else if (sortBy === 'course') {
  //       result = a.course_name.localeCompare(b.course_name)
  //     } else {
  //       result = a.state.localeCompare(b.state)
  //     }
  //
  //     return sortDirection === 'asc' ? result : -result
  //   })
  //   return nextRows
  // }, [filteredRows, sortBy, sortDirection])
  //
  // const uniqueUsers = useMemo(() => new Set(rows.map((row) => normalizeId(row.user_id))).size, [rows])
  // const totalItems = sortedRows.length
  // const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
  // const safePage = Math.min(Math.max(1, page), totalPages)
  // const pagedRows = useMemo(() => {
  //   const start = (safePage - 1) * perPage
  //   return sortedRows.slice(start, start + perPage)
  // }, [safePage, perPage, sortedRows])
  //
  // useEffect(() => {
  //   setPage(1)
  // }, [search, sortBy, sortDirection, perPage])

  const stageStudents = useMemo(() => funnel?.students?.[stage] ?? [], [funnel, stage])

  const [currentRange, setCurrentRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [previousRange, setPreviousRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })

  // Older cached snapshots lack per-course completion rows; fall back to one row per completed student.
  const completionRecords = useMemo<CbaFunnelCompletion[]>(() => {
    if (funnel?.completions) return funnel.completions
    return (funnel?.students?.completed ?? []).map((student) => ({
      user_id: student.user_id,
      full_name: student.full_name,
      email: student.email,
      course: student.courses.join(', '),
      date_completed: student.date_completed,
    }))
  }, [funnel])

  const currentSummary = useMemo(() => summarizeCompletions(completionRecords, currentRange), [completionRecords, currentRange])
  const previousSummary = useMemo(() => summarizeCompletions(completionRecords, previousRange), [completionRecords, previousRange])

  const courseComparison = useMemo(() => {
    if (!currentSummary || !previousSummary) return []
    const courses = new Set([...currentSummary.byCourse.keys(), ...previousSummary.byCourse.keys()])
    return Array.from(courses)
      .map((course) => ({
        course,
        current: currentSummary.byCourse.get(course) || 0,
        previous: previousSummary.byCourse.get(course) || 0,
      }))
      .sort((a, b) => b.current + b.previous - (a.current + a.previous) || a.course.localeCompare(b.course))
  }, [currentSummary, previousSummary])

  const setPreviousYear = () => {
    if (!currentRange.fromDate || !currentRange.toDate) return
    setPreviousRange({
      fromDate: format(subYears(parseISO(currentRange.fromDate), 1), 'yyyy-MM-dd'),
      toDate: format(subYears(parseISO(currentRange.toDate), 1), 'yyyy-MM-dd'),
    })
  }

  const exportExcel = async () => {
    const [XLSX, { formatDataWorksheet }] = await Promise.all([
      import('xlsx-js-style'),
      import('@/lib/excelFormatting'),
    ])
    const stageLabel = stage.charAt(0).toUpperCase() + stage.slice(1)
    const showCompleted = stage === 'completed'
    const headers = ['User ID', 'Name', 'Email', 'Course(s)', ...(showCompleted ? ['Completed'] : [])]
    const dataRows = stageStudents.map((student) => [
      student.user_id,
      student.full_name || '',
      student.email || '',
      student.courses.join(', '),
      ...(showCompleted ? [formatDate(student.date_completed)] : []),
    ])
    const worksheet = XLSX.utils.aoa_to_sheet([[`CBA ${stageLabel} Students`], headers, ...dataRows])
    formatDataWorksheet(worksheet, {
      titleRow: 0,
      headerRow: 1,
      dataEndRow: dataRows.length + 1,
      columnWidths: [12, 28, 36, 60, ...(showCompleted ? [16] : [])],
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, stageLabel)
    XLSX.writeFile(workbook, `cba-${stage}-students.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CalendarCheck2 className="h-8 w-8 text-emerald-500" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">CBA Completion</h1>
            <p className="text-sm text-muted-foreground">
              Completed learners matched with Commercial Brokers Association portal members
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => void loadFunnel()}
          disabled={funnelLoading}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${funnelLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CBA Student Funnel</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enrolled, started, and completed counts among CBA members
          </p>
        </CardHeader>
        <CardContent>
          {funnelError ? (
            <p className="text-sm text-red-600">{funnelError}</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline">CBA members: {funnel?.cbaMembers ?? '-'}</Badge>
                <Badge variant="outline">CBA courses: {funnel?.cbaCourses.length ?? '-'}</Badge>
                {funnel?.source === 'live-no-db' ? (
                  <Badge variant="warning">DB not configured — computing live every load</Badge>
                ) : null}
                {funnelLoading ? <Badge variant="warning">Loading...</Badge> : null}
              </div>
              <div className="h-[60vh] min-h-[420px] w-full rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { stage: 'Enrolled', students: funnel?.enrolled ?? 0 },
                      { stage: 'Started', students: funnel?.started ?? 0 },
                      { stage: 'Completed', students: funnel?.completed ?? 0 },
                    ]}
                    margin={{ top: 16, right: 24, bottom: 8, left: 8 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="stage" tick={{ fontSize: 14, fontWeight: 600 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="students" name="Students" radius={[8, 8, 0, 0]}>
                      {[funnel?.enrolled, funnel?.started, funnel?.completed].map((_, index) => (
                        <Cell key={index} fill={['#0891b2', '#f59e0b', '#22c55e'][index]} />
                      ))}
                      <LabelList dataKey="students" position="top" style={{ fontWeight: 600, fill: '#0f172a' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {funnel?.meta?.note ? (
                <p className="mt-2 text-xs text-muted-foreground">{funnel.meta.note}</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Completions Comparison</CardTitle>
          <p className="text-sm text-muted-foreground">
            Compare completions in a date range against a previous range, e.g. April 2026 vs April 2025.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Date range</p>
              <DateRangeFilter value={currentRange} onChange={setCurrentRange} showLabels={false} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Compare with</p>
              <DateRangeFilter value={previousRange} onChange={setPreviousRange} showLabels={false} />
            </div>
            <Button
              variant="outline"
              onClick={setPreviousYear}
              disabled={!currentRange.fromDate || !currentRange.toDate}
              className="h-10"
            >
              Same period last year
            </Button>
          </div>

          {funnelLoading ? <Badge variant="warning">Loading...</Badge> : null}

          {!currentSummary || !previousSummary ? (
            <p className="text-sm text-muted-foreground">Select both date ranges to see the comparison.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead className="text-right">{formatRangeLabel(currentRange)}</TableHead>
                      <TableHead className="text-right">{formatRangeLabel(previousRange)}</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead className="text-right">% Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: 'Course completions', current: currentSummary.completions, previous: previousSummary.completions },
                      { label: 'Unique students', current: currentSummary.students, previous: previousSummary.students },
                    ].map((metric) => {
                      const change = formatChange(metric.current, metric.previous)
                      return (
                        <TableRow key={metric.label}>
                          <TableCell className="font-medium">{metric.label}</TableCell>
                          <TableCell className="text-right">{metric.current.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{metric.previous.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{change.delta}</TableCell>
                          <TableCell className="text-right">{change.percent}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="h-64 w-full rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { period: formatRangeLabel(currentRange), completions: currentSummary.completions },
                      { period: formatRangeLabel(previousRange), completions: previousSummary.completions },
                    ]}
                    margin={{ top: 16, right: 24, bottom: 8, left: 8 }}
                    barCategoryGap="40%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="completions" name="Completions" radius={[8, 8, 0, 0]}>
                      <Cell fill="#22c55e" />
                      <Cell fill="#94a3b8" />
                      <LabelList dataKey="completions" position="top" style={{ fontWeight: 600, fill: '#0f172a' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {courseComparison.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead className="text-right">Date range</TableHead>
                        <TableHead className="text-right">Compare with</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courseComparison.map((row) => (
                        <TableRow key={row.course}>
                          <TableCell className="font-medium">{row.course}</TableCell>
                          <TableCell className="text-right">{row.current.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.previous.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatChange(row.current, row.previous).delta}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No completions found in either range.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Student List</CardTitle>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Select value={stage} onValueChange={(value) => setStage(value as FunnelStage)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enrolled">Enrolled ({funnel?.enrolled ?? 0})</SelectItem>
                <SelectItem value="started">Started ({funnel?.started ?? 0})</SelectItem>
                <SelectItem value="completed">Completed ({funnel?.completed ?? 0})</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => void exportExcel()}
              disabled={funnelLoading || stageStudents.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge variant="outline">{stageStudents.length} students</Badge>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course(s)</TableHead>
                  {stage === 'completed' ? <TableHead>Completed</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!funnelLoading && stageStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={stage === 'completed' ? 5 : 4} className="text-center text-sm text-muted-foreground">
                      No students found for this stage.
                    </TableCell>
                  </TableRow>
                ) : null}

                {stageStudents.map((student) => (
                  <TableRow key={student.user_id}>
                    <TableCell className="font-medium">{student.user_id}</TableCell>
                    <TableCell>{student.full_name || '-'}</TableCell>
                    <TableCell>{student.email || '-'}</TableCell>
                    <TableCell className="max-w-[320px] truncate" title={student.courses.join(', ')}>
                      {student.courses.join(', ') || '-'}
                    </TableCell>
                    {stage === 'completed' ? <TableCell>{formatDate(student.date_completed)}</TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Old filters + row-level completions table UI, disabled per client request (graph-only page).
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search user, email, course, state, license"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Completion Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="course">Course</SelectItem>
              <SelectItem value="state">State</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as SortDirection)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">CBA users: {cbaUsers.length}</Badge>
            <Badge variant="outline">Completed users: {uniqueUsers}</Badge>
            <Badge variant="outline">Completion rows: {rows.length}</Badge>
            <Badge variant="outline">Filtered: {totalItems}</Badge>
            <Badge variant="outline">Page: {safePage}/{totalPages}</Badge>
            {loading ? <Badge variant="warning">Loading...</Badge> : null}
            {error ? <Badge variant="error">{error}</Badge> : null}
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table className="min-w-[1250px]">
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Profession</TableHead>
                  <TableHead>CBA Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && pagedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                      No CBA completion rows found.
                    </TableCell>
                  </TableRow>
                ) : null}

                {pagedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.user_id || '-'}</TableCell>
                    <TableCell>{row.full_name || '-'}</TableCell>
                    <TableCell>{row.email || '-'}</TableCell>
                    <TableCell className="max-w-[360px] truncate">{row.course_name || '-'}</TableCell>
                    <TableCell>{row.state || '-'}</TableCell>
                    <TableCell>{formatDate(row.date_completed_iso || row.date_completed)}</TableCell>
                    <TableCell>{row.license_number || '-'}</TableCell>
                    <TableCell>{row.licensee_profession || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="success">{row.cbaUser.completion || 'CBA member'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationControls
            page={safePage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={perPage}
            pageSizeOptions={[20, 50, 100, 200]}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPageSizeChange={(size) => setPerPage(size)}
          />
        </CardContent>
      </Card>
      */}
    </div>
  )
}