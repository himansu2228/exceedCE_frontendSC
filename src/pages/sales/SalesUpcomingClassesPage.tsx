import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarClock, Download, Eye, RefreshCw } from 'lucide-react'
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
  const [managedClass, setManagedClass] = useState<NcScheduledClass | InstructorUpcomingClass | null>(null)
  const classRequestId = useRef(0)

  const loadClasses = useCallback(async () => {
    const requestId = ++classRequestId.current
    setLoading(true)
    setError('')
    if (instructorFilter === 'nc') setClasses([])
    else setInstructorClasses([])
    try {
      if (instructorFilter === 'nc') {
        const response = await getNcUpcomingClasses()
        if (requestId !== classRequestId.current) return
        setClasses(response.classes)
      } else {
        const assignedClasses = await getInstructorUpcomingClasses(instructorFilter)
        if (requestId !== classRequestId.current) return
        setInstructorClasses(assignedClasses)
      }
    } catch (loadError) {
      if (requestId !== classRequestId.current) return
      setError(loadError instanceof Error ? loadError.message : 'Unable to load upcoming classes.')
    } finally {
      if (requestId === classRequestId.current) setLoading(false)
    }
  }, [instructorFilter])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadClasses()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadClasses])

  const handleInstructorChange = (value: string) => {
    if (!INSTRUCTOR_OPTIONS.some((item) => item.id === value)) return
    classRequestId.current += 1
    setLoading(true)
    setError('')
    setClasses([])
    setInstructorClasses([])
    setInstructorFilter(value as InstructorFilter)
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
          <p className="mt-1 text-sm text-slate-600">NC calendar classes and automatically matched Donald/Cheryl courses with current LMS enrollments.</p>
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
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Class / Date</th>
                  <th className="px-4 py-3 font-semibold">Instructor</th>
                  <th className="px-4 py-3 font-semibold">Enrolled</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((item) => (
                  <tr key={item.id} className="bg-white">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{classTitle(item)}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.startsAt ? formatClassDate(item.startsAt) : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.date}T00:00:00Z`))}</p>
                      {item.moderatorName && <p className="mt-1 text-xs text-slate-500">Moderator: {item.moderatorName}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.instructorName || 'Needs instructor confirmation'}</td>
                    <td className="px-4 py-3 text-slate-700">{item.enrollmentCount ?? 'Not available'}</td>
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
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No upcoming NC classes found.</td></tr>
                )}
                {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading schedule and enrollment counts…</td></tr>}
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
                      <td className="px-4 py-3 text-slate-700">{item.startsAt ? formatClassDate(item.startsAt) : 'Date/time not found in title'}</td>
                      <td className="px-4 py-3 text-slate-700" title={item.enrollmentError || undefined}>
                        {item.enrollmentError ? 'Unavailable' : item.enrollmentCount ?? 'Unavailable'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setManagedClass(item)} aria-label={`Manage ${item.courseName}`}>
                            <Eye className="mr-2 h-4 w-4" />Manage
                          </Button>
                          <Button size="sm" variant="outline" disabled={Boolean(item.enrollmentError) || downloadingId === String(item.courseId)} onClick={() => void handleInstructorRosterDownload(item)}>
                            <Download className="mr-2 h-4 w-4" />{downloadingId === String(item.courseId) ? 'Preparing' : 'XLSX'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && instructorClasses.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-600">No future ExceedCE courses matched this instructor&apos;s course-name rules.</td></tr>
                  )}
                  {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading ExceedCE classes and enrollments…</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-slate-500">NC uses the NC calendar. Donald and Cheryl are matched by the client&apos;s course-title rules; class times are read from titles and rosters come from LMS enrollments.</p>
        </CardContent>
      </Card>

      <Dialog open={Boolean(managedClass)} onOpenChange={(open) => { if (!open) setManagedClass(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-blue-600" />Class details</DialogTitle>
            <DialogDescription>{managedClass ? ('scheduleStatus' in managedClass ? managedClass.courseName : classTitle(managedClass)) : ''}</DialogDescription>
          </DialogHeader>

          {managedClass && (
            <div className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
              {('scheduleStatus' in managedClass
                ? [
                    ['Course name', managedClass.courseName],
                    ['Date and time', managedClass.startsAt ? formatClassDate(managedClass.startsAt) : 'Not available'],
                    ['Instructor', managedClass.instructorName],
                    ['Instructor email', managedClass.instructorEmail || 'Not configured'],
                    ['Enrollments', managedClass.enrollmentError ? 'Unavailable' : managedClass.enrollmentCount ?? 'Unavailable'],
                    ['Email timing', `${Math.round(managedClass.sendLeadMinutes / 60)} hours before class`],
                  ]
                : [
                    ['Class name', classTitle(managedClass)],
                    ['Date and time', managedClass.startsAt ? formatClassDate(managedClass.startsAt) : managedClass.date],
                    ['Instructor', managedClass.instructorName || 'Needs confirmation'],
                    ['Moderator', managedClass.moderatorName || 'None listed'],
                    ['Enrollments', managedClass.enrollmentCount ?? 'Not available'],
                    ['Roster', managedClass.matchStatus === 'matched' ? 'Available for XLSX download' : 'Not available'],
                    ['Mail timing', '24 hours before class'],
                  ]
              ).map(([label, value]) => (
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