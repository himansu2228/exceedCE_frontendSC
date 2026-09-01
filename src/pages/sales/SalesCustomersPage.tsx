import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, Search, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { getSalesCustomers } from '@/lib/api'
import type { SalesCustomer } from '@/lib/api'
import { formatCurrency } from './shared'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function formatDate(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function SalesCustomersPage() {
  const [rows, setRows] = useState<SalesCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')

  const load = async (targetPage = page, targetPerPage = perPage) => {
    try {
      setLoading(true)
      setError(null)
      const result = await getSalesCustomers({ page: targetPage, perPage: targetPerPage, search: search || undefined })
      setRows(result.items)
      setPage(result.page)
      setPerPage(result.perPage)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, perPage)
  }, [])

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <section className="overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-emerald-50/50 shadow-[0_24px_70px_-45px_rgba(2,132,199,0.5)]">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-[0_12px_28px_-12px_rgba(2,132,199,0.9)]"><Users className="h-6 w-6" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Sales Directory</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Customers</h1><p className="mt-1 text-sm text-slate-600">Customer profiles, purchase activity, and lifetime spending in one place.</p></div>
          </div>
          <Button type="button" variant="outline" onClick={() => void load(1, perPage)} disabled={loading} className="border-sky-200 bg-white text-sky-700 hover:bg-sky-50"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </section>

      <Card className="border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
        <CardHeader className="border-b border-slate-100 pb-4"><CardTitle className="text-base">Find Customers</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input placeholder="Search customer, email, or company" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(1, perPage) }} className="h-10 border-slate-200 pl-9" /></div>
          <Button type="button" onClick={() => void load(1, perPage)} disabled={loading} className="h-10 bg-slate-900 hover:bg-slate-800">Search</Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4"><div><CardTitle className="text-base">Customer Directory</CardTitle><p className="mt-1 text-sm text-muted-foreground">Profiles are ordered by recent customer activity.</p></div><span className="rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{total.toLocaleString()} total</span></CardHeader>
        <CardContent className="p-0">
          {error ? <div className="m-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div> : null}
          {loading ? <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : null}
          {!loading && !error && rows.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-sky-50 text-sky-600"><Users className="h-5 w-5" /></div><p className="font-medium text-slate-900">No customers found</p><p className="mt-1 text-sm text-muted-foreground">Try a different name, email, or company search.</p></div> : null}
          {!loading && rows.length > 0 ? <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Purchases</TableHead>
                  <TableHead>Total Spending</TableHead>
                  <TableHead>Latest Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && !loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No customers found</TableCell></TableRow>
                ) : rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-sky-50/40">
                    <TableCell>
                      <div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">{(row.fullName || '?').slice(0, 1).toUpperCase()}</div><div><p className="font-medium text-slate-900">{row.fullName || '-'}</p><p className="max-w-56 truncate text-xs text-muted-foreground">{row.email || '-'}</p></div></div>
                    </TableCell>
                    <TableCell className="text-slate-600">{row.companyName || '-'}</TableCell>
                    <TableCell><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{row.source || 'Direct'}</span></TableCell>
                    <TableCell className="font-medium text-slate-600">{row.stateCode || '-'}</TableCell>
                    <TableCell className="font-medium text-slate-900">{row.totalOrders.toLocaleString()}</TableCell>
                    <TableCell className="font-semibold text-emerald-700">{formatCurrency(row.totalSpending)}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-600">{formatDate(row.latestOrderDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div> : null}

          {!loading && !error ? <PaginationControls
            className="border-t border-slate-100 px-5 py-4"
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={perPage}
            onPageChange={(targetPage) => void load(targetPage, perPage)}
            onPageSizeChange={(size) => {
              setPerPage(size)
              void load(1, size)
            }}
          /> : null}
        </CardContent>
      </Card>
    </div>
  )
}
