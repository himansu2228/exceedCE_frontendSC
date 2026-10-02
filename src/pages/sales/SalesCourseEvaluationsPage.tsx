import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Star } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getCourseEvaluations, type CourseEvaluationRecord, type CourseEvaluationsResponse } from '@/lib/api'

const STATE_NAMES: Record<string, string> = {
  CA: 'California', CO: 'Colorado', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  MI: 'Michigan', MO: 'Missouri', MT: 'Montana', NC: 'North Carolina', NV: 'Nevada',
  OR: 'Oregon', PA: 'Pennsylvania', SC: 'South Carolina', WA: 'Washington',
}

function courseName(record: CourseEvaluationRecord): string {
  if (record.courseName) return record.courseName
  const course = record.course
  if (typeof course === 'string' && course.trim()) return course.trim()
  if (course && typeof course === 'object') return course.name || course.title || `Course ${course.id ?? 'unknown'}`
  return record.course_name || record.course_title || 'Unknown course'
}

function courseState(record: CourseEvaluationRecord): string | null {
  return courseName(record).match(/^([A-Z]{2})\s/)?.[1] || null
}

function score(record: CourseEvaluationRecord): number | null {
  const value = Number(record.rating)
  return record.rating !== null && record.rating !== undefined && record.rating !== '' && Number.isFinite(value) && value >= 1 && value <= 5 ? value : null
}

function monthKey(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 7)
}

function ChartPanel({ title, detail, children }: { title: string; detail: string; children: React.ReactElement }) {
  return (
    <Card className="min-w-0 border-slate-200">
      <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle><p className="text-sm text-slate-500">{detail}</p></CardHeader>
      <CardContent><div className="h-72 w-full min-w-0"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></CardContent>
    </Card>
  )
}

export function SalesCourseEvaluationsPage() {
  const [data, setData] = useState<CourseEvaluationsResponse | null>(null)
  const [selectedCourse, setSelectedCourse] = useState('all')
  const [selectedState, setSelectedState] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    setLoading(true)
    setError('')
    try {
      setData(await getCourseEvaluations(refresh))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load course evaluations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void getCourseEvaluations()
      .then(setData)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load course evaluations.'))
      .finally(() => setLoading(false))
  }, [])

  const states = useMemo(() => [...new Set((data?.records || []).map(courseState).filter((state): state is string => Boolean(state)))].sort(), [data])
  const stateRecords = useMemo(() => (data?.records || []).filter((record) => selectedState === 'all' || courseState(record) === selectedState), [data, selectedState])
  const courses = useMemo(() => [...new Set(stateRecords.map(courseName))].sort(), [stateRecords])
  const records = useMemo(() => stateRecords.filter((record) => selectedCourse === 'all' || courseName(record) === selectedCourse), [stateRecords, selectedCourse])
  const scored = records.map((record) => ({ record, rating: score(record) })).filter((item): item is { record: CourseEvaluationRecord; rating: number } => item.rating !== null)
  const average = scored.length ? scored.reduce((sum, item) => sum + item.rating, 0) / scored.length : null
  const written = records.filter((record) => String(record.reviews || record.review || '').trim()).length

  const distribution = [1, 2, 3, 4, 5].map((rating) => ({ label: `${rating} star${rating === 1 ? '' : 's'}`, count: scored.filter((item) => Math.round(item.rating) === rating).length }))
  const monthlyMap = new Map<string, { month: string; count: number; sum: number; rated: number }>()
  for (const record of records) {
    const month = monthKey(record.submissionDate || record.created_at)
    if (!month) continue
    const bucket = monthlyMap.get(month) || { month, count: 0, sum: 0, rated: 0 }
    bucket.count += 1
    const rating = score(record)
    if (rating !== null) { bucket.sum += rating; bucket.rated += 1 }
    monthlyMap.set(month, bucket)
  }
  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)).map((item) => ({ ...item, average: item.rated ? Number((item.sum / item.rated).toFixed(2)) : null }))

  const byCourse = new Map<string, { course: string; count: number; sum: number; rated: number }>()
  for (const record of records) {
    const name = courseName(record)
    const bucket = byCourse.get(name) || { course: name, count: 0, sum: 0, rated: 0 }
    bucket.count += 1
    const rating = score(record)
    if (rating !== null) { bucket.sum += rating; bucket.rated += 1 }
    byCourse.set(name, bucket)
  }
  const courseRows = [...byCourse.values()].map((item) => ({ ...item, average: item.rated ? Number((item.sum / item.rated).toFixed(2)) : null }))
  const mostReviewed = [...courseRows].sort((a, b) => b.count - a.count).slice(0, 8)
  const highestRated = [...courseRows].filter((item) => item.rated >= 2).sort((a, b) => (b.average || 0) - (a.average || 0)).slice(0, 8)
  const axisName = (value: string) => value.length > 22 ? `${value.slice(0, 20)}…` : value

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase text-teal-700">Learner feedback</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Course Evaluation</h1><p className="mt-1 text-sm text-slate-600">Rating trends and course feedback from ExceedCE.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedState} onValueChange={(value) => { setSelectedState(value); setSelectedCourse('all') }}><SelectTrigger className="w-48" aria-label="Filter by course state"><SelectValue placeholder="All states" /></SelectTrigger><SelectContent><SelectItem value="all">All states</SelectItem>{states.map((code) => <SelectItem key={code} value={code}>{STATE_NAMES[code] ? `${STATE_NAMES[code]} (${code})` : code}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}><SelectTrigger className="w-56" aria-label="Filter by course"><SelectValue placeholder="All courses" /></SelectTrigger><SelectContent><SelectItem value="all">All courses</SelectItem>{courses.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" disabled={loading} onClick={() => void load(true)}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </header>

      {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {loading && !data ? <p className="py-12 text-center text-sm text-slate-500">Loading evaluations…</p> : data && <>
        {data.truncated && <p role="status" className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">Showing {data.records.length.toLocaleString()} of {data.total.toLocaleString()} evaluations. Charts may not include older entries.</p>}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Evaluation summary">
          {[['Evaluations', records.length.toLocaleString()], ['Average rating', average === null ? 'No ratings' : `${average.toFixed(2)} / 5`], ['Written reviews', written.toLocaleString()], ['Courses', courseRows.length.toLocaleString()]].map(([label, value]) => <div key={label} className="border-t-2 border-teal-600 bg-slate-50 px-5 py-4"><p className="text-xs font-medium uppercase text-slate-500">{label}</p><p className="mt-2 flex items-center gap-2 text-xl font-semibold text-slate-900">{label === 'Average rating' && <Star className="h-4 w-4 fill-amber-400 text-amber-500" />}{value}</p></div>)}
        </section>
        {records.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">No evaluations found for this course.</p> : <div className="grid gap-4 xl:grid-cols-2">
          <ChartPanel title="Rating distribution" detail="Number of evaluations by star rating"><BarChart data={distribution} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="Evaluations" radius={[4, 4, 0, 0]}>{distribution.map((item) => <Cell key={item.label} fill={item.count ? '#0d9488' : '#cbd5e1'} />)}</Bar></BarChart></ChartPanel>
          <ChartPanel title="Evaluation activity" detail="Evaluations submitted each month"><LineChart data={monthly} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="count" name="Evaluations" stroke="#0d9488" strokeWidth={2} /></LineChart></ChartPanel>
          <ChartPanel title="Top-rated courses" detail="Average score, minimum two ratings"><BarChart layout="vertical" data={highestRated} margin={{ top: 4, right: 16, bottom: 4, left: 12 }}><CartesianGrid stroke="#e2e8f0" horizontal={false} /><XAxis type="number" domain={[0, 5]} /><YAxis type="category" dataKey="course" width={125} tickFormatter={axisName} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="average" name="Average rating" fill="#d97706" radius={[0, 4, 4, 0]} /></BarChart></ChartPanel>
          <ChartPanel title="Most evaluated courses" detail="Courses with the most learner feedback"><BarChart layout="vertical" data={mostReviewed} margin={{ top: 4, right: 16, bottom: 4, left: 12 }}><CartesianGrid stroke="#e2e8f0" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="course" width={125} tickFormatter={axisName} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" name="Evaluations" fill="#2563eb" radius={[0, 4, 4, 0]} /></BarChart></ChartPanel>
        </div>}
      </>}
    </div>
  )
}