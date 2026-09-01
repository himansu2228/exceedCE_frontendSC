import { useCallback, useEffect, useState } from 'react'
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PaginationControls } from '@/components/ui/pagination-controls'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getSalesReportExportUrl, getSalesReports } from '@/lib/api'
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
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'

interface ReportPreset {
  id: string
  label: string
  filters: {
    state?: string | string[]
    source?: string
    course?: string
  }
  description?: string
}

interface SalesReportsPageProps {
  initialPreset?: string
}

// Predefined report presets for common use cases
const REPORT_PRESETS: ReportPreset[] = [
  { id: 'all', label: 'All Reports', filters: {} },
  { 
    id: 'nc', 
    label: 'NC Sales Report', 
    filters: { state: 'NC' },
    description: 'North Carolina market sales'
  },
  { 
  id: 'crcbr',
  label: 'CRCBR Sales Report',
  filters: {
    state: ['NC', 'SC'],
    source: 'CRCBR'
  },
  description: 'CRCBR partner'
  },
  { 
    id: 'cba', 
    label: 'CBA Sales Report', 
    filters: { source: 'CBA' },
    description: 'Commercial Brokers Association partner'
  },
  { 
    id: 'partner-direct', 
    label: 'Direct Sales Channel', 
    filters: { source: 'Direct' },
    description: 'Direct enrollment sales'
  },
  { 
    id: 'partner-referral', 
    label: 'Referral Channel', 
    filters: { source: 'Referral' },
    description: 'Referred customer sales'
  },
]

function resolveDisplaySource(row: SalesReportRow): string {
  const feedback = (row.feedback || '').trim()
  const feedbackOther = (row.feedbackOther || '').trim()

  if (feedback.toLowerCase() === 'other') {
    if (feedbackOther) return feedbackOther
  } else if (feedback) {
    return feedback
  }

  const source = (row.source || '').trim()
  return source || 'N/A'
}

export function SalesReportsPage({ initialPreset = 'all' }: SalesReportsPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<SalesReportRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [preset, setPreset] = useState(initialPreset)
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [course, setCourse] = useState('')
  const [customer, setCustomer] = useState('')
  const [state, setState] = useState('')
  const [source, setSource] = useState('')

  useEffect(() => {
    if (initialPreset !== 'all') {
      applyPreset(initialPreset)
    }
  }, [])

  const applyPreset = (presetId: string) => {
    const selectedPreset = REPORT_PRESETS.find((p) => p.id === presetId)
    if (!selectedPreset) return

    // Reset all filters first
    setDateRange({ fromDate: '', toDate: '' })
    setCourse('')
    setCustomer('')
    setState('')
    setSource('')

    // Apply preset filters
    if (selectedPreset.filters.state) {
      setState(
        Array.isArray(selectedPreset.filters.state)
          ? selectedPreset.filters.state.join(', ')
          : selectedPreset.filters.state
      )
    }
    if (selectedPreset.filters.source) {
      setSource(selectedPreset.filters.source)
    }
    if (selectedPreset.filters.course) {
      setCourse(selectedPreset.filters.course)
    }

    setPreset(presetId)
    setPage(1)
  }

  const load = useCallback(async (targetPage: number, targetPerPage: number) => {
    try {
      setLoading(true)
      setError(null)
      const response = await getSalesReports({
        page: targetPage,
        perPage: targetPerPage,
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
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
  }, [dateRange, course, customer, state, source])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(1, perPage), 300)
    return () => window.clearTimeout(timeoutId)
  }, [load, perPage])

  const handleDateRangeChange = (nextDateRange: DateRangeValue) => {
    setDateRange(nextDateRange)
    setPage(1)
  }

  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value)
    setPage(1)
  }

  const handleExportCSV = async () => {
    try {
      const exportUrl = getSalesReportExportUrl({
        format: 'csv',
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
        state: state || undefined,
        source: source || undefined,
        course: course || undefined,
        customer: customer || undefined,
      })

      const response = await fetch(exportUrl, {
        method: 'GET',
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Export failed: ${response.statusText}`)
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase()
      if (contentType.includes('text/html')) {
        throw new Error('Export endpoint returned HTML instead of CSV. Please retry and contact support if this continues.')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const contentDisposition = response.headers.get('content-disposition') || ''
      const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)
      const serverFilename = filenameMatch?.[1]?.trim()
      const decodedFilename = serverFilename ? decodeURIComponent(serverFilename.replace(/^"|"$/g, '')) : null
      const now = new Date()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const yyyy = now.getFullYear()
      const timeStr = `${now.getHours()}${now.getMinutes()}`
      const ext = contentType.includes('spreadsheetml') ? 'xlsx' : 'csv'
      const fallbackFilename = `salesReport - ${mm}${dd}${yyyy} - ${timeStr}.${ext}`

      link.href = url
      link.download = decodedFilename || fallbackFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      alert(`Failed to export: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

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
          <Button variant="outline" onClick={() => void load(page, perPage)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-4">
          <div className="flex flex-col gap-2">
            <div className="grid gap-2 sm:grid-cols-1 lg:grid-cols-4 items-end">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Preset</label>
                <Select value={preset} onValueChange={applyPreset}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DateRangeFilter
                value={dateRange}
                onChange={handleDateRangeChange}
                className="lg:col-span-2"
                showLabels={false}
              />
              <Input placeholder="State" value={state} onChange={(e) => handleFilterChange(setState, e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <Input placeholder="Course" value={course} onChange={(e) => handleFilterChange(setCourse, e.target.value)} className="h-8 text-xs" />
              <Input placeholder="Customer" value={customer} onChange={(e) => handleFilterChange(setCustomer, e.target.value)} className="h-8 text-xs" />
              <Input placeholder="Source" value={source} onChange={(e) => handleFilterChange(setSource, e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
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
                      <TableCell>{resolveDisplaySource(row)}</TableCell>
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
              setPage(1)
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
