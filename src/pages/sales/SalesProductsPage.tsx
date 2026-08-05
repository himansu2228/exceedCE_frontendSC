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
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No course sales available</p> : null}
          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Course</th>
                    <th className="px-4 py-3 text-center font-medium">Quantity</th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.course} className="border-t">
                      <td className="px-4 py-3">{row.course}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{row.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
