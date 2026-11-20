import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileSpreadsheet,
  GitCompareArrows,
  HelpCircle,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
import { formatDateRangeLabel } from './shared'
import {
  getQuizCourseOptions,
  getLowAccuracyQuizQuestions,
  getQuizOptions,
  getQuizQuestionDetail,
  type QuizCourseOption,
  type LowAccuracyQuiz,
  type LowAccuracyQuizQuestion,
  type QuizOption,
} from '@/lib/api'

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

function ChartPanel({
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

function AccuracyDisplay({ percentage }: { percentage: number }) {
  const safePercentage = Math.max(0, Math.min(100, percentage))
  const isVeryLow = safePercentage < 40
  const isModerate = safePercentage >= 40 && safePercentage <= 60

  const badgeClass = isVeryLow
    ? 'bg-red-50 text-red-800'
    : isModerate
    ? 'bg-amber-50 text-amber-800'
    : 'bg-emerald-50 text-emerald-800'

  const barClass = isVeryLow ? 'bg-red-500' : isModerate ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="flex w-24 shrink-0 flex-col items-end gap-1.5" aria-label={`${percentage.toFixed(1)} percent correct`}>
      <span className={`rounded-sm px-2 py-1 text-sm font-bold tabular-nums ${badgeClass}`}>
        {percentage.toFixed(1)}%
      </span>
      <span className="text-[11px] font-medium text-slate-500">correct</span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <span className={`block h-full rounded-full ${barClass}`} style={{ width: `${safePercentage}%` }} />
      </span>
    </div>
  )
}

export function SalesQuizQuestionsPage() {
  const [courses, setCourses] = useState<QuizCourseOption[]>([])
  const [quizzes, setQuizzes] = useState<QuizOption[]>([])
  const [questions, setQuestions] = useState<LowAccuracyQuizQuestion[]>([])
  const [qualifyingQuizzes, setQualifyingQuizzes] = useState<LowAccuracyQuiz[]>([])
  const [page, setPage] = useState(1)
  const [pageCursors, setPageCursors] = useState<Record<number, number>>({ 1: 0 })
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loadingPage, setLoadingPage] = useState<number | null>(1)
  const [threshold, setThreshold] = useState(100)
  const [totalQuizzes, setTotalQuizzes] = useState(0)
  const [compareMode, setCompareMode] = useState(false)
  const [unscoredQuestionCount, setUnscoredQuestionCount] = useState(0)
  const [failedQuizCount, setFailedQuizCount] = useState(0)
  const [selectedCourse, setSelectedCourse] = useState('all')
  const [coursePickerOpen, setCoursePickerOpen] = useState(false)
  const [courseSearch, setCourseSearch] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState('all')
  const [quizPickerOpen, setQuizPickerOpen] = useState(false)
  const [quizSearch, setQuizSearch] = useState('')
  const [quizListScrollTop, setQuizListScrollTop] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingQuizzes, setLoadingQuizzes] = useState(true)
  const [error, setError] = useState('')
  const [courseListError, setCourseListError] = useState('')
  const [quizListError, setQuizListError] = useState('')
  const [activeQuestion, setActiveQuestion] = useState<LowAccuracyQuizQuestion | null>(null)
  const [loadingQuestionDetail, setLoadingQuestionDetail] = useState(false)
  const [questionDetailError, setQuestionDetailError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [comparisonView, setComparisonView] = useState<'table' | 'analytics'>('table')
  const [comparisonQuizMap, setComparisonQuizMap] = useState<Record<string, LowAccuracyQuiz>>({})
  const [loadingComparison, setLoadingComparison] = useState(false)
  const [comparePickerOpen, setComparePickerOpen] = useState(false)
  const [compareSearch, setCompareSearch] = useState('')
  const [detailsReturnToComparison, setDetailsReturnToComparison] = useState(false)
  const [activeQuestionTab, setActiveQuestionTab] = useState<string>('all')
  const loadRequestId = useRef(0)
  const questionDetailRequestId = useRef(0)

  const selectedRangeLabel = useMemo(
    () => formatDateRangeLabel(dateRange.fromDate, dateRange.toDate),
    [dateRange.fromDate, dateRange.toDate]
  )

  const openQuestionDetail = async (question: LowAccuracyQuizQuestion) => {
    const requestId = ++questionDetailRequestId.current
    setActiveQuestion(question)
    setLoadingQuestionDetail(true)
    setQuestionDetailError('')
    try {
      const detail = await getQuizQuestionDetail(question.id)
      if (requestId === questionDetailRequestId.current) {
        const options = detail.options?.map((option) => {
          const listedOption = question.options?.find((candidate) => candidate.id === option.id)
            || question.options?.find((candidate) => candidate.text.trim().toLocaleLowerCase() === option.text.trim().toLocaleLowerCase())
          return {
            ...option,
            responseCount: option.responseCount ?? listedOption?.responseCount ?? null,
            selectionPercentage: option.selectionPercentage ?? listedOption?.selectionPercentage ?? null,
          }
        }) || question.options
        setActiveQuestion({
          ...question,
          ...detail,
          question: detail.question || question.question,
          options,
          totalResponses: detail.totalResponses ?? question.totalResponses ?? null,
        })
      }
    } catch (cause) {
      if (requestId === questionDetailRequestId.current) {
        setQuestionDetailError(cause instanceof Error ? cause.message : 'Question details are unavailable.')
      }
    } finally {
      if (requestId === questionDetailRequestId.current) setLoadingQuestionDetail(false)
    }
  }

  const load = async (
    quizId: string = selectedQuiz,
    cursor = 0,
    requestedPage = 1,
    refresh = false,
    courseId = selectedCourse,
    range = dateRange,
    thresholdValue = threshold
  ) => {
    const requestId = ++loadRequestId.current
    setLoading(true)
    setLoadingPage(quizId === 'all' ? requestedPage : null)
    setError('')
    try {
      const result = await getLowAccuracyQuizQuestions(
        quizId,
        cursor,
        refresh,
        courseId,
        range.fromDate || undefined,
        range.toDate || undefined,
        thresholdValue
      )
      if (requestId !== loadRequestId.current) return
      setQuestions(result.questions)
      setQualifyingQuizzes(result.quizzes)
      setThreshold(result.threshold)
      setTotalQuizzes(result.totalQuizzes ?? 0)
      setPage(requestedPage)
      setNextCursor(result.nextCursor)
      setHasNextPage(result.hasNextPage)
      setUnscoredQuestionCount(result.unscoredQuestionCount)
      setFailedQuizCount(result.failedQuizCount)
    } catch (cause) {
      if (requestId !== loadRequestId.current) return
      const message = cause instanceof Error ? cause.message : 'Unable to load quiz questions.'
      setError(quizId === 'all' ? `${message} Select one quiz to load its results separately.` : message)
    } finally {
      if (requestId === loadRequestId.current) {
        setLoading(false)
        setLoadingPage(null)
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    getQuizCourseOptions()
      .then((courseOptions) => {
        if (!cancelled) setCourses(courseOptions)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setCourseListError(cause instanceof Error ? cause.message : 'Unable to load the course list.')
      })
      .finally(() => {
        if (!cancelled) setLoadingCourses(false)
      })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingQuizzes(true)
    setQuizListError('')
    getQuizOptions(false, selectedCourse)
      .then((quizOptions) => {
        if (!cancelled) setQuizzes(quizOptions)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setQuizListError(cause instanceof Error ? cause.message : 'Unable to load the quiz list.')
      })
      .finally(() => {
        if (!cancelled) setLoadingQuizzes(false)
      })

    return () => { cancelled = true }
  }, [selectedCourse])

  useEffect(() => {
    setPage(1)
    setPageCursors({ 1: 0 })
    void load(selectedQuiz, 0, 1, false, selectedCourse, dateRange, threshold)
  }, [dateRange])

  const handleThresholdChange = (newThreshold: number) => {
    setThreshold(newThreshold)
    setPage(1)
    setPageCursors({ 1: 0 })
    setComparisonQuizMap({})
    void load(selectedQuiz, 0, 1, false, selectedCourse, dateRange, newThreshold)
  }

  const handleQuizChange = (quizId: string) => {
    setSelectedQuiz(quizId)
    setQuizPickerOpen(false)
    setQuizSearch('')
    setQuizListScrollTop(0)
    setPage(1)
    setPageCursors({ 1: 0 })
    void load(quizId, 0, 1, false, selectedCourse, dateRange, threshold)
  }

  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId)
    setCoursePickerOpen(false)
    setCourseSearch('')
    setSelectedQuiz('all')
    setPage(1)
    setPageCursors({ 1: 0 })
    void load('all', 0, 1, false, courseId, dateRange, threshold)
  }

  const normalizedSearch = quizSearch.trim().toLocaleLowerCase()
  const normalizedCourseSearch = courseSearch.trim().toLocaleLowerCase()
  const matchingCourses = normalizedCourseSearch
    ? courses.filter((course) => course.name.toLocaleLowerCase().includes(normalizedCourseSearch))
    : courses
  const matchingQuizzes = normalizedSearch
    ? quizzes.filter((quiz) => quiz.name.toLocaleLowerCase().includes(normalizedSearch))
    : quizzes
  const quizOptions = [
    ...(!normalizedSearch || 'all quizzes'.includes(normalizedSearch)
      ? [{ id: 'all', name: 'All quizzes' }]
      : []),
    ...matchingQuizzes,
  ]
  const rowHeight = 36
  const viewportHeight = 288
  const firstVisibleOption = Math.max(0, Math.floor(quizListScrollTop / rowHeight) - 3)
  const lastVisibleOption = Math.min(quizOptions.length, Math.ceil((quizListScrollTop + viewportHeight) / rowHeight) + 3)
  const visibleQuizOptions = quizOptions.slice(firstVisibleOption, lastVisibleOption)
  const selectedQuizName = selectedQuiz === 'all'
    ? 'All quizzes'
    : quizzes.find((quiz) => quiz.id === selectedQuiz)?.name || 'Select a quiz'
  const selectedCourseName = selectedCourse === 'all'
    ? 'All courses'
    : courses.find((course) => course.id === selectedCourse)?.name || 'Select a course'
  const totalPages = totalQuizzes > 0 ? Math.ceil(totalQuizzes / 20) : 1
  const hasPreviousPage = page > 1
  const goToNextPage = () => {
    if (nextCursor === null || loading) return
    const nextPage = page + 1
    setPageCursors((current) => ({ ...current, [nextPage]: nextCursor }))
    void load('all', nextCursor, nextPage, false, selectedCourse, dateRange, threshold)
  }
  const goToPreviousPage = () => {
    if (loading || !hasPreviousPage) return
    const previousPage = page - 1
    void load('all', pageCursors[previousPage] ?? 0, previousPage, false, selectedCourse, dateRange, threshold)
  }
  const canExport = selectedQuiz === 'all'
    ? qualifyingQuizzes.length > 0 || hasNextPage
    : questions.length > 0

  const exportExcel = async () => {
    setExporting(true)
    setExportError('')
    try {
      const allQuizzes: LowAccuracyQuiz[] = []
      let exportQuestions: LowAccuracyQuizQuestion[] = []
      let cursor = 0

      while (true) {
        const result = await getLowAccuracyQuizQuestions(
          selectedQuiz,
          cursor,
          false,
          selectedCourse,
          dateRange.fromDate || undefined,
          dateRange.toDate || undefined,
          threshold
        )
        if (result.failedQuizCount > 0) {
          throw new Error(`Could not load ${result.failedQuizCount} quiz${result.failedQuizCount === 1 ? '' : 'zes'}; export canceled to avoid an incomplete file.`)
        }

        if (selectedQuiz !== 'all') {
          exportQuestions = result.questions
          break
        }

        allQuizzes.push(...result.quizzes)
        if (!result.hasNextPage) break
        if (result.nextCursor === null || result.nextCursor <= cursor) {
          throw new Error('Quiz results pagination did not advance; export canceled.')
        }
        cursor = result.nextCursor
      }

      const dataRows = (selectedQuiz === 'all' ? allQuizzes.flatMap((quiz) => quiz.questions) : exportQuestions)
        .map((question) => [question.quizName, question.question, question.correctPercentage])
      if (dataRows.length === 0) throw new Error('There are no quiz questions to export.')

      const [XLSX, { formatDataWorksheet }] = await Promise.all([
        import('xlsx-js-style'),
        import('@/lib/excelFormatting'),
      ])
      const worksheet = XLSX.utils.aoa_to_sheet([
        [`QUESTIONS AT OR BELOW ${threshold}% CORRECT`],
        ['Quiz', 'Question', 'Correct (%)'],
        ...dataRows,
      ])
      formatDataWorksheet(worksheet, {
        titleRow: 0,
        headerRow: 1,
        dataEndRow: dataRows.length + 1,
        columnWidths: [42, 90, 16],
      })
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Quiz Questions')
      XLSX.writeFile(workbook, `quiz-questions-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : 'Unable to export quiz questions.')
    } finally {
      setExporting(false)
    }
  }

  const toggleQuizSelection = (quizId: string) => {
    setSelectedQuizIds((current) =>
      current.includes(quizId) ? current.filter((id) => id !== quizId) : [...current, quizId]
    )
  }

  const visibleQuizIds = useMemo(() => qualifyingQuizzes.map((q) => String(q.id)), [qualifyingQuizzes])
  const allVisibleSelected = visibleQuizIds.length > 0 && visibleQuizIds.every((id) => selectedQuizIds.includes(id))

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedQuizIds((current) => current.filter((id) => !visibleQuizIds.includes(id)))
    } else {
      setSelectedQuizIds((current) => [...new Set([...current, ...visibleQuizIds])])
    }
  }

  const matchingCompareQuizzes = useMemo(() => {
    const q = compareSearch.trim().toLowerCase()
    return q ? quizzes.filter((quiz) => quiz.name.toLowerCase().includes(q)) : quizzes
  }, [quizzes, compareSearch])

  useEffect(() => {
    if (qualifyingQuizzes.length > 0) {
      setComparisonQuizMap((prev) => {
        const next = { ...prev }
        for (const quiz of qualifyingQuizzes) {
          next[String(quiz.id)] = quiz
        }
        return next
      })
    }
  }, [qualifyingQuizzes])

  useEffect(() => {
    if (!comparisonOpen || selectedQuizIds.length === 0) return
    let cancelled = false
    const missingIds = selectedQuizIds.filter((id) => !comparisonQuizMap[id])

    if (missingIds.length === 0) return

    setLoadingComparison(true)
    Promise.allSettled(
      missingIds.map(async (id) => {
        const inQualifying = qualifyingQuizzes.find((q) => String(q.id) === id)
        if (inQualifying) return inQualifying

        const result = await getLowAccuracyQuizQuestions(
          id,
          0,
          false,
          selectedCourse,
          dateRange.fromDate || undefined,
          dateRange.toDate || undefined,
          threshold
        )
        const quizMeta = quizzes.find((q) => String(q.id) === id)
        return {
          id,
          name: quizMeta?.name || result.questions[0]?.quizName || `Quiz #${id}`,
          questions: result.questions,
        }
      })
    ).then((results) => {
      if (cancelled) return
      setComparisonQuizMap((prev) => {
        const next = { ...prev }
        for (const res of results) {
          if (res.status === 'fulfilled') {
            next[String(res.value.id)] = res.value
          }
        }
        return next
      })
    }).finally(() => {
      if (!cancelled) setLoadingComparison(false)
    })

    return () => { cancelled = true }
  }, [comparisonOpen, selectedQuizIds, qualifyingQuizzes, quizzes, selectedCourse, dateRange])

  const comparedQuizzes = useMemo(() => {
    return selectedQuizIds.map((id, index) => {
      const quiz = comparisonQuizMap[id] || {
        id,
        name: quizzes.find((q) => String(q.id) === id)?.name || `Quiz #${id}`,
        questions: [],
      }
      const questions = quiz.questions || []
      const count = questions.length
      const avg = count > 0 ? questions.reduce((sum, q) => sum + q.correctPercentage, 0) / count : null
      const lowest = count > 0 ? Math.min(...questions.map((q) => q.correctPercentage)) : null
      const highest = count > 0 ? Math.max(...questions.map((q) => q.correctPercentage)) : null
      const under30 = questions.filter((q) => q.correctPercentage < 30).length
      const under40 = questions.filter((q) => q.correctPercentage >= 30 && q.correctPercentage < 40).length
      const under50 = questions.filter((q) => q.correctPercentage >= 40 && q.correctPercentage < 50).length
      const under60 = questions.filter((q) => q.correctPercentage >= 50 && q.correctPercentage <= threshold).length

      return {
        id,
        name: quiz.name,
        color: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
        questions,
        count,
        avg,
        lowest,
        highest,
        under30,
        under40,
        under50,
        under60,
      }
    })
  }, [selectedQuizIds, comparisonQuizMap, quizzes, threshold])

  const comparisonTotals = useMemo(() => {
    const totalFlagged = comparedQuizzes.reduce((sum, q) => sum + q.count, 0)
    const allQuestions = comparedQuizzes.flatMap((q) => q.questions)
    const combinedAvg = allQuestions.length > 0 ? allQuestions.reduce((sum, q) => sum + q.correctPercentage, 0) / allQuestions.length : null
    const lowestOverall = allQuestions.length > 0 ? Math.min(...allQuestions.map((q) => q.correctPercentage)) : null
    return {
      totalFlagged,
      combinedAvg,
      lowestOverall,
    }
  }, [comparedQuizzes])

  const openQuestionDetailFromComparison = (question: LowAccuracyQuizQuestion) => {
    setComparisonOpen(false)
    setDetailsReturnToComparison(true)
    void openQuestionDetail(question)
  }

  const exportComparisonExcel = async () => {
    try {
      setExporting(true)
      setExportError('')
      const [XLSX, { formatDataWorksheet }] = await Promise.all([
        import('xlsx-js-style'),
        import('@/lib/excelFormatting'),
      ])

      const summaryRows = comparedQuizzes.map((q) => [
        q.name,
        q.count,
        q.avg !== null ? `${q.avg.toFixed(1)}%` : 'N/A',
        q.lowest !== null ? `${q.lowest.toFixed(1)}%` : 'N/A',
        q.highest !== null ? `${q.highest.toFixed(1)}%` : 'N/A',
        q.under30,
        q.under40,
        q.under50,
        q.under60,
      ])

      const questionRows = comparedQuizzes.flatMap((q) =>
        q.questions.map((question) => [
          q.name,
          question.question,
          `${question.correctPercentage.toFixed(1)}%`,
          question.difficulty || 'N/A',
        ])
      )

      const summaryWs = XLSX.utils.aoa_to_sheet([
        ['QUIZ COMPARISON SUMMARY'],
        ['Quiz Name', `Flagged Questions (<= ${threshold}%)`, 'Avg Correct %', 'Lowest Score', 'Highest Score', '<30%', '30-40%', '40-50%', '50-60%'],
        ...summaryRows,
        [],
        ['TOTALS / OVERALL', comparisonTotals.totalFlagged, comparisonTotals.combinedAvg !== null ? `${comparisonTotals.combinedAvg.toFixed(1)}%` : 'N/A', comparisonTotals.lowestOverall !== null ? `${comparisonTotals.lowestOverall.toFixed(1)}%` : 'N/A'],
      ])

      formatDataWorksheet(summaryWs, {
        titleRow: 0,
        headerRow: 1,
        dataEndRow: summaryRows.length + 1,
        columnWidths: [38, 22, 16, 16, 16, 10, 10, 10, 10],
      })

      const questionsWs = XLSX.utils.aoa_to_sheet([
        ['COMPARISON QUESTION DETAILS'],
        ['Quiz', 'Question', 'Correct (%)', 'Difficulty'],
        ...questionRows,
      ])

      formatDataWorksheet(questionsWs, {
        titleRow: 0,
        headerRow: 1,
        dataEndRow: questionRows.length + 1,
        columnWidths: [38, 90, 16, 16],
      })

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Comparison Summary')
      XLSX.utils.book_append_sheet(wb, questionsWs, 'Flagged Questions')
      XLSX.writeFile(wb, `quiz-comparison-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : 'Unable to export comparison.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Assessment review</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Quiz Questions</h1>
          <p className="mt-1 text-sm text-slate-600">
            {threshold >= 100
              ? 'All quiz questions and percentage answered correctly.'
              : `Questions answered correctly by ${threshold}% or fewer of quiz respondents.`}
          </p>
          {selectedRangeLabel ? (
            <p className="mt-1 break-words text-xs font-medium text-teal-700">{selectedRangeLabel}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={coursePickerOpen} onOpenChange={(open) => { setCoursePickerOpen(open); if (!open) setCourseSearch('') }}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={loadingCourses}
                aria-label="Filter by course"
                aria-expanded={coursePickerOpen}
                title={loadingCourses ? 'Loading courses...' : selectedCourseName}
                className="h-10 w-full justify-between border-input bg-background px-3 text-left font-normal shadow-none hover:bg-accent/50 hover:text-foreground sm:w-64"
              >
                <span className="truncate">{loadingCourses ? 'Loading courses…' : selectedCourseName}</span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  autoFocus
                  value={courseSearch}
                  onChange={(event) => setCourseSearch(event.target.value)}
                  placeholder="Search courses…"
                  aria-label="Search courses"
                  className="h-10 border-0 bg-transparent px-0 shadow-none backdrop-blur-none focus-visible:ring-0"
                />
              </div>
              <div className="border-b px-3 py-2 text-xs text-muted-foreground">
                {normalizedCourseSearch ? `${matchingCourses.length.toLocaleString()} matching courses` : `${courses.length.toLocaleString()} courses`}
              </div>
              <div className="max-h-72 overflow-y-auto overscroll-contain p-1" role="listbox" aria-label="Course options">
                {(!normalizedCourseSearch || 'all courses'.includes(normalizedCourseSearch)) && (
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedCourse === 'all'}
                    title="All courses"
                    onClick={() => handleCourseChange('all')}
                    className="flex h-9 w-full items-center rounded-sm px-3 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <Check className={`mr-2 h-4 w-4 shrink-0 ${selectedCourse === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="truncate">All courses</span>
                  </button>
                )}
                {matchingCourses.length > 0 ? matchingCourses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    role="option"
                    aria-selected={selectedCourse === course.id}
                    title={course.name}
                    onClick={() => handleCourseChange(course.id)}
                    className="flex h-9 w-full items-center rounded-sm px-3 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <Check className={`mr-2 h-4 w-4 shrink-0 ${selectedCourse === course.id ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="truncate">{course.name}</span>
                  </button>
                )) : normalizedCourseSearch ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">No courses match that search.</p>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={quizPickerOpen} onOpenChange={(open) => { setQuizPickerOpen(open); if (!open) { setQuizSearch(''); setQuizListScrollTop(0) } }}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={loadingQuizzes}
                aria-label="Filter by quiz"
                aria-expanded={quizPickerOpen}
                title={loadingQuizzes ? 'Loading quiz list...' : selectedQuizName}
                className="h-10 w-full justify-between border-input bg-background px-3 text-left font-normal shadow-none hover:bg-accent/50 hover:text-foreground sm:w-80"
              >
                <span className="truncate">{loadingQuizzes ? 'Loading quiz list…' : selectedQuizName}</span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  autoFocus
                  value={quizSearch}
                  onChange={(event) => { setQuizSearch(event.target.value); setQuizListScrollTop(0) }}
                  placeholder="Search quizzes…"
                  aria-label="Search quizzes"
                  className="h-10 border-0 bg-transparent px-0 shadow-none backdrop-blur-none focus-visible:ring-0"
                />
              </div>
              <div className="border-b px-3 py-2 text-xs text-muted-foreground">
                {normalizedSearch
                  ? `${matchingQuizzes.length.toLocaleString()} matching quizzes`
                  : threshold >= 100
                  ? 'All quizzes'
                  : `Quizzes with questions at or below ${threshold}% correct`}
              </div>
              <div
                key={normalizedSearch}
                className="max-h-72 overflow-y-auto overscroll-contain p-1"
                role="listbox"
                aria-label="Quiz options"
                onScroll={(event) => setQuizListScrollTop(event.currentTarget.scrollTop)}
              >
                {quizOptions.length > 0 ? (
                  <div style={{ height: quizOptions.length * rowHeight, position: 'relative' }}>
                    {visibleQuizOptions.map((quiz, visibleIndex) => {
                      const optionIndex = firstVisibleOption + visibleIndex
                      return (
                        <button
                          key={quiz.id}
                          type="button"
                          role="option"
                          aria-selected={selectedQuiz === quiz.id}
                          title={quiz.name}
                          onClick={() => handleQuizChange(quiz.id)}
                          className="absolute left-0 flex h-9 w-full items-center rounded-sm px-3 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          style={{ top: optionIndex * rowHeight }}
                        >
                          <Check className={`mr-2 h-4 w-4 shrink-0 ${selectedQuiz === quiz.id ? 'opacity-100' : 'opacity-0'}`} />
                          <span className="truncate">{quiz.name}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : <p className="px-3 py-6 text-center text-sm text-muted-foreground">No quizzes match that search.</p>}
              </div>
            </PopoverContent>
          </Popover>
          {!compareMode ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompareMode(true)}
              aria-label="Enter compare mode"
            >
              <GitCompareArrows className="mr-2 h-4 w-4" />
              Compare
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Popover open={comparePickerOpen} onOpenChange={(open) => { setComparePickerOpen(open); if (!open) setCompareSearch('') }}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant={selectedQuizIds.length >= 2 ? 'default' : 'outline'}
                    className={selectedQuizIds.length >= 2 ? 'bg-teal-700 hover:bg-teal-800 text-white' : 'border-teal-300 text-teal-800 bg-teal-50/50'}
                    aria-label="Compare quizzes"
                  >
                    <GitCompareArrows className="mr-2 h-4 w-4" />
                    {selectedQuizIds.length >= 2
                      ? `Compare (${selectedQuizIds.length})`
                      : selectedQuizIds.length === 1
                      ? 'Select 1 more'
                      : 'Select quizzes'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={compareSearch}
                      onChange={(e) => setCompareSearch(e.target.value)}
                      placeholder="Search quizzes to compare…"
                      className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
                    <span>{selectedQuizIds.length} of {quizzes.length} selected</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedQuizIds(matchingCompareQuizzes.map((q) => String(q.id)))}
                        className="text-teal-700 hover:underline"
                      >
                        Select filtered
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedQuizIds([])}
                        className="text-slate-500 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-1">
                    {matchingCompareQuizzes.length > 0 ? (
                      matchingCompareQuizzes.map((quiz) => {
                        const isChecked = selectedQuizIds.includes(String(quiz.id))
                        return (
                          <button
                            key={quiz.id}
                            type="button"
                            onClick={() => toggleQuizSelection(String(quiz.id))}
                            className="flex h-9 w-full items-center justify-between rounded-sm px-3 text-left text-sm hover:bg-accent"
                          >
                            <span className="truncate pr-2">{quiz.name}</span>
                            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isChecked ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300'}`}>
                              {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                          </button>
                        )
                      })
                    ) : (
                      <p className="p-3 text-center text-xs text-slate-500">No matching quizzes</p>
                    )}
                  </div>
                  <div className="border-t p-2">
                    <Button
                      className="w-full bg-teal-700 hover:bg-teal-800 text-white"
                      size="sm"
                      disabled={selectedQuizIds.length < 2}
                      onClick={() => {
                        setComparePickerOpen(false)
                        setComparisonOpen(true)
                      }}
                    >
                      <GitCompareArrows className="mr-2 h-4 w-4" />
                      Compare Selected ({selectedQuizIds.length})
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCompareMode(false)
                  setSelectedQuizIds([])
                }}
                aria-label="Exit compare mode"
                className="h-10 text-xs text-slate-500 hover:text-slate-800"
              >
                Done
              </Button>
            </div>
          )}
          <Select
            value={String(threshold)}
            onValueChange={(val) => handleThresholdChange(Number(val))}
          >
            <SelectTrigger
              className="h-10 w-full sm:w-44 bg-background border-input font-normal text-sm shadow-none"
              aria-label="Filter questions by accuracy"
            >
              <SelectValue placeholder="Accuracy filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="100">All Questions</SelectItem>
              <SelectItem value="60">≤ 60% Correct</SelectItem>
            </SelectContent>
          </Select>
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            onDone={(range) => void load(selectedQuiz, 0, 1, false, selectedCourse, range, threshold)}
            showLabels={false}
            showToday
            className="w-full sm:w-auto [&>div]:min-w-0 sm:[&>div]:min-w-[280px]"
          />
          {threshold === 60 && (
            <Button
              type="button"
              variant="outline"
              disabled={loading || exporting || !canExport}
              onClick={() => void exportExcel()}
              aria-label="Export quiz questions to Excel"
            >
              <FileSpreadsheet className={`mr-2 h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} />
              {exporting ? 'Exporting...' : 'Export Excel'}
            </Button>
          )}
          <Button variant="outline" disabled={loading} onClick={() => void load(selectedQuiz, pageCursors[page] ?? 0, page, true, selectedCourse, dateRange, threshold)} aria-label="Refresh quiz questions">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {selectedQuizIds.length > 0 && (
        <section className="space-y-3 rounded-lg border border-teal-200 bg-gradient-to-r from-teal-50/70 via-sky-50/40 to-white p-4 shadow-sm" aria-label="Selected quizzes for comparison">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Selected quizzes for comparison ({selectedQuizIds.length})
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedQuizIds([])
                  setCompareMode(false)
                }}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                <X className="mr-1 h-3.5 w-3.5" /> Clear & exit
              </Button>
              <Button
                size="sm"
                disabled={selectedQuizIds.length < 2}
                onClick={() => setComparisonOpen(true)}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                <GitCompareArrows className="mr-1.5 h-4 w-4" />
                Compare ({selectedQuizIds.length})
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedQuizIds.map((id) => {
              const quizName = quizzes.find((q) => String(q.id) === id)?.name
                || qualifyingQuizzes.find((q) => String(q.id) === id)?.name
                || `Quiz #${id}`
              return (
                <span
                  key={id}
                  className="flex items-center gap-1.5 rounded-md border border-teal-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm"
                >
                  <span className="max-w-xs truncate">{quizName}</span>
                  <button
                    type="button"
                    onClick={() => toggleQuizSelection(id)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`Remove ${quizName}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )
            })}
          </div>
        </section>
      )}

      {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {exportError && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{exportError}</div>}
      {exporting && <div role="status" className="border-l-4 border-teal-600 bg-teal-50 px-4 py-3 text-sm text-teal-900">Please wait — preparing the Excel file may take a few minutes. Your download will start automatically.</div>}
      {courseListError && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">Course list: {courseListError}</div>}
      {quizListError && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">Quiz list: {quizListError}</div>}
      {unscoredQuestionCount > 0 && <div role="status" className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">Accuracy data could not be read for {unscoredQuestionCount.toLocaleString()} question{unscoredQuestionCount === 1 ? '' : 's'}.</div>}
      {failedQuizCount > 0 && <div role="status" className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">Analysis could not be loaded for {failedQuizCount.toLocaleString()} quiz{failedQuizCount === 1 ? '' : 'zes'}; showing results from the other quizzes.</div>}
      <section aria-live="polite" aria-busy={loading} className="min-h-64 border border-slate-200 bg-white">
        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 bg-white px-5 py-12 text-center text-sm text-slate-600">
            <LoaderCircle className="h-6 w-6 animate-spin text-teal-700" />
            <p>{selectedQuiz === 'all' ? `Loading…` : 'Loading quiz questions…'}</p>
          </div>
        ) : error ? (
          <div role="alert" className="flex min-h-64 items-center justify-center bg-white px-5 py-12 text-center text-sm text-red-800">
            {error}
          </div>
        ) : selectedQuiz === 'all' && qualifyingQuizzes.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center gap-3 bg-white px-5 py-12 text-sm text-slate-600">
            <HelpCircle className="h-5 w-5 shrink-0 text-slate-400" />
            <p>{unscoredQuestionCount > 0 ? 'Some question accuracy values could not be read. No qualifying quizzes were found in this page.' : 'No quizzes with questions at or below 60% correct were found in this page.'}</p>
          </div>
        ) : selectedQuiz === 'all' ? (
        <div className="overflow-x-auto bg-white">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {compareMode && (
                  <th scope="col" className="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-teal-600 cursor-pointer"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible quizzes"
                    />
                  </th>
                )}
                <th scope="col" className="w-72 px-5 py-3 font-semibold">Quiz</th>
                <th scope="col" className="px-5 py-3 font-semibold">{threshold >= 100 ? 'All Quiz Questions' : `Questions at or below ${threshold}%`}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {qualifyingQuizzes.map((quiz) => {
                const isSelected = selectedQuizIds.includes(String(quiz.id))
                return (
                  <tr key={quiz.id} className={`align-top transition-colors ${isSelected ? 'bg-teal-50/50' : 'hover:bg-slate-50/60'}`}>
                    {compareMode && (
                      <td className="w-12 px-4 py-5 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded accent-teal-600 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleQuizSelection(String(quiz.id))}
                          aria-label={`Select ${quiz.name} for comparison`}
                        />
                      </td>
                    )}
                    <th scope="row" className="w-72 bg-slate-50/40 px-5 py-5 text-left align-top">
                      <p className="break-words text-sm font-semibold leading-5 text-slate-900">{quiz.name}</p>
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        {threshold >= 100
                          ? `${quiz.questions.length} ${quiz.questions.length === 1 ? 'question' : 'questions'}`
                          : `${quiz.questions.length} flagged ${quiz.questions.length === 1 ? 'question' : 'questions'}`}
                      </p>
                    </th>
                    <td className="px-5 py-4 text-slate-900">
                      <ul className="divide-y divide-slate-100">
                        {quiz.questions.map((question) => (
                          <li key={question.id} className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0">
                            <button type="button" onClick={() => void openQuestionDetail(question)} className="min-w-0 flex-1 whitespace-pre-wrap break-words rounded-sm py-1 text-left text-sm font-medium leading-6 text-black hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                              {question.question}
                            </button>
                            <AccuracyDisplay percentage={question.correctPercentage} />
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        ) : questions.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center gap-3 bg-white px-5 py-12 text-sm text-slate-600">
            <HelpCircle className="h-5 w-5 shrink-0 text-slate-400" />
            <p>{unscoredQuestionCount > 0 ? 'Some question accuracy values could not be read.' : (threshold >= 100 ? 'No questions found for this quiz.' : `No questions at or below ${threshold}% correct were found for this quiz.`)}</p>
          </div>
        ) : (
        <div className="overflow-x-auto bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase text-slate-500">Selected quiz</p>
              <h2 className="mt-1 break-words text-base font-semibold leading-6 text-slate-950">{questions[0]?.quizName}</h2>
            </div>
            <Button
              type="button"
              size="sm"
              variant={selectedQuizIds.includes(selectedQuiz) ? 'default' : 'outline'}
              className={selectedQuizIds.includes(selectedQuiz) ? 'bg-teal-700 hover:bg-teal-800 text-white' : ''}
              onClick={() => {
                toggleQuizSelection(selectedQuiz)
                setCompareMode(true)
              }}
            >
              <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
              {selectedQuizIds.includes(selectedQuiz) ? 'Selected for comparison' : 'Add to comparison'}
            </Button>
          </div>
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-white text-xs uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Question</th>
                <th scope="col" className="w-32 px-5 py-3 text-right font-semibold">Correct</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {questions.map((question) => (
                <tr key={question.id} className="align-middle transition-colors hover:bg-slate-50/60">
                  <td className="min-w-80 px-5 py-4 text-slate-900">
                    <button type="button" onClick={() => void openQuestionDetail(question)} className="whitespace-pre-wrap break-words rounded-sm text-left text-sm font-medium leading-6 text-black hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                      {question.question}
                    </button>
                  </td>
                  <td className="px-5 py-4"><div className="flex justify-end"><AccuracyDisplay percentage={question.correctPercentage} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>
      {selectedQuiz === 'all' && (hasPreviousPage || hasNextPage || loading) && (
        <div className="flex items-center justify-end gap-3 border border-slate-200 bg-white px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {loading
              ? `Loading page ${loadingPage ?? page}`
              : threshold >= 100 && totalPages > 0
              ? `Page ${page} of ${totalPages} (${totalQuizzes} quizzes)`
              : `Page ${page}${hasNextPage ? ' - more results available' : ' - last page'}`}
          </span>
          <Button variant="outline" size="sm" disabled={loading || !hasPreviousPage} onClick={goToPreviousPage}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={loading || !hasNextPage} onClick={goToNextPage}>
            Next
          </Button>
        </div>
      )}
      <Dialog
        open={activeQuestion !== null}
        onOpenChange={(open) => {
          if (!open) {
            questionDetailRequestId.current += 1
            setActiveQuestion(null)
            setLoadingQuestionDetail(false)
            if (detailsReturnToComparison) {
              setDetailsReturnToComparison(false)
              setComparisonOpen(true)
            }
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question details</DialogTitle>
            <DialogDescription>{activeQuestion?.quizName} · {activeQuestion ? `${activeQuestion.correctPercentage.toFixed(1)}% answered correctly` : ''}</DialogDescription>
          </DialogHeader>
          {detailsReturnToComparison && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                questionDetailRequestId.current += 1
                setActiveQuestion(null)
                setLoadingQuestionDetail(false)
                setDetailsReturnToComparison(false)
                setComparisonOpen(true)
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to comparison
            </Button>
          )}
          <div className="space-y-5">
            <div className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-900">
              {activeQuestion?.question}
            </div>
            <section aria-labelledby="answer-options-heading" className="space-y-2">
              <h3 id="answer-options-heading" className="text-sm font-semibold text-slate-900">Answer options</h3>
              {loadingQuestionDetail ? (
                <p className="text-sm text-slate-600">Loading answer details…</p>
              ) : activeQuestion?.options?.length ? (
                <ul className="space-y-2">
                  {activeQuestion.options.map((option, optionIndex) => (
                    <li key={option.id} className={`flex items-start gap-3 rounded border px-3 py-2.5 text-sm ${option.isCorrect === true ? 'border-green-300 bg-green-50 text-green-900' : option.isCorrect === false ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200 bg-white text-slate-800'}`}>
                      <span aria-hidden="true" className="w-5 shrink-0 font-semibold">{optionIndex < 26 ? String.fromCharCode(97 + optionIndex) : `${optionIndex + 1}`}</span>
                      <span className="whitespace-pre-wrap">{option.text}</span>
                      {(typeof option.selectionPercentage === 'number' || option.isCorrect !== null) && (
                        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs font-semibold">
                          {typeof option.selectionPercentage === 'number' && <span>{option.selectionPercentage.toFixed(1)}% chose this option</span>}
                          {option.isCorrect === true && <span>Correct</span>}
                          {option.isCorrect === false && <span>Incorrect</span>}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">Answer options are not available for this question.</p>
              )}
              {!loadingQuestionDetail && activeQuestion?.options?.length && !activeQuestion.options.some((option) => option.isCorrect !== null) && (
                <p className="text-sm text-amber-800">The answer key is not available, so options are not marked correct or incorrect.</p>
              )}
              {!loadingQuestionDetail && activeQuestion?.options?.length && !activeQuestion.options.some((option) => typeof option.selectionPercentage === 'number') && (
                <p className="text-sm text-amber-800">Student response percentages are not available for this question.</p>
              )}
              {activeQuestion?.correctAnswer && !activeQuestion.options?.some((option) => option.isCorrect === true) && (
                <p className="text-sm font-medium text-green-800">Correct answer: {activeQuestion.correctAnswer}</p>
              )}
              {questionDetailError && <p role="status" className="text-sm text-amber-800">{questionDetailError}</p>}
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-6xl flex-col overflow-hidden">
          <DialogHeader className="pr-6">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-950">
              <GitCompareArrows className="h-5 w-5 text-teal-700" />
              Quiz Comparison
            </DialogTitle>
            <DialogDescription>
              {comparedQuizzes.length} selected quizzes · {comparisonTotals.totalFlagged} total flagged questions (≤ {threshold}% correct)
            </DialogDescription>
          </DialogHeader>

          {/* Quick selection chips & Add button inside dialog */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Comparing:</span>
            {comparedQuizzes.map((q) => (
              <span
                key={q.id}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-xs"
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: q.color }} />
                <span className="max-w-[200px] truncate">{q.name}</span>
                <button
                  type="button"
                  onClick={() => toggleQuizSelection(q.id)}
                  className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label={`Remove ${q.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Add Quiz
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="flex items-center border-b px-2.5 py-1.5">
                  <Search className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search quizzes…"
                    value={compareSearch}
                    onChange={(e) => setCompareSearch(e.target.value)}
                    className="h-8 border-0 text-xs shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                  {matchingCompareQuizzes.map((quiz) => {
                    const isChecked = selectedQuizIds.includes(String(quiz.id))
                    return (
                      <button
                        key={quiz.id}
                        type="button"
                        onClick={() => toggleQuizSelection(String(quiz.id))}
                        className="flex h-8 w-full items-center justify-between rounded px-2 text-left text-xs hover:bg-accent"
                      >
                        <span className="truncate pr-2">{quiz.name}</span>
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
              <p>Loading comparison data for selected quizzes…</p>
            </div>
          ) : comparedQuizzes.length < 2 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 py-12 text-center text-sm text-slate-600">
              <HelpCircle className="h-8 w-8 text-slate-400" />
              <p className="font-medium text-slate-900">Select at least 2 quizzes to compare</p>
              <p className="text-xs text-slate-500">Use the checkboxes in the table or the "Add Quiz" button above.</p>
            </div>
          ) : comparisonView === 'table' ? (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              {/* Summary table */}
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Quiz Name</th>
                      <th className="px-3 py-3 text-center">Flagged (≤ {threshold}%)</th>
                      <th className="px-3 py-3 text-right">Avg Accuracy</th>
                      <th className="px-3 py-3 text-right">Lowest</th>
                      <th className="px-3 py-3 text-right">Highest Flagged</th>
                      <th className="px-4 py-3 text-center">Breakdown (&lt;30% | 30-40% | 40-50% | 50-60%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparedQuizzes.map((quiz) => (
                      <tr key={quiz.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: quiz.color }} />
                            <span>{quiz.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-slate-800">
                          {quiz.count}
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
                          {quiz.avg !== null ? `${quiz.avg.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-red-700 font-medium">
                          {quiz.lowest !== null ? `${quiz.lowest.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-amber-700 font-medium">
                          {quiz.highest !== null ? `${quiz.highest.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex gap-1 text-xs">
                            <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-800" title="<30% Correct">{quiz.under30}</span>
                            <span className="rounded bg-orange-100 px-1.5 py-0.5 font-semibold text-orange-800" title="30-40% Correct">{quiz.under40}</span>
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800" title="40-50% Correct">{quiz.under50}</span>
                            <span className="rounded bg-teal-100 px-1.5 py-0.5 font-semibold text-teal-800" title="50-60% Correct">{quiz.under60}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-teal-600 bg-teal-50/70 font-semibold text-slate-900">
                    <tr>
                      <td className="px-4 py-3">Totals / Overall</td>
                      <td className="px-3 py-3 text-center">{comparisonTotals.totalFlagged}</td>
                      <td className="px-3 py-3 text-right">{comparisonTotals.combinedAvg !== null ? `${comparisonTotals.combinedAvg.toFixed(1)}%` : '—'}</td>
                      <td className="px-3 py-3 text-right text-red-700">{comparisonTotals.lowestOverall !== null ? `${comparisonTotals.lowestOverall.toFixed(1)}%` : '—'}</td>
                      <td className="px-3 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-600">Combined flagged questions</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Questions breakdown */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Flagged Questions</h3>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveQuestionTab('all')}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        activeQuestionTab === 'all' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      All Quizzes ({comparisonTotals.totalFlagged})
                    </button>
                    {comparedQuizzes.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setActiveQuestionTab(q.id)}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          activeQuestionTab === q.id ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {q.name.length > 18 ? q.name.slice(0, 16) + '…' : q.name} ({q.count})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white">
                  <ul className="divide-y divide-slate-100">
                    {(activeQuestionTab === 'all'
                      ? comparedQuizzes.flatMap((q) => q.questions)
                      : comparedQuizzes.find((q) => q.id === activeQuestionTab)?.questions || []
                    ).map((question) => (
                      <li key={question.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50/60">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {question.quizName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openQuestionDetailFromComparison(question)}
                            className="whitespace-pre-wrap break-words text-left text-sm font-medium text-slate-900 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                          >
                            {question.question}
                          </button>
                        </div>
                        <AccuracyDisplay percentage={question.correctPercentage} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            /* View Analytics */
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-4 md:grid-cols-2">
                <ChartPanel title="Flagged Questions Count" detail="Total questions answered at or below 60%">
                  <BarChart data={comparedQuizzes} margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(name) => (name.length > 15 ? name.slice(0, 13) + '…' : name)}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Flagged Questions" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartPanel>

                <ChartPanel title="Average Flagged Accuracy (%)" detail="Average percentage correct for flagged questions">
                  <BarChart
                    data={comparedQuizzes.map((q) => ({
                      name: q.name,
                      avg: q.avg !== null ? Number(q.avg.toFixed(1)) : 0,
                    }))}
                    margin={{ top: 8, right: 16, bottom: 20, left: 0 }}
                  >
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(name) => (name.length > 15 ? name.slice(0, 13) + '…' : name)}
                    />
                    <YAxis domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <ReferenceLine y={threshold} stroke="#dc2626" strokeDasharray="3 3" label={`Threshold (${threshold}%)`} />
                    <Bar dataKey="avg" name="Avg Correct %" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartPanel>

                <div className="md:col-span-2">
                  <ChartPanel
                    title="Accuracy Distribution Breakdown"
                    detail="Questions categorized by accuracy brackets across compared quizzes"
                    chartHeight={300}
                  >
                    <BarChart data={comparedQuizzes} margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(name) => (name.length > 20 ? name.slice(0, 18) + '…' : name)}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="under30" name="< 30% (Critical)" fill="#dc2626" stackId="a" />
                      <Bar dataKey="under40" name="30% - 40% (Very Low)" fill="#ea580c" stackId="a" />
                      <Bar dataKey="under50" name="40% - 50% (Low)" fill="#d97706" stackId="a" />
                      <Bar dataKey="under60" name="50% - 60% (Moderate)" fill="#0891b2" stackId="a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartPanel>
                </div>
              </div>
            </div>
          )}

          {/* Dialog Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={exporting || comparedQuizzes.length < 2}
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