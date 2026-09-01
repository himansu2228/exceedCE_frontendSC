import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, DollarSign, ReceiptText, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getSalesAnalytics } from '@/lib/api'
import type { SalesDashboardResponse } from '@/lib/api'
import { formatCurrency } from './shared'

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function SalesRevenuePage() {
  const [data, setData] = useState<SalesDashboardResponse | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getSalesAnalytics({ fromDate: dateRange.fromDate || undefined, toDate: dateRange.toDate || undefined })
      setData(response)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load revenue data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [dateRange])

  const topCourses = useMemo(() => (data?.revenueByCourse || []).slice(0, 10), [data])
  const topStates = useMemo(() => (data?.revenueByState || []).slice(0, 8), [data])
  const highestCourse = topCourses[0]

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <section className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-cyan-50/50 shadow-[0_24px_70px_-45px_rgba(5,150,105,0.5)]"><div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-[0_12px_28px_-12px_rgba(5,150,105,0.9)]"><TrendingUp className="h-6 w-6" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Revenue Intelligence</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Revenue</h1><p className="mt-1 text-sm text-slate-600">Track revenue movement, top-performing courses, and state contribution.</p></div></div><div className="rounded-xl border border-emerald-100 bg-white/80 p-2"><DateRangeFilter value={dateRange} onChange={setDateRange} showLabels={false} /></div></div></section>

      {loading ? <RevenueSkeleton /> : error || !data ? <div className="flex h-64 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-red-700"><AlertTriangle className="h-5 w-5" />{error || 'No revenue data available'}</div> : <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={DollarSign} title="Total Revenue" value={formatCurrency(data.summary.totalRevenue)} accent="emerald" /><Metric icon={ReceiptText} title="Orders" value={data.summary.totalOrders.toLocaleString()} accent="sky" /><Metric icon={BarChart3} title="Average Order Value" value={formatCurrency(data.summary.averageOrderValue)} accent="violet" /><Metric icon={TrendingUp} title="Top Course Revenue" value={formatCurrency(highestCourse?.revenue || 0)} accent="amber" /></section>

        <div className="grid gap-4 xl:grid-cols-2"><ChartCard title="Monthly Revenue" subtitle="Revenue movement across the selected period."><LineChart data={data.revenueByMonth}><CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" /><XAxis dataKey="month" /><YAxis tickFormatter={(value) => formatCompactCurrency(Number(value || 0))} /><Tooltip formatter={(value) => formatCurrency(Number(value || 0))} /><Line type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" strokeWidth={2.5} dot={false} /></LineChart></ChartCard><ChartCard title="Top Revenue States" subtitle="Highest revenue contribution by billing state."><BarChart data={topStates}><CartesianGrid strokeDasharray="3 3" stroke="#cffafe" /><XAxis dataKey="state" /><YAxis tickFormatter={(value) => formatCompactCurrency(Number(value || 0))} /><Tooltip formatter={(value) => formatCurrency(Number(value || 0))} /><Bar dataKey="revenue" name="Revenue" fill="#0891b2" radius={[6, 6, 0, 0]} /></BarChart></ChartCard></div>

        <Card className="overflow-hidden border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]"><CardHeader className="border-b border-slate-100 pb-4"><CardTitle className="text-base">Top Revenue Courses</CardTitle><p className="mt-1 text-sm text-muted-foreground">Top 10 courses by collected revenue.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 text-left font-semibold">Rank</th><th className="px-5 py-3 text-left font-semibold">Course</th><th className="px-5 py-3 text-right font-semibold">Units Sold</th><th className="px-5 py-3 text-right font-semibold">Revenue</th><th className="px-5 py-3 text-right font-semibold">Revenue Share</th></tr></thead><tbody className="divide-y divide-slate-100">{topCourses.map((course, index) => { const share = data.summary.totalRevenue ? (course.revenue / data.summary.totalRevenue) * 100 : 0; return <tr key={course.course} className="hover:bg-emerald-50/40"><td className="px-5 py-3.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{index + 1}</span></td><td className="max-w-[30rem] px-5 py-3.5 font-medium text-slate-900" title={course.course}>{course.course}</td><td className="px-5 py-3.5 text-right text-slate-600">{course.quantity.toLocaleString()}</td><td className="px-5 py-3.5 text-right font-semibold text-emerald-700">{formatCurrency(course.revenue)}</td><td className="px-5 py-3.5 text-right text-slate-600">{share.toFixed(1)}%</td></tr> })}</tbody></table></div></CardContent></Card>
      </>}
    </div>
  )
}

function Metric({ icon: Icon, title, value, accent }: { icon: typeof DollarSign; title: string; value: string; accent: 'emerald' | 'sky' | 'violet' | 'amber' }) {
  const styles = { emerald: 'border-emerald-100 bg-emerald-50/50 text-emerald-600', sky: 'border-sky-100 bg-sky-50/50 text-sky-600', violet: 'border-violet-100 bg-violet-50/50 text-violet-600', amber: 'border-amber-100 bg-amber-50/50 text-amber-600' }
  return <Card className="border-slate-200 shadow-sm"><CardContent className="flex items-center gap-3 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${styles[accent]}`}><Icon className="h-5 w-5" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p></div></CardContent></Card>
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactElement }) {
  return <Card className="overflow-hidden border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]"><CardHeader><CardTitle className="text-base">{title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></CardHeader><CardContent><div className="h-80 rounded-xl border border-slate-100 bg-slate-50/60 p-3"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></CardContent></Card>
}

function RevenueSkeleton() {
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}</div><div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-96 w-full" /><Skeleton className="h-96 w-full" /></div></div>
}
