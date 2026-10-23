import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BookOpenCheck, MoreHorizontal, Plus, RefreshCw, Search, Target, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getCourseListOverrides, getSalesAnalytics, setCourseListOverride, type CourseListOverrides } from '@/lib/api'

type CRCBRRow = {
  courseName: string
  totalSales: number
  totalOrders: number
  manual: boolean
}

type CourseSale = { course: string; revenue: number; quantity: number }

const AUTO_COURSE_NAMES = ['north carolina', 'north carolina ce', 'south carolina', 'south carolina ce']

// Courses CRCBR includes by default; super admins can add to or remove from this list.
function isAutoCourse(courseName: string): boolean {
  const name = (courseName || '').toLowerCase().trim()
  return !/\bexp\b/.test(name) && AUTO_COURSE_NAMES.some((valid) => name.includes(valid))
}

type SortBy = 'commission' | 'orders' | 'course'

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function SalesCRCBRPage() {
  const [allCourses, setAllCourses] = useState<CourseSale[]>([])
  const [overrides, setOverrides] = useState<CourseListOverrides>({ included: [], excluded: [] })
  const [addOpen, setAddOpen] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [savingCourse, setSavingCourse] = useState('')
  const [actionError, setActionError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('commission')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [response, courseOverrides] = await Promise.all([
        getSalesAnalytics({ limit: 'all' }),
        getCourseListOverrides('crcbr'),
      ])
      setAllCourses(response.revenueByCourse || [])
      setOverrides(courseOverrides)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load CRCBR sales')
      setAllCourses([])
    } finally {
      setLoading(false)
    }
  }, [])

  const rows = useMemo<CRCBRRow[]>(() => {
    const included = new Set(overrides.included)
    const excluded = new Set(overrides.excluded)
    const seen = new Set<string>()
    const result: CRCBRRow[] = []
    for (const item of allCourses) {
      const name = item.course || ''
      if (!name || seen.has(name)) continue
      if (included.has(name) || (isAutoCourse(name) && !excluded.has(name))) {
        seen.add(name)
        result.push({ courseName: name, totalSales: item.revenue * 0.2, totalOrders: item.quantity, manual: included.has(name) })
      }
    }
    for (const name of included) {
      if (!seen.has(name)) result.push({ courseName: name, totalSales: 0, totalOrders: 0, manual: true })
    }
    return result
  }, [allCourses, overrides])

  const addableCourses = useMemo(() => {
    const current = new Set(rows.map((row) => row.courseName))
    const query = addSearch.trim().toLowerCase()
    return Array.from(new Set(allCourses.map((item) => item.course).filter(Boolean)))
      .filter((name) => !current.has(name) && (!query || name.toLowerCase().includes(query)))
      .sort((first, second) => first.localeCompare(second))
  }, [allCourses, rows, addSearch])

  const changeCourse = async (course: string, add: boolean) => {
    const auto = isAutoCourse(course)
    const action = add ? (auto ? 'reset' : 'include') : (auto ? 'exclude' : 'reset')
    setSavingCourse(course)
    setActionError('')
    try {
      setOverrides(await setCourseListOverride('crcbr', course, action))
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'Unable to update the course list.')
    } finally {
      setSavingCourse('')
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? rows.filter((row) => row.courseName.toLowerCase().includes(query)) : rows
  }, [rows, search])
  const sortedRows = useMemo(() => [...filteredRows].sort((first, second) => {
    if (sortBy === 'course') return first.courseName.localeCompare(second.courseName)
    return sortBy === 'orders' ? second.totalOrders - first.totalOrders : second.totalSales - first.totalSales
  }), [filteredRows, sortBy])
  const totals = useMemo(() => sortedRows.reduce((summary, row) => ({
    sales: summary.sales + row.totalSales,
    orders: summary.orders + row.totalOrders,
  }), { sales: 0, orders: 0 }), [sortedRows])
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / perPage))
  const currentPage = Math.min(page, totalPages)
  const visibleRows = sortedRows.slice((currentPage - 1) * perPage, currentPage * perPage)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleSortChange = (value: SortBy) => {
    setSortBy(value)
    setPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPerPage(size)
    setPage(1)
  }

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <section className="overflow-hidden rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50 via-white to-blue-50/60 shadow-[0_24px_70px_-45px_rgba(8,145,178,0.5)]">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-[0_12px_28px_-12px_rgba(8,145,178,0.9)]"><Target className="h-6 w-6" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">Partner Performance</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">CRCBR Sales</h1><p className="mt-1 text-sm text-slate-600">Course-level commissions for North Carolina and South Carolina partner sales.</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={() => { setAddSearch(''); setActionError(''); setAddOpen(true) }} disabled={loading} className="bg-cyan-600 hover:bg-cyan-700"><Plus className="mr-2 h-4 w-4" />Add course</Button>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} className="border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
        <CardHeader className="border-b border-slate-100 pb-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Commission Ledger</CardTitle><p className="mt-1 text-sm text-muted-foreground">Calculated at a 20% partner share from synchronized course sales.</p></div><span className="rounded-md bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">{sortedRows.length.toLocaleString()} courses</span></div></CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[minmax(0,1fr)_12rem]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Search CRCBR courses" className="h-10 border-slate-200 pl-9" /></div>
            <Select value={sortBy} onValueChange={(value) => handleSortChange(value as SortBy)}><SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Sort courses" /></SelectTrigger><SelectContent><SelectItem value="commission">Highest commission</SelectItem><SelectItem value="orders">Most orders</SelectItem><SelectItem value="course">Course name A-Z</SelectItem></SelectContent></Select>
          </div>
          {loading ? <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : null}
          {!loading && error ? <div className="m-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div> : null}
          {!loading && !error && sortedRows.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center"><BookOpenCheck className="mb-3 h-6 w-6 text-cyan-600" /><p className="font-medium text-slate-900">No CRCBR courses found</p><p className="mt-1 text-sm text-muted-foreground">Try a different course search or refresh the data.</p></div> : null}
          {!loading && !error && sortedRows.length > 0 ? <><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 text-left font-semibold">Rank</th><th className="px-5 py-3 text-left font-semibold">Course</th><th className="px-5 py-3 text-right font-semibold">Orders</th><th className="px-5 py-3 text-right font-semibold">Partner Commission</th><th className="px-5 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.map((row, index) => <tr key={row.courseName} className="transition-colors hover:bg-cyan-50/45"><td className="px-5 py-3.5 text-slate-500">{(currentPage - 1) * perPage + index + 1}</td><td className="px-5 py-3.5 font-medium text-slate-900">{row.courseName}{row.manual ? <span className="ml-2 rounded bg-cyan-50 px-1.5 py-0.5 text-[11px] font-medium text-cyan-700">Added manually</span> : null}</td><td className="px-5 py-3.5 text-right font-medium text-slate-700">{row.totalOrders.toLocaleString()}</td><td className="px-5 py-3.5 text-right font-semibold text-emerald-700">{formatUSD(row.totalSales)}</td><td className="px-5 py-3.5 text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" disabled={savingCourse === row.courseName} aria-label={`Actions for ${row.courseName}`} className="h-8 w-8 text-slate-500 hover:text-slate-900"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => void changeCourse(row.courseName, false)} className="text-red-700 focus:text-red-800"><Trash2 className="mr-2 h-4 w-4" />Remove course</DropdownMenuItem></DropdownMenuContent></DropdownMenu></td></tr>)}</tbody><tfoot className="border-t border-slate-200 bg-cyan-50/50"><tr><td colSpan={2} className="px-5 py-3.5 font-semibold text-slate-900">Filtered Total</td><td className="px-5 py-3.5 text-right font-semibold text-slate-700">{totals.orders.toLocaleString()}</td><td className="px-5 py-3.5 text-right font-semibold text-emerald-700">{formatUSD(totals.sales)}</td><td /></tr></tfoot></table></div><PaginationControls className="border-t border-slate-100 px-5 py-4" page={currentPage} totalPages={totalPages} totalItems={sortedRows.length} pageSize={perPage} pageSizeOptions={[25, 50, 100]} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} /></> : null}
        </CardContent>
      </Card>

      {actionError && !addOpen ? <p role="alert" className="text-sm text-red-700">{actionError}</p> : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add course to CRCBR</DialogTitle>
            <DialogDescription>Courses with synchronized sales that are not currently in the CRCBR list. Removed NC/SC courses also appear here.</DialogDescription>
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
