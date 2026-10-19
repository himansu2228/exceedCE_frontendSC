import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Search,
  GraduationCap,
  Users,
  CheckCircle2,
  ExternalLink,
  Eye,
  Loader2,
  XCircle,
  BadgeCheck,
  CalendarDays,
  MapPin,
  Plus,
  Trash2,
  AlertTriangle,
  RotateCcw,
  X,
} from 'lucide-react'
import {
  getSCCoursesPaginated,
  getCourseCompletionsPaginated,
  getManagedCourses,
  addManagedCourse,
  type Course,
  type ManagedCourse,
  type ManagedCoursesResponse,
  type Student,
} from '@/lib/api'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { getTenantAccessProfile } from '@/lib/auth'
import { AddCourseDialog, RemoveCourseDialog } from '@/components/courses/ManageCourseDialogs'

// States whose CE Broker course list (course + CE Broker course ID) is maintained by ExceedCE.
const MANAGED_COURSE_STATES = new Set(['SC'])

export function CoursesPage() {
  const [tenant, setTenant] = useState(() => getTenantAccessProfile())
  const [courses, setCourses] = useState<Course[]>([])
  const [totalCourses, setTotalCourses] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [completions, setCompletions] = useState<Student[]>([])
  const [completionsTotal, setCompletionsTotal] = useState(0)
  const [completionsPage, setCompletionsPage] = useState(1)
  const [completionsPerPage, setCompletionsPerPage] = useState(100)
  const [completionsTotalPages, setCompletionsTotalPages] = useState(1)
  const [loadingCompletions, setLoadingCompletions] = useState(false)
  const canManageCourses = MANAGED_COURSE_STATES.has(tenant.stateCode)
  const [managed, setManaged] = useState<ManagedCoursesResponse | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{ name: string; ceb_course_id?: string | null } | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [readdingName, setReaddingName] = useState<string | null>(null)

  const fetchCourses = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true)
      setError(null)
      const data = await getSCCoursesPaginated({
        page,
        perPage,
        search: searchTerm.trim() || undefined,
      })
      setCourses(data.items)
      setTotalCourses(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch courses')
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }

  const fetchManagedCourses = async () => {
    const data = canManageCourses ? await getManagedCourses().catch(() => null) : null
    setManaged(data)
  }

  const refreshAfterCourseChange = async (message: string) => {
    setNotice({ tone: 'success', message })
    await Promise.all([fetchCourses({ silent: true }), fetchManagedCourses()])
  }

  const handleCourseAdded = (course: ManagedCourse) => {
    void refreshAfterCourseChange(
      `"${course.name}" was added with CE Broker ID ${course.id_course}. New completions will be reported to CE Broker.`
    )
  }

  const handleCourseRemoved = (course: ManagedCourse) => {
    void refreshAfterCourseChange(`"${course.name}" was removed. New completions will no longer be reported to CE Broker.`)
  }

  const handleReadd = async (course: ManagedCourse) => {
    setReaddingName(course.name)
    try {
      const result = await addManagedCourse({
        name: course.name,
        id_course: course.id_course,
        exceed_course_id: course.exceed_course_id,
      })
      handleCourseAdded(result.course)
    } catch (err) {
      setNotice({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to add the course back' })
    } finally {
      setReaddingName(null)
    }
  }

  const coursesMissingFromCatalog = (managed?.courses || []).filter((course) => course.in_catalog === false)
  const recentlyRemoved = (managed?.removed || []).slice(0, 5)
    useEffect(() => {
    const syncActiveState = () => {
      setTenant(getTenantAccessProfile())
      setNotice(null)
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'exceedce-active-state') {
        syncActiveState()
      }
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('exceedce:active-state-changed', syncActiveState as EventListener)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('exceedce:active-state-changed', syncActiveState as EventListener)
    }
  }, [])


    useEffect(() => {
    void fetchCourses()
  }, [page, perPage, searchTerm, tenant.stateCode])

  useEffect(() => {
    if (!canManageCourses) return
    let cancelled = false
    getManagedCourses()
      .then((data) => {
        if (!cancelled) setManaged(data)
      })
      .catch(() => {
        if (!cancelled) setManaged(null)
      })
    return () => {
      cancelled = true
    }
  }, [canManageCourses, tenant.stateCode])


  // Fetch completions when a course is selected
  const fetchCourseCompletions = async (courseId: number, targetPage: number, targetPerPage: number) => {
    setLoadingCompletions(true)
    try {
      const data = await getCourseCompletionsPaginated(courseId, {
        page: targetPage,
        perPage: targetPerPage,
      })
      setCompletions(data.items)
      setCompletionsTotal(data.total)
      setCompletionsPage(data.page)
      setCompletionsTotalPages(data.totalPages)
    } catch {
      setCompletions([])
      setCompletionsTotal(0)
      setCompletionsTotalPages(1)
    } finally {
      setLoadingCompletions(false)
    }
  }

  const handleViewCourse = async (course: Course) => {
    setSelectedCourse(course)
    setCompletionsPage(1)
    await fetchCourseCompletions(course.id, 1, completionsPerPage)
  }

  const totalEnrolled = courses.reduce((sum, c) => sum + (c.total_enrolled || 0), 0)
  const totalCompleted = courses.reduce((sum, c) => sum + (c.total_completed || 0), 0)

  const statTiles = [
    {
      label: `${tenant.stateName} Courses`,
      value: totalCourses.toLocaleString(),
      icon: GraduationCap,
      accent: 'from-blue-500 to-indigo-500',
      ring: 'ring-blue-200',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Total Enrolled',
      value: totalEnrolled.toLocaleString(),
      icon: Users,
      accent: 'from-amber-500 to-orange-500',
      ring: 'ring-amber-200',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Total Completed',
      value: totalCompleted.toLocaleString(),
      icon: CheckCircle2,
      accent: 'from-emerald-500 to-green-500',
      ring: 'ring-emerald-200',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading courses...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <p className="text-red-600 font-medium">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stats */}
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

      {/* Course list change notices */}
      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {notice.tone === 'error'
            ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
          <p className="flex-1">{notice.message}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {canManageCourses && coursesMissingFromCatalog.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {coursesMissingFromCatalog.length === 1
              ? '1 course in the list was not found in the ExceedCE catalog'
              : `${coursesMissingFromCatalog.length} courses in the list were not found in the ExceedCE catalog`}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Completions are only reported once the title matches an ExceedCE course exactly. Remove it and add it again with the correct title if needed.
          </p>
          <ul className="mt-2 space-y-1.5">
            {coursesMissingFromCatalog.map((course) => (
              <li key={course.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2">
                <span className="min-w-0 break-words">
                  <span className="font-medium">{course.name}</span>
                  <span className="ml-2 font-mono text-xs text-amber-800">CEB {course.id_course}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setRemoveTarget({ name: course.name, ceb_course_id: course.id_course })}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Courses Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <CardTitle>{tenant.stateName} Courses</CardTitle>
              {canManageCourses && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Approved courses reported to CE Broker. Add a course once the state approves it, or remove one to stop reporting it.
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setPage(1)
                  }}
                  className="pl-9"
                />
              </div>
              {canManageCourses && (
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Course
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={totalCourses}
              pageSize={perPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPerPage(size)
                setPage(1)
              }}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course Name</TableHead>
                <TableHead>CE Broker ID</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-center">Enrolled</TableHead>
                <TableHead className="text-center">Completed</TableHead>
                <TableHead className="text-center">Rate</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => {
                const enrolled = course.total_enrolled || 0
                const completed = course.total_completed || 0
                const completionRate = enrolled > 0 ? ((completed / enrolled) * 100).toFixed(0) : '0'
                return (
                  <TableRow key={course.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{course.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-slate-100 px-2 py-1 text-sm">
                        {course.ceb_course_id}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{course.state}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{enrolled}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-green-600">{completed}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          parseInt(completionRate) >= 70
                            ? 'success'
                            : parseInt(completionRate) >= 40
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        {completionRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewCourse(course)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="flex max-h-[88vh] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-2xl shadow-slate-950/15">
                          <DialogHeader className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50/70 px-5 py-5 pr-14 text-left sm:px-7">
                            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-800 via-teal-500 to-emerald-400" />
                            <div className="flex items-start gap-3.5">
                              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-cyan-100 bg-white text-cyan-800 shadow-sm">
                                <GraduationCap className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="mb-1 text-[10px] font-semibold uppercase text-cyan-800">Course record</p>
                                <DialogTitle className="text-lg leading-snug text-slate-950 sm:text-xl">{course.name}</DialogTitle>
                                <DialogDescription className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                                  <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-teal-700" />
                                    {course.state}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="font-medium text-slate-500">CE Broker ID</span>
                                    <span className="font-mono text-slate-800">{course.ceb_course_id}</span>
                                  </span>
                                </DialogDescription>
                              </div>
                            </div>
                          </DialogHeader>

                          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-3.5 sm:px-7">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                                <Users className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500">Completed learners</p>
                                <p className="text-lg font-semibold leading-tight tabular-nums text-slate-950">
                                  {loadingCompletions ? '—' : completionsTotal.toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <p className="shrink-0 text-right text-xs text-slate-500">
                              {loadingCompletions
                                ? 'Loading roster'
                                : completions.length > 0
                                  ? `Page ${completionsPage} of ${completionsTotalPages}`
                                  : 'Course completions'}
                            </p>
                          </div>

                          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7">
                            {loadingCompletions ? (
                              <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                                <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
                                <div>
                                  <p className="text-sm font-medium text-slate-800">Loading completed learners</p>
                                  <p className="mt-1 text-xs text-slate-500">Course records are being retrieved.</p>
                                </div>
                              </div>
                            ) : completions.length === 0 ? (
                              <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                  <Users className="h-5 w-5" />
                                </div>
                                <p className="text-sm font-medium text-slate-800">No completed learners</p>
                                <p className="text-xs text-slate-500">There are no completion records for this course.</p>
                              </div>
                            ) : (
                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <Table className="min-w-[680px]">
                                  <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                                    <TableRow className="border-slate-200 hover:bg-transparent">
                                      <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase text-slate-500">Learner</TableHead>
                                      <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase text-slate-500">Email</TableHead>
                                      <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase text-slate-500">License number</TableHead>
                                      <TableHead className="h-10 px-4 text-[10px] font-semibold uppercase text-slate-500">Completed</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {completions.map((student) => (
                                      <TableRow key={student.user_id} className="border-slate-100 hover:bg-cyan-50/40">
                                        <TableCell className="px-4 py-3">
                                          <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[11px] font-semibold text-sky-800">
                                              {`${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase() || '—'}
                                            </div>
                                            <span className="whitespace-nowrap text-sm font-medium text-slate-900">
                                              {student.first_name} {student.last_name}
                                            </span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-sm text-slate-600">{student.email}</TableCell>
                                        <TableCell className="px-4 py-3">
                                          {student.license_number ? (
                                            <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-slate-800">
                                              <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                                              {student.license_number}
                                            </span>
                                          ) : (
                                            <span className="text-sm text-slate-400">N/A</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-700">
                                            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                                            {student.date_completed || 'N/A'}
                                          </span>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>

                          {!loadingCompletions && completions.length > 0 && (
                            <div className="shrink-0 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-7">
                              <PaginationControls
                                page={completionsPage}
                                totalPages={completionsTotalPages}
                                totalItems={completionsTotal}
                                pageSize={completionsPerPage}
                                onPageChange={(nextPage) => {
                                  if (!selectedCourse) return
                                  void fetchCourseCompletions(selectedCourse.id, nextPage, completionsPerPage)
                                }}
                                onPageSizeChange={(nextPerPage) => {
                                  if (!selectedCourse) return
                                  setCompletionsPerPage(nextPerPage)
                                  void fetchCourseCompletions(selectedCourse.id, 1, nextPerPage)
                                }}
                              />
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      {canManageCourses && course.ceb_course_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          title="Remove course from CE Broker reporting"
                          aria-label={`Remove ${course.name}`}
                          onClick={() => setRemoveTarget({ name: course.name, ceb_course_id: course.ceb_course_id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {courses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {searchTerm.trim() ? 'No courses match your search.' : 'No courses in the list yet.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManageCourses && recentlyRemoved.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              Recently removed
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              These courses are no longer reported to CE Broker. Add one back if it was removed by mistake.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y rounded-lg border">
              {recentlyRemoved.map((course) => (
                <li key={course.name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-slate-800">{course.name}</p>
                    <p className="text-xs text-muted-foreground">
                      CE Broker ID <span className="font-mono">{course.id_course}</span>
                      {course.removed_at && ` · removed ${new Date(course.removed_at).toLocaleDateString()}`}
                      {course.removed_by && ` by ${course.removed_by}`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={readdingName !== null}
                    onClick={() => void handleReadd(course)}
                  >
                    {readdingName === course.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Add back
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {canManageCourses && (
        <>
          <AddCourseDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            stateName={tenant.stateName}
            onAdded={handleCourseAdded}
          />
          <RemoveCourseDialog
            course={removeTarget}
            stateName={tenant.stateName}
            onOpenChange={(open) => {
              if (!open) setRemoveTarget(null)
            }}
            onRemoved={handleCourseRemoved}
          />
        </>
      )}
    </div>
  )
}
