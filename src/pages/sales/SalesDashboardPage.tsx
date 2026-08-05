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

function truncateCourseLabel(label: string, maxLength = 26) {
  if (!label) return ''
  return label.length > maxLength ? `${label.slice(0, maxLength - 3)}...` : label
}

// Custom tooltip for Revenue by State chart
interface StateTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: { state: string; revenue: number } }>
  label?: string
}

interface CourseTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: { course: string; revenue: number } }>
}

interface OrderStatusDatum {
  name: string
  value: number
  color: string
  description: string
}

interface OrderStatusTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: OrderStatusDatum }>
  total: number
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

function CustomCourseTooltip({ active, payload }: CourseTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0]?.payload
  if (!data) return null

  return (
    <div className="max-w-[28rem] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p
        className="overflow-hidden break-words font-semibold leading-snug text-slate-900 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
        title={data.course}
      >
        {data.course}
      </p>
      <p className="text-sm text-slate-600">Revenue: {formatCurrency(data.revenue)}</p>
    </div>
  )
}

function CustomOrderStatusTooltip({ active, payload, total }: OrderStatusTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0]?.payload
  if (!data) return null

  const share = total > 0 ? (data.value / total) * 100 : 0

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="font-semibold text-slate-900">{data.name}</p>
      <p className="text-sm text-slate-600">{data.description}</p>
      <p className="mt-1 text-sm text-slate-700">
        {data.value.toLocaleString()} orders ({share.toFixed(1)}%)
      </p>
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
  const orderStatusData: OrderStatusDatum[] = [
    {
      name: 'Completed',
      value: kpi.completedOrders,
      color: '#16a34a',
      description: 'Successfully processed orders',
    },
    {
      name: 'Pending',
      value: kpi.pendingOrders,
      color: '#f59e0b',
      description: 'Awaiting confirmation or action',
    },
    {
      name: 'Refunded',
      value: kpi.refundedOrders,
      color: '#0ea5e9',
      description: 'Orders reversed and refunded',
    },
    {
      name: 'Failed',
      value: kpi.failedPayments,
      color: '#ef4444',
      description: 'Payment attempt was not captured',
    },
  ]
  const totalOrderStatuses = orderStatusData.reduce((sum, item) => sum + item.value, 0)

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
            <div className="h-[26rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueByCourse} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 20 }} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="course"
                    type="category"
                    width={230}
                    interval={0}
                    tickMargin={10}
                    tickFormatter={(value) => truncateCourseLabel(String(value || ''))}
                  />
                  <Tooltip content={<CustomCourseTooltip />} />
                  <Bar dataKey="revenue" fill="#0f766e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Status Mix</CardTitle>
            <p className="text-sm text-muted-foreground">
              Distribution of all sales orders by current lifecycle state.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="relative h-72 rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
                  <div className="rounded-full border border-slate-200 bg-white px-5 py-3 text-center shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Total Orders</p>
                    <p className="text-2xl font-semibold text-slate-900">{totalOrderStatuses.toLocaleString()}</p>
                  </div>
                </div>
                <div className="relative z-10 h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={72}
                        outerRadius={102}
                        paddingAngle={3}
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {orderStatusData.map((status) => (
                          <Cell key={status.name} fill={status.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomOrderStatusTooltip total={totalOrderStatuses} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2">
                {orderStatusData.map((status) => {
                  const share = totalOrderStatuses > 0 ? (status.value / totalOrderStatuses) * 100 : 0

                  return (
                    <div
                      key={status.name}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                            {status.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">{status.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{status.value.toLocaleString()}</p>
                          <p className="text-xs text-slate-600">{share.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Higher completed share indicates stronger checkout health, while pending and failed shares help identify recovery opportunities.
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
