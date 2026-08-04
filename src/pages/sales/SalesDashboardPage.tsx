import { useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RefreshCw, AlertTriangle, IndianRupee, ShoppingCart, Activity, Percent } from 'lucide-react'
import { getSalesDashboard } from '@/lib/api'
import type { SalesDashboardResponse } from '@/lib/api'
import { formatCurrency } from './shared'

const PIE_COLORS = ['#1d4ed8', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b']

// State code to full name mapping
const STATE_NAMES: Record<string, string> = {
  'NC': 'North Carolina',
  'SC': 'South Carolina',
  'HI': 'Hawaii',
  'MI': 'Michigan',
  'MO': 'Missouri',
  'IL': 'Illinois',
  'AL': 'Alabama',
  'ID': 'Idaho',
  'NV': 'Nevada',
  'CA': 'California',
  'WA': 'Washington',
}

// Custom tooltip for Revenue by State chart
interface StateTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: { state: string; revenue: number } }>
  label?: string
}

function CustomStateTooltip({ active, payload }: StateTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  
  const data = payload[0]?.payload
  if (!data) return null
  
  const fullName = STATE_NAMES[data.state] || data.state
  
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="font-semibold text-slate-900">{fullName} ({data.state})</p>
      <p className="text-sm text-slate-600">Revenue: {formatCurrency(data.revenue)}</p>
    </div>
  )
}

export function SalesDashboardPage() {
  const [data, setData] = useState<SalesDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getSalesDashboard()
      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const stateChart = useMemo(() => {
    if (!data) return []
    return data.revenueByState.slice(0, 8)
  }, [data])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-red-700">
        <AlertTriangle className="h-5 w-5" />
        <span>{error || 'Unable to load sales dashboard'}</span>
      </div>
    )
  }

  const kpi = data.kpi

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live KPIs and revenue performance</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Total Sales" value={formatCurrency(kpi.totalSales)} icon={IndianRupee} />
        <Metric title="Orders" value={kpi.orders.toLocaleString()} icon={ShoppingCart} />
        <Metric title="Avg Order Value" value={formatCurrency(kpi.averageOrderValue)} icon={Activity} />
        <Metric title="Sales Growth" value={`${kpi.salesGrowthPercent.toFixed(2)}%`} icon={Percent} />
        <Metric title="Today" value={formatCurrency(kpi.todaySales)} />
        <Metric title="Weekly" value={formatCurrency(kpi.weeklySales)} />
        <Metric title="Monthly" value={formatCurrency(kpi.monthlySales)} />
        <Metric title="Yearly" value={formatCurrency(kpi.yearlySales)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="#93c5fd" fillOpacity={0.35} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by State</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stateChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="state" />
                  <YAxis />
                  <Tooltip content={<CustomStateTooltip />} />
                  <Bar dataKey="revenue" fill="#0284c7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Course (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueByCourse} layout="vertical" margin={{ left: 12, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="course" type="category" width={170} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                  <Bar dataKey="revenue" fill="#0f766e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Status Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Completed', value: kpi.completedOrders },
                      { name: 'Pending', value: kpi.pendingOrders },
                      { name: 'Refunded', value: kpi.refundedOrders },
                      { name: 'Failed', value: kpi.failedPayments },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={120}
                    label
                  >
                    {PIE_COLORS.map((color, index) => (
                      <Cell key={index} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string
  icon?: ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xs uppercase tracking-[0.12em] text-muted-foreground">
          <span>{title}</span>
          {Icon ? <Icon className="h-4 w-4" /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}
