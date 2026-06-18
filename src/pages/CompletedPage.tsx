import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, XCircle, Search, CalendarCheck2, Users, GraduationCap, Filter } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { getCompletedEntries, getSCCourses, type CompletedEntry, type Course } from '@/lib/api'

export function CompletedPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [entries, setEntries] = useState<CompletedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [courseFilter, setCourseFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchCourseList = async () => {
    const data = await getSCCourses()
    setCourses(data)
  }

  const fetchCompletedEntries = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getCompletedEntries({
        courseId: courseFilter === 'all' ? undefined : Number(courseFilter),
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        search: searchTerm.trim() || undefined,
      })
      setEntries(response.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch completed users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function initialize() {
      try {
        await fetchCourseList()
        await fetchCompletedEntries()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize completed page')
        setLoading(false)
      }
    }
    initialize()
  }, [])

  const handleApplyFilters = async () => {
    await fetchCompletedEntries()
  }

  const handleResetFilters = async () => {
    setCourseFilter('all')
    setFromDate('')
    setToDate('')
    setSearchTerm('')

    setLoading(true)
    setError(null)
    try {
      const response = await getCompletedEntries()
      setEntries(response.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset filters')
    } finally {
      setLoading(false)
    }
  }

  const totalUsers = useMemo(() => {
    const ids = new Set(entries.map((entry) => String(entry.user_id || `${entry.email}:${entry.full_name}`)))
    return ids.size
  }, [entries])

  const totalCourses = useMemo(() => {
    const ids = new Set(entries.map((entry) => entry.course_id))
    return ids.size
  }, [entries])

  const statTiles = [
    {
      label: 'Completed Records',
      value: entries.length.toLocaleString(),
      icon: CalendarCheck2,
      accent: 'from-emerald-500 to-green-500',
      ring: 'ring-emerald-200',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Unique Users',
      value: totalUsers.toLocaleString(),
      icon: Users,
      accent: 'from-blue-500 to-indigo-500',
      ring: 'ring-blue-200',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Courses in Result',
      value: totalCourses.toLocaleString(),
      icon: GraduationCap,
      accent: 'from-amber-500 to-orange-500',
      ring: 'ring-amber-200',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ]

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading completed records...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <p className="font-medium text-red-600">{error}</p>
        <Button onClick={handleApplyFilters}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        {statTiles.map((tile) => (
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck2 className="h-5 w-5" />
              Completed Users
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-60">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search user, email, course..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleApplyFilters()
                    }
                  }}
                  className="pl-9"
                />
              </div>

              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All SC Courses ({courses.length})</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
              />

              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
              />

              <Button size="sm" onClick={handleApplyFilters}>
                <Filter className="mr-2 h-4 w-4" />
                Apply
              </Button>

              <Button size="sm" variant="outline" onClick={handleResetFilters}>
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {entries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No completed users found for selected filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Profession</TableHead>
                  <TableHead>Completed Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium">{entry.full_name || `${entry.first_name} ${entry.last_name}`.trim()}</div>
                      <div className="text-xs text-muted-foreground">User ID: {entry.user_id ?? 'N/A'}</div>
                    </TableCell>
                    <TableCell>{entry.email || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="max-w-[320px] truncate font-medium" title={entry.course_name}>
                        {entry.course_name}
                      </div>
                      {entry.ceb_course_id && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          CEB: {entry.ceb_course_id}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{entry.license_number || 'N/A'}</TableCell>
                    <TableCell>{entry.licensee_profession || 'N/A'}</TableCell>
                    <TableCell>
                      {entry.date_completed_iso
                        ? formatDate(entry.date_completed_iso)
                        : entry.date_completed || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}