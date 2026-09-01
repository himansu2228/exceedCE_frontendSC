import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BookOpenCheck, RefreshCw, Search, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSalesAnalytics } from '@/lib/api'

type CRCBRRow = {
  courseName: string
  totalSales: number
  totalOrders: number
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
  const [rows, setRows] = useState<CRCBRRow[]>([])
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
      const response = await getSalesAnalytics({ limit: 'all' })
      const mapped = (response.revenueByCourse || [])
        .filter((item) => {
          const courseName = (item.course || '').toLowerCase()
          return !courseName.endsWith('_r') && (
            courseName.startsWith('nc ') ||
            courseName.startsWith('sc ') ||
            courseName.includes('north carolina') ||
            courseName.includes('south carolina')
          )
        })
        .map((item) => ({
          courseName: item.course,
          totalSales: item.revenue * 0.2,
          totalOrders: item.quantity,
        }))
      setRows(mapped)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load CRCBR sales')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

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
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} className="border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
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
          {!loading && !error && sortedRows.length > 0 ? <><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 text-left font-semibold">Rank</th><th className="px-5 py-3 text-left font-semibold">Course</th><th className="px-5 py-3 text-right font-semibold">Orders</th><th className="px-5 py-3 text-right font-semibold">Partner Commission</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.map((row, index) => <tr key={row.courseName} className="transition-colors hover:bg-cyan-50/45"><td className="px-5 py-3.5 text-slate-500">{(currentPage - 1) * perPage + index + 1}</td><td className="px-5 py-3.5 font-medium text-slate-900">{row.courseName}</td><td className="px-5 py-3.5 text-right font-medium text-slate-700">{row.totalOrders.toLocaleString()}</td><td className="px-5 py-3.5 text-right font-semibold text-emerald-700">{formatUSD(row.totalSales)}</td></tr>)}</tbody><tfoot className="border-t border-slate-200 bg-cyan-50/50"><tr><td colSpan={2} className="px-5 py-3.5 font-semibold text-slate-900">Filtered Total</td><td className="px-5 py-3.5 text-right font-semibold text-slate-700">{totals.orders.toLocaleString()}</td><td className="px-5 py-3.5 text-right font-semibold text-emerald-700">{formatUSD(totals.sales)}</td></tr></tfoot></table></div><PaginationControls className="border-t border-slate-100 px-5 py-4" page={currentPage} totalPages={totalPages} totalItems={sortedRows.length} pageSize={perPage} pageSizeOptions={[25, 50, 100]} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} /></> : null}
        </CardContent>
      </Card>
    </div>
  )
}
