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
import { RefreshCw, AlertTriangle, DollarSign, ShoppingCart, Activity, Percent } from 'lucide-react'
import { getSalesDashboard, getSalesCustomerCohort, getSalesAttributionBySource } from '@/lib/api'
import type { SalesDashboardResponse, CustomerCohortAnalysis, SalesAttributionBySource } from '@/lib/api'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
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

function formatHeaderDate(isoDate: string): string {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [data, setData] = useState<SalesDashboardResponse | null>(null)
  const [cohortData, setCohortData] = useState<CustomerCohortAnalysis | null>(null)
  const [attributionData, setAttributionData] = useState<SalesAttributionBySource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedRangeLabel = useMemo(() => {
    if (!dateRange.fromDate && !dateRange.toDate) return ''
    const from = dateRange.fromDate ? formatHeaderDate(dateRange.fromDate) : '...'
    const to = dateRange.toDate ? formatHeaderDate(dateRange.toDate) : '...'
    return `Showing data for ${from} - ${to}`
  }, [dateRange.fromDate, dateRange.toDate])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const [dashboardResponse, cohortResponse, attributionResponse] = await Promise.all([
        getSalesDashboard({
          fromDate: dateRange.fromDate || undefined,
          toDate: dateRange.toDate || undefined,
        }),
        getSalesCustomerCohort({
          fromDate: dateRange.fromDate || undefined,
          toDate: dateRange.toDate || undefined,
        }),
        getSalesAttributionBySource({
          fromDate: dateRange.fromDate || undefined,
          toDate: dateRange.toDate || undefined,
        }),
      ])
      setData(dashboardResponse)
      setCohortData(cohortResponse)
      setAttributionData(attributionResponse)
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live KPIs and revenue performance with date filtering</p>
          {selectedRangeLabel ? (
            <p className="mt-1 break-words text-xs font-medium text-blue-700">{selectedRangeLabel}</p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            showLabels={false}
            className="w-full sm:w-auto [&>div]:min-w-0 sm:[&>div]:min-w-[300px]"
          />
          <Button className="w-full sm:w-auto" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Apply
          </Button>
        </div>
      </div>

      <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-600">Year-to-Date Sales</p>
            <p className="mt-1 break-words text-3xl font-bold text-blue-900">{formatCurrency(kpi.yearlySales)}</p>
            <p className="mt-2 break-words text-xs text-blue-700">
              {kpi.orders.toLocaleString()} orders • {formatCurrency(kpi.averageOrderValue)} average value
            </p>
          </div>
          <div className="self-start text-left sm:self-auto sm:text-right">
            <div className="rounded-lg bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-slate-600">Monthly Avg</p>
              <p className="text-lg font-semibold text-slate-900">
                {formatCurrency(kpi.yearlySales / 12)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Total Sales" value={formatCurrency(kpi.totalSales)} icon={DollarSign} />
        <Metric title="Orders" value={kpi.orders.toLocaleString()} icon={ShoppingCart} />
        <Metric title="Avg Order Value" value={formatCurrency(kpi.averageOrderValue)} icon={Activity} />
        <Metric title="Sales Growth" value={`${kpi.salesGrowthPercent.toFixed(2)}%`} icon={Percent} />
        <Metric title="Today" value={formatCurrency(kpi.todaySales)} />
        <Metric title="Weekly" value={formatCurrency(kpi.weeklySales)} />
        <Metric title="Monthly" value={formatCurrency(kpi.monthlySales)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 sm:h-80">
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

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Revenue by State</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 sm:h-80">
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
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Revenue by Course (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[22rem] sm:h-[26rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueByCourse} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="course"
                    type="category"
                    width={108}
                    interval={0}
                    tickMargin={10}
                    tickFormatter={(value) => truncateCourseLabel(String(value || ''), 14)}
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

        <Card>
          <CardHeader>
            <CardTitle>Customer Cohorts</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sales breakdown by new vs returning customers based on first order date.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="relative h-72 rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
                  <div className="rounded-full border border-slate-200 bg-white px-5 py-3 text-center shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Total Customers</p>
                    <p className="text-2xl font-semibold text-slate-900">
                      {cohortData
                        ? (cohortData.new.customerCount + cohortData.returning.customerCount).toLocaleString()
                        : '-'}
                    </p>
                  </div>
                </div>
                <div className="relative z-10 h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={
                          cohortData
                            ? [
                              {
                                name: 'New Customers',
                                value: cohortData.new.customerCount,
                                color: '#3b82f6',
                              },
                              {
                                name: 'Returning Customers',
                                value: cohortData.returning.customerCount,
                                color: '#8b5cf6',
                              },
                            ]
                            : []
                        }
                        dataKey="value"
                        nameKey="name"
                        innerRadius={72}
                        outerRadius={102}
                        paddingAngle={3}
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {cohortData && [
                          { name: 'New Customers', value: cohortData.new.customerCount, color: '#3b82f6' },
                          { name: 'Returning Customers', value: cohortData.returning.customerCount, color: '#8b5cf6' },
                        ].map((cohort) => (
                          <Cell key={cohort.name} fill={cohort.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        }}
                        formatter={(value: number) => value.toLocaleString()}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2">
                {cohortData && [
                  { name: 'New Customers', ...cohortData.new, color: '#3b82f6' },
                  { name: 'Returning Customers', ...cohortData.returning, color: '#8b5cf6' },
                ].map((cohort) => (
                  <div
                    key={cohort.name}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cohort.color }} />
                          {cohort.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {cohort.customerCount} customers • {cohort.totalOrders} orders
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(cohort.revenue)}
                        </p>
                        <p className="text-xs text-slate-600">{cohort.percentOfRevenue.toFixed(1)}% of revenue</p>
                        <p className="mt-1 text-xs font-medium text-slate-700">
                          Avg: {formatCurrency(cohort.avgCustomerValue)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              New customers = first order within 90 days. Returning customers = first order 90+ days ago.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales Attribution by Source</CardTitle>
            <p className="text-sm text-muted-foreground">
              Revenue breakdown by marketing channel or sales source
            </p>
          </CardHeader>
          <CardContent>
            {attributionData && attributionData.sources.length > 0 ? (
              <div className="space-y-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={attributionData.sources.map((s, idx) => ({
                        name: s.source,
                        revenue: s.revenue,
                        color: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'][idx % 6],
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                        {attributionData.sources.map((_, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'][
                              idx % 6
                            ]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {attributionData.sources.map((source, idx) => (
                    <div key={source.source} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <span
                              className="h-2.5 w-2.5 rounded"
                              style={{
                                backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'][
                                  idx % 6
                                ],
                              }}
                            />
                            {source.source}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {source.customerCount} customers • {source.orderCount} orders
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(source.revenue)}
                          </p>
                          <p className="text-xs text-slate-600">{source.percentOfRevenue.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                  Top attribution channel: <strong>{attributionData.sources[0]?.source}</strong> with{' '}
                  {formatCurrency(attributionData.sources[0]?.revenue || 0)} ({attributionData.sources[0]?.percentOfRevenue.toFixed(1)}% of total)
                </div>
              </div>
            ) : (
              <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
                <p className="text-sm text-slate-600">No attribution data available</p>
              </div>
            )}
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
