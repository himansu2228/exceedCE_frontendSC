import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, BarChart3, Download, MoreHorizontal, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
import { getCourseListOverrides, getSalesAnalytics, setCourseListOverride, type CourseListOverrides } from '@/lib/api'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

type ViewMode = 'sales' | 'orders'

interface MonthData {
  key: string
  label: string
  fromDate: string
  toDate: string
}

interface CourseStats {
  revenue: number
  quantity: number
}

interface CourseRow {
  courseName: string
  monthlyStats: Record<string, CourseStats>
  totalRevenue: number
  totalQuantity: number
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function isCBAOutOfStateCourse(courseName: string): boolean {
  const name = (courseName || '').toLowerCase().trim()
  
  // 1. Exclude WA specifically
  if (name.startsWith('wa ') || name.includes('washington')) return false
  
  // 2. All US State abbreviations except WA
  const outOfStates = [
    'al ', 'ak ', 'az ', 'ar ', 'ca ', 'co ', 'ct ', 'de ', 'fl ', 'ga ', 
    'hi ', 'id ', 'il ', 'in ', 'ia ', 'ks ', 'ky ', 'la ', 'me ', 'md ', 
    'ma ', 'mi ', 'mn ', 'ms ', 'mo ', 'mt ', 'ne ', 'nv ', 'nh ', 'nj ', 
    'nm ', 'ny ', 'nc ', 'nd ', 'oh ', 'ok ', 'or ', 'pa ', 'ri ', 'sc ', 
    'sd ', 'tn ', 'tx ', 'ut ', 'vt ', 'va ', 'wv ', 'wi ', 'wy ',
    'north carolina ', 'south carolina '
  ]
  
  // 3. Check if the course starts with any out-of-state prefix
  const hasStatePrefix = outOfStates.some(state => name.startsWith(state))
  if (!hasStatePrefix) return false
  
  // 4. Ensure it's a CBA-related topic
  const isCBATopic = name.includes('commercial') || 
                     name.includes('syndication') || 
                     name.includes('package') ||
                     name.includes('real estate') ||
                     name.includes('ethics')
  
  return isCBATopic
}

export function SalesOutOfStatePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('sales')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allRows, setAllRows] = useState<CourseRow[]>([])
  const [overrides, setOverrides] = useState<CourseListOverrides>({ included: [], excluded: [] })
  const [addOpen, setAddOpen] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [savingCourse, setSavingCourse] = useState('')
  const [actionError, setActionError] = useState('')

  // Rule-based courses minus removed ones, plus manually added ones (even with no sales in range).
  const rows = useMemo<CourseRow[]>(() => {
    const included = new Set(overrides.included)
    const excluded = new Set(overrides.excluded)
    const kept = allRows.filter((row) => included.has(row.courseName) || (isCBAOutOfStateCourse(row.courseName) && !excluded.has(row.courseName)))
    const present = new Set(kept.map((row) => row.courseName))
    const empty = overrides.included
      .filter((name) => !present.has(name))
      .map((name) => ({ courseName: name, monthlyStats: {}, totalRevenue: 0, totalQuantity: 0 }))
    return [...kept, ...empty].sort((a, b) => a.courseName.localeCompare(b.courseName))
  }, [allRows, overrides])

  const addableCourses = useMemo(() => {
    const current = new Set(rows.map((row) => row.courseName))
    const query = addSearch.trim().toLowerCase()
    return allRows
      .map((row) => row.courseName)
      .filter((name) => !current.has(name) && (!query || name.toLowerCase().includes(query)))
  }, [allRows, rows, addSearch])

  const changeCourse = async (course: string, add: boolean) => {
    const auto = isCBAOutOfStateCourse(course)
    const action = add ? (auto ? 'reset' : 'include') : (auto ? 'exclude' : 'reset')
    setSavingCourse(course)
    setActionError('')
    try {
      setOverrides(await setCourseListOverride('out-of-state', course, action))
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'Unable to update the course list.')
    } finally {
      setSavingCourse('')
    }
  }
  
  const months = useMemo(() => {
    const now = new Date()
    const selectedFrom = dateRange.fromDate ? new Date(`${dateRange.fromDate}T00:00:00`) : null
    const selectedTo = dateRange.toDate ? new Date(`${dateRange.toDate}T00:00:00`) : null
    const start = selectedFrom || startOfMonth(subMonths(now, 11))
    const end = selectedTo || now
    const result: MonthData[] = []
    let month = startOfMonth(end)
    const firstMonth = startOfMonth(start)
    while (month >= firstMonth) {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)
      result.push({
        key: format(month, 'yyyy-MM'),
        label: format(month, "MMM ''yy"),
        fromDate: format(selectedFrom && selectedFrom > monthStart ? selectedFrom : monthStart, 'yyyy-MM-dd'),
        toDate: format(selectedTo && selectedTo < monthEnd ? selectedTo : monthEnd, 'yyyy-MM-dd'),
      })
      month = subMonths(month, 1)
    }
    return result
  }, [dateRange.fromDate, dateRange.toDate])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const promises = months.map(m => 
        getSalesAnalytics({ fromDate: m.fromDate, toDate: m.toDate, limit: 'all' })
          .catch(() => ({ revenueByCourse: [] })) // fallback for individual month failure
      )
      
      const [results, courseOverrides] = await Promise.all([
        Promise.all(promises),
        getCourseListOverrides('out-of-state'),
      ])
      setOverrides(courseOverrides)
      
      const courseMap = new Map<string, CourseRow>()
      
      results.forEach((res, index) => {
        const monthKey = months[index].key
        const courses = res.revenueByCourse || []
        
        courses.forEach(item => {
          const matchedCourseName = item.course || 'Unknown Course'

          if (!courseMap.has(matchedCourseName)) {
            courseMap.set(matchedCourseName, {
              courseName: matchedCourseName,
              monthlyStats: {},
              totalRevenue: 0,
              totalQuantity: 0,
            })
          }
          
          const row = courseMap.get(matchedCourseName)!
          row.monthlyStats[monthKey] = {
            revenue: item.revenue,
            quantity: item.quantity,
          }
          row.totalRevenue += item.revenue
          row.totalQuantity += item.quantity
        })
      })
      
      const sortedRows = Array.from(courseMap.values()).sort((a, b) => 
        a.courseName.localeCompare(b.courseName)
      )
      
      setAllRows(sortedRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load out-of-state sales data')
    } finally {
      setLoading(false)
    }
  }, [months])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const totals = useMemo(() => {
    const monthlyTotal: Record<string, CourseStats> = {}
    let grandTotalRevenue = 0
    let grandTotalQuantity = 0
    
    months.forEach(m => { monthlyTotal[m.key] = { revenue: 0, quantity: 0 } })
    
    rows.forEach(row => {
      months.forEach(m => {
        const stats = row.monthlyStats[m.key]
        if (stats) {
          monthlyTotal[m.key].revenue += stats.revenue
          monthlyTotal[m.key].quantity += stats.quantity
        }
      })
      grandTotalRevenue += row.totalRevenue
      grandTotalQuantity += row.totalQuantity
    })
    
    return { monthlyTotal, grandTotalRevenue, grandTotalQuantity }
  }, [rows, months])

  const exportExcel = async () => {
    const [XLSX, { formatDataWorksheet }] = await Promise.all([
      import('xlsx-js-style'),
      import('@/lib/excelFormatting'),
    ])
    const headers = ['Course Name', ...months.map(m => m.label), 'Grand Total']
    const dataRows = rows.map(row => [
      row.courseName,
      ...months.map(m => {
        const stats = row.monthlyStats[m.key]
        return viewMode === 'sales'
          ? stats?.revenue || 0
          : stats?.quantity || 0
      }),
      viewMode === 'sales' ? row.totalRevenue : row.totalQuantity,
    ])
    const totalRow = [
      'Grand Total',
      ...months.map(m => {
        const stats = totals.monthlyTotal[m.key]
        return viewMode === 'sales'
          ? stats?.revenue || 0
          : stats?.quantity || 0
      }),
      viewMode === 'sales'
        ? totals.grandTotalRevenue
        : totals.grandTotalQuantity,
    ]
    const worksheet = XLSX.utils.aoa_to_sheet([['OUT-OF-STATE SALES'], headers, ...dataRows, totalRow])
    formatDataWorksheet(worksheet, {
      titleRow: 0,
      headerRow: 1,
      dataEndRow: dataRows.length + 2,
      totalRow: dataRows.length + 2,
      columnWidths: [48, ...months.map(() => 14), 16],
      currencyColumns: viewMode === 'sales' ? Array.from({ length: months.length + 1 }, (_, index) => index + 1) : [],
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, viewMode === 'sales' ? 'Sales' : 'Orders')
    XLSX.writeFile(workbook, `out-of-state-sales-${viewMode}.xlsx`)
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Out-of-State Sales
              {!loading && rows.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  {rows.length} courses
                </span>
              )}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Month-by-month breakdown of CBA course sales outside Washington.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => { setAddSearch(''); setActionError(''); setAddOpen(true) }} disabled={loading}>
              <Plus className="mr-2 h-4 w-4" />
              Add course
            </Button>
            <DateRangeFilter value={dateRange} onChange={setDateRange} showLabels={false} />
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">View: Sales ($)</SelectItem>
                <SelectItem value="orders">View: Orders (#)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportExcel} disabled={loading || rows.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button variant="outline" size="icon" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="m-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
              <p className="font-medium text-slate-900">No out-of-state sales found</p>
              <p className="text-sm text-muted-foreground">Try refreshing the data.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-5 py-3 text-left font-semibold border-b border-r min-w-[280px] max-w-[400px]">Course Name</th>
                    {months.map(m => (
                      <th key={m.key} className="px-4 py-3 text-right font-semibold border-b whitespace-nowrap min-w-[100px]">
                        {m.label}
                      </th>
                    ))}
                    <th className="px-5 py-3 text-right font-bold text-slate-700 border-b bg-blue-50/50">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.courseName} className="transition-colors hover:bg-slate-50/50">
                      <td className="sticky left-0 z-10 bg-white px-5 py-3 font-medium text-slate-900 border-r shadow-[1px_0_0_0_rgba(241,245,249,1)] min-w-[280px] max-w-[400px] whitespace-normal">
                        <div className="flex items-start justify-between gap-2">
                          <span>
                            {row.courseName}
                            {overrides.included.includes(row.courseName) ? <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">Added manually</span> : null}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" size="icon" variant="ghost" disabled={savingCourse === row.courseName} aria-label={`Actions for ${row.courseName}`} className="h-7 w-7 shrink-0 text-slate-500 hover:text-slate-900">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onSelect={() => void changeCourse(row.courseName, false)} className="text-red-700 focus:text-red-800">
                                <Trash2 className="mr-2 h-4 w-4" />Remove course
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                      {months.map(m => {
                        const stats = row.monthlyStats[m.key]
                        const val = viewMode === 'sales' 
                          ? formatUSD(stats?.revenue || 0)
                          : (stats?.quantity || 0).toLocaleString()
                        return (
                          <td key={m.key} className="px-4 py-3 text-right text-slate-600">
                            {(!stats || (stats.revenue === 0 && stats.quantity === 0)) ? <span className="text-slate-300">-</span> : val}
                          </td>
                        )
                      })}
                      <td className="px-5 py-3 text-right font-semibold bg-blue-50/30 text-slate-800">
                        {viewMode === 'sales' ? formatUSD(row.totalRevenue) : row.totalQuantity.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td className="sticky left-0 z-10 bg-slate-50 px-5 py-4 font-bold text-slate-900 border-r min-w-[280px] max-w-[400px]">Grand Total</td>
                    {months.map(m => {
                      const stats = totals.monthlyTotal[m.key]
                      const val = viewMode === 'sales'
                        ? formatUSD(stats?.revenue || 0)
                        : (stats?.quantity || 0).toLocaleString()
                      return (
                        <td key={m.key} className="px-4 py-4 text-right font-semibold text-slate-700">
                          {(!stats || (stats.revenue === 0 && stats.quantity === 0)) ? <span className="text-slate-300">-</span> : val}
                        </td>
                      )
                    })}
                    <td className="px-5 py-4 text-right font-bold text-blue-700 bg-blue-50">
                      {viewMode === 'sales' ? formatUSD(totals.grandTotalRevenue) : totals.grandTotalQuantity.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {actionError && !addOpen ? <p role="alert" className="text-sm text-red-700">{actionError}</p> : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add course to Out-of-State Sales</DialogTitle>
            <DialogDescription>Courses with sales in the selected period that are not in this list. Removed courses also appear here.</DialogDescription>
          </DialogHeader>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={addSearch} onChange={(event) => setAddSearch(event.target.value)} placeholder="Search courses" className="h-10 pl-9" /></div>
          {actionError ? <p role="alert" className="text-xs text-red-700">{actionError}</p> : null}
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
            {addableCourses.slice(0, 100).map((name) => (
              <div key={name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 break-words text-slate-800">{name}</span>
                <Button type="button" size="sm" variant="outline" disabled={savingCourse === name} onClick={() => void changeCourse(name, true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add</Button>
              </div>
            ))}
            {addableCourses.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-500">No matching courses.</p> : null}
          </div>
          {addableCourses.length > 100 ? <p className="text-xs text-slate-500">Showing the first 100 of {addableCourses.length}. Narrow the search to see more.</p> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
