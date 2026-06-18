import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  GraduationCap,
  Users,
  FileCheck,
  Activity,
  TrendingUp,
  Loader2,
  Sparkles,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import {
  getDashboardStats,
  getRecentActivity,
  getSubmissionTrend,
  getCourseBreakdown,
  getPipelineStatus,
} from '@/lib/api'
import type { DashboardStats, RecentActivity, SubmissionTrend, CourseBreakdown, PipelineStatus } from '@/lib/api'

// Helper to format relative time
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [submissionTrend, setSubmissionTrend] = useState<SubmissionTrend[]>([])
  const [courseBreakdown, setCourseBreakdown] = useState<CourseBreakdown[]>([])
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all dashboard data
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true)
        setError(null)
        
        const [statsData, activityData, trendData, breakdownData, pipelineData] = await Promise.all([
          getDashboardStats(),
          getRecentActivity(5),
          getSubmissionTrend(7),
          getCourseBreakdown(),
          getPipelineStatus(),
        ])
        
        setStats(statsData)
        setRecentActivity(activityData)
        setSubmissionTrend(trendData)
        setCourseBreakdown(breakdownData)
        setPipelineStatus(pipelineData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data')
      } finally {
        setLoading(false)
      }
    }
    
    fetchDashboardData()
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading dashboard...</span>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <span className="ml-2 text-red-500">{error || 'Failed to load dashboard'}</span>
      </div>
    )
  }

  const successRate = stats.total_submissions > 0 
    ? (stats.successful_submissions / stats.total_submissions * 100).toFixed(1)
    : '0.0'

  const topStats = [
    {
      title: 'Total Courses',
      value: stats.total_courses.toLocaleString(),
      description: 'SC mapped courses',
      icon: GraduationCap,
      accent: 'from-blue-500 to-indigo-500',
      ring: 'ring-blue-200',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Total Submissions',
      value: stats.total_submissions.toLocaleString(),
      description: 'All time records',
      icon: Users,
      accent: 'from-amber-500 to-orange-500',
      ring: 'ring-amber-200',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      title: 'Success Rate',
      value: `${successRate}%`,
      description: 'Submission success',
      icon: FileCheck,
      accent: 'from-violet-500 to-fuchsia-500',
      ring: 'ring-violet-200',
      bg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      title: 'Pipeline Status',
      value: pipelineStatus?.is_running ? 'Running' : 'Idle',
      description: pipelineStatus?.current_course || 'Ready to run',
      icon: Activity,
      accent: 'from-emerald-500 to-teal-500',
      ring: 'ring-emerald-200',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
  ]

  // Build status distribution from real stats
  const statusDistribution = [
    { name: 'Successful', value: stats.successful_submissions, color: '#22c55e' },
    { name: 'Failed', value: stats.failed_submissions, color: '#ef4444' },
    { name: 'Skipped', value: stats.skipped_submissions, color: '#f59e0b' },
    { name: 'Duplicate', value: stats.duplicate_submissions, color: '#f97316' },
  ].filter(item => item.value > 0)

  const summaryTiles = [
    {
      label: 'Successful',
      value: stats.successful_submissions.toLocaleString(),
      icon: CheckCircle2,
      accent: 'from-emerald-500 to-green-500',
      bg: 'bg-emerald-50',
      ring: 'ring-emerald-200',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Failed',
      value: stats.failed_submissions.toLocaleString(),
      icon: XCircle,
      accent: 'from-rose-500 to-red-500',
      bg: 'bg-rose-50',
      ring: 'ring-rose-200',
      iconColor: 'text-rose-600',
    },
    {
      label: 'Skipped',
      value: stats.skipped_submissions.toLocaleString(),
      icon: AlertTriangle,
      accent: 'from-amber-500 to-yellow-500',
      bg: 'bg-amber-50',
      ring: 'ring-amber-200',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Duplicates',
      value: stats.duplicate_submissions.toLocaleString(),
      icon: Clock,
      accent: 'from-orange-500 to-amber-500',
      bg: 'bg-orange-50',
      ring: 'ring-orange-200',
      iconColor: 'text-orange-600',
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5 shrink-0">
          <div className="absolute inset-0 rounded-xl bg-primary/30 blur-md opacity-70" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md shadow-primary/25">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">Overview Dashboard</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">CE automation performance</p>
        </div>
      </div>

      {/* Vaani-style compact tiles */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {topStats.map((stat) => (
          <Card
            key={stat.title}
            className="relative overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-[6px]"
          >
            <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${stat.accent}`} />
            <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-[11px]">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-md p-1.5 ring-1 ${stat.ring} ${stat.bg}`}>
                  <stat.icon className={`h-3.5 w-3.5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">{stat.value}</div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">{stat.description}</p>
              {stat.title === 'Success Rate' && (
                <Progress value={parseFloat(successRate)} className="mt-2 h-1.5" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-1 flex items-center gap-2 sm:mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[11px]">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Performance Analytics
        </span>
        <div className="h-px flex-1 bg-border/70" />
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {summaryTiles.map((tile) => (
          <Card key={tile.label} className="relative overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-[6px]">
            <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${tile.accent}`} />
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-[11px]">{tile.label}</p>
                  <p className="mt-1 text-xl font-semibold leading-tight text-foreground sm:text-2xl">{tile.value}</p>
                </div>
                <div className={`rounded-md p-1.5 ring-1 ${tile.ring} ${tile.bg}`}>
                  <tile.icon className={`h-3.5 w-3.5 ${tile.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Submission Trend */}
        <Card className="rounded-xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-[6px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Submission Trend (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] min-h-[300px] min-w-0">
              {submissionTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
                  <AreaChart data={submissionTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="submissions"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.2}
                      name="Total"
                    />
                    <Area
                      type="monotone"
                      dataKey="successful"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.2}
                      name="Successful"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No submission data for the last 7 days
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="rounded-xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-[6px]">
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] min-h-[300px] min-w-0 flex items-center justify-center">
              {statusDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground">No submissions yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course Breakdown & Recent Activity */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Course Breakdown */}
        <Card className="rounded-xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-[6px]">
          <CardHeader>
            <CardTitle>Course Completion Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] min-h-[300px] min-w-0">
              {courseBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
                  <BarChart data={courseBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      className="text-xs"
                      width={120}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completions" fill="#94a3b8" name="Completions" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="submitted" fill="#3b82f6" name="Submitted" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No course data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="rounded-xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-[6px]">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                        {item.student.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.student}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {item.course}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          item.status === 'ok'
                            ? 'success'
                            : item.status === 'duplicate'
                            ? 'warning'
                            : item.status === 'error'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {item.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(item.time)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
