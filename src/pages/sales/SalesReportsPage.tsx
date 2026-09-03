import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, BarChart3, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSalesAnalytics } from '@/lib/api'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

type ViewMode = 'sales' | 'orders'

interface MonthData {
  key: string
  label: string
  fromDate: string
  toDate: string
}

interface CourseStats {
  revenue: number
  quantity: number
}

interface CourseRow {
  courseName: string
  monthlyStats: Record<string, CourseStats>
  totalRevenue: number
  totalQuantity: number
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function isCBAOutOfStateCourse(courseName: string): boolean {
  const name = (courseName || '').toLowerCase().trim()
  
  // 1. Exclude WA specifically
  if (name.startsWith('wa ') || name.includes('washington')) return false
  
  // 2. All US State abbreviations except WA
  const outOfStates = [
    'al ', 'ak ', 'az ', 'ar ', 'ca ', 'co ', 'ct ', 'de ', 'fl ', 'ga ', 
    'hi ', 'id ', 'il ', 'in ', 'ia ', 'ks ', 'ky ', 'la ', 'me ', 'md ', 
    'ma ', 'mi ', 'mn ', 'ms ', 'mo ', 'mt ', 'ne ', 'nv ', 'nh ', 'nj ', 
    'nm ', 'ny ', 'nc ', 'nd ', 'oh ', 'ok ', 'or ', 'pa ', 'ri ', 'sc ', 
    'sd ', 'tn ', 'tx ', 'ut ', 'vt ', 'va ', 'wv ', 'wi ', 'wy ',
    'north carolina ', 'south carolina '
  ]
  
  // 3. Check if the course starts with any out-of-state prefix
  const hasStatePrefix = outOfStates.some(state => name.startsWith(state))
  if (!hasStatePrefix) return false
  
  // 4. Ensure it's a CBA-related topic
  const isCBATopic = name.includes('commercial') || 
                     name.includes('syndication') || 
                     name.includes('package') ||
                     name.includes('real estate') ||
                     name.includes('ethics')
  
  return isCBATopic
}

export function SalesReportsPage({ initialPreset }: { initialPreset?: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>('sales')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CourseRow[]>([])
  
  // Generate the last 12 months
  const months = useMemo(() => {
    const now = new Date()
    const result: MonthData[] = []
    for (let i = 0; i < 12; i++) {
      const d = subMonths(now, i)
      result.push({
        key: format(d, 'yyyy-MM'),
        label: format(d, "MMM ''yy"),
        fromDate: format(startOfMonth(d), 'yyyy-MM-dd'),
        toDate: format(endOfMonth(d), 'yyyy-MM-dd'),
      })
    }
    return result
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const promises = months.map(m => 
        getSalesAnalytics({ fromDate: m.fromDate, toDate: m.toDate, limit: 'all' })
          .catch(() => ({ revenueByCourse: [] })) // fallback for individual month failure
      )
      
      const results = await Promise.all(promises)
      
      const courseMap = new Map<string, CourseRow>()
      
      results.forEach((res, index) => {
        const monthKey = months[index].key
        const courses = res.revenueByCourse || []
        
        courses.forEach(item => {
          if (!isCBAOutOfStateCourse(item.course)) return
          
          const matchedCourseName = item.course || 'Unknown Course'

          if (!courseMap.has(matchedCourseName)) {
            courseMap.set(matchedCourseName, {
              courseName: matchedCourseName,
              monthlyStats: {},
              totalRevenue: 0,
              totalQuantity: 0,
            })
          }
          
          const row = courseMap.get(matchedCourseName)!
          row.monthlyStats[monthKey] = {
            revenue: item.revenue,
            quantity: item.quantity,
          }
          row.totalRevenue += item.revenue
          row.totalQuantity += item.quantity
        })
      })
      
      const sortedRows = Array.from(courseMap.values()).sort((a, b) => 
        a.courseName.localeCompare(b.courseName)
      )
      
      setRows(sortedRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load out-of-state sales data')
    } finally {
      setLoading(false)
    }
  }, [months])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const totals = useMemo(() => {
    const monthlyTotal: Record<string, CourseStats> = {}
    let grandTotalRevenue = 0
    let grandTotalQuantity = 0
    
    months.forEach(m => { monthlyTotal[m.key] = { revenue: 0, quantity: 0 } })
    
    rows.forEach(row => {
      months.forEach(m => {
        const stats = row.monthlyStats[m.key]
        if (stats) {
          monthlyTotal[m.key].revenue += stats.revenue
          monthlyTotal[m.key].quantity += stats.quantity
        }
      })
      grandTotalRevenue += row.totalRevenue
      grandTotalQuantity += row.totalQuantity
    })
    
    return { monthlyTotal, grandTotalRevenue, grandTotalQuantity }
  }, [rows, months])

  return (
    <div className="space-y-4 animate-fadeIn">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Out-of-State Sales
              {!loading && rows.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  {rows.length} courses
                </span>
              )}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Month-by-month breakdown of CBA course sales outside Washington.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">View: Sales ($)</SelectItem>
                <SelectItem value="orders">View: Orders (#)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="m-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
              <p className="font-medium text-slate-900">No out-of-state sales found</p>
              <p className="text-sm text-muted-foreground">Try refreshing the data.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-5 py-3 text-left font-semibold border-b border-r min-w-[280px] max-w-[400px]">Course Name</th>
                    {months.map(m => (
                      <th key={m.key} className="px-4 py-3 text-right font-semibold border-b whitespace-nowrap min-w-[100px]">
                        {m.label}
                      </th>
                    ))}
                    <th className="px-5 py-3 text-right font-bold text-slate-700 border-b bg-blue-50/50">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.courseName} className="transition-colors hover:bg-slate-50/50">
                      <td className="sticky left-0 z-10 bg-white px-5 py-3 font-medium text-slate-900 border-r shadow-[1px_0_0_0_rgba(241,245,249,1)] min-w-[280px] max-w-[400px] whitespace-normal">
                        {row.courseName}
                      </td>
                      {months.map(m => {
                        const stats = row.monthlyStats[m.key]
                        const val = viewMode === 'sales' 
                          ? formatUSD(stats?.revenue || 0)
                          : (stats?.quantity || 0).toLocaleString()
                        return (
                          <td key={m.key} className="px-4 py-3 text-right text-slate-600">
                            {(!stats || (stats.revenue === 0 && stats.quantity === 0)) ? <span className="text-slate-300">-</span> : val}
                          </td>
                        )
                      })}
                      <td className="px-5 py-3 text-right font-semibold bg-blue-50/30 text-slate-800">
                        {viewMode === 'sales' ? formatUSD(row.totalRevenue) : row.totalQuantity.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td className="sticky left-0 z-10 bg-slate-50 px-5 py-4 font-bold text-slate-900 border-r min-w-[280px] max-w-[400px]">Grand Total</td>
                    {months.map(m => {
                      const stats = totals.monthlyTotal[m.key]
                      const val = viewMode === 'sales'
                        ? formatUSD(stats?.revenue || 0)
                        : (stats?.quantity || 0).toLocaleString()
                      return (
                        <td key={m.key} className="px-4 py-4 text-right font-semibold text-slate-700">
                          {(!stats || (stats.revenue === 0 && stats.quantity === 0)) ? <span className="text-slate-300">-</span> : val}
                        </td>
                      )
                    })}
                    <td className="px-5 py-4 text-right font-bold text-blue-700 bg-blue-50">
                      {viewMode === 'sales' ? formatUSD(totals.grandTotalRevenue) : totals.grandTotalQuantity.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
