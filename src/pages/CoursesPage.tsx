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
} from 'lucide-react'
import { getSCCourses, getCourseCompletions, type Course, type Student } from '@/lib/api'

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [_selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [completions, setCompletions] = useState<Student[]>([])
  const [loadingCompletions, setLoadingCompletions] = useState(false)

  // Fetch courses from API
  useEffect(() => {
    async function fetchCourses() {
      try {
        setLoading(true)
        setError(null)
        const data = await getSCCourses()
        setCourses(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch courses')
      } finally {
        setLoading(false)
      }
    }
    fetchCourses()
  }, [])

  // Fetch completions when a course is selected
  const handleViewCourse = async (course: Course) => {
    setSelectedCourse(course)
    setLoadingCompletions(true)
    try {
      const data = await getCourseCompletions(course.id)
      setCompletions(data)
    } catch (err) {
      setCompletions([])
    } finally {
      setLoadingCompletions(false)
    }
  }

  const filteredCourses = courses.filter((course) =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalEnrolled = courses.reduce((sum, c) => sum + (c.total_enrolled || 0), 0)
  const totalCompleted = courses.reduce((sum, c) => sum + (c.total_completed || 0), 0)

  const statTiles = [
    {
      label: 'SC Courses',
      value: courses.length.toLocaleString(),
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

      {/* Courses Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>South Carolina Courses</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
              {filteredCourses.map((course) => {
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
                    <TableCell className="text-right">
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
                        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
                          <DialogHeader>
                            <DialogTitle>{course.name}</DialogTitle>
                            <DialogDescription>
                              CE Broker ID: {course.ceb_course_id} | State: {course.state}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="mt-4 overflow-y-auto pr-1">
                            <h4 className="font-semibold mb-3">Completed Students</h4>
                            {loadingCompletions ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="ml-2 text-muted-foreground">Loading completions...</span>
                              </div>
                            ) : completions.length === 0 ? (
                              <p className="text-muted-foreground text-center py-8">No completed students found</p>
                            ) : (
                              <div className="max-h-[calc(85vh-13rem)] overflow-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Email</TableHead>
                                      <TableHead>License #</TableHead>
                                      <TableHead>Completed</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {completions.map((student) => (
                                      <TableRow key={student.user_id}>
                                        <TableCell className="font-medium">
                                          {student.first_name} {student.last_name}
                                        </TableCell>
                                        <TableCell>{student.email}</TableCell>
                                        <TableCell>
                                          <code className="text-sm">{(student as any).exceedce_license || student.license_number || 'N/A'}</code>
                                        </TableCell>
                                        <TableCell>{student.date_completed || 'N/A'}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
