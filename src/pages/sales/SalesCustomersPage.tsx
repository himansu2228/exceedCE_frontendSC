import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { getSalesCustomers } from '@/lib/api'
import type { SalesCustomer } from '@/lib/api'
import { formatCurrency } from './shared'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function SalesCustomersPage() {
  const [rows, setRows] = useState<SalesCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground">Customer profiles with purchase history and spending</p>
      </div>

      <Card>
        <CardContent className="pt-6 flex gap-2">
          <Input placeholder="Search customer/email/company" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button onClick={() => void load(1, perPage)}>Search</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Customer List</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {loading ? <p className="text-sm text-muted-foreground">Loading customers...</p> : null}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
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
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium">{row.fullName || '-'}</p>
                      <p className="text-xs text-muted-foreground">{row.email || '-'}</p>
                    </TableCell>
                    <TableCell>{row.companyName || 'N/A'}</TableCell>
                    <TableCell>{row.source || 'N/A'}</TableCell>
                    <TableCell>{row.stateCode || 'N/A'}</TableCell>
                    <TableCell>{row.totalOrders}</TableCell>
                    <TableCell>{formatCurrency(row.totalSpending)}</TableCell>
                    <TableCell>{row.latestOrderDate ? new Date(row.latestOrderDate).toLocaleDateString() : '-'}</TableCell>
                  </TableRow>
                ))}
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
