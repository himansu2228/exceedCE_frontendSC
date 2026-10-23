import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getSalesOrders } from '@/lib/api'
import type { SalesOrder } from '@/lib/api'
import { formatCurrency } from './shared'

export interface OrderStatusSelection {
  name: string
  apiStatus: string
}

interface OrderStatusDetailsDialogProps {
  selection: OrderStatusSelection | null
  fromDate?: string
  toDate?: string
  onClose: () => void
}

function resolveStates(order: SalesOrder): string {
  const itemStates = Array.from(new Set(order.items.map((item) => item.stateCode).filter(Boolean)))
  if (itemStates.length > 0) return itemStates.join(', ')
  return order.billingStateCode || order.shippingStateCode || '-'
}

function resolveRefundReason(order: SalesOrder): string {
  const reasons = Array.from(new Set((order.refunds ?? []).map((refund) => refund.reason).filter(Boolean)))
  return reasons.length > 0 ? reasons.join('; ') : '-'
}

export function OrderStatusDetailsDialog({ selection, fromDate, toDate, onClose }: OrderStatusDetailsDialogProps) {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const apiStatus = selection?.apiStatus

  useEffect(() => {
    setPage(1)
  }, [apiStatus])

  useEffect(() => {
    if (!apiStatus) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getSalesOrders({ status: apiStatus, page, perPage, fromDate, toDate, sortBy: 'orderDate', sortDir: 'desc' })
      .then((result) => {
        if (cancelled) return
        setOrders(result.items)
        setTotal(result.total)
        setTotalPages(result.totalPages)
      })
      .catch((loadError) => {
        if (cancelled) return
        setOrders([])
        setError(loadError instanceof Error ? loadError.message : 'Unable to load orders')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiStatus, page, perPage, fromDate, toDate])

  const isRefunds = apiStatus === 'REFUNDED'

  return (
    <Dialog open={selection !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{selection?.name} orders</DialogTitle>
          <DialogDescription>
            {total.toLocaleString()} {total === 1 ? 'order' : 'orders'}
            {fromDate && toDate ? ` between ${fromDate} and ${toDate}` : ''}
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </div>
        ) : null}

        {!loading && !error && orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No orders found.</p>
        ) : null}

        {!loading && orders.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>State</TableHead>
                    {isRefunds ? <TableHead>Refund Reason</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const refundedAmount = (order.refunds ?? []).reduce((sum, refund) => sum + refund.amount, 0)
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.aomOrderId || order.id}</TableCell>
                        <TableCell>
                          <p className="font-medium">{order.customer?.fullName || '-'}</p>
                          <p className="max-w-56 truncate text-xs text-muted-foreground">{order.customer?.email || '-'}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="font-medium">{formatCurrency(order.total, order.currency)}</p>
                          {isRefunds && refundedAmount > 0 ? (
                            <p className="text-xs text-rose-600">Refunded {formatCurrency(refundedAmount, order.currency)}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>{resolveStates(order)}</TableCell>
                        {isRefunds ? <TableCell className="max-w-64">{resolveRefundReason(order)}</TableCell> : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={perPage}
              pageSizeOptions={[25, 50, 100]}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPerPage(size)
                setPage(1)
              }}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
