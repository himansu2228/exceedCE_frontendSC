import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  Loader2,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getAdminOverview,
  getDashboardUsers,
  type AdminOverview,
  type DashboardUserListItem,
} from '@/lib/api'
import {
  getCurrentAuthUser,
  getTenantAccessProfile,
  getActiveState,
  normalizeStateCode,
  setActiveState,
} from '@/lib/auth'

const AVAILABLE_STATES = [
  { code: 'SC', name: 'South Carolina' },
  { code: 'HI', name: 'Hawaii' },
]

function formatDateTime(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleString()
}

interface StateSwitcherProps {
  activeCode: string
  onChangeCode: (code: string) => void
}

function StateSwitcher({ activeCode, onChangeCode }: StateSwitcherProps) {
  const user = getCurrentAuthUser()
  const tenant = getTenantAccessProfile()

  const isSuperAdmin = user?.role === 'super_admin'
  const isAdminExceed = user?.role === 'admin-exceed'

  if (!isSuperAdmin && !isAdminExceed) return null

  const stateOptions = isSuperAdmin
    ? AVAILABLE_STATES
    : (tenant.allowedStates ?? []).map((name) => ({
        code: normalizeStateCode(name),
        name,
      }))

  if (stateOptions.length === 0) return null

  const allOptions = isSuperAdmin
    ? [{ code: 'ALL', name: 'All States' }, ...stateOptions]
    : stateOptions

  const label = allOptions.find((s) => s.code === activeCode)?.name ?? activeCode

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <MapPin className="h-4 w-4 shrink-0 text-primary" />
      <div className="flex flex-1 items-center gap-3">
        <span className="text-sm font-medium text-foreground">Active State View</span>
        <Select
          value={activeCode}
          onValueChange={(code) => {
            setActiveState(code)
            onChangeCode(code)
          }}
        >
          <SelectTrigger className="h-8 w-44 gap-1 border-primary/30 bg-background text-sm">
            <SelectValue />
            <ChevronDown className="h-3 w-3 opacity-60" />
          </SelectTrigger>
          <SelectContent>
            {allOptions.map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Badge variant="outline" className="border-primary/30 text-xs text-primary">
        {activeCode === 'ALL' ? 'Global View' : label}
      </Badge>
    </div>
  )
}

const STATE_NAME_MAP: Record<string, string> = {
  SC: 'South Carolina',
  HI: 'Hawaii',
  ALL: 'All States',
}

export function AdminPage() {
  const tenant = getTenantAccessProfile()

  if (!tenant.isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<DashboardUserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Read active state directly from localStorage — getTenantAccessProfile ignores it for super_admin
  const [activeCode, setActiveCode] = useState<string>(() => {
    const stored = getActiveState()
    return stored && stored !== '' ? stored : 'ALL'
  })

  useEffect(() => {
    async function load() {
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
        setError(err instanceof Error ? err.message : 'Failed to load admin data')
      } finally {
        setLoading(false)
      }
    }

    load()
    const interval = window.setInterval(load, 30_000)
    return () => window.clearInterval(interval)
  }, [])


  // Filter breakdown for selected state without fallback to full list
  const filteredBreakdown = useMemo(() => {
    if (!overview) return []
    if (activeCode === 'ALL') return overview.stateBreakdown
    const targetName = (STATE_NAME_MAP[activeCode] ?? activeCode).toLowerCase()
    return overview.stateBreakdown.filter(
      (s) => (s.state || '').toLowerCase() === targetName
    )
  }, [overview, activeCode])

  // Filter dashboard users for selected state
  const filteredUsers = useMemo(() => {
    if (activeCode === 'ALL') return users
    const targetName = (STATE_NAME_MAP[activeCode] ?? activeCode).toLowerCase()
    return users.filter((u) => {
      const userState = (u.state || '').toLowerCase()
      // Include users directly belonging to this state
      if (userState === targetName || userState.includes(targetName)) return true
      // Include multi-state admin or super admins
      if (u.role === 'super_admin' || u.role === 'admin-exceed') return true
      return false
    })
  }, [users, activeCode])

  const filteredMetrics = useMemo(() => {
    if (!overview) {
      return { totalUsers: 0, totalStates: 0, totalSubmissions: 0, successRate: '0.0' }
    }
    if (activeCode === 'ALL') {
      const sr =
        overview.totalSubmissions > 0
          ? ((overview.successfulSubmissions / overview.totalSubmissions) * 100).toFixed(1)
          : '0.0'
      return {
        totalUsers: overview.totalUsers,
        totalStates: overview.totalStates,
        totalSubmissions: overview.totalSubmissions,
        successRate: sr,
      }
    }

    const totalSubmissions = filteredBreakdown.reduce((sum, item) => sum + item.submissions, 0)
    const successfulSubmissions = filteredBreakdown.reduce((sum, item) => sum + item.successful, 0)
    const sr =
      totalSubmissions > 0
        ? ((successfulSubmissions / totalSubmissions) * 100).toFixed(1)
        : '0.0'

    return {
      totalUsers: filteredUsers.length,
      totalStates: filteredBreakdown.length > 0 ? 1 : 0,
      totalSubmissions,
      successRate: sr,
    }
  }, [overview, activeCode, filteredBreakdown, filteredUsers])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading admin dashboard...</span>
      </div>
    )
  }

  if (error || !overview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <span className="ml-2 text-red-500">{error || 'Failed to load overview'}</span>
      </div>
    )
  }

  const isFiltered = activeCode !== 'ALL'
  const displayStateName = STATE_NAME_MAP[activeCode] ?? activeCode

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-blue-500/30 blur-md opacity-70" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-amber-500 text-white shadow-md">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Admin — Sales Report</h1>
            <p className="text-sm text-muted-foreground">
              {isFiltered ? `Viewing: ${displayStateName}` : 'Cross-state submissions & user overview'}
            </p>
          </div>
        </div>
      </div>

      {/* State Switcher */}
      <StateSwitcher activeCode={activeCode} onChangeCode={setActiveCode} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Total Login IDs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{filteredMetrics.totalUsers.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              States Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{filteredMetrics.totalStates.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Total Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{filteredMetrics.totalSubmissions.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{filteredMetrics.successRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              {isFiltered ? `${displayStateName} — Performance` : 'State-wise Performance'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={filteredBreakdown}>
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
              {isFiltered ? `${displayStateName} — Summary` : 'States Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No state data available yet.</p>
            ) : (
              filteredBreakdown.map((item) => (
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

      {/* All Dashboard Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Dashboard Users {isFiltered && `(${displayStateName})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
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
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{u.username}</td>
                      <td className="px-3 py-2">{u.state}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            u.role === 'super_admin'
                              ? 'default'
                              : u.role === 'admin-exceed'
                              ? 'outline'
                              : 'secondary'
                          }
                        >
                          {u.role === 'super_admin'
                            ? 'Super Admin'
                            : u.role === 'admin-exceed'
                            ? 'Admin-Exceed'
                            : 'State Admin'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={u.is_active ? 'default' : 'destructive'}>
                          {u.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{formatDateTime(u.last_login_at)}</td>
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
