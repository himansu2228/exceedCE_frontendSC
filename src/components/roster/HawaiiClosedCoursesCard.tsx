import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, Loader2, LockOpen, RefreshCw } from 'lucide-react'
import { getHawaiiPortalCourses, reopenHawaiiCourse, type HawaiiPortalCourse } from '@/lib/api'

export function HawaiiClosedCoursesCard() {
  const [courses, setCourses] = useState<HawaiiPortalCourse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reopeningCourseId, setReopeningCourseId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadCourses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getHawaiiPortalCourses()
      setCourses(response.courses.filter((course) => course.is_closed))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load Hawaii courses')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCourses()
  }, [loadCourses])

  const handleReopen = useCallback(async (course: HawaiiPortalCourse) => {
    const confirmed = window.confirm(
      `Reopen "${course.course_number} ${course.title}"?\n\n`
      + 'This sets the course status back to Open so attendees can be added again. '
      + 'Already submitted attendee credits are not changed.',
    )
    if (!confirmed) return

    setReopeningCourseId(course.id)
    setNotice(null)
    setError(null)
    try {
      const result = await reopenHawaiiCourse(course.id)
      setNotice(result.message)
      await loadCourses()
    } catch (reopenError) {
      setError(reopenError instanceof Error ? reopenError.message : 'Could not reopen the course')
    } finally {
      setReopeningCourseId(null)
    }
  }, [loadCourses])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockOpen className="h-5 w-5" />
          Closed Courses
        </CardTitle>
        <CardDescription>
          A closed course cannot accept new attendees. Reopen it here if it was closed by mistake —
          already submitted attendee credits are never changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={courses.length > 0 ? 'warning' : 'secondary'}>
            {loading ? 'Loading…' : `${courses.length} closed course(s)`}
          </Badge>
          <Button variant="outline" size="sm" onClick={loadCourses} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 mr-2 animate-spin' : 'h-4 w-4 mr-2'} />
            Refresh
          </Button>
        </div>

        {notice && (
          <Alert className="border-emerald-500/50 bg-emerald-50/90 text-emerald-800 [&>svg]:text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Course Reopened</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Could Not Complete</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {courses.length > 0 ? (
          <div className="space-y-3">
            {courses.map((course) => (
              <div key={course.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">
                      {course.course_number ? `${course.course_number} — ` : ''}{course.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Status: {course.status} · Valid {course.start_date || '-'} to {course.end_date || '-'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReopen(course)}
                    disabled={!course.can_reopen || reopeningCourseId !== null}
                  >
                    {reopeningCourseId === course.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <LockOpen className="h-4 w-4 mr-2" />
                    )}
                    Reopen Course
                  </Button>
                </div>
                {!course.can_reopen && (
                  <p className="mt-2 text-xs text-amber-700">
                    This course window has ended, so it cannot be reopened from the dashboard.
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          !loading && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No closed courses. Every course is open and can still accept attendees.
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
