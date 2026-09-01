import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, ChartNoAxesCombined, Package, RefreshCw, Search, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
import { getSalesAnalytics } from '@/lib/api'
import { formatCurrency } from './shared'

type CourseRow = { course: string; revenue: number; quantity: number }

export function SalesProductsPage() {
  const [rows, setRows] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [sortBy, setSortBy] = useState<'revenue' | 'quantity' | 'name'>('revenue')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getSalesAnalytics({
        limit: 'all',
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
      })
      setRows(response.revenueByCourse || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load course performance')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const handleDateRangeChange = (nextDateRange: DateRangeValue) => {
    setDateRange(nextDateRange)
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleSortChange = (value: 'revenue' | 'quantity' | 'name') => {
    setSortBy(value)
    setPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPerPage(size)
    setPage(1)
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? rows.filter((row) => row.course.toLowerCase().includes(query)) : rows
  }, [rows, search])
  const totalRevenue = useMemo(() => rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0), [rows])
  const totalQuantity = useMemo(() => rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0), [rows])
  const sortedRows = useMemo(() => [...filteredRows].sort((first, second) => {
    if (sortBy === 'name') return first.course.localeCompare(second.course)
    return sortBy === 'revenue' ? second.revenue - first.revenue : second.quantity - first.quantity
  }), [filteredRows, sortBy])
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / perPage))
  const currentPage = Math.min(page, totalPages)
  const visibleRows = sortedRows.slice((currentPage - 1) * perPage, currentPage * perPage)

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <section className="overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50/50 shadow-[0_24px_70px_-45px_rgba(109,40,217,0.5)]">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-[0_12px_28px_-12px_rgba(124,58,237,0.9)]"><BookOpen className="h-6 w-6" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Catalog Intelligence</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Products & Courses</h1><p className="mt-1 text-sm text-slate-600">Monitor course demand, units sold, and revenue performance.</p></div>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} className="border-violet-200 bg-white text-violet-700 hover:bg-violet-50"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Package} label="Courses Tracked" value={rows.length.toLocaleString()} accent="violet" />
        <MetricCard icon={ChartNoAxesCombined} label="Course Revenue" value={formatCurrency(totalRevenue)} accent="emerald" />
        <MetricCard icon={Trophy} label="Units Sold" value={totalQuantity.toLocaleString()} accent="amber" />
      </section>

      <Card className="overflow-hidden border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="text-base">Course Performance</CardTitle><p className="mt-1 text-sm text-muted-foreground">All available courses, ranked by revenue and enrollment volume.</p></div>
            <span className="rounded-md bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{sortedRows.length.toLocaleString()} courses</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)_12rem]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Search a course" className="h-10 border-slate-200 pl-9" /></div>
            <DateRangeFilter value={dateRange} onChange={handleDateRangeChange} showLabels={false} className="min-w-0" />
            <Select value={sortBy} onValueChange={(value) => handleSortChange(value as 'revenue' | 'quantity' | 'name')}><SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Sort courses" /></SelectTrigger><SelectContent><SelectItem value="revenue">Highest revenue</SelectItem><SelectItem value="quantity">Most units sold</SelectItem><SelectItem value="name">Course name A-Z</SelectItem></SelectContent></Select>
          </div>
          {loading ? <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : null}
          {!loading && error ? <div className="p-5 text-sm text-red-700">{error}</div> : null}
          {!loading && !error && sortedRows.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center"><BookOpen className="mb-3 h-6 w-6 text-violet-500" /><p className="font-medium text-slate-900">No courses found</p><p className="mt-1 text-sm text-muted-foreground">Try another course name or date range.</p></div> : null}
          {!loading && !error && sortedRows.length > 0 ? <><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 text-left font-semibold">Rank</th><th className="px-5 py-3 text-left font-semibold">Course</th><th className="px-5 py-3 text-right font-semibold">Units</th><th className="px-5 py-3 text-right font-semibold">Revenue</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.map((row, index) => <tr key={row.course} className="transition-colors hover:bg-violet-50/50"><td className="px-5 py-3.5 text-slate-500">{(currentPage - 1) * perPage + index + 1}</td><td className="px-5 py-3.5 font-medium text-slate-900">{row.course}</td><td className="px-5 py-3.5 text-right text-slate-600">{row.quantity.toLocaleString()}</td><td className="px-5 py-3.5 text-right font-semibold text-emerald-700">{formatCurrency(row.revenue)}</td></tr>)}</tbody></table></div><PaginationControls className="border-t border-slate-100 px-5 py-4" page={currentPage} totalPages={totalPages} totalItems={sortedRows.length} pageSize={perPage} pageSizeOptions={[25, 50, 100]} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} /></> : null}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, accent }: { icon: typeof Package; label: string; value: string; accent: 'violet' | 'emerald' | 'amber' }) {
  const styles = { violet: 'border-violet-100 bg-violet-50/50 text-violet-600', emerald: 'border-emerald-100 bg-emerald-50/50 text-emerald-600', amber: 'border-amber-100 bg-amber-50/50 text-amber-600' }
  return <Card className="border-slate-200 shadow-sm"><CardContent className="flex items-center gap-3 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${styles[accent]}`}><Icon className="h-5 w-5" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p></div></CardContent></Card>
}
