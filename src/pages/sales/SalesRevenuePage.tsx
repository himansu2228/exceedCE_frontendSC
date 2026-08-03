import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSalesAnalytics } from '@/lib/api'
import type { SalesDashboardResponse } from '@/lib/api'
import { formatCurrency } from './shared'

export function SalesRevenuePage() {
  const [data, setData] = useState<SalesDashboardResponse | null>(null)

  useEffect(() => {
    getSalesAnalytics().then(setData).catch(() => setData(null))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Revenue</h1>
        <p className="text-sm text-muted-foreground">Revenue insights by month, course, and state</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric title="Total Revenue" value={formatCurrency(data?.summary.totalRevenue || 0)} />
        <Metric title="Average Order Value" value={formatCurrency(data?.summary.averageOrderValue || 0)} />
        <Metric title="Completed Orders" value={String(data?.summary.completedOrders || 0)} />
        <Metric title="Refunded Orders" value={String(data?.summary.refundedOrders || 0)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue by Course (Top 10)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(data?.revenueByCourse || []).slice(0, 10).map((course) => (
            <div key={course.course} className="flex items-center justify-between rounded-lg border p-3">
              <span className="max-w-[70%] truncate text-sm">{course.course}</span>
              <strong>{formatCurrency(course.revenue)}</strong>
            </div>
          ))}
          {(!data || data.revenueByCourse.length === 0) ? <p className="text-sm text-muted-foreground">No revenue rows available</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}
