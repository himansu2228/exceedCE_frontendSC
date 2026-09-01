import { useEffect, useState } from 'react'
import { AlertTriangle, ReceiptText, RefreshCw, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
import { getSalesOrders } from '@/lib/api'
import type { SalesOrder } from '@/lib/api'
import { formatCurrency, StatusBadge } from './shared'

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function SalesTransactionsPage() {
  const [rows, setRows] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const load = async (targetPage = page, targetPerPage = perPage) => {
    try {
      setLoading(true)
      setError(null)
      const result = await getSalesOrders({
        page: targetPage,
        perPage: targetPerPage,
        search: search.trim() || undefined,
        status,
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
        sortBy: 'orderDate',
        sortDir: 'desc',
      })
      setRows(result.items)
      setPage(result.page)
      setPerPage(result.perPage)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load transactions')
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
  }, [search, status, dateRange, perPage])

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <section className="overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-emerald-50/60 shadow-[0_24px_70px_-45px_rgba(2,132,199,0.5)]">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-[0_12px_28px_-12px_rgba(2,132,199,0.9)]"><ReceiptText className="h-6 w-6" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Sales Operations</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Transaction Ledger</h1><p className="mt-1 text-sm text-slate-600">Monitor every synchronized sale, customer, and payment total in one place.</p></div>
          </div>
          <Button type="button" variant="outline" onClick={() => void load(1, perPage)} disabled={loading} className="border-sky-200 bg-white text-sky-700 hover:bg-sky-50"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </section>

      <Card className="border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
        <CardHeader className="border-b border-slate-100 pb-4"><CardTitle className="text-base">Find Transactions</CardTitle></CardHeader>
        <CardContent className="grid gap-3 pt-5 lg:grid-cols-[minmax(0,1fr)_11rem_minmax(18rem,0.9fr)]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, customer, email, or course" className="h-10 border-slate-200 pl-9" /></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Payment status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="FAILED">Failed</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem></SelectContent></Select>
          <DateRangeFilter value={dateRange} onChange={setDateRange} showLabels={false} className="min-w-0" />
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4"><div><CardTitle className="text-base">Sales Ledger</CardTitle><p className="mt-1 text-sm text-muted-foreground">Newest transactions appear first.</p></div><span className="rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{total.toLocaleString()} total</span></CardHeader>
        <CardContent className="p-0">
          {error ? <div className="m-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div> : null}
          {loading ? <TransactionTableSkeleton /> : null}
          {!loading && !error && rows.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-sky-50 text-sky-600"><ReceiptText className="h-5 w-5" /></div><p className="font-medium text-slate-900">No transactions found</p><p className="mt-1 text-sm text-muted-foreground">Try changing the search or date range.</p></div> : null}
          {!loading && rows.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 text-left font-semibold">Transaction</th><th className="px-5 py-3 text-left font-semibold">Date</th><th className="px-5 py-3 text-left font-semibold">Customer</th><th className="px-5 py-3 text-left font-semibold">Items</th><th className="px-5 py-3 text-left font-semibold">State</th><th className="px-5 py-3 text-right font-semibold">Tax</th><th className="px-5 py-3 text-right font-semibold">Discount</th><th className="px-5 py-3 text-right font-semibold">Total</th><th className="px-5 py-3 text-right font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="transition-colors hover:bg-sky-50/45"><td className="px-5 py-4 font-semibold text-slate-900">#{row.aomOrderId || row.id}</td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(row.orderDate)}</td><td className="px-5 py-4"><p className="font-medium text-slate-900">{row.customer?.fullName || '-'}</p><p className="mt-0.5 max-w-56 truncate text-xs text-slate-500">{row.customer?.email || '-'}</p></td><td className="px-5 py-4 text-slate-600">{row.items.length} {row.items.length === 1 ? 'item' : 'items'}</td><td className="px-5 py-4 text-slate-600">{row.billingStateCode || row.shippingStateCode || '-'}</td><td className="px-5 py-4 text-right text-slate-600">{formatCurrency(row.taxAmount, row.currency)}</td><td className="px-5 py-4 text-right text-slate-600">{formatCurrency(row.discountAmount, row.currency)}</td><td className="px-5 py-4 text-right font-semibold text-emerald-700">{formatCurrency(row.total, row.currency)}</td><td className="px-5 py-4 text-right"><StatusBadge status={row.status} displayStatus={row.displayStatus} /></td></tr>)}</tbody></table></div> : null}
          {!loading && !error ? <PaginationControls className="border-t border-slate-100 px-5 py-4" page={page} totalPages={totalPages} totalItems={total} pageSize={perPage} onPageChange={(nextPage) => void load(nextPage, perPage)} onPageSizeChange={(size) => { setPerPage(size); void load(1, size) }} /> : null}
        </CardContent>
      </Card>
    </div>
  )
}

function TransactionTableSkeleton() {
  return <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>
}
