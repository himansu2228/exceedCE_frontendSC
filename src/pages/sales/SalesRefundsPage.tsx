import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSalesOrders } from '@/lib/api'
import type { SalesOrder } from '@/lib/api'
import { formatCurrency, StatusBadge } from './shared'

export function SalesRefundsPage() {
  const [rows, setRows] = useState<SalesOrder[]>([])

  useEffect(() => {
    getSalesOrders({ page: 1, perPage: 100, status: 'REFUNDED' })
      .then((res) => setRows(res.items))
      .catch(() => setRows([]))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Refunds</h1>
        <p className="text-sm text-muted-foreground">Refunded orders and payout impact</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Refunded Orders</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No refunded orders found</p> : null}
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border p-3 sm:grid-cols-[120px_minmax(0,1fr)_auto_auto] sm:gap-2"
            >
              <span className="col-start-1 row-start-1 min-w-0 text-sm sm:col-auto sm:row-auto">#{row.aomOrderId || row.id}</span>
              <span className="col-start-1 row-start-2 min-w-0 truncate text-sm sm:col-auto sm:row-auto">{row.customer?.fullName || '-'}</span>
              <div className="col-start-2 row-start-1 justify-self-end sm:col-auto sm:row-auto sm:justify-self-auto">
                <StatusBadge status={row.status} displayStatus={row.displayStatus} />
              </div>
              <strong className="col-start-2 row-start-2 whitespace-nowrap sm:col-auto sm:row-auto">{formatCurrency(row.total, row.currency)}</strong>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
