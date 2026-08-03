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
            <div key={row.id} className="grid grid-cols-[120px_1fr_auto_auto] items-center gap-2 rounded-lg border p-3">
              <span className="text-sm">#{row.aomOrderId || row.id}</span>
              <span className="truncate text-sm">{row.customer?.fullName || '-'}</span>
              <StatusBadge status={row.status} displayStatus={row.displayStatus} />
              <strong>{formatCurrency(row.total, row.currency)}</strong>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
