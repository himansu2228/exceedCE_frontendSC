import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, Pencil, Presentation, RefreshCw, Search } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { getSurveyCourses, getSurveyReport, type SurveyCourse, type SurveyReportResponse } from '@/lib/api'
import {
  COMMENT_CATEGORIES, RATING_LEVELS, classifyQuestion, collectComments, defaultQuestionLabel, lowRatingShare, parseRating,
  summarizeChoices, summarizeRatings, type CommentCategory, type QuestionConfigMap,
} from '@/lib/surveyReport'

const CONFIG_KEY = 'exceedce.surveyReport.questionConfig'
const CATEGORY_KEY = 'exceedce.surveyReport.commentCategories'

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? initial } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)) }, [key, value])
  return [value, setValue] as const
}

const courseValue = (course: SurveyCourse) => `${course.courseId}:${course.moduleId}`

export function SalesSurveyReportPage() {
  const [courses, setCourses] = useState<SurveyCourse[]>([])
  const [query, setQuery] = useState('')
  const [typing, setTyping] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [selected, setSelected] = useState('')
  const [report, setReport] = useState<SurveyReportResponse | null>(null)
  const [config, setConfig] = useStoredState<QuestionConfigMap>(CONFIG_KEY, {})
  const [categoryOverrides, setCategoryOverrides] = useStoredState<Record<string, CommentCategory>>(CATEGORY_KEY, {})
  const [categoryFilter, setCategoryFilter] = useState<'All' | CommentCategory>('All')
  const [detailQuestion, setDetailQuestion] = useState<string | null>(null)
  const [detailCommentKey, setDetailCommentKey] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState(false)
  const skipLabelSave = useRef(false)
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void getSurveyCourses()
      .then(setCourses)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load survey courses.'))
      .finally(() => setLoadingCourses(false))
  }, [])

  const loadReport = async (value: string, refresh = false) => {
    const course = courses.find((item) => courseValue(item) === value)
    if (!course) return
    setLoadingReport(true)
    setError('')
    try {
      setReport(await getSurveyReport(course.courseId, course.moduleId, refresh))
    } catch (cause) {
      setReport(null)
      setError(cause instanceof Error ? cause.message : 'Unable to load the survey report.')
    } finally {
      setLoadingReport(false)
    }
  }

  const visibleCourses = useMemo(() => courses
    .filter((course) => course.count > 0 && (!typing || course.courseName.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((left, right) => left.courseName.localeCompare(right.courseName)), [courses, query, typing])
  const selectedCourse = courses.find((course) => courseValue(course) === selected)

  const chooseCourse = (course: SurveyCourse) => {
    const value = courseValue(course)
    setSelected(value)
    setQuery(course.courseName)
    setTyping(false)
    setListOpen(false)
    void loadReport(value)
  }

  const kinds = useMemo(() => report ? Object.fromEntries(report.questions.map((question) => [question, classifyQuestion(report, question)])) : {}, [report])
  const questionsOfKind = (kind: string) => (report?.questions || []).filter((question) => kinds[question] === kind)

  const ratingRows = useMemo(() => report ? summarizeRatings(report, questionsOfKind('rating'), config) : [], [report, kinds, config]) // eslint-disable-line react-hooks/exhaustive-deps
  const choiceRows = useMemo(() => report ? summarizeChoices(report, questionsOfKind('choice'), config) : [], [report, kinds, config]) // eslint-disable-line react-hooks/exhaustive-deps
  const comments = useMemo(() => (report ? collectComments(report, questionsOfKind('text'), config) : []).map((comment) => ({ ...comment, category: categoryOverrides[comment.key] || comment.suggested })), [report, kinds, config, categoryOverrides]) // eslint-disable-line react-hooks/exhaustive-deps
  const low = lowRatingShare(ratingRows)
  const visibleComments = comments.filter((comment) => categoryFilter === 'All' || comment.category === categoryFilter)

  const chartData = ratingRows.map((row) => ({
    question: row.question,
    label: row.label,
    total: row.total,
    ...Object.fromEntries(row.counts.flatMap((count, index) => [[`p${index + 1}`, row.total ? (count / row.total) * 100 : 0], [`n${index + 1}`, count]])),
  }))

  const detailRow = ratingRows.find((row) => row.question === detailQuestion) ?? null
  const detailLowStudents = report && detailRow ? report.responses.filter((response) => { const rating = parseRating(response.answers[detailRow.question] || ''); return rating === 1 || rating === 2 }) : []
  const detailAverage = detailRow?.total ? detailRow.counts.reduce((sum, count, index) => sum + count * (index + 1), 0) / detailRow.total : null
  const detailComment = comments.find((comment) => comment.key === detailCommentKey) ?? null
  const detailCommentResponse = report && detailComment ? report.responses.find((response) => response.id === detailComment.responseId) : undefined

  const exportReport = async (format: 'pptx' | 'xlsx') => {
    if (!report) return
    setExporting(true)
    try {
      if (format === 'pptx') {
        const { exportSurveyDeck } = await import('../../lib/exportSurveyPptx.ts')
        await exportSurveyDeck({ courseName: report.courseName, studentCount: report.total, rows: ratingRows, lowShare: low.share, comments })
      } else {
        const { exportSurveyWorkbook } = await import('../../lib/exportSurveyXlsx.ts')
        exportSurveyWorkbook({ report, rows: ratingRows, lowShare: low.share, comments })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to export the report.')
    } finally {
      setExporting(false)
    }
  }

  const updateConfig = (question: string, patch: { label?: string; hidden?: boolean }) =>
    setConfig((current) => ({ ...current, [question]: { ...current[question], ...patch } }))

  const saveLabel = (question: string, value: string) => {
    if (skipLabelSave.current) { skipLabelSave.current = false; return }
    const label = value.trim()
    updateConfig(question, { label: label === defaultQuestionLabel(question) ? '' : label })
    setEditingLabel(false)
  }

  const allVisible = !!report && report.questions.every((question) => !config[question]?.hidden)
  const setAllVisible = (visible: boolean) => {
    if (!report) return
    setConfig((current) => ({ ...current, ...Object.fromEntries(report.questions.map((question) => [question, { ...current[question], hidden: !visible }])) }))
  }

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-semibold uppercase text-teal-700">Course Evaluation</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Survey Report</h1></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-[32rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9" role="combobox" aria-expanded={listOpen} aria-controls="survey-course-list" aria-label="Search courses"
              placeholder={loadingCourses ? 'Loading courses…' : 'Search courses'} disabled={loadingCourses} value={query}
              onFocus={(event) => { setListOpen(true); event.currentTarget.select() }}
              onBlur={() => { setListOpen(false); setTyping(false); setQuery(selectedCourse?.courseName ?? '') }}
              onChange={(event) => { setQuery(event.target.value); setTyping(true); setListOpen(true); setHighlight(0) }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') { event.preventDefault(); setListOpen(true); setHighlight((current) => Math.min(visibleCourses.length - 1, current + 1)) }
                else if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((current) => Math.max(0, current - 1)) }
                else if (event.key === 'Enter' && listOpen && visibleCourses[highlight]) { event.preventDefault(); chooseCourse(visibleCourses[highlight]) }
                else if (event.key === 'Escape') event.currentTarget.blur()
              }}
            />
            {listOpen && <ul id="survey-course-list" role="listbox" className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-md">
              {visibleCourses.length === 0 ? <li className="px-3 py-2 text-sm text-slate-500">No courses found</li> : visibleCourses.map((course, index) => (
                <li key={courseValue(course)} role="option" aria-selected={courseValue(course) === selected} onMouseDown={(event) => { event.preventDefault(); chooseCourse(course) }} onMouseEnter={() => setHighlight(index)} className={`cursor-pointer px-3 py-2 text-sm ${index === highlight ? 'bg-slate-100' : ''} ${courseValue(course) === selected ? 'font-semibold text-teal-700' : 'text-slate-800'}`}>{course.courseName} <span className="text-slate-500">({course.count})</span></li>
              ))}
            </ul>}
          </div>          <Button variant="outline" disabled={!selected || loadingReport} onClick={() => void loadReport(selected, true)}><RefreshCw className={`mr-2 h-4 w-4 ${loadingReport ? 'animate-spin' : ''}`} />Refresh</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button disabled={!report || exporting}><Download className="mr-2 h-4 w-4" />Export<ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!ratingRows.length} onSelect={() => void exportReport('pptx')}><Presentation className="mr-2 h-4 w-4" />PowerPoint (.pptx)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportReport('xlsx')}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel (.xlsx)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {!report && !loadingReport && <p className="py-12 text-center text-sm text-slate-500">Select a course to see its survey results.</p>}
      {loadingReport && <p className="py-12 text-center text-sm text-slate-500">Loading survey responses…</p>}

      {report && !loadingReport && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Survey summary">
          {[['Students', report.total.toLocaleString()], ['Rating questions', ratingRows.length.toLocaleString()], ['Low ratings (1-2)', low.share === null ? 'No ratings' : `${(low.share * 100).toFixed(1)}%`], ['Comments', comments.length.toLocaleString()]].map(([label, value]) => (
            <div key={label} className="border-t-2 border-teal-600 bg-slate-50 px-5 py-4"><p className="text-xs font-medium uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-900">{value}</p></div>
          ))}
        </section>

        <Card className="border-slate-200">
          <CardHeader className="pb-3"><CardTitle className="text-lg text-blue-700">{report.courseName}</CardTitle><p className="text-sm text-slate-500">{report.total} students · {report.surveyName} · N/A answers excluded</p></CardHeader>
          <CardContent>
            {ratingRows.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">This survey has no 1-5 rating questions.</p> : (
              <div style={{ height: Math.max(320, ratingRows.length * 46 + 110) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={chartData} margin={{ top: 16, right: 24, bottom: 8, left: 8 }} style={{ cursor: 'pointer' }} onClick={(state) => {
                    if (state.activeTooltipIndex == null) return
                    const row = chartData[Number(state.activeTooltipIndex)]
                    if (row) setDetailQuestion(row.question)
                  }}>
                    <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                    <YAxis type="category" dataKey="label" width={190} interval={0} tick={({ x, y, payload }: { x?: string | number; y?: string | number; payload?: { value: string } }) => {
                      const row = chartData.find((item) => item.label === payload?.value)
                      return <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} className="cursor-pointer fill-slate-700 hover:fill-teal-700" onClick={() => row && setDetailQuestion(row.question)}>{payload?.value}</text>
                    }} />
                    <Tooltip formatter={(value, name, item) => { const index = RATING_LEVELS.findIndex((level) => level.label === name) + 1; return `${Number(value).toFixed(1)}% (${(item.payload as Record<string, number>)[`n${index}`]})` }} />
                    <Legend wrapperStyle={{ fontWeight: 700, fontSize: 13 }} />
                    {RATING_LEVELS.map((level) => (
                      <Bar key={level.value} dataKey={`p${level.value}`} name={level.label} stackId="ratings" fill={level.color}>
                        <LabelList dataKey={`p${level.value}`} position="center" fill="#ffffff" fontSize={11} formatter={(value) => Number(value) >= 6 ? `${Math.round(Number(value))}%` : ''} />
                      </Bar>
                    ))}
                    {low.share !== null && <ReferenceLine x={low.share * 100} stroke="#dc2626" strokeWidth={2} strokeDasharray="6 4" label={{ value: `${(low.share * 100).toFixed(1)}% low`, position: 'top', fill: '#dc2626', fontSize: 12 }} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <details className="rounded-md border border-slate-200">
          <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Question visibility ({report.questions.length} questions)</summary>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-slate-600"><tr><th className="px-4 py-2"><label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-teal-600" checked={allVisible} onChange={(event) => setAllVisible(event.target.checked)} aria-label="Check all or uncheck all questions" />{allVisible ? 'Uncheck all' : 'Check all'}</label></th><th className="px-4 py-2">Original question</th><th className="px-4 py-2">Type</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{report.questions.map((question) => (
                <tr key={question}>
                  <td className="px-4 py-2"><input type="checkbox" className="h-4 w-4 accent-teal-600" checked={!config[question]?.hidden} onChange={(event) => updateConfig(question, { hidden: !event.target.checked })} aria-label={`Show ${question}`} /></td>
                  <td className="px-4 py-2">{question}</td>
                  <td className="px-4 py-2 capitalize text-slate-500">{kinds[question]}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </details>

        {choiceRows.length > 0 && <section className="space-y-2" aria-label="Yes and no questions">
          <h2 className="text-lg font-semibold">Yes / No questions</h2>
          <div className="grid gap-3 md:grid-cols-2">{choiceRows.map((row) => (
            <div key={row.question} className="rounded-md border border-slate-200 p-4"><p className="text-sm font-medium text-slate-800">{row.label}</p><p className="mt-2 text-sm text-slate-600">{row.counts.map((item) => `${item.answer}: ${item.count}`).join(' · ') || 'No answers'}</p></div>
          ))}</div>
        </section>}

        <section className="space-y-3" aria-label="Student comments">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Student comments ({visibleComments.length})</h2>
            <div className="flex flex-wrap gap-1">{(['All', ...COMMENT_CATEGORIES] as const).map((category) => (
              <button key={category} type="button" onClick={() => setCategoryFilter(category)} className={`rounded-sm px-3 py-1.5 text-sm font-medium ${categoryFilter === category ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{category} ({category === 'All' ? comments.length : comments.filter((comment) => comment.category === category).length})</button>
            ))}</div>
          </div>
          {visibleComments.length === 0 ? <p className="py-6 text-sm text-slate-500">No comments in this category.</p> : <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">{visibleComments.map((comment) => (
            <li key={comment.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <button type="button" className="min-w-0 flex-1 text-left hover:text-teal-700" onClick={() => setDetailCommentKey(comment.key)}><p className="text-sm">{comment.text}</p><p className="mt-1 text-xs text-slate-500">{comment.name} · {comment.questionLabel}</p></button>
              <select className="h-8 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-sm" value={comment.category} aria-label="Comment category" onChange={(event) => setCategoryOverrides((current) => ({ ...current, [comment.key]: event.target.value as CommentCategory }))}>{COMMENT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select>
            </li>
          ))}</ul>}
        </section>
      </>}

      <Dialog open={detailRow !== null} onOpenChange={(open) => { if (!open) { setDetailQuestion(null); setEditingLabel(false) } }}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden">
          {detailRow && <>
            <DialogHeader className="pr-6">
              <div className="flex items-center gap-2">
                <DialogTitle className={editingLabel ? 'sr-only' : 'break-words leading-normal'}>{detailRow.label}</DialogTitle>
                {editingLabel
                  ? <Input autoFocus className="h-9 text-base font-semibold" defaultValue={detailRow.label} aria-label="Short label" onBlur={(event) => saveLabel(detailRow.question, event.currentTarget.value)} onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                    if (event.key === 'Escape') { event.stopPropagation(); skipLabelSave.current = true; setEditingLabel(false) }
                  }} />
                  : <button type="button" className="shrink-0 rounded-sm p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Edit short label" onClick={() => setEditingLabel(true)}><Pencil className="h-4 w-4" /></button>}
              </div>
              <DialogDescription>{detailRow.question}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[['Rated', detailRow.total], ['Average', detailAverage === null ? '-' : `${detailAverage.toFixed(2)} / 5`], ['Low (1-2)', `${(((detailRow.counts[0] + detailRow.counts[1]) / detailRow.total) * 100).toFixed(1)}%`], ['N/A', detailRow.na]].map(([label, value]) => (
                  <div key={label} className="border-t-2 border-teal-600 bg-slate-50 px-3 py-2"><p className="text-xs font-medium uppercase text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900">{value}</p></div>
                ))}
              </div>
              <table className="w-full text-left text-sm">
                <thead className="text-slate-600"><tr><th className="py-2">Rating</th><th className="py-2 text-right">Students</th><th className="py-2 text-right">Share</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{[...RATING_LEVELS].reverse().map((level) => (
                  <tr key={level.value}>
                    <td className="py-2"><span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ backgroundColor: level.color }} />{level.value} = {level.label}</td>
                    <td className="py-2 text-right">{detailRow.counts[level.value - 1]}</td>
                    <td className="py-2 text-right">{((detailRow.counts[level.value - 1] / detailRow.total) * 100).toFixed(1)}%</td>
                  </tr>
                ))}</tbody>
              </table>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Students who rated 1 or 2 ({detailLowStudents.length})</h3>
                {detailLowStudents.length === 0 ? <p className="mt-1 text-sm text-slate-500">None.</p> : <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">{detailLowStudents.map((student) => (
                  <li key={student.id} className="flex justify-between gap-3 px-3 py-2"><span className="min-w-0 break-words">{student.name} <span className="text-slate-500">{student.email}</span></span><span className="shrink-0 text-slate-600">{student.answers[detailRow.question]}</span></li>
                ))}</ul>}
              </div>
              <Button type="button" variant="outline" onClick={() => { updateConfig(detailRow.question, { hidden: true }); setDetailQuestion(null) }}>Hide from chart</Button>
            </div>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={detailComment !== null} onOpenChange={(open) => { if (!open) setDetailCommentKey(null) }}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden">
          {detailComment && <>
            <DialogHeader className="pr-6"><DialogTitle className="break-words leading-normal">{detailComment.name}</DialogTitle><DialogDescription>{detailCommentResponse?.email}</DialogDescription></DialogHeader>
            <div className="min-h-0 space-y-5 overflow-y-auto">
              <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{detailComment.text}</p>
              <div className="space-y-1"><p className="text-xs font-medium uppercase text-slate-500">Question</p><p className="text-sm text-slate-700">{detailComment.question}</p></div>
              <div className="space-y-1"><p className="text-xs font-medium uppercase text-slate-500">Category</p>
                <select className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm" value={detailComment.category} aria-label="Comment category" onChange={(event) => setCategoryOverrides((current) => ({ ...current, [detailComment.key]: event.target.value as CommentCategory }))}>{COMMENT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select>
              </div>
              {detailCommentResponse && <div className="space-y-1"><p className="text-xs font-medium uppercase text-slate-500">Ratings from this student</p>
                <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">{ratingRows.filter((row) => detailCommentResponse.answers[row.question]).map((row) => (
                  <li key={row.question} className="flex justify-between gap-3 px-3 py-2"><span className="min-w-0 break-words">{row.label}</span><span className="shrink-0 text-slate-600">{detailCommentResponse.answers[row.question]}</span></li>
                ))}</ul>
              </div>}
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
