import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge, formatCurrency } from './shared'
import { COUNT_SORT, DATE_SORT, NUMBER_SORT, SortHeader, StateHeader, TEXT_SORT, type SortDir } from './ColumnHeaderControls'
import { getSalesOrders } from '@/lib/api'
import type { SalesOrder } from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'

export function SalesOrdersPage() {
  const [rows, setRows] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [sortBy, setSortBy] = useState('orderDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [stateFilter, setStateFilter] = useState('')

  const handleSortChange = (key: string, dir: SortDir) => {
    setSortBy(key)
    setSortDir(dir)
  }

  const sortProps = { activeKey: sortBy, activeDir: sortDir, onChange: handleSortChange }

  const load = async (targetPage = page, targetPerPage = perPage) => {
    try {
      setLoading(true)
      setError(null)
      const result = await getSalesOrders({
        page: targetPage,
        perPage: targetPerPage,
        search: search || undefined,
        status,
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
        sortBy,
        sortDir,
        state: stateFilter || undefined,
      })
      setRows(result.items)
      setPage(result.page)
      setPerPage(result.perPage)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(1, perPage), 300)
    return () => window.clearTimeout(timeoutId)
  }, [search, status, dateRange, sortBy, sortDir, stateFilter, perPage])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">Search, filter, and inspect all synchronized orders</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Input placeholder="Search customer/course" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Filter by order status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
              <SelectItem value="PENDING_PAYMENT">Pending payment</SelectItem>
            </SelectContent>
          </Select>
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            showLabels={false}
            className="md:col-span-2 lg:col-span-3"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {loading ? <p className="text-sm text-muted-foreground">Loading orders...</p> : null}

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortHeader label="Order" sortKey="orderNumber" options={DATE_SORT} {...sortProps} /></TableHead>
                  <TableHead><SortHeader label="Date" sortKey="orderDate" options={DATE_SORT} {...sortProps} /></TableHead>
                  <TableHead><SortHeader label="Customer" sortKey="customer" options={TEXT_SORT} {...sortProps} /></TableHead>
                  <TableHead><SortHeader label="Status" sortKey="status" options={TEXT_SORT} {...sortProps} /></TableHead>
                  <TableHead><SortHeader label="Amount" sortKey="amount" options={NUMBER_SORT} {...sortProps} /></TableHead>
                  <TableHead><SortHeader label="Tax" sortKey="tax" options={NUMBER_SORT} {...sortProps} /></TableHead>
                  <TableHead><SortHeader label="Discount" sortKey="discount" options={NUMBER_SORT} {...sortProps} /></TableHead>
                  <TableHead><StateHeader value={stateFilter} onChange={setStateFilter} /></TableHead>
                  <TableHead><SortHeader label="Items" sortKey="items" options={COUNT_SORT} {...sortProps} /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">No orders found</TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>#{row.aomOrderId || row.id}</TableCell>
                      <TableCell>{row.orderDate ? new Date(row.orderDate).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>
                        <p className="font-medium">{row.customer?.fullName || '-'}</p>
                        <p className="text-xs text-muted-foreground">{row.customer?.email || '-'}</p>
                      </TableCell>
                      <TableCell><StatusBadge status={row.status} displayStatus={row.displayStatus} /></TableCell>
                      <TableCell>{formatCurrency(row.total, row.currency)}</TableCell>
                      <TableCell>{formatCurrency(row.taxAmount, row.currency)}</TableCell>
                      <TableCell>{formatCurrency(row.discountAmount, row.currency)}</TableCell>
                      <TableCell>{row.billingStateCode || row.shippingStateCode || '-'}</TableCell>
                      <TableCell>{row.items.length}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
