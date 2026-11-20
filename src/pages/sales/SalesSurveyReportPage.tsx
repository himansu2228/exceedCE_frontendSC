import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  GitCompareArrows,
  HelpCircle,
  LoaderCircle,
  Pencil,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
import { formatDateRangeLabel } from './shared'
import { getSurveyCourses, getSurveyReport, type SurveyCourse, type SurveyReportResponse } from '@/lib/api'
import {
  COMMENT_CATEGORIES, RATING_LEVELS, classifyQuestion, collectComments, defaultQuestionLabel, lowRatingShare, parseRating,
  summarizeChoices, summarizeRatings, type CommentCategory, type QuestionConfigMap,
} from '@/lib/surveyReport'

const COMPARISON_COLORS = [
  '#0d9488',
  '#2563eb',
  '#d97706',
  '#db2777',
  '#7c3aed',
  '#65a30d',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
  '#be123c',
  '#0f766e',
  '#a16207',
  '#0369a1',
  '#9333ea',
]

function ComparisonChartPanel({
  title,
  detail,
  children,
  chartHeight = 280,
}: {
  title: string
  detail?: string
  children: React.ReactElement
  chartHeight?: number
}) {
  return (
    <Card className="min-w-0 border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
      </CardHeader>
      <CardContent>
        <div className="w-full min-w-0" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

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
  const [listSearch, setListSearch] = useState('')
  const [typing, setTyping] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [selected, setSelected] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [report, setReport] = useState<SurveyReportResponse | null>(null)
  const [config, setConfig] = useStoredState<QuestionConfigMap>(CONFIG_KEY, {})
  const [categoryOverrides, setCategoryOverrides] = useStoredState<Record<string, CommentCategory>>(CATEGORY_KEY, {})
  const [categoryFilter, setCategoryFilter] = useState<'All' | CommentCategory>('All')
  const [commentSort, setCommentSort] = useState<'newest' | 'oldest'>('newest')
  const [detailQuestion, setDetailQuestion] = useState<string | null>(null)
  const [detailCommentKey, setDetailCommentKey] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState(false)
  const skipLabelSave = useRef(false)
  const reportRequest = useRef(0)
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [selectedCourseKeys, setSelectedCourseKeys] = useState<string[]>([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [comparisonView, setComparisonView] = useState<'table' | 'analytics'>('table')
  const [comparisonReportMap, setComparisonReportMap] = useState<Record<string, SurveyReportResponse>>({})
  const [loadingComparison, setLoadingComparison] = useState(false)
  const [comparePickerOpen, setComparePickerOpen] = useState(false)
  const [compareSearch, setCompareSearch] = useState('')

  const selectedRangeLabel = useMemo(() => formatDateRangeLabel(dateRange.fromDate, dateRange.toDate), [dateRange.fromDate, dateRange.toDate])

  useEffect(() => {
    void getSurveyCourses()
      .then(setCourses)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load survey courses.'))
      .finally(() => setLoadingCourses(false))
  }, [])

  const loadReport = async (value: string, refresh = false) => {
    const course = courses.find((item) => courseValue(item) === value)
    if (!course) return
    const request = ++reportRequest.current
    setLoadingReport(true)
    setError('')
    try {
      const data = await getSurveyReport(course.courseId, course.moduleId, refresh)
      if (request === reportRequest.current) setReport(data)
    } catch (cause) {
      if (request !== reportRequest.current) return
      setReport(null)
      setError(cause instanceof Error ? cause.message : 'Unable to load the survey report.')
    } finally {
      if (request === reportRequest.current) setLoadingReport(false)
    }
  }

  const goBack = () => {
    reportRequest.current += 1
    setSelected('')
    setReport(null)
    setDateRange({ fromDate: '', toDate: '' })
    setError('')
    setLoadingReport(false)
    setQuery('')
    setCategoryFilter('All')
    setDetailQuestion(null)
    setDetailCommentKey(null)
  }

  const visibleCourses = useMemo(() => courses
    .filter((course) => course.count > 0 && (!typing || course.courseName.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((left, right) => left.courseName.localeCompare(right.courseName)), [courses, query, typing])
  const selectedCourse = courses.find((course) => courseValue(course) === selected)
  const listCourses = useMemo(() => courses
    .filter((course) => course.count > 0 && course.courseName.toLowerCase().includes(listSearch.trim().toLowerCase()))
    .sort((left, right) => left.courseName.localeCompare(right.courseName)), [courses, listSearch])

  const chooseCourse = (course: SurveyCourse) => {
    const value = courseValue(course)
    setSelected(value)
    setQuery(course.courseName)
    setTyping(false)
    setListOpen(false)
    void loadReport(value)
  }

  const filteredReport = useMemo(() => {
    if (!report) return null
    if (!dateRange.fromDate && !dateRange.toDate) return report
    const responses = report.responses.filter((response) => {
      if (!response.date) return false
      const day = response.date.slice(0, 10)
      return (!dateRange.fromDate || day >= dateRange.fromDate) && (!dateRange.toDate || day <= dateRange.toDate)
    })
    return {
      ...report,
      total: responses.length,
      responses,
    }
  }, [report, dateRange.fromDate, dateRange.toDate])

  const kinds = useMemo(() => filteredReport ? Object.fromEntries(filteredReport.questions.map((question) => [question, classifyQuestion(filteredReport, question)])) : {}, [filteredReport])
  const questionsOfKind = (kind: string) => (filteredReport?.questions || []).filter((question) => kinds[question] === kind)

  const ratingRows = useMemo(() => filteredReport ? summarizeRatings(filteredReport, questionsOfKind('rating'), config) : [], [filteredReport, kinds, config]) // eslint-disable-line react-hooks/exhaustive-deps
  const choiceRows = useMemo(() => filteredReport ? summarizeChoices(filteredReport, questionsOfKind('choice'), config) : [], [filteredReport, kinds, config]) // eslint-disable-line react-hooks/exhaustive-deps
  const comments = useMemo(() => (filteredReport ? collectComments(filteredReport, questionsOfKind('text'), config) : []).map((comment) => ({ ...comment, category: categoryOverrides[comment.key] || comment.suggested })), [filteredReport, kinds, config, categoryOverrides]) // eslint-disable-line react-hooks/exhaustive-deps
  const low = lowRatingShare(ratingRows)
  const visibleComments = comments
    .filter((comment) => categoryFilter === 'All' || comment.category === categoryFilter)
    .sort((left, right) => {
      if (!left.date || !right.date) return left.date ? -1 : right.date ? 1 : 0
      return commentSort === 'newest' ? right.date.localeCompare(left.date) : left.date.localeCompare(right.date)
    })

  const chartData = ratingRows.map((row) => ({
    question: row.question,
    label: row.label,
    total: row.total,
    ...Object.fromEntries(row.counts.flatMap((count, index) => [[`p${index + 1}`, row.total ? (count / row.total) * 100 : 0], [`n${index + 1}`, count]])),
  }))

  const detailRow = ratingRows.find((row) => row.question === detailQuestion) ?? null
  const detailLowStudents = filteredReport && detailRow ? filteredReport.responses.filter((response) => { const rating = parseRating(response.answers[detailRow.question] || ''); return rating === 1 || rating === 2 }) : []
  const detailAverage = detailRow?.total ? detailRow.counts.reduce((sum, count, index) => sum + count * (index + 1), 0) / detailRow.total : null
  const detailComment = comments.find((comment) => comment.key === detailCommentKey) ?? null
  const detailCommentResponse = filteredReport && detailComment ? filteredReport.responses.find((response) => response.id === detailComment.responseId) : undefined

  const exportReport = async (format: 'pptx' | 'xlsx') => {
    if (!filteredReport) return
    setExporting(true)
    try {
      if (format === 'pptx') {
        const { exportSurveyDeck } = await import('../../lib/exportSurveyPptx.ts')
        await exportSurveyDeck({ courseName: filteredReport.courseName, studentCount: filteredReport.total, rows: ratingRows, lowShare: low.share, comments })
      } else {
        const { exportSurveyWorkbook } = await import('../../lib/exportSurveyXlsx.ts')
        exportSurveyWorkbook({ report: filteredReport, rows: ratingRows, lowShare: low.share, comments })
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

  useEffect(() => {
    if (selected && report) {
      setComparisonReportMap((prev) => ({ ...prev, [selected]: report }))
    }
  }, [selected, report])

  useEffect(() => {
    if (!comparisonOpen || selectedCourseKeys.length === 0) return
    let cancelled = false
    const missingKeys = selectedCourseKeys.filter((key) => !comparisonReportMap[key])

    if (missingKeys.length === 0) return

    setLoadingComparison(true)
    Promise.allSettled(
      missingKeys.map(async (key) => {
        const course = courses.find((c) => courseValue(c) === key)
        if (!course) throw new Error('Course not found')
        const data = await getSurveyReport(course.courseId, course.moduleId, false)
        return { key, data }
      })
    ).then((results) => {
      if (cancelled) return
      setComparisonReportMap((prev) => {
        const next = { ...prev }
        for (const res of results) {
          if (res.status === 'fulfilled') {
            next[res.value.key] = res.value.data
          }
        }
        return next
      })
    }).finally(() => {
      if (!cancelled) setLoadingComparison(false)
    })

    return () => { cancelled = true }
  }, [comparisonOpen, selectedCourseKeys, comparisonReportMap, courses])

  const toggleCourseSelection = (key: string) => {
    setSelectedCourseKeys((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    )
  }

  const visibleListCourseKeys = useMemo(() => listCourses.map((c) => courseValue(c)), [listCourses])
  const allVisibleListSelected = visibleListCourseKeys.length > 0 && visibleListCourseKeys.every((k) => selectedCourseKeys.includes(k))

  const toggleAllVisibleList = () => {
    if (allVisibleListSelected) {
      setSelectedCourseKeys((current) => current.filter((k) => !visibleListCourseKeys.includes(k)))
    } else {
      setSelectedCourseKeys((current) => [...new Set([...current, ...visibleListCourseKeys])])
    }
  }

  const matchingCompareCourses = useMemo(() => {
    const q = compareSearch.trim().toLowerCase()
    return q ? courses.filter((c) => c.courseName.toLowerCase().includes(q)) : courses
  }, [courses, compareSearch])

  const comparedCourses = useMemo(() => {
    return selectedCourseKeys.map((key, index) => {
      const courseMeta = courses.find((c) => courseValue(c) === key)
      const rawReport = comparisonReportMap[key]

      if (!rawReport) {
        return {
          key,
          courseName: courseMeta?.courseName || `Course ${key}`,
          color: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
          totalStudents: courseMeta?.count || 0,
          avgRating: null,
          lowShare: null,
          lowCount: 0,
          totalRatings: 0,
          commentsCount: 0,
          starCounts: [0, 0, 0, 0, 0],
          ratingRows: [],
        }
      }

      let rep = rawReport
      if (dateRange.fromDate || dateRange.toDate) {
        const filteredResponses = rawReport.responses.filter((response) => {
          if (!response.date) return false
          const day = response.date.slice(0, 10)
          return (!dateRange.fromDate || day >= dateRange.fromDate) && (!dateRange.toDate || day <= dateRange.toDate)
        })
        rep = { ...rawReport, total: filteredResponses.length, responses: filteredResponses }
      }

      const repKinds = Object.fromEntries(rep.questions.map((q) => [q, classifyQuestion(rep, q)]))
      const ratingQuestions = rep.questions.filter((q) => repKinds[q] === 'rating')
      const textQuestions = rep.questions.filter((q) => repKinds[q] === 'text')
      const rows = summarizeRatings(rep, ratingQuestions, config)
      const comms = collectComments(rep, textQuestions, config)
      const lowData = lowRatingShare(rows)

      const totalRatings = rows.reduce((sum, r) => sum + r.total, 0)
      const weightedSum = rows.reduce((sum, r) => sum + r.counts.reduce((subSum, count, i) => subSum + count * (i + 1), 0), 0)
      const avgRating = totalRatings > 0 ? weightedSum / totalRatings : null

      const starCounts = [0, 0, 0, 0, 0]
      for (const r of rows) {
        for (let i = 0; i < 5; i++) {
          starCounts[i] += r.counts[i]
        }
      }

      return {
        key,
        courseName: courseMeta?.courseName || rep.courseName,
        color: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
        totalStudents: rep.total,
        avgRating,
        lowShare: lowData.share,
        lowCount: lowData.low,
        totalRatings,
        commentsCount: comms.length,
        starCounts,
        ratingRows: rows,
      }
    })
  }, [selectedCourseKeys, comparisonReportMap, courses, dateRange.fromDate, dateRange.toDate, config])

  const comparisonTotals = useMemo(() => {
    const totalStudents = comparedCourses.reduce((sum, c) => sum + c.totalStudents, 0)
    const totalRatings = comparedCourses.reduce((sum, c) => sum + c.totalRatings, 0)
    const totalLow = comparedCourses.reduce((sum, c) => sum + c.lowCount, 0)
    const combinedLowShare = totalRatings > 0 ? totalLow / totalRatings : null
    const totalComments = comparedCourses.reduce((sum, c) => sum + c.commentsCount, 0)

    const allWeightedSum = comparedCourses.reduce((sum, c) => {
      return sum + (c.avgRating !== null ? c.avgRating * c.totalRatings : 0)
    }, 0)
    const combinedAvgRating = totalRatings > 0 ? allWeightedSum / totalRatings : null

    return {
      totalStudents,
      totalRatings,
      combinedLowShare,
      totalComments,
      combinedAvgRating,
    }
  }, [comparedCourses])

  const comparisonQuestionMatrix = useMemo(() => {
    const questionLabels = new Map<string, string>()
    for (const c of comparedCourses) {
      for (const r of c.ratingRows) {
        if (!questionLabels.has(r.label)) {
          questionLabels.set(r.label, r.question)
        }
      }
    }

    return Array.from(questionLabels.entries()).map(([label]) => {
      const courseScores: Record<string, number | null> = {}
      let sum = 0
      let count = 0

      for (const c of comparedCourses) {
        const row = c.ratingRows.find((r) => r.label === label)
        if (row && row.total > 0) {
          const rowAvg = row.counts.reduce((s, cnt, i) => s + cnt * (i + 1), 0) / row.total
          courseScores[c.key] = rowAvg
          sum += rowAvg
          count += 1
        } else {
          courseScores[c.key] = null
        }
      }

      return {
        label,
        courseScores,
        avgOverall: count > 0 ? sum / count : null,
      }
    }).sort((a, b) => a.label.localeCompare(b.label))
  }, [comparedCourses])

  const exportComparisonExcel = async () => {
    try {
      setExporting(true)
      const [XLSX, { formatDataWorksheet }] = await Promise.all([
        import('xlsx-js-style'),
        import('@/lib/excelFormatting'),
      ])

      const summaryRows = comparedCourses.map((c) => [
        c.courseName,
        c.totalStudents,
        c.avgRating !== null ? Number(c.avgRating.toFixed(2)) : 'N/A',
        c.lowShare !== null ? `${(c.lowShare * 100).toFixed(1)}%` : 'N/A',
        c.starCounts[0],
        c.starCounts[1],
        c.starCounts[2],
        c.starCounts[3],
        c.starCounts[4],
        c.commentsCount,
      ])

      const summaryWs = XLSX.utils.aoa_to_sheet([
        ['SURVEY REPORT COMPARISON SUMMARY'],
        ['Course Name', 'Student Responses', 'Avg Rating (/5)', 'Low Rating % (1-2★)', '1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars', 'Comments'],
        ...summaryRows,
        [],
        ['TOTALS / OVERALL', comparisonTotals.totalStudents, comparisonTotals.combinedAvgRating !== null ? Number(comparisonTotals.combinedAvgRating.toFixed(2)) : 'N/A', comparisonTotals.combinedLowShare !== null ? `${(comparisonTotals.combinedLowShare * 100).toFixed(1)}%` : 'N/A', '', '', '', '', '', comparisonTotals.totalComments],
      ])

      formatDataWorksheet(summaryWs, {
        titleRow: 0,
        headerRow: 1,
        dataEndRow: summaryRows.length + 1,
        columnWidths: [38, 18, 16, 20, 10, 10, 10, 10, 10, 14],
      })

      const questionHeaders = ['Question Label', ...comparedCourses.map((c) => c.courseName), 'Overall Average']
      const questionRows = comparisonQuestionMatrix.map((q) => [
        q.label,
        ...comparedCourses.map((c) => (q.courseScores[c.key] !== null && q.courseScores[c.key] !== undefined ? Number(q.courseScores[c.key]!.toFixed(2)) : 'N/A')),
        q.avgOverall !== null ? Number(q.avgOverall.toFixed(2)) : 'N/A',
      ])

      const questionWs = XLSX.utils.aoa_to_sheet([
        ['QUESTION-BY-QUESTION RATING COMPARISON'],
        questionHeaders,
        ...questionRows,
      ])

      formatDataWorksheet(questionWs, {
        titleRow: 0,
        headerRow: 1,
        dataEndRow: questionRows.length + 1,
        columnWidths: [35, ...comparedCourses.map(() => 24), 18],
      })

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary Comparison')
      XLSX.utils.book_append_sheet(wb, questionWs, 'Question Ratings')
      XLSX.writeFile(wb, `survey-comparison-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to export comparison.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Course Evaluation</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Survey Report</h1>
          {selected && selectedRangeLabel ? (
            <p className="mt-1 break-words text-xs font-medium text-teal-700">{selectedRangeLabel}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected ? (
            <>
              <Button variant="outline" onClick={goBack}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
              <Button
                type="button"
                variant={selectedCourseKeys.includes(selected) ? 'default' : 'outline'}
                className={selectedCourseKeys.includes(selected) ? 'bg-teal-700 hover:bg-teal-800 text-white' : ''}
                onClick={() => toggleCourseSelection(selected)}
              >
                <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
                {selectedCourseKeys.includes(selected) ? 'In comparison' : 'Add to comparison'}
              </Button>
              <div className="relative w-full sm:w-[28rem]">
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
              </div>
              <Button variant="outline" disabled={!selected || loadingReport} onClick={() => void loadReport(selected, true)}><RefreshCw className={`mr-2 h-4 w-4 ${loadingReport ? 'animate-spin' : ''}`} />Refresh</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button disabled={!filteredReport || exporting}><Download className="mr-2 h-4 w-4" />Export<ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={!ratingRows.length} onSelect={() => void exportReport('pptx')}><Presentation className="mr-2 h-4 w-4" />PowerPoint (.pptx)</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportReport('xlsx')}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel (.xlsx)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}

          <Popover open={comparePickerOpen} onOpenChange={(open) => { setComparePickerOpen(open); if (!open) setCompareSearch('') }}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={selectedCourseKeys.length >= 2 ? 'default' : 'outline'}
                className={selectedCourseKeys.length >= 2 ? 'bg-teal-700 hover:bg-teal-800 text-white' : ''}
                aria-label="Compare courses"
              >
                <GitCompareArrows className="mr-2 h-4 w-4" />
                Compare{selectedCourseKeys.length > 0 ? ` (${selectedCourseKeys.length})` : ''}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  autoFocus
                  value={compareSearch}
                  onChange={(e) => setCompareSearch(e.target.value)}
                  placeholder="Search courses to compare…"
                  className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
                <span>{selectedCourseKeys.length} of {courses.length} selected</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCourseKeys(matchingCompareCourses.map((c) => courseValue(c)))}
                    className="text-teal-700 hover:underline"
                  >
                    Select filtered
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCourseKeys([])}
                    className="text-slate-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {matchingCompareCourses.length > 0 ? (
                  matchingCompareCourses.map((course) => {
                    const key = courseValue(course)
                    const isChecked = selectedCourseKeys.includes(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCourseSelection(key)}
                        className="flex h-9 w-full items-center justify-between rounded-sm px-3 text-left text-sm hover:bg-accent"
                      >
                        <span className="truncate pr-2">{course.courseName}</span>
                        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isChecked ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300'}`}>
                          {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <p className="p-3 text-center text-xs text-slate-500">No matching courses</p>
                )}
              </div>
              <div className="border-t p-2">
                <Button
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white"
                  size="sm"
                  disabled={selectedCourseKeys.length < 2}
                  onClick={() => {
                    setComparePickerOpen(false)
                    setComparisonOpen(true)
                  }}
                >
                  <GitCompareArrows className="mr-2 h-4 w-4" />
                  Compare Selected ({selectedCourseKeys.length})
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {selectedCourseKeys.length > 0 && (
        <section className="space-y-3 rounded-lg border border-teal-200 bg-gradient-to-r from-teal-50/70 via-sky-50/40 to-white p-4 shadow-sm" aria-label="Selected courses for comparison">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Selected courses for comparison ({selectedCourseKeys.length})
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedCourseKeys([])}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                <X className="mr-1 h-3.5 w-3.5" /> Clear selection
              </Button>
              <Button
                size="sm"
                disabled={selectedCourseKeys.length < 2}
                onClick={() => setComparisonOpen(true)}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                <GitCompareArrows className="mr-1.5 h-4 w-4" />
                Compare ({selectedCourseKeys.length})
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedCourseKeys.map((key) => {
              const course = courses.find((c) => courseValue(c) === key)
              const name = course?.courseName || `Course ${key}`
              return (
                <span
                  key={key}
                  className="flex items-center gap-1.5 rounded-md border border-teal-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm"
                >
                  <span className="max-w-xs truncate">{name}</span>
                  <button
                    type="button"
                    onClick={() => toggleCourseSelection(key)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )
            })}
          </div>
        </section>
      )}

      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <p className="text-sm font-medium text-slate-600">Filter survey responses by date</p>
          <DateRangeFilter value={dateRange} onChange={setDateRange} showLabels={false} showToday className="min-w-0" />
        </div>
      )}

      {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {!selected && <section className="space-y-3" aria-label="Survey courses">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" aria-label="Search courses" placeholder="Search courses" disabled={loadingCourses} value={listSearch} onChange={(event) => setListSearch(event.target.value)} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={listCourses.length === 0}
            onClick={toggleAllVisibleList}
          >
            {allVisibleListSelected ? 'Clear visible' : 'Select all visible'}
          </Button>
        </div>
        {loadingCourses ? <p className="py-8 text-center text-sm text-slate-500">Loading courses…</p> : listCourses.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No courses found</p> : (
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-auto rounded-md border border-slate-200">{listCourses.map((course) => {
            const key = courseValue(course)
            const isChecked = selectedCourseKeys.includes(key)
            return (
              <li key={key} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isChecked ? 'bg-teal-50/50' : 'hover:bg-slate-50'}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded accent-teal-600 cursor-pointer shrink-0"
                  checked={isChecked}
                  onChange={() => toggleCourseSelection(key)}
                  aria-label={`Select ${course.courseName} for comparison`}
                />
                <button type="button" className="flex flex-1 items-center justify-between gap-3 text-left text-sm" onClick={() => chooseCourse(course)}>
                  <span className="min-w-0 break-words font-medium text-slate-900">{course.courseName}</span>
                  <span className="shrink-0 text-slate-500">{course.count} responses</span>
                </button>
              </li>
            )
          })}</ul>
        )}
      </section>}
      {loadingReport && <p className="py-12 text-center text-sm text-slate-500">Loading survey responses…</p>}

      {filteredReport && !loadingReport && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Survey summary">
          {[['Students', filteredReport.total.toLocaleString()], ['Rating questions', ratingRows.length.toLocaleString()], ['Low ratings (1-2)', low.share === null ? 'No ratings' : `${(low.share * 100).toFixed(1)}%`], ['Comments', comments.length.toLocaleString()]].map(([label, value]) => (
            <div key={label} className="border-t-2 border-teal-600 bg-slate-50 px-5 py-4"><p className="text-xs font-medium uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-900">{value}</p></div>
          ))}
        </section>

        <Card className="border-slate-200">
          <CardHeader className="pb-3"><CardTitle className="text-lg text-blue-700">{filteredReport.courseName}</CardTitle><p className="text-sm text-slate-500">{filteredReport.total} students · {filteredReport.surveyName} · N/A answers excluded</p></CardHeader>
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
                    <Legend itemSorter={null} wrapperStyle={{ fontWeight: 700, fontSize: 13 }} />
                    {RATING_LEVELS.map((level) => (
                      <Bar key={level.value} dataKey={`p${level.value}`} name={level.label} stackId="ratings" fill={level.color}>
                        <LabelList dataKey={`p${level.value}`} content={({ x, y, width, height, value }) => {
                          const pct = Number(value)
                          const w = Number(width)
                          if (!pct || w < 22) return null
                          return <text x={Number(x) + w / 2} y={Number(y) + Number(height) / 2} dy={4} textAnchor="middle" fill="#ffffff" fontSize={11} fontWeight={700}>{`${Math.round(pct)}%`}</text>
                        }} />
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
          <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Question visibility ({filteredReport.questions.length} questions)</summary>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-slate-600"><tr><th className="px-4 py-2"><label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-teal-600" checked={allVisible} onChange={(event) => setAllVisible(event.target.checked)} aria-label="Check all or uncheck all questions" />{allVisible ? 'Uncheck all' : 'Check all'}</label></th><th className="px-4 py-2">Original question</th><th className="px-4 py-2">Type</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredReport.questions.map((question) => (
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
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Student comments ({visibleComments.length})</h2>
            <Select value={commentSort} onValueChange={(value) => setCommentSort(value as 'newest' | 'oldest')}>
              <SelectTrigger className="h-9 w-[10.5rem] gap-2 border-slate-200 bg-white text-sm" aria-label="Sort comments"><ArrowUpDown className="h-4 w-4 text-slate-500" /><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="newest">Latest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1">{(['All', ...COMMENT_CATEGORIES] as const).map((category) => (
              <button key={category} type="button" onClick={() => setCategoryFilter(category)} className={`rounded-sm px-3 py-1.5 text-sm font-medium ${categoryFilter === category ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{category} ({category === 'All' ? comments.length : comments.filter((comment) => comment.category === category).length})</button>
            ))}</div>
          </div>
          {visibleComments.length === 0 ? <p className="py-6 text-sm text-slate-500">No comments in this category.</p> : <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">{visibleComments.map((comment) => (
            <li key={comment.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <button type="button" className="min-w-0 flex-1 text-left hover:text-teal-700" onClick={() => setDetailCommentKey(comment.key)}><p className="text-sm">{comment.text}</p><p className="mt-1 text-xs text-slate-500">{comment.name} · {comment.questionLabel}{comment.date ? ` · ${comment.date}` : ''}</p></button>
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

      <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-6xl flex-col overflow-hidden">
          <DialogHeader className="pr-6">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-950">
              <GitCompareArrows className="h-5 w-5 text-teal-700" />
              Course Survey Report Comparison
            </DialogTitle>
            <DialogDescription>
              {comparedCourses.length} selected courses · {comparisonTotals.totalStudents} total student responses
            </DialogDescription>
          </DialogHeader>

          {/* Quick selection chips & Add button inside dialog */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Comparing:</span>
            {comparedCourses.map((c) => (
              <span
                key={c.key}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-xs"
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="max-w-[200px] truncate">{c.courseName}</span>
                <button
                  type="button"
                  onClick={() => toggleCourseSelection(c.key)}
                  className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label={`Remove ${c.courseName}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Add Course
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="flex items-center border-b px-2.5 py-1.5">
                  <Search className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search courses…"
                    value={compareSearch}
                    onChange={(e) => setCompareSearch(e.target.value)}
                    className="h-8 border-0 text-xs shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                  {matchingCompareCourses.map((course) => {
                    const key = courseValue(course)
                    const isChecked = selectedCourseKeys.includes(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCourseSelection(key)}
                        className="flex h-8 w-full items-center justify-between rounded px-2 text-left text-xs hover:bg-slate-100"
                      >
                        <span className="truncate pr-2">{course.courseName}</span>
                        {isChecked && <Check className="h-3.5 w-3.5 text-teal-600 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* View Tab Buttons */}
          <div className="flex gap-1 border-b border-slate-200 pb-2" role="tablist" aria-label="Comparison view">
            <button
              type="button"
              role="tab"
              aria-selected={comparisonView === 'table'}
              onClick={() => setComparisonView('table')}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                comparisonView === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Comparison table
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={comparisonView === 'analytics'}
              onClick={() => setComparisonView('analytics')}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                comparisonView === 'analytics' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              View analytics
            </button>
          </div>

          {loadingComparison ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 py-12 text-center text-sm text-slate-600">
              <LoaderCircle className="h-6 w-6 animate-spin text-teal-700" />
              <p>Loading survey comparison data for selected courses…</p>
            </div>
          ) : comparedCourses.length < 2 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 py-12 text-center text-sm text-slate-600">
              <HelpCircle className="h-8 w-8 text-slate-400" />
              <p className="font-medium text-slate-900">Select at least 2 courses to compare</p>
              <p className="text-xs text-slate-500">Use the checkboxes in the course list or the "Add Course" button above.</p>
            </div>
          ) : comparisonView === 'table' ? (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              {/* Summary table */}
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Course Name</th>
                      <th className="px-3 py-3 text-center">Responses</th>
                      <th className="px-3 py-3 text-right">Avg Rating (/5)</th>
                      <th className="px-3 py-3 text-right">Low Ratings (1-2★)</th>
                      <th className="px-4 py-3 text-center">Rating Breakdown (1★ | 2★ | 3★ | 4★ | 5★)</th>
                      <th className="px-3 py-3 text-center">Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparedCourses.map((course) => (
                      <tr key={course.key} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: course.color }} />
                            <span>{course.courseName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-slate-800">
                          {course.totalStudents.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
                          {course.avgRating !== null ? `${course.avgRating.toFixed(2)} / 5` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-red-700 font-medium">
                          {course.lowShare !== null ? `${(course.lowShare * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex gap-1 text-xs">
                            <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-800" title="1 Star (Unsatisfactory)">{course.starCounts[0]}</span>
                            <span className="rounded bg-orange-100 px-1.5 py-0.5 font-semibold text-orange-800" title="2 Stars (Needs Improvement)">{course.starCounts[1]}</span>
                            <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800" title="3 Stars (Satisfactory)">{course.starCounts[2]}</span>
                            <span className="rounded bg-purple-100 px-1.5 py-0.5 font-semibold text-purple-800" title="4 Stars (Above Average)">{course.starCounts[3]}</span>
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-800" title="5 Stars (Excellent)">{course.starCounts[4]}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-medium text-slate-700">
                          {course.commentsCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-teal-600 bg-teal-50/70 font-semibold text-slate-900">
                    <tr>
                      <td className="px-4 py-3">Totals / Overall</td>
                      <td className="px-3 py-3 text-center">{comparisonTotals.totalStudents.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">{comparisonTotals.combinedAvgRating !== null ? `${comparisonTotals.combinedAvgRating.toFixed(2)} / 5` : '—'}</td>
                      <td className="px-3 py-3 text-right text-red-700">{comparisonTotals.combinedLowShare !== null ? `${(comparisonTotals.combinedLowShare * 100).toFixed(1)}%` : '—'}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-600">{comparisonTotals.totalRatings.toLocaleString()} total ratings</td>
                      <td className="px-3 py-3 text-center">{comparisonTotals.totalComments.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Question-level Rating Comparison Matrix */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Rating Question Comparison (/5 Scale)</h3>
                  <span className="text-xs text-slate-500">{comparisonQuestionMatrix.length} rating questions evaluated</span>
                </div>

                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Question Label</th>
                        {comparedCourses.map((c) => (
                          <th key={c.key} className="px-3 py-3 text-right">
                            <span className="inline-block max-w-[140px] truncate" title={c.courseName}>{c.courseName}</span>
                          </th>
                        ))}
                        <th className="px-3 py-3 text-right font-semibold">Overall Avg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparisonQuestionMatrix.map((q) => (
                        <tr key={q.label} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{q.label}</td>
                          {comparedCourses.map((c) => {
                            const score = q.courseScores[c.key]
                            return (
                              <td key={c.key} className="px-3 py-2.5 text-right tabular-nums">
                                {score !== null && score !== undefined ? (
                                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                                    score >= 4.5 ? 'bg-blue-50 text-blue-800' :
                                    score >= 4.0 ? 'bg-green-50 text-green-800' :
                                    score >= 3.0 ? 'bg-amber-50 text-amber-800' :
                                    'bg-red-50 text-red-800'
                                  }`}>
                                    {score.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                            {q.avgOverall !== null ? q.avgOverall.toFixed(2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* View Analytics */
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-4 md:grid-cols-2">
                <ComparisonChartPanel title="Student Responses by Course" detail="Total respondents per course version">
                  <BarChart data={comparedCourses} margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="courseName"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(name) => (name.length > 15 ? name.slice(0, 13) + '…' : name)}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="totalStudents" name="Students" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ComparisonChartPanel>

                <ComparisonChartPanel title="Average Rating (/5 Scale)" detail="Overall weighted mean rating score">
                  <BarChart
                    data={comparedCourses.map((c) => ({
                      courseName: c.courseName,
                      avgRating: c.avgRating !== null ? Number(c.avgRating.toFixed(2)) : 0,
                    }))}
                    margin={{ top: 8, right: 16, bottom: 20, left: 0 }}
                  >
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="courseName"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(name) => (name.length > 15 ? name.slice(0, 13) + '…' : name)}
                    />
                    <YAxis domain={[0, 5]} />
                    <Tooltip formatter={(value) => `${value} / 5`} />
                    <ReferenceLine y={4.0} stroke="#ca8a04" strokeDasharray="3 3" label="Target (4.0)" />
                    <Bar dataKey="avgRating" name="Average Rating" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ComparisonChartPanel>

                <div className="md:col-span-2">
                  <ComparisonChartPanel
                    title="Low Rating Share (1-2 Stars %)"
                    detail="Percentage of unsatisfactory & needs improvement ratings"
                    chartHeight={260}
                  >
                    <BarChart
                      data={comparedCourses.map((c) => ({
                        courseName: c.courseName,
                        lowSharePct: c.lowShare !== null ? Number((c.lowShare * 100).toFixed(1)) : 0,
                      }))}
                      margin={{ top: 8, right: 16, bottom: 20, left: 0 }}
                    >
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="courseName"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(name) => (name.length > 20 ? name.slice(0, 18) + '…' : name)}
                      />
                      <YAxis domain={[0, 100]} unit="%" />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <ReferenceLine y={10} stroke="#dc2626" strokeDasharray="3 3" label="Threshold (10%)" />
                      <Bar dataKey="lowSharePct" name="Low Rating %" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ComparisonChartPanel>
                </div>

                <div className="md:col-span-2">
                  <ComparisonChartPanel
                    title="Rating Distribution (100% Stacked)"
                    detail="Breakdown of star ratings across compared courses"
                    chartHeight={300}
                  >
                    <BarChart
                      data={comparedCourses.map((c) => {
                        const tot = c.totalRatings || 1
                        return {
                          courseName: c.courseName,
                          p1: (c.starCounts[0] / tot) * 100,
                          p2: (c.starCounts[1] / tot) * 100,
                          p3: (c.starCounts[2] / tot) * 100,
                          p4: (c.starCounts[3] / tot) * 100,
                          p5: (c.starCounts[4] / tot) * 100,
                        }
                      })}
                      margin={{ top: 8, right: 16, bottom: 20, left: 0 }}
                    >
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="courseName"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(name) => (name.length > 20 ? name.slice(0, 18) + '…' : name)}
                      />
                      <YAxis domain={[0, 100]} unit="%" />
                      <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                      <Legend />
                      <Bar dataKey="p1" name="1 Star" fill="#dc2626" stackId="a" />
                      <Bar dataKey="p2" name="2 Stars" fill="#f97316" stackId="a" />
                      <Bar dataKey="p3" name="3 Stars" fill="#16a34a" stackId="a" />
                      <Bar dataKey="p4" name="4 Stars" fill="#7c3aed" stackId="a" />
                      <Bar dataKey="p5" name="5 Stars" fill="#2563eb" stackId="a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ComparisonChartPanel>
                </div>
              </div>
            </div>
          )}

          {/* Dialog Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={exporting || comparedCourses.length < 2}
              onClick={() => void exportComparisonExcel()}
            >
              <FileSpreadsheet className={`mr-2 h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} />
              Export Comparison Excel
            </Button>
            <Button type="button" onClick={() => setComparisonOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
