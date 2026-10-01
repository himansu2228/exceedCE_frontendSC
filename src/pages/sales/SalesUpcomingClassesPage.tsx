import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Download, Eye, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  downloadInstructorClassRoster,
  downloadNcClassRoster,
  getInstructorUpcomingClasses,
  getNcUpcomingClasses,
  type InstructorUpcomingClass,
  type NcScheduledClass,
} from '@/lib/api'

type InstructorFilter = 'nc' | 'donald-croteau' | 'cheryl-crawford'

const INSTRUCTOR_OPTIONS = [
  { id: 'nc' as const, name: 'North Carolina' },
  { id: 'donald-croteau' as const, name: 'Donald Croteau' },
  { id: 'cheryl-crawford' as const, name: 'Cheryl Crawford' },
]

function formatClassDate(value: string | null) {
  if (!value) return 'Time not listed'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time not listed'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
  }).format(date)
}

function classTitle(item: NcScheduledClass) {
  return item.scheduledTitle || item.courseName || 'Scheduled NC class'
}

export function SalesUpcomingClassesPage() {
  const [classes, setClasses] = useState<NcScheduledClass[]>([])
  const [instructorFilter, setInstructorFilter] = useState<InstructorFilter>('nc')
  const [instructorClasses, setInstructorClasses] = useState<InstructorUpcomingClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingId, setDownloadingId] = useState('')
  const [managedClass, setManagedClass] = useState<NcScheduledClass | null>(null)

  const loadClasses = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (instructorFilter === 'nc') {
        const response = await getNcUpcomingClasses()
        setClasses(response.classes)
      } else {
        const assignedClasses = await getInstructorUpcomingClasses(instructorFilter)
        setInstructorClasses(assignedClasses)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load upcoming classes.')
    } finally {
      setLoading(false)
    }
  }, [instructorFilter])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadClasses()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadClasses])

  const handleInstructorChange = (value: string) => {
    if (INSTRUCTOR_OPTIONS.some((item) => item.id === value)) setInstructorFilter(value as InstructorFilter)
  }

  const handleRosterDownload = async (item: NcScheduledClass) => {
    setDownloadingId(item.id)
    try {
      const blob = await downloadNcClassRoster(item.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `NC-Class-Roster-${item.courseId}-${item.date}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download roster.')
    } finally {
      setDownloadingId('')
    }
  }

  const handleInstructorRosterDownload = async (item: InstructorUpcomingClass) => {
    setDownloadingId(String(item.courseId))
    try {
      const blob = await downloadInstructorClassRoster(item.instructorId, item.courseId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Class-Roster-${item.courseId}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download roster.')
    } finally {
      setDownloadingId('')
    }
  }

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700">Instructor rosters</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Upcoming classes</h1>
          <p className="mt-1 text-sm text-slate-600">NC calendar classes or configured Donald and Cheryl classes with current LMS enrollments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadClasses()} disabled={loading} aria-label="Refresh schedule">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-blue-600" />Class schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="max-w-sm space-y-2">
            <Label htmlFor="instructor">Instructor</Label>
            <Select value={instructorFilter} onValueChange={handleInstructorChange}>
              <SelectTrigger id="instructor"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INSTRUCTOR_OPTIONS.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {instructorFilter === 'nc' ? <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Class / Date</th>
                  <th className="px-4 py-3 font-semibold">Instructor</th>
                  <th className="px-4 py-3 font-semibold">LMS ID</th>
                  <th className="px-4 py-3 font-semibold">Enrolled</th>
                  <th className="px-4 py-3 font-semibold">Match</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((item) => (
                  <tr key={item.id} className="bg-white">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{classTitle(item)}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.startsAt ? formatClassDate(item.startsAt) : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.date}T00:00:00Z`))}</p>
                      {item.courseName && item.scheduledTitle && <p className="mt-1 text-xs text-slate-500">LMS: {item.courseName}</p>}
                      {item.moderatorName && <p className="mt-1 text-xs text-slate-500">Moderator: {item.moderatorName}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.instructorName || 'Needs instructor confirmation'}</td>
                    <td className="px-4 py-3 text-slate-700">{item.courseId ?? 'Needs match'}</td>
                    <td className="px-4 py-3 text-slate-700">{item.enrollmentCount ?? 'Not available'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={item.matchStatus === 'matched' ? 'secondary' : 'outline'}>
                        {item.matchStatus === 'matched' ? 'Matched' : item.matchStatus === 'ambiguous' ? 'Review match' : 'Needs LMS match'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setManagedClass(item)} aria-label={`View details for ${classTitle(item)}`}>
                          <Eye className="mr-2 h-4 w-4" />Manage
                        </Button>
                        <Button size="sm" variant="outline" disabled={item.matchStatus !== 'matched' || downloadingId === item.id} onClick={() => void handleRosterDownload(item)} aria-label={`Download roster for ${classTitle(item)}`}>
                          <Download className="mr-2 h-4 w-4" />{downloadingId === item.id ? 'Preparing' : 'XLSX'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && classes.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No upcoming NC classes found.</td></tr>
                )}
                {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading schedule and LMS counts…</td></tr>}
              </tbody>
            </table>
          </div> : (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">ExceedCE Course</th>
                    <th className="px-4 py-3 font-semibold">Class date/time</th>
                    <th className="px-4 py-3 font-semibold">Enrolled</th>
                    <th className="px-4 py-3 font-semibold">Roster</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {instructorClasses.map((item) => (
                    <tr key={item.courseId} className="bg-white">
                      <td className="px-4 py-3 font-medium text-slate-900">{item.courseName}</td>
                      <td className="px-4 py-3 text-slate-700">{formatClassDate(item.startsAt)}</td>
                      <td className="px-4 py-3 text-slate-700">{item.enrollmentCount}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" disabled={downloadingId === String(item.courseId)} onClick={() => void handleInstructorRosterDownload(item)}>
                          <Download className="mr-2 h-4 w-4" />{downloadingId === String(item.courseId) ? 'Preparing' : 'XLSX'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!loading && instructorClasses.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-600">Automatic ExceedCE class discovery is not connected yet.</td></tr>
                  )}
                  {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading ExceedCE classes and enrollments…</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-slate-500">North Carolina classes continue to use the NC calendar. Donald and Cheryl classes are selected from ExceedCE and use the current LMS enrollment list.</p>
        </CardContent>
      </Card>

      <Dialog open={Boolean(managedClass)} onOpenChange={(open) => { if (!open) setManagedClass(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-blue-600" />Class details</DialogTitle>
            <DialogDescription>{managedClass ? classTitle(managedClass) : ''}</DialogDescription>
          </DialogHeader>

          {managedClass && (
            <div className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
              {[
                ['Date and time', managedClass.startsAt ? formatClassDate(managedClass.startsAt) : managedClass.date],
                ['Instructor', managedClass.instructorName || 'Needs confirmation'],
                ['Moderator', managedClass.moderatorName || 'None listed'],
                ['LMS course', managedClass.courseName || 'Needs LMS match'],
                ['LMS ID', managedClass.courseId ?? 'Not available'],
                ['Enrolled', managedClass.enrollmentCount ?? 'Not available'],
                ['Roster', managedClass.matchStatus === 'matched' ? 'Available for XLSX download' : 'Unavailable until LMS match'],
                ['Mail schedule', '24 hours before class'],
              ].map(([label, value]) => (
                <div key={String(label)} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-3">
                  <span className="font-medium text-slate-500">{label}</span>
                  <span className="text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}