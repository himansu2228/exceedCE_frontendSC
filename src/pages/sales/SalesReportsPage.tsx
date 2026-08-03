import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { getSalesReports, getSalesReportExportUrl } from '@/lib/api'
import type { SalesReportRow } from '@/lib/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from './shared'

export function SalesReportsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<SalesReportRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [course, setCourse] = useState('')
  const [customer, setCustomer] = useState('')
  const [state, setState] = useState('')
  const [source, setSource] = useState('')

  const load = async (targetPage = page, targetPerPage = perPage) => {
    try {
      setLoading(true)
      setError(null)
      const response = await getSalesReports({
        page: targetPage,
        perPage: targetPerPage,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        course: course || undefined,
        customer: customer || undefined,
        state: state || undefined,
        source: source || undefined,
      })
      setRows(response.items)
      setTotal(response.total)
      setTotalPages(response.totalPages)
      setGrandTotal(response.grandTotal)
      setPage(response.page)
      setPerPage(response.perPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, perPage)
  }, [])

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-600 p-2 text-white shadow-md">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Sales Reports</h1>
            <p className="text-sm text-muted-foreground">Spreadsheet-aligned sales report with export</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <a
            href={getSalesReportExportUrl({
              fromDate: fromDate || undefined,
              toDate: toDate || undefined,
              course: course || undefined,
              customer: customer || undefined,
              state: state || undefined,
              source: source || undefined,
            })}
            target="_blank"
            rel="noreferrer"
          >
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Input placeholder="Course" value={course} onChange={(e) => setCourse(e.target.value)} />
          <Input placeholder="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
          <Input placeholder="Source" value={source} onChange={(e) => setSource(e.target.value)} />
          <Button className="md:col-span-3 lg:col-span-2" onClick={() => void load(1, perPage)}>
            Apply Filters
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report Rows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {loading ? <p className="text-sm text-muted-foreground">Loading report...</p> : null}

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week Of</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Coupon</TableHead>
                  <TableHead>Date Purchased</TableHead>
                  <TableHead>Date Registered</TableHead>
                  <TableHead>Total Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                      No report rows found
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.itemId}>
                      <TableCell>{row.weekOf || '-'}</TableCell>
                      <TableCell>{row.customer}</TableCell>
                      <TableCell>{row.state || '-'}</TableCell>
                      <TableCell>{row.company || 'N/A'}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{row.course}</TableCell>
                      <TableCell>{formatCurrency(row.amount)}</TableCell>
                      <TableCell>{row.source || 'N/A'}</TableCell>
                      <TableCell>{row.coupon || 'N/A'}</TableCell>
                      <TableCell>{row.datePurchased || '-'}</TableCell>
                      <TableCell>{row.dateRegistered || '-'}</TableCell>
                      <TableCell>{formatCurrency(row.runningTotal || 0)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-zinc-50 p-3 text-sm">
            <span>Grand Total</span>
            <strong>{formatCurrency(grandTotal)}</strong>
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={perPage}
            onPageChange={(targetPage) => void load(targetPage, perPage)}
            onPageSizeChange={(size) => {
              setPerPage(size)
              void load(1, size)
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
