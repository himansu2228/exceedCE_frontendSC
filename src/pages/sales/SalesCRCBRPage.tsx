import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSalesAnalytics } from '@/lib/api'
import { Target } from 'lucide-react'

type CRCBRRow = {
  courseName: string
  totalSales: number
  totalOrders: number
}

export function SalesCRCBRPage() {
  const [rows, setRows] = useState<CRCBRRow[]>([])
  const [rawCourses, setRawCourses] = useState<string[]>([])

  useEffect(() => {
    getSalesAnalytics({ limit: 'all' })
      .then((res) => {
        const raw = (res.revenueByCourse || [])
        setRawCourses(raw.map(r => r.course))

        const mapped = raw
          .filter((item) => {
            const name = (item.course || '').toLowerCase()
            
            // Exclude courses that end with _R
            if (name.endsWith('_r')) {
              return false;
            }

            return (
              name.startsWith('nc ') || 
              name.startsWith('sc ') || 
              name.includes('north carolina') || 
              name.includes('south carolina')
            )
          })
          .map((item) => ({
            courseName: item.course,
            totalSales: item.revenue * 0.2,
            totalOrders: item.quantity,
          }))
        setRows(mapped)
      })
      .catch(() => {
        setRows([])
        setRawCourses([])
      })
  }, [])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.sales += row.totalSales
        acc.orders += row.totalOrders
        return acc
      },
      { sales: 0, orders: 0 },
    )
  }, [rows])

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Target className="h-8 w-8 text-blue-400" />
        <div>
          <h1 className="text-xl font-semibold">CRCBR</h1>
          <p className="text-sm text-muted-foreground">Course-wise sales and order counts</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CRCBR Sales Table</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No CRCBR data available</p> : null}

          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium">Course Name</th>
                    <th className="px-4 py-3 text-right font-medium">Total Sales</th>
                    <th className="px-4 py-3 text-center font-medium">Total Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.courseName} className="border-b last:border-b-0">
                      <td className="px-4 py-3">{row.courseName}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatUSD(row.totalSales)}</td>
                      <td className="px-4 py-3 text-center">{row.totalOrders}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td className="px-4 py-3 font-semibold">Grand Total</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatUSD(totals.sales)}</td>
                    <td className="px-4 py-3 text-center font-semibold">{totals.orders}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
