import { useCallback, useEffect, useRef, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Download, Eye, List, RefreshCw, Save } from 'lucide-react'
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
  saveClassInstructorSettings,
  type InstructorUpcomingClass,
  type NcScheduledClass,
} from '@/lib/api'

type InstructorFilter = 'nc' | 'donald-croteau' | 'cheryl-crawford'
type ScheduleView = 'list' | 'calendar'

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

function scheduledDate(item: NcScheduledClass | InstructorUpcomingClass) {
  if ('scheduleStatus' in item) {
    if (!item.startsAt) return null
    const date = new Date(item.startsAt)
    if (Number.isNaN(date.getTime())) return null
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date)
    const part = (type: string) => parts.find((value) => value.type === type)?.value
    return parseISO(`${part('year')}-${part('month')}-${part('day')}T00:00:00`)
  }
  const date = parseISO(`${item.date.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function scheduledTime(item: NcScheduledClass | InstructorUpcomingClass) {
  if (!item.startsAt) return 'Time not listed'
  const date = new Date(item.startsAt)
  if (Number.isNaN(date.getTime())) return 'Time not listed'
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  }).format(date)
}

function scheduleItemTitle(item: NcScheduledClass | InstructorUpcomingClass) {
  return 'scheduleStatus' in item ? item.courseName : classTitle(item)
}

export function SalesUpcomingClassesPage() {
  const [classes, setClasses] = useState<NcScheduledClass[]>([])
  const [instructorFilter, setInstructorFilter] = useState<InstructorFilter>('nc')
  const [scheduleView, setScheduleView] = useState<ScheduleView>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [instructorClasses, setInstructorClasses] = useState<InstructorUpcomingClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingId, setDownloadingId] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [availabilityDraft, setAvailabilityDraft] = useState(true)
  const [mailLeadHoursDraft, setMailLeadHoursDraft] = useState(24)
  const [managedClass, setManagedClass] = useState<NcScheduledClass | InstructorUpcomingClass | null>(null)
  const classRequestId = useRef(0)
  const scheduledClasses: Array<NcScheduledClass | InstructorUpcomingClass> = instructorFilter === 'nc' ? classes : instructorClasses
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarMonth)),
    end: endOfWeek(endOfMonth(calendarMonth)),
  })
  const calendarEvents = new Map<string, Array<NcScheduledClass | InstructorUpcomingClass>>()
  for (const item of scheduledClasses) {
    const date = scheduledDate(item)
    if (!date) continue
    const key = format(date, 'yyyy-MM-dd')
    calendarEvents.set(key, [...(calendarEvents.get(key) || []), item])
  }
  const unscheduledClasses = scheduledClasses.filter((item) => !scheduledDate(item))

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

  const openManage = (item: NcScheduledClass | InstructorUpcomingClass) => {
    setManagedClass(item)
    setAvailabilityDraft(item.instructorAvailable ?? Boolean(item.instructorName))
    setMailLeadHoursDraft(Math.round((item.sendLeadMinutes ?? 1440) / 60))
    setSettingsError('')
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

  const handleSaveClassSettings = async () => {
    if (!managedClass || savingSettings) return
    const isInstructorClass = 'scheduleStatus' in managedClass
    const classType = isInstructorClass ? 'instructor' : 'nc'
    const classId = isInstructorClass
      ? `${managedClass.instructorId}:${managedClass.courseId}`
      : managedClass.id
    const classKey = isInstructorClass
      ? `instructor:${managedClass.instructorId}:${managedClass.courseId}`
      : `nc:${managedClass.id}`
    const available = availabilityDraft
    const mailLeadHours = mailLeadHoursDraft
    setSavingSettings(true)
    setSettingsError('')
    try {
      await saveClassInstructorSettings(classType, classId, available, mailLeadHours)
      const updateSettings = <T extends NcScheduledClass | InstructorUpcomingClass>(item: T): T => {
        const itemKey = 'scheduleStatus' in item
          ? `instructor:${item.instructorId}:${item.courseId}`
          : `nc:${item.id}`
        return itemKey === classKey
          ? { ...item, instructorAvailable: available, sendLeadMinutes: mailLeadHours * 60 } as T
          : item
      }
      setClasses((current) => current.map(updateSettings))
      setInstructorClasses((current) => current.map(updateSettings))
      setManagedClass(null)
    } catch (saveError) {
      setSettingsError(saveError instanceof Error ? saveError.message : 'Unable to save class settings.')
    } finally {
      setSavingSettings(false)
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
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full max-w-sm space-y-2 sm:w-72">
              <Label htmlFor="instructor">Instructor</Label>
              <Select value={instructorFilter} onValueChange={handleInstructorChange}>
                <SelectTrigger id="instructor"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSTRUCTOR_OPTIONS.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div role="group" aria-label="Schedule view" className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  aria-pressed={scheduleView === 'list'}
                  onClick={() => setScheduleView('list')}
                  className={`inline-flex h-9 items-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${scheduleView === 'list' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}
                >
                  <List className="h-4 w-4" />List
                </button>
                <button
                  type="button"
                  aria-pressed={scheduleView === 'calendar'}
                  onClick={() => setScheduleView('calendar')}
                  className={`inline-flex h-9 items-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${scheduleView === 'calendar' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}
                >
                  <CalendarDays className="h-4 w-4" />Calendar
                </button>
              </div>
            </div>
          </div>

          {scheduleView === 'calendar' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">{format(calendarMonth, 'MMMM yyyy')}</h2>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={() => setCalendarMonth((month) => subMonths(month, 1))} aria-label="Previous month">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => setCalendarMonth(new Date())}>Month</Button>
                  <Button variant="outline" size="icon" onClick={() => setCalendarMonth((month) => addMonths(month, 1))} aria-label="Next month">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {loading && <p role="status" className="text-sm text-slate-500">Loading schedule…</p>}
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day) => {
                      const events = calendarEvents.get(format(day, 'yyyy-MM-dd')) || []
                      return (
                        <div key={format(day, 'yyyy-MM-dd')} className={`min-h-[120px] border-b border-r border-slate-200 p-2 ${isSameMonth(day, calendarMonth) ? 'bg-white' : 'bg-slate-50 text-slate-400'}`}>
                          <span className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-blue-700 font-semibold text-white' : ''}`}>
                            {format(day, 'd')}
                          </span>
                          <div className="space-y-1">
                            {events.map((item) => (
                              <button
                                key={'scheduleStatus' in item ? item.courseId : item.id}
                                type="button"
                                onClick={() => openManage(item)}
                                className={`block w-full rounded-sm border-l-2 px-2 py-1 text-left text-xs focus:outline-none focus:ring-2 ${item.instructorAvailable === false ? 'border-red-600 bg-red-100 text-red-950 hover:bg-red-200 focus:ring-red-600' : 'border-blue-600 bg-blue-50 text-blue-950 hover:bg-blue-100 focus:ring-blue-600'}`}
                                title={`${scheduledTime(item)} - ${scheduleItemTitle(item)}`}
                              >
                                <span className="block font-semibold">{scheduledTime(item)}</span>
                                <span className="block truncate">{scheduleItemTitle(item)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              {unscheduledClasses.length > 0 && (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Date not found</h3>
                  <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {unscheduledClasses.map((item) => (
                      <button key={'scheduleStatus' in item ? item.courseId : item.id} type="button" onClick={() => openManage(item)} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                        <span className="font-medium text-slate-900">{scheduleItemTitle(item)}</span>
                        <span className="ml-2 text-slate-500">Date/time not found in title</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : instructorFilter === 'nc' ? <div className="overflow-x-auto rounded-md border border-slate-200">
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
                  <tr key={item.id} className={item.instructorAvailable === false ? 'bg-red-50' : 'bg-white'}>
                    <td className="px-4 py-3">
                      <p className={`font-medium ${item.instructorAvailable === false ? 'text-red-900' : 'text-slate-900'}`}>{classTitle(item)}</p>
                      {item.instructorAvailable === false && <span className="mt-1 inline-flex rounded-sm bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Instructor unavailable</span>}
                      <p className="mt-1 text-xs text-slate-500">{item.startsAt ? formatClassDate(item.startsAt) : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${item.date}T00:00:00Z`))}</p>
                      {item.moderatorName && <p className="mt-1 text-xs text-slate-500">Moderator: {item.moderatorName}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.instructorName || 'Needs instructor confirmation'}</td>
                    <td className="px-4 py-3 text-slate-700">{item.enrollmentCount ?? 'Not available'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-9 border-blue-200 px-3 text-blue-700 hover:bg-blue-50 hover:text-blue-800" onClick={() => openManage(item)} aria-label={`Manage ${classTitle(item)}`}>
                          Manage
                        </Button>
                        <Button size="sm" variant="outline" disabled={item.matchStatus !== 'matched' || downloadingId === item.id} onClick={() => void handleRosterDownload(item)} aria-label={`Download roster for ${classTitle(item)}`}>
                          <Download className="mr-2 h-4 w-4" />{downloadingId === item.id ? 'Preparing' : 'Download'}
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
                    <tr key={item.courseId} className={item.instructorAvailable === false ? 'bg-red-50' : 'bg-white'}>
                      <td className={`px-4 py-3 font-medium ${item.instructorAvailable === false ? 'text-red-900' : 'text-slate-900'}`}>
                        {item.courseName}
                        {item.instructorAvailable === false && <span className="mt-1 block text-xs font-medium text-red-700">Instructor unavailable</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.startsAt ? formatClassDate(item.startsAt) : 'Date/time not found in title'}</td>
                      <td className="px-4 py-3 text-slate-700" title={item.enrollmentError || undefined}>
                        {item.enrollmentError ? 'Unavailable' : item.enrollmentCount ?? 'Unavailable'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-9 border-blue-200 px-3 text-blue-700 hover:bg-blue-50 hover:text-blue-800" onClick={() => openManage(item)} aria-label={`Manage ${item.courseName}`}>
                          Manage
                          </Button>
                          <Button size="sm" variant="outline" disabled={Boolean(item.enrollmentError) || downloadingId === String(item.courseId)} onClick={() => void handleInstructorRosterDownload(item)}>
                            <Download className="mr-2 h-4 w-4" />{downloadingId === String(item.courseId) ? 'Preparing' : 'Download'}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl"><Eye className="h-5 w-5 text-blue-600" />Class details</DialogTitle>
            <DialogDescription className="text-sm leading-5">{managedClass ? ('scheduleStatus' in managedClass ? managedClass.courseName : classTitle(managedClass)) : ''}</DialogDescription>
          </DialogHeader>

          {managedClass && (
            <div className="space-y-4">
              <section className={`rounded-md border p-4 ${availabilityDraft ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Class instructor availability</h3>
                    <p className={`mt-1 text-sm font-medium ${availabilityDraft ? 'text-emerald-800' : 'text-red-800'}`}>
                      {availabilityDraft ? 'Available' : 'Not available'}
                    </p>
                  </div>
                  <div role="group" aria-label="Set class instructor availability" className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      aria-pressed={availabilityDraft}
                      disabled={savingSettings}
                      onClick={() => setAvailabilityDraft(true)}
                      className={`h-9 rounded-sm px-3 text-sm font-medium disabled:opacity-60 ${availabilityDraft ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'}`}
                    >Available</button>
                    <button
                      type="button"
                      aria-pressed={!availabilityDraft}
                      disabled={savingSettings}
                      onClick={() => setAvailabilityDraft(false)}
                      className={`h-9 rounded-sm px-3 text-sm font-medium disabled:opacity-60 ${!availabilityDraft ? 'bg-red-100 text-red-800' : 'text-slate-600 hover:bg-slate-50'}`}
                    >Not available</button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-600">Unavailable classes are marked red and excluded from roster emails after you save.</p>
                <div className="mt-4 max-w-sm space-y-2">
                  <Label htmlFor="mail-lead-hours">Roster email timing</Label>
                  <Select value={String(mailLeadHoursDraft)} onValueChange={(value) => setMailLeadHoursDraft(Number(value))}>
                    <SelectTrigger id="mail-lead-hours" disabled={savingSettings}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 6, 12, 24].map((hours) => <SelectItem key={hours} value={String(hours)}>{hours} {hours === 1 ? 'hour' : 'hours'} before class</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {settingsError && <p role="alert" className="mt-3 text-xs text-red-700">{settingsError}</p>}
              </section>
              <div className="grid gap-x-8 sm:grid-cols-2">
              {('scheduleStatus' in managedClass
                ? [
                    ['Course name', managedClass.courseName],
                    ['Date and time', managedClass.startsAt ? formatClassDate(managedClass.startsAt) : 'Not available'],
                    ['Instructor', managedClass.instructorName],
                    ['Instructor email', managedClass.instructorEmail || 'Not configured'],
                    ['Enrollments', managedClass.enrollmentError ? 'Unavailable' : managedClass.enrollmentCount ?? 'Unavailable'],
                  ]
                : [
                    ['Class name', classTitle(managedClass)],
                    ['Date and time', managedClass.startsAt ? formatClassDate(managedClass.startsAt) : managedClass.date],
                    ['Instructor', managedClass.instructorName || 'Needs confirmation'],
                    ['Moderator', managedClass.moderatorName || 'None listed'],
                    ['Enrollments', managedClass.enrollmentCount ?? 'Not available'],
                    ['Roster', managedClass.matchStatus === 'matched' ? 'Available for XLSX download' : 'Not available'],
                  ]
              ).map(([label, value]) => (
                <div key={String(label)} className="border-b border-slate-100 py-3">
                  <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
                  <div className="mt-1 font-medium text-slate-900">{value}</div>
                </div>
              ))}
              </div>
              <div className="flex justify-end border-t border-slate-200 pt-4">
                <Button onClick={() => void handleSaveClassSettings()} disabled={savingSettings}>
                  <Save className="mr-2 h-4 w-4" />{savingSettings ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}