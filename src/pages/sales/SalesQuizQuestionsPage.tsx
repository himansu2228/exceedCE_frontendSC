import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, HelpCircle, LoaderCircle, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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

function AccuracyDisplay({ percentage }: { percentage: number }) {
  const safePercentage = Math.max(0, Math.min(100, percentage))
  const isVeryLow = safePercentage < 40
  return (
    <div className="flex w-24 shrink-0 flex-col items-end gap-1.5" aria-label={`${percentage.toFixed(1)} percent correct`}>
      <span className={`rounded-sm px-2 py-1 text-sm font-bold tabular-nums ${isVeryLow ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
        {percentage.toFixed(1)}%
      </span>
      <span className="text-[11px] font-medium text-slate-500">correct</span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <span className={`block h-full rounded-full ${isVeryLow ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${safePercentage}%` }} />
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
  const [threshold, setThreshold] = useState(60)
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
  const loadRequestId = useRef(0)
  const questionDetailRequestId = useRef(0)

  const openQuestionDetail = async (question: LowAccuracyQuizQuestion) => {
    const requestId = ++questionDetailRequestId.current
    setActiveQuestion(question)
    setLoadingQuestionDetail(true)
    setQuestionDetailError('')
    try {
      const detail = await getQuizQuestionDetail(question.id)
      if (requestId === questionDetailRequestId.current) {
        setActiveQuestion({ ...question, ...detail, question: detail.question || question.question })
      }
    } catch (cause) {
      if (requestId === questionDetailRequestId.current) {
        setQuestionDetailError(cause instanceof Error ? cause.message : 'Question details are unavailable.')
      }
    } finally {
      if (requestId === questionDetailRequestId.current) setLoadingQuestionDetail(false)
    }
  }

  const load = async (quizId: string, cursor = 0, requestedPage = 1, refresh = false, courseId = selectedCourse) => {
    const requestId = ++loadRequestId.current
    setLoading(true)
    setLoadingPage(quizId === 'all' ? requestedPage : null)
    setError('')
    try {
      const result = await getLowAccuracyQuizQuestions(quizId, cursor, refresh, courseId)
      if (requestId !== loadRequestId.current) return
      setQuestions(result.questions)
      setQualifyingQuizzes(result.quizzes)
      setThreshold(result.threshold)
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
    void load('all', 0, 1, false, 'all')
  }, [])

  const handleQuizChange = (quizId: string) => {
    setSelectedQuiz(quizId)
    setQuizPickerOpen(false)
    setQuizSearch('')
    setQuizListScrollTop(0)
    setPage(1)
    setPageCursors({ 1: 0 })
    void load(quizId, 0, 1)
  }

  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId)
    setCoursePickerOpen(false)
    setCourseSearch('')
    setSelectedQuiz('all')
    setPage(1)
    setPageCursors({ 1: 0 })
    void load('all', 0, 1, false, courseId)
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
  const hasPreviousPage = page > 1
  const goToNextPage = () => {
    if (nextCursor === null || loading) return
    const nextPage = page + 1
    setPageCursors((current) => ({ ...current, [nextPage]: nextCursor }))
    void load('all', nextCursor, nextPage, false, selectedCourse)
  }
  const goToPreviousPage = () => {
    if (loading || !hasPreviousPage) return
    const previousPage = page - 1
    void load('all', pageCursors[previousPage] ?? 0, previousPage, false, selectedCourse)
  }

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Assessment review</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Quiz Questions</h1>
          <p className="mt-1 text-sm text-slate-600">Questions answered correctly by {threshold}% or fewer of quiz respondents.</p>
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
                {normalizedSearch ? `${matchingQuizzes.length.toLocaleString()} matching quizzes needing review` : 'Quizzes with questions at or below 60% correct'}
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
          <Button variant="outline" disabled={loading} onClick={() => void load(selectedQuiz, pageCursors[page] ?? 0, page, true, selectedCourse)} aria-label="Refresh quiz questions">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
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
                <th scope="col" className="w-72 px-5 py-3 font-semibold">Quiz</th>
                <th scope="col" className="px-5 py-3 font-semibold">Questions at or below {threshold}%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {qualifyingQuizzes.map((quiz) => (
                <tr key={quiz.id} className="align-top transition-colors hover:bg-slate-50/60">
                  <th scope="row" className="w-72 bg-slate-50/40 px-5 py-5 text-left align-top">
                    <p className="break-words text-sm font-semibold leading-5 text-slate-900">{quiz.name}</p>
                    <p className="mt-2 text-xs font-medium text-slate-500">{quiz.questions.length} flagged {quiz.questions.length === 1 ? 'question' : 'questions'}</p>
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
              ))}
            </tbody>
          </table>
        </div>
        ) : questions.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center gap-3 bg-white px-5 py-12 text-sm text-slate-600">
            <HelpCircle className="h-5 w-5 shrink-0 text-slate-400" />
            <p>{unscoredQuestionCount > 0 ? 'Some question accuracy values could not be read.' : 'No questions at or below 60% correct were found for this quiz.'}</p>
          </div>
        ) : (
        <div className="overflow-x-auto bg-white">
          <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Selected quiz</p>
            <h2 className="mt-1 break-words text-base font-semibold leading-6 text-slate-950">{questions[0]?.quizName}</h2>
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
          <span className="text-sm text-muted-foreground">{loading ? `Loading page ${loadingPage ?? page}` : `Page ${page}${hasNextPage ? ' - more results available' : ' - last page'}`}</span>
          <Button variant="outline" size="sm" disabled={loading || !hasPreviousPage} onClick={goToPreviousPage}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={loading || !hasNextPage} onClick={goToNextPage}>
            Next
          </Button>
        </div>
      )}
      <Dialog open={activeQuestion !== null} onOpenChange={(open) => { if (!open) { questionDetailRequestId.current += 1; setActiveQuestion(null); setLoadingQuestionDetail(false) } }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question details</DialogTitle>
            <DialogDescription>{activeQuestion?.quizName} · {activeQuestion ? `${activeQuestion.correctPercentage.toFixed(1)}% answered correctly` : ''}</DialogDescription>
          </DialogHeader>
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
                      {option.isCorrect === true && <span className="ml-auto shrink-0 text-xs font-semibold">Correct</span>}
                      {option.isCorrect === false && <span className="ml-auto shrink-0 text-xs font-semibold">Incorrect</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">Answer options are not available for this question.</p>
              )}
              {!loadingQuestionDetail && activeQuestion?.options?.length && !activeQuestion.options.some((option) => option.isCorrect !== null) && (
                <p className="text-sm text-amber-800">The answer key is not available, so options are not marked correct or incorrect.</p>
              )}
              {activeQuestion?.correctAnswer && !activeQuestion.options?.some((option) => option.isCorrect === true) && (
                <p className="text-sm font-medium text-green-800">Correct answer: {activeQuestion.correctAnswer}</p>
              )}
              {questionDetailError && <p role="status" className="text-sm text-amber-800">{questionDetailError}</p>}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}