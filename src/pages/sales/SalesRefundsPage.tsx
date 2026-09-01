import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CreditCard, RefreshCw, RotateCcw, Search, Undo2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
import { getSalesOrders } from '@/lib/api'
import type { SalesOrder } from '@/lib/api'
import { formatCurrency, StatusBadge } from './shared'

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function SalesRefundsPage() {
  const [rows, setRows] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const visibleRefundValue = useMemo(() => rows.reduce((sum, row) => sum + Number(row.total || 0), 0), [rows])
  const visibleCustomers = useMemo(() => new Set(rows.map((row) => row.customer?.id).filter(Boolean)).size, [rows])

  const load = async (targetPage = page, targetPerPage = perPage) => {
    try {
      setLoading(true)
      setError(null)
      const result = await getSalesOrders({ page: targetPage, perPage: targetPerPage, status: 'REFUNDED', search: search.trim() || undefined, fromDate: dateRange.fromDate || undefined, toDate: dateRange.toDate || undefined, sortBy: 'orderDate', sortDir: 'desc' })
      setRows(result.items)
      setPage(result.page)
      setPerPage(result.perPage)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load refunds')
      setRows([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(1, perPage), 300)
    return () => window.clearTimeout(timeoutId)
  }, [search, dateRange, perPage])

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <section className="overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-amber-50/50 shadow-[0_24px_70px_-45px_rgba(190,24,93,0.55)]">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-[0_12px_28px_-12px_rgba(225,29,72,0.9)]"><Undo2 className="h-6 w-6" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Sales Operations</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Refund Center</h1><p className="mt-1 text-sm text-slate-600">Review refunded orders and their impact on collected revenue.</p></div></div>
          <Button type="button" variant="outline" onClick={() => void load(1, perPage)} disabled={loading} className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3"><MetricCard icon={RotateCcw} label="Refunded Orders" value={total.toLocaleString()} accent="rose" /><MetricCard icon={CreditCard} label="Visible Refund Value" value={formatCurrency(visibleRefundValue)} accent="amber" description="Current page" /><MetricCard icon={Search} label="Visible Customers" value={visibleCustomers.toLocaleString()} accent="sky" description="Current page" /></section>

      <Card className="border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]"><CardHeader className="border-b border-slate-100 pb-4"><CardTitle className="text-base">Find Refunds</CardTitle></CardHeader><CardContent className="grid gap-3 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, customer, email, or course" className="h-10 border-slate-200 pl-9" /></div><DateRangeFilter value={dateRange} onChange={setDateRange} showLabels={false} className="min-w-0" /></CardContent></Card>

      <Card className="overflow-hidden border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]"><CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4"><div><CardTitle className="text-base">Refund Ledger</CardTitle><p className="mt-1 text-sm text-muted-foreground">Most recent refunds appear first.</p></div><span className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">{total.toLocaleString()} total</span></CardHeader><CardContent className="p-0">
        {error ? <div className="m-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div> : null}
        {loading ? <RefundTableSkeleton /> : null}
        {!loading && !error && rows.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><RotateCcw className="h-5 w-5" /></div><p className="font-medium text-slate-900">No refunds found</p><p className="mt-1 text-sm text-muted-foreground">Try changing the search or date range.</p></div> : null}
        {!loading && rows.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 text-left font-semibold">Order</th><th className="px-5 py-3 text-left font-semibold">Refund Date</th><th className="px-5 py-3 text-left font-semibold">Customer</th><th className="px-5 py-3 text-left font-semibold">Items</th><th className="px-5 py-3 text-left font-semibold">State</th><th className="px-5 py-3 text-right font-semibold">Refund Amount</th><th className="px-5 py-3 text-right font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="transition-colors hover:bg-rose-50/35"><td className="px-5 py-4 font-semibold text-slate-900">#{row.aomOrderId || row.id}</td><td className="px-5 py-4 whitespace-nowrap text-slate-600">{formatDate(row.orderDate)}</td><td className="px-5 py-4"><p className="font-medium text-slate-900">{row.customer?.fullName || '-'}</p><p className="mt-0.5 max-w-56 truncate text-xs text-slate-500">{row.customer?.email || '-'}</p></td><td className="px-5 py-4 text-slate-600">{row.items.length} {row.items.length === 1 ? 'item' : 'items'}</td><td className="px-5 py-4 text-slate-600">{row.billingStateCode || row.shippingStateCode || '-'}</td><td className="px-5 py-4 text-right font-semibold text-rose-700">{formatCurrency(row.total, row.currency)}</td><td className="px-5 py-4 text-right"><StatusBadge status={row.status} displayStatus={row.displayStatus} /></td></tr>)}</tbody></table></div> : null}
        {!loading && !error ? <PaginationControls className="border-t border-slate-100 px-5 py-4" page={page} totalPages={totalPages} totalItems={total} pageSize={perPage} onPageChange={(nextPage) => void load(nextPage, perPage)} onPageSizeChange={(size) => { setPerPage(size); void load(1, size) }} /> : null}
      </CardContent></Card>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, description, accent }: { icon: typeof RotateCcw; label: string; value: string; description?: string; accent: 'rose' | 'amber' | 'sky' }) {
  const styles = { rose: 'border-rose-100 bg-rose-50/50 text-rose-600', amber: 'border-amber-100 bg-amber-50/50 text-amber-600', sky: 'border-sky-100 bg-sky-50/50 text-sky-600' }
  return <Card className="border-slate-200 shadow-sm"><CardContent className="flex items-center gap-3 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${styles[accent]}`}><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>{description ? <p className="text-xs text-slate-500">{description}</p> : null}</div></CardContent></Card>
}

function RefundTableSkeleton() {
  return <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>
}
