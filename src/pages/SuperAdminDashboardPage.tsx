import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Building2, Loader2, ShieldCheck, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  getAdminOverview,
  getDashboardUsers,
  type AdminOverview,
  type DashboardUserListItem,
} from '@/lib/api'

function formatDateTime(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleString()
}

export function SuperAdminDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<DashboardUserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAdminDashboard() {
      try {
        setLoading(true)
        setError(null)

        const [overviewData, usersData] = await Promise.all([
          getAdminOverview(),
          getDashboardUsers(),
        ])

        setOverview(overviewData)
        setUsers(usersData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load admin dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadAdminDashboard()
    const interval = window.setInterval(loadAdminDashboard, 30000)
    return () => window.clearInterval(interval)
  }, [])

  const successRate = useMemo(() => {
    if (!overview || overview.totalSubmissions <= 0) return '0.0'
    return ((overview.successfulSubmissions / overview.totalSubmissions) * 100).toFixed(1)
  }, [overview])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading super admin dashboard...</span>
      </div>
    )
  }

  if (error || !overview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <span className="ml-2 text-red-500">{error || 'Failed to load admin overview'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-xl bg-blue-500/30 blur-md opacity-70" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-amber-500 text-white shadow-md">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Super Admin Business Dashboard</h1>
          <p className="text-sm text-muted-foreground">Cross-state sales, submissions, and user control center</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total Login IDs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{overview.totalUsers.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.14em] text-muted-foreground">States Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{overview.totalStates.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{overview.totalSubmissions.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{successRate}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              State-wise Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={overview.stateBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="state" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="submissions" fill="#3b82f6" name="Submissions" />
                  <Bar dataKey="successful" fill="#22c55e" name="Successful" />
                  <Bar dataKey="failed" fill="#ef4444" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              States Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overview.stateBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No state data available yet.</p>
            ) : (
              overview.stateBreakdown.map((item) => (
                <div key={item.state} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{item.state}</p>
                    <p className="text-xs text-muted-foreground">Users: {item.users}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{item.submissions.toLocaleString()} submissions</p>
                    <p className="text-xs text-muted-foreground">Success: {item.successful.toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Dashboard Users</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dashboard users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2">Username</th>
                    <th className="px-3 py-2">State</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{user.username}</td>
                      <td className="px-3 py-2">{user.state}</td>
                      <td className="px-3 py-2">
                        <Badge variant={user.role === 'super_admin' ? 'default' : user.role === 'admin-exceed' ? 'outline' : 'secondary'}>
                          {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin-exceed' ? 'Admin-Exceed' : 'State Admin'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={user.is_active ? 'default' : 'destructive'}>
                          {user.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{formatDateTime(user.last_login_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
