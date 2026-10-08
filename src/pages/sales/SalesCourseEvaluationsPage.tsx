import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, Star, X, GitCompareArrows } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getCourseEvaluations, type CourseEvaluationRecord, type CourseEvaluationsResponse } from '@/lib/api'
import { courseKey, courseName, courseState, evaluationSummary, reviewText, score, summarizeCourses } from '@/lib/courseEvaluations'

const STATE_NAMES: Record<string, string> = {
  CA: 'California', CO: 'Colorado', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  MI: 'Michigan', MO: 'Missouri', MT: 'Montana', NC: 'North Carolina', NV: 'Nevada',
  OR: 'Oregon', PA: 'Pennsylvania', SC: 'South Carolina', WA: 'Washington',
}

function monthKey(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 7)
}

const RATING_COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#0891b2', '#0d9488']

function ChartPanel({ title, detail, children, controls, empty }: { title: string; detail: string; children: React.ReactElement; controls?: React.ReactNode; empty?: React.ReactNode }) {
  return (
    <Card className="min-w-0 border-slate-200">
      <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle><p className="text-sm text-slate-500">{detail}</p>{controls}</CardHeader>
      <CardContent><div className="h-72 w-full min-w-0">{empty ?? <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}</div></CardContent>
    </Card>
  )
}

export function SalesCourseEvaluationsPage({ view = 'analytics' }: { view?: 'analytics' | 'comparison' }) {
  const [data, setData] = useState<CourseEvaluationsResponse | null>(null)
  const [selectedCourse, setSelectedCourse] = useState('all')
  const [selectedState, setSelectedState] = useState('all')
  const [ratingState, setRatingState] = useState('all')
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [courseSearch, setCourseSearch] = useState('')
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [details, setDetails] = useState<{ title: string; records: CourseEvaluationRecord[] } | null>(null)
  const [exporting, setExporting] = useState(false)
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
  const courses = useMemo(() => summarizeCourses(stateRecords), [stateRecords])
  const records = useMemo(() => stateRecords.filter((record) => selectedCourse === 'all' || courseKey(record) === selectedCourse), [stateRecords, selectedCourse])
  const scored = records.map((record) => ({ record, rating: score(record) })).filter((item): item is { record: CourseEvaluationRecord; rating: number } => item.rating !== null)
  const average = scored.length ? scored.reduce((sum, item) => sum + item.rating, 0) / scored.length : null
  const written = records.filter((record) => reviewText(record)).length

  const distribution = [1, 2, 3, 4, 5].map((rating) => ({ label: `${rating} star${rating === 1 ? '' : 's'}`, count: scored.filter((item) => Math.round(item.rating) === rating).length }))
  const monthlyMap = new Map<string, { month: string; count: number; sum: number; rated: number; comments: number }>()
  for (const record of records) {
    const month = monthKey(record.submissionDate || record.created_at)
    if (!month) continue
    const bucket = monthlyMap.get(month) || { month, count: 0, sum: 0, rated: 0, comments: 0 }
    bucket.count += 1
    if (reviewText(record)) bucket.comments += 1
    const rating = score(record)
    if (rating !== null) { bucket.sum += rating; bucket.rated += 1 }
    monthlyMap.set(month, bucket)
  }
  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)).map((item) => ({ ...item, average: item.rated ? Number((item.sum / item.rated).toFixed(2)) : null }))

  const courseRows = summarizeCourses(records)
  const visibleCourses = courseRows.filter((row) => row.course.toLowerCase().includes(courseSearch.toLowerCase()))
  const combinedRecords = (data?.records || []).filter((record) => selectedVersions.includes(courseKey(record)))
  const combined = evaluationSummary(combinedRecords)
  const combinedCourses = summarizeCourses(combinedRecords)
  const openCourse = (key: string) => {
    const matching = (data?.records || []).filter((record) => courseKey(record) === key)
    setDetails({ title: matching.length ? courseName(matching[0]) : 'Course evaluations', records: matching })
  }
  const toggleVersion = (key: string) => setSelectedVersions((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  const exportRecords = async (rows: CourseEvaluationRecord[], title: string) => {
    setExporting(true)
    try {
      const { exportEvaluationWorkbook } = await import('../../lib/exportEvaluations.ts')
      exportEvaluationWorkbook(rows, title)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to export evaluations.')
    } finally {
      setExporting(false)
    }
  }
  const mostReviewed = [...courseRows].sort((a, b) => b.count - a.count).slice(0, 8)
  const commentShare = [{ name: 'Written comment', value: written }, { name: 'No written comment', value: records.length - written }]
  const ratingStates = [...new Set(records.map((record) => courseState(record) || 'Unknown'))].sort()
  const stateAverages = ratingStates.map((state) => ({
    state,
    ...evaluationSummary(records.filter((record) => (courseState(record) || 'Unknown') === state)),
  })).filter((state) => state.average !== null).sort((left, right) => (right.average ?? 0) - (left.average ?? 0))
  const courseResponseRatings = courseRows.filter((course) => course.average !== null).sort((left, right) => right.rated - left.rated).slice(0, 8)
  const stateRatingRecords = records.filter((record) => ratingState === 'all' || (courseState(record) || 'Unknown') === ratingState)
  const stateRatings = [1, 2, 3, 4, 5].map((rating) => ({
    label: `${rating} star${rating === 1 ? '' : 's'}`,
    count: stateRatingRecords.filter((record) => { const value = score(record); return value !== null && Math.round(value) === rating }).length,
  }))
  const axisName = (value: string) => value.length > 22 ? `${value.slice(0, 20)}…` : value
  const openRating = (rows: CourseEvaluationRecord[], index: number) => {
    if (!Number.isInteger(index) || index < 0 || index > 4) return
    setDetails({ title: `${index + 1}-star evaluations`, records: rows.filter((record) => {
      const value = score(record)
      return value !== null && Math.round(value) === index + 1
    }) })
  }
  const openMonth = (index: number, commentsOnly?: boolean) => {
    const month = monthly[index]?.month
    if (!month) return
    setDetails({ title: `${month} evaluations`, records: records.filter((record) => monthKey(record.submissionDate || record.created_at) === month && (commentsOnly === undefined || Boolean(reviewText(record)) === commentsOnly)) })
  }

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase text-teal-700">Course Evaluation</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">{view === 'analytics' ? 'Analytics' : 'Comparison'}</h1></div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedState} onValueChange={(value) => { setSelectedState(value); setSelectedCourse('all') }}><SelectTrigger className="w-48" aria-label="Filter by course state"><SelectValue placeholder="All states" /></SelectTrigger><SelectContent><SelectItem value="all">All states</SelectItem>{states.map((code) => <SelectItem key={code} value={code}>{STATE_NAMES[code] ? `${STATE_NAMES[code]} (${code})` : code}</SelectItem>)}</SelectContent></Select>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}><SelectTrigger className="w-56 max-w-full" aria-label="Filter by course"><SelectValue placeholder="All courses" /></SelectTrigger><SelectContent><SelectItem value="all">All courses</SelectItem>{courses.map((row) => <SelectItem key={row.key} value={row.key}>{row.course} {row.courseId !== undefined ? `(ID ${row.courseId})` : ''}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" disabled={loading} onClick={() => void load(true)}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </header>

      {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {loading && !data ? <p className="py-12 text-center text-sm text-slate-500">Loading evaluations…</p> : data && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Evaluation summary">
          {[['Evaluations', records.length.toLocaleString()], ['Average rating', average === null ? 'No ratings' : `${average.toFixed(2)} / 5`], ['Written reviews', written.toLocaleString()], ['Courses', courseRows.length.toLocaleString()]].map(([label, value]) => <div key={label} className="border-t-2 border-teal-600 bg-slate-50 px-5 py-4"><p className="text-xs font-medium uppercase text-slate-500">{label}</p><button disabled={!records.length} onClick={() => setDetails({ title: 'Filtered evaluations', records: label === 'Written reviews' ? records.filter((record) => reviewText(record)) : records })} className="mt-2 flex items-center gap-2 text-left text-xl font-semibold text-slate-900 hover:text-teal-700 hover:underline disabled:no-underline" aria-label={`View ${label.toLowerCase()} records`}>{label === 'Average rating' && <Star className="h-4 w-4 fill-amber-400 text-amber-500" />}{value}</button></div>)}
        </section>
        {view === 'comparison' && <><section className="space-y-3 border-y border-slate-200 py-5" aria-label="Combined course ratings">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Selected versions ({combinedCourses.length})</h2><Button variant="ghost" disabled={!selectedVersions.length} onClick={() => setSelectedVersions([])}><X className="mr-2 h-4 w-4" />Clear selection</Button></div>
          {combinedCourses.length ? <>
            <div className="flex flex-wrap gap-2">{combinedCourses.map((row) => <span key={row.key} className="flex max-w-full items-center gap-2 rounded-md border border-slate-200 px-3 py-1 text-sm"><span className="min-w-0 break-words">{row.course} {row.courseId !== undefined ? `(ID ${row.courseId})` : ''}</span><button className="shrink-0 p-1" title={`Remove ${row.course}`} aria-label={`Remove ${row.course}`} onClick={() => toggleVersion(row.key)}><X className="h-4 w-4" /></button></span>)}</div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3"><button className="font-semibold text-teal-700 hover:underline" onClick={() => setDetails({ title: 'Combined course evaluations', records: combinedRecords })}>Combined rating: {combined.average === null ? 'No ratings' : `${combined.average.toFixed(2)} / 5`}</button><span className="text-sm text-slate-600">{combined.rated} rated responses · {combined.count} evaluations · {combined.comments} comments</span><Button disabled={combinedCourses.length < 2} onClick={() => setComparisonOpen(true)}><GitCompareArrows className="mr-2 h-4 w-4" />Compare ({combinedCourses.length})</Button><Button variant="outline" disabled={exporting} onClick={() => void exportRecords(combinedRecords, 'Combined course evaluations')}><Download className="mr-2 h-4 w-4" />Export selected</Button></div>
          </> : <p className="text-sm text-slate-500">No course versions selected.</p>}
        </section>
        <section className="space-y-3" aria-label="Course versions">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Course versions</h2><div className="flex max-w-full flex-wrap gap-2"><Input className="w-60 max-w-full" placeholder="Search courses" aria-label="Search course versions" value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} /><Button variant="outline" disabled={!records.length || exporting} onClick={() => void exportRecords(records, 'Filtered course evaluations')}><Download className="mr-2 h-4 w-4" />Export filtered</Button></div></div>
          <div className="overflow-x-auto rounded-md border border-slate-200"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">Combine</th><th className="px-4 py-3">Course / LMS ID</th><th className="px-4 py-3">Course state</th><th className="px-4 py-3">Responses</th><th className="px-4 py-3">Average</th><th className="px-4 py-3">Comments</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleCourses.map((row) => <tr key={row.key} className={selectedVersions.includes(row.key) ? 'bg-teal-50/50' : ''}><td className="px-4 py-3"><input type="checkbox" className="h-4 w-4 accent-teal-600" checked={selectedVersions.includes(row.key)} onChange={() => toggleVersion(row.key)} aria-label={`Combine ${row.course} (ID ${row.courseId ?? 'unknown'})`} /></td><td className="max-w-md px-4 py-3"><button onClick={() => openCourse(row.key)} className="text-left font-medium text-teal-700 hover:underline">{row.course}</button><p className="mt-1 text-xs text-slate-500">LMS ID: {row.courseId ?? 'Not provided'}</p></td><td className="px-4 py-3">{row.state || 'Not identified'}</td><td className="px-4 py-3">{row.rated} rated / {row.count} total</td><td className="px-4 py-3"><button onClick={() => openCourse(row.key)} className="font-semibold text-teal-700 hover:underline">{row.average === null ? 'No ratings' : `${row.average.toFixed(2)} / 5`}</button></td><td className="px-4 py-3"><button onClick={() => { const matching = (data.records || []).filter((record) => courseKey(record) === row.key && reviewText(record)); setDetails({ title: `${row.course} comments`, records: matching }) }} className="text-teal-700 hover:underline">{row.comments}</button></td></tr>)}{!visibleCourses.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No matching course versions.</td></tr>}</tbody></table></div>
        </section></>}
        {view === 'analytics' && (records.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">No evaluations found for this course.</p> : <div className="grid gap-4 xl:grid-cols-2">
          <ChartPanel title="Most evaluated courses" detail="Courses with the most learner feedback"><BarChart layout="vertical" data={mostReviewed} margin={{ top: 4, right: 16, bottom: 4, left: 12 }}><CartesianGrid stroke="#e2e8f0" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="course" width={125} tickFormatter={axisName} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" name="Evaluations" fill="#2563eb" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(_entry, index) => openCourse(mostReviewed[index].key)} /></BarChart></ChartPanel>
          <ChartPanel title="Average rating trend" detail="Monthly average of valid responses"><AreaChart data={monthly} margin={{ top: 8, right: 12, bottom: 8, left: 0 }} style={{ cursor: 'pointer' }} onClick={(state) => { if (state.activeTooltipIndex != null) openMonth(Number(state.activeTooltipIndex)) }}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis domain={[1, 5]} /><Tooltip /><Area type="monotone" dataKey="average" name="Average rating" stroke="#2563eb" fill="#bfdbfe" strokeWidth={2} connectNulls={false} /></AreaChart></ChartPanel>
          <ChartPanel title="Written feedback" detail={`${written} comments across ${records.length} evaluations`}><PieChart><Pie data={commentShare} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="78%" paddingAngle={2} cursor="pointer" onClick={(_entry, index) => setDetails({ title: commentShare[index].name, records: records.filter((record) => Boolean(reviewText(record)) === (index === 0)) })}>{commentShare.map((item, index) => <Cell key={item.name} fill={index === 0 ? '#0891b2' : '#cbd5e1'} />)}</Pie><Tooltip /><Legend /></PieChart></ChartPanel>
          <ChartPanel title="Ratings by state" detail={`${evaluationSummary(stateRatingRecords).rated} rated responses`} controls={
            <Select value={ratingState} onValueChange={setRatingState}><SelectTrigger className="w-56 max-w-full" aria-label="Select state for rating distribution"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All filtered states</SelectItem>{[...new Set([...ratingStates, ...(ratingState !== 'all' ? [ratingState] : [])])].sort().map((state) => <SelectItem key={state} value={state}>{STATE_NAMES[state] ? `${STATE_NAMES[state]} (${state})` : state}</SelectItem>)}</SelectContent></Select>
          }>
            <BarChart layout="vertical" data={stateRatings} margin={{ top: 8, right: 20, bottom: 8, left: 4 }} style={{ cursor: 'pointer' }} onClick={(state) => { if (state.activeTooltipIndex != null) openRating(stateRatingRecords, Number(state.activeTooltipIndex)) }}>
              <CartesianGrid stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={65} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: '#0d9488', fillOpacity: 0.08 }} />
              <Bar dataKey="count" name="Rated responses" radius={[0, 4, 4, 0]}>{stateRatings.map((item, index) => <Cell key={item.label} fill={RATING_COLORS[index]} />)}</Bar>
            </BarChart>
          </ChartPanel>
          <ChartPanel title="Rating share" detail={`${scored.length} valid rated responses`}>
            <PieChart>
              <Pie data={distribution} dataKey="count" nameKey="label" outerRadius="75%" paddingAngle={1} cursor="pointer" onClick={(_entry, index) => openRating(records, index)}>
                {distribution.map((item, index) => <Cell key={item.label} fill={RATING_COLORS[index]} />)}
              </Pie>
              <Tooltip formatter={(value) => { const count = Number(value); return `${count} responses (${scored.length ? (count / scored.length * 100).toFixed(1) : '0'}%)` }} />
              <Legend />
            </PieChart>
          </ChartPanel>
          <ChartPanel title="Written feedback by month" detail="Comments and evaluations without comments">
            <BarChart data={monthly.map((month) => ({ ...month, withoutComments: month.count - month.comments }))} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip /><Legend />
              <Bar dataKey="comments" name="Written comment" stackId="feedback" fill="#0891b2" cursor="pointer" onClick={(_entry, index) => openMonth(index, true)} />
              <Bar dataKey="withoutComments" name="No comment" stackId="feedback" fill="#cbd5e1" cursor="pointer" onClick={(_entry, index) => openMonth(index, false)} />
            </BarChart>
          </ChartPanel>
          <ChartPanel title="Average rating by state" detail="Response-weighted average for each course state">
            <BarChart layout="vertical" data={stateAverages} margin={{ top: 8, right: 20, bottom: 8, left: 4 }} style={{ cursor: 'pointer' }} onClick={(chart) => {
              if (chart.activeTooltipIndex == null) return
              const state = stateAverages[Number(chart.activeTooltipIndex)]?.state
              if (state) setDetails({ title: `${state} evaluations`, records: records.filter((record) => (courseState(record) || 'Unknown') === state) })
            }}>
              <CartesianGrid stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" domain={[0, 5]} />
              <YAxis type="category" dataKey="state" width={65} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => Number(value).toFixed(2)} />
              <Bar dataKey="average" name="Average rating" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartPanel>
          <ChartPanel title="Course ratings and response volume" detail="Eight most-rated versions: responses and average score">
            <ComposedChart data={courseResponseRatings} margin={{ top: 12, right: 4, bottom: 4, left: 0 }} style={{ cursor: 'pointer' }} onClick={(chart) => {
              if (chart.activeTooltipIndex == null) return
              const course = courseResponseRatings[Number(chart.activeTooltipIndex)]
              if (course) openCourse(course.key)
            }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="key" tickFormatter={(key) => { const index = courseResponseRatings.findIndex((course) => course.key === key); return `#${index + 1}` }} tick={{ fontSize: 12 }} />
              <YAxis yAxisId="responses" allowDecimals={false} width={40} />
              <YAxis yAxisId="rating" orientation="right" domain={[0, 5]} width={28} />
              <Tooltip content={({ active, payload }) => {
                const course = payload?.[0]?.payload as (typeof courseResponseRatings)[number] | undefined
                return active && course ? <div className="max-w-64 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-sm"><p className="font-medium text-slate-900">{course.course}</p><p className="mt-1 text-slate-600">{course.rated} rated responses</p><p className="text-slate-600">Average: {course.average?.toFixed(2)} / 5</p></div> : null
              }} />
              <Legend />
              <Bar yAxisId="responses" dataKey="rated" name="Rated responses" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Line yAxisId="rating" dataKey="average" name="Average / 5" stroke="#d97706" strokeWidth={3} dot={{ r: 5, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 7 }} />
            </ComposedChart>
          </ChartPanel>
        </div>)}
      </>}
      <Dialog open={details !== null} onOpenChange={(open) => { if (!open) setDetails(null) }}><DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden"><DialogHeader className="pr-6"><DialogTitle className="break-words leading-normal">{details?.title}</DialogTitle><DialogDescription>ExceedCE evaluation records</DialogDescription></DialogHeader>{details && <EvaluationDetails records={details.records} exporting={exporting} onExport={(rows) => void exportRecords(rows, details.title)} />}</DialogContent></Dialog>
      <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden">
          <DialogHeader><DialogTitle>Course version comparison</DialogTitle><DialogDescription>{combinedCourses.length} selected versions · {combined.rated} rated responses</DialogDescription></DialogHeader>
          <div className="min-h-0 overflow-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-slate-50"><tr>{['Course / LMS ID', 'State', 'Evaluations', 'Rated responses', 'Average / 5', 'Comments'].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{combinedCourses.map((row) => <tr key={row.key}><td className="max-w-xs px-3 py-3"><button className="text-left font-medium text-teal-700 hover:underline" onClick={() => { setComparisonOpen(false); openCourse(row.key) }}>{row.course}</button><p className="mt-1 text-xs text-slate-500">LMS ID: {row.courseId ?? 'Not provided'}</p></td><td className="px-3 py-3">{row.state || 'Not identified'}</td><td className="px-3 py-3">{row.count}</td><td className="px-3 py-3">{row.rated}</td><td className="px-3 py-3 font-semibold">{row.average?.toFixed(2) ?? 'No ratings'}</td><td className="px-3 py-3">{row.comments}</td></tr>)}</tbody>
              <tfoot className="border-t-2 border-teal-600 bg-teal-50 font-semibold"><tr><td className="px-3 py-3">Combined</td><td className="px-3 py-3">Selected states</td><td className="px-3 py-3">{combined.count}</td><td className="px-3 py-3">{combined.rated}</td><td className="px-3 py-3">{combined.average?.toFixed(2) ?? 'No ratings'}</td><td className="px-3 py-3">{combined.comments}</td></tr></tfoot>
            </table>
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setComparisonOpen(false); setDetails({ title: 'Combined course evaluations', records: combinedRecords }) }}>View evaluations</Button><Button variant="outline" disabled={exporting} onClick={() => void exportRecords(combinedRecords, 'Combined course evaluations')}><Download className="mr-2 h-4 w-4" />Export selected</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EvaluationDetails({ records, exporting, onExport }: { records: CourseEvaluationRecord[]; exporting: boolean; onExport: (rows: CourseEvaluationRecord[]) => void }) {
  const [query, setQuery] = useState('')
  const [rating, setRating] = useState('all')
  const [commentsOnly, setCommentsOnly] = useState(false)
  const [page, setPage] = useState(1)
  const filtered = records.filter((record) => (rating === 'all' || score(record) === Number(rating)) && (!commentsOnly || Boolean(reviewText(record))) && `${courseName(record)} ${reviewText(record)} ${record.userdisplayName || ''}`.toLowerCase().includes(query.toLowerCase()))
  const summary = evaluationSummary(records)
  const pages = Math.max(1, Math.ceil(filtered.length / 25))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25)
  return <>
    <p className="text-sm text-slate-600">Average: {summary.average === null ? 'No ratings' : `${summary.average.toFixed(2)} / 5`} · {summary.rated} rated responses · {summary.count} evaluations · {summary.comments} comments</p>
    <div className="flex flex-wrap items-center gap-3"><Input className="w-60 max-w-full" aria-label="Search evaluations" placeholder="Search comments, course or learner" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /><Select value={rating} onValueChange={(value) => { setRating(value); setPage(1) }}><SelectTrigger className="w-36" aria-label="Filter evaluation rating"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All ratings</SelectItem>{[1, 2, 3, 4, 5].map((value) => <SelectItem key={value} value={String(value)}>{value} stars</SelectItem>)}</SelectContent></Select><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-600" checked={commentsOnly} onChange={(event) => { setCommentsOnly(event.target.checked); setPage(1) }} />Comments only</label><Button variant="outline" disabled={!filtered.length || exporting} onClick={() => onExport(filtered)}><Download className="mr-2 h-4 w-4" />Export records</Button></div>
    <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200"><table className="w-full min-w-[720px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-slate-600"><tr>{['Evaluation ID', 'Course', 'Rating', 'Comment', 'Submitted by', 'Date'].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map((record, index) => <tr key={`${record.id ?? 'record'}-${index}`}><td className="px-3 py-3">{record.id ?? 'Not provided'}</td><td className="max-w-xs px-3 py-3 align-top">{courseName(record)}</td><td className="px-3 py-3 align-top">{score(record) ?? 'Not rated'}</td><td className="min-w-56 max-w-md whitespace-pre-wrap break-words px-3 py-3 align-top">{reviewText(record) || 'No written comment'}</td><td className="px-3 py-3 align-top">{record.userdisplayName || 'Not provided'}</td><td className="px-3 py-3 align-top">{record.submissionDate || record.created_at || 'Not provided'}</td></tr>)}{!filtered.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No matching evaluations.</td></tr>}</tbody></table></div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{filtered.length} records · Page {currentPage} of {pages}</span><div className="flex gap-2"><Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>
  </>
}