import { useEffect, useState } from 'react'
import { ChartColumnBig, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from 'recharts'
import { getSalesAnalytics } from '@/lib/api'
import type { SalesDashboardResponse } from '@/lib/api'
import { formatCurrency } from './shared'

export function SalesAnalyticsPage() {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SalesDashboardResponse | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getSalesAnalytics({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      })
      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-600 p-2 text-white shadow-md">
            <ChartColumnBig className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Sales Analytics</h1>
            <p className="text-sm text-muted-foreground">Deep analysis with date-range filtering</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">From</p>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[150px]" />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">To</p>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[150px]" />
          </div>
          <Button onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Apply
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : error || !data ? (
        <Card>
          <CardContent className="pt-6 text-red-600">{error || 'No analytics data found'}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Info title="Revenue" value={formatCurrency(data.summary.totalRevenue)} />
            <Info title="Orders" value={data.summary.totalOrders.toLocaleString()} />
            <Info title="AOV" value={formatCurrency(data.summary.averageOrderValue)} />
            <Info title="Failed Payments" value={String(data.summary.failedPayments)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Revenue vs Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip formatter={(value, name) => (name === 'revenue' ? formatCurrency(Number(value || 0)) : value)} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} />
                      <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#0f766e" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Revenue States</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.revenueByState.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="state" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                      <Bar dataKey="revenue" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function Info({ title, value }: { title: string; value: string }) {
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
