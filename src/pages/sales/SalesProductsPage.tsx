import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSalesAnalytics } from '@/lib/api'
import { formatCurrency } from './shared'

export function SalesProductsPage() {
  const [rows, setRows] = useState<Array<{ course: string; revenue: number; quantity: number }>>([])

  useEffect(() => {
    getSalesAnalytics()
      .then((res) => setRows(res.revenueByCourse))
      .catch(() => setRows([]))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Products / Courses</h1>
        <p className="text-sm text-muted-foreground">Top-selling courses and quantity distribution</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Course Performance</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No course sales available</p> : null}
          {rows.map((row) => (
            <div key={row.course} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg border p-3">
              <span className="truncate text-sm">{row.course}</span>
              <span className="text-xs text-muted-foreground">Qty: {row.quantity}</span>
              <strong>{formatCurrency(row.revenue)}</strong>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
