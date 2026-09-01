import { useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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

function truncateSourceLabel(label: string, maxLength = 24) {
  if (!label) return ''
  return label.length > maxLength ? `${label.slice(0, maxLength - 3)}...` : label
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 1,
  }).format(value)
}

const SOURCE_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#d97706', '#059669', '#0891b2', '#4f46e5', '#be123c']
const METRIC_ACCENTS = ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#16a34a']

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
    return data.revenueByState.slice(0, 10)
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
  const attributionSources = attributionData?.sources ?? []
  const attributionChartData = attributionSources.slice(0, 12).map((source, idx) => ({
    ...source,
    color: SOURCE_COLORS[idx % SOURCE_COLORS.length],
  }))

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.7)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
          <p className="text-xs font-semibold uppercase text-blue-700">Executive Sales Command</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Sales Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live KPIs, attribution quality, cohorts, and revenue movement in one control view.</p>
          {selectedRangeLabel ? (
            <p className="mt-1 text-xs font-medium text-blue-700">{selectedRangeLabel}</p>
          ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2 shadow-inner">
            <DateRangeFilter
              value={dateRange}
              onChange={setDateRange}
              showLabels={false}
            />
            <Button onClick={() => void load()} className="shadow-sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Apply
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-6 text-white shadow-[0_30px_80px_-42px_rgba(30,64,175,0.85)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-100">Year-to-Date Sales</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-white">{formatCurrency(kpi.yearlySales)}</p>
            <p className="mt-3 text-sm text-blue-100/90">
              {kpi.orders.toLocaleString()} orders • {formatCurrency(kpi.averageOrderValue)} average value
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[24rem]">
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-xs font-medium uppercase text-blue-100/80">Monthly Avg</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {formatCurrency(kpi.yearlySales / 12)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/30 bg-amber-300/10 px-4 py-3 backdrop-blur">
              <p className="text-xs font-medium uppercase text-amber-100/90">Growth</p>
              <p className="mt-1 text-xl font-semibold text-white">{kpi.salesGrowthPercent.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Total Sales" value={formatCurrency(kpi.totalSales)} icon={DollarSign} accent={METRIC_ACCENTS[0]} />
        <Metric title="Orders" value={kpi.orders.toLocaleString()} icon={ShoppingCart} accent={METRIC_ACCENTS[1]} />
        <Metric title="Avg Order Value" value={formatCurrency(kpi.averageOrderValue)} icon={Activity} accent={METRIC_ACCENTS[2]} />
        <Metric title="Sales Growth" value={`${kpi.salesGrowthPercent.toFixed(2)}%`} icon={Percent} accent={METRIC_ACCENTS[3]} />
        <Metric title="Today" value={formatCurrency(kpi.todaySales)} accent={METRIC_ACCENTS[4]} />
        <Metric title="Weekly" value={formatCurrency(kpi.weeklySales)} accent={METRIC_ACCENTS[5]} />
        <Metric title="Monthly" value={formatCurrency(kpi.monthlySales)} accent={METRIC_ACCENTS[6]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Monthly Revenue vs Orders</CardTitle>
            <p className="text-sm text-muted-foreground">Revenue and order volume across the selected period.</p>
          </CardHeader>
          <CardContent>
            <div className="h-80 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="revenue" tickFormatter={(value) => formatCompactCurrency(Number(value || 0))} />
                  <YAxis yAxisId="orders" orientation="right" />
                  <Tooltip formatter={(value, name) => (name === 'Revenue' ? formatCurrency(Number(value || 0)) : Number(value || 0).toLocaleString())} />
                  <Legend />
                  <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke="#0f766e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Top Revenue States</CardTitle>
            <p className="text-sm text-muted-foreground">Top state contribution by collected revenue.</p>
          </CardHeader>
          <CardContent>
            <div className="h-80 rounded-xl border border-cyan-100 bg-gradient-to-br from-cyan-50/70 to-white p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stateChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cffafe" />
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
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Revenue by Course (Top 10)</CardTitle>
            <p className="text-sm text-muted-foreground">Highest-grossing products and courses.</p>
          </CardHeader>
          <CardContent>
            <div className="h-[26rem] rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50/70 to-white p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueByCourse} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 20 }} barCategoryGap="18%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccfbf1" />
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

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Order Status Mix</CardTitle>
            <p className="text-sm text-muted-foreground">
              Distribution of all sales orders by current lifecycle state.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="relative h-72 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-white p-2">
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
                      className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm"
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

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader>
            <CardTitle>Customer Cohorts</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sales breakdown by new vs returning customers based on first order date.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="relative h-72 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white p-2">
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

              <div className="grid gap-3 sm:grid-cols-2 xl:self-center">
                {cohortData && [
                  { name: 'New Customers', ...cohortData.new, color: '#3b82f6' },
                  { name: 'Returning Customers', ...cohortData.returning, color: '#8b5cf6' },
                ].map((cohort) => (
                  <div
                    key={cohort.name}
                    className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm"
                  >
                    <div className="flex h-full flex-col justify-between gap-4">
                      <div className="flex-1">
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cohort.color }} />
                          {cohort.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {cohort.customerCount} customers • {cohort.totalOrders} orders
                        </p>
                      </div>
                      <div className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] font-medium uppercase text-slate-500">Revenue</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(cohort.revenue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium uppercase text-slate-500">Share</p>
                          <p className="text-sm font-semibold text-slate-900">{cohort.percentOfRevenue.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium uppercase text-slate-500">Avg Value</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(cohort.avgCustomerValue)}
                          </p>
                        </div>
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

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Sales Attribution by Source</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Revenue breakdown by marketing channel or sales source.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{attributionSources.length}</span> sources tracked
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {attributionSources.length > 0 ? (
              <div className="space-y-4">
                <div className="h-[30rem] rounded-xl border border-blue-100 bg-gradient-to-br from-slate-50 via-blue-50/60 to-white p-3" aria-label="Revenue by sales source chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={attributionChartData}
                      layout="vertical"
                      margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
                      barCategoryGap="20%"
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dbeafe" />
                      <XAxis type="number" tickFormatter={(value) => formatCompactCurrency(Number(value || 0))} />
                      <YAxis
                        dataKey="source"
                        type="category"
                        width={190}
                        interval={0}
                        tickMargin={10}
                        tickFormatter={(value) => truncateSourceLabel(String(value || ''))}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => String(label)}
                      />
                      <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                        {attributionChartData.map((source) => (
                          <Cell key={source.source} fill={source.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {attributionSources.map((source, idx) => (
                    <div key={source.source} className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 break-words text-sm font-semibold leading-snug text-slate-900">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded"
                              style={{
                                backgroundColor: SOURCE_COLORS[idx % SOURCE_COLORS.length],
                              }}
                            />
                            {source.source}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {source.customerCount} customers • {source.orderCount} orders
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
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
                  Top attribution channel: <strong>{attributionSources[0]?.source}</strong> with{' '}
                  {formatCurrency(attributionSources[0]?.revenue || 0)} ({attributionSources[0]?.percentOfRevenue.toFixed(1)}% of total)
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
  accent = '#2563eb',
}: {
  title: string
  value: string
  icon?: ComponentType<{ className?: string }>
  accent?: string
}) {
  return (
    <Card className="group overflow-hidden">
      <div className="h-1" style={{ backgroundColor: accent }} />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xs uppercase text-muted-foreground">
          <span>{title}</span>
          {Icon ? (
            <span className="rounded-lg p-2 text-white shadow-sm transition-transform group-hover:scale-105" style={{ backgroundColor: accent }}>
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-slate-950">{value}</p>
      </CardContent>
    </Card>
  )
}
