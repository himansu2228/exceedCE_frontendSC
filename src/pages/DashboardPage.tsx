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

  // Build status distribution from real stats
  const statusDistribution = [
    { name: 'Successful', value: stats.successful_submissions, color: '#22c55e' },
    { name: 'Failed', value: stats.failed_submissions, color: '#ef4444' },
    { name: 'Skipped', value: stats.skipped_submissions, color: '#f59e0b' },
    { name: 'Duplicate', value: stats.duplicate_submissions, color: '#f97316' },
  ].filter(item => item.value > 0)

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Courses
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_courses}</div>
            <p className="text-xs text-muted-foreground mt-1">
              SC mapped courses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Submissions
            </CardTitle>
            <Users className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_submissions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All time submissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
            <FileCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successRate}%</div>
            <Progress value={parseFloat(successRate)} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pipeline Status
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {pipelineStatus?.is_running ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  <span className="text-lg font-semibold text-green-600">Running</span>
                </>
              ) : (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-400"></span>
                  </span>
                  <span className="text-lg font-semibold text-gray-600">Idle</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pipelineStatus?.current_course || 'Ready to run'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.successful_submissions}</p>
                <p className="text-sm text-muted-foreground">Successful</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.failed_submissions}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.skipped_submissions}</p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats.duplicate_submissions}</p>
                <p className="text-sm text-muted-foreground">Duplicates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Submission Trend */}
        <Card>
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
        <Card>
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
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Course Breakdown */}
        <Card>
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
        <Card>
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
