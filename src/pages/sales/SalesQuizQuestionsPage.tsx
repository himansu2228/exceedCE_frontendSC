import { useEffect, useState } from 'react'
import { Check, ChevronDown, HelpCircle, LoaderCircle, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  getLowAccuracyQuizQuestions,
  getQuizOptions,
  type LowAccuracyQuiz,
  type LowAccuracyQuizQuestion,
  type QuizOption,
} from '@/lib/api'

export function SalesQuizQuestionsPage() {
  const [quizzes, setQuizzes] = useState<QuizOption[]>([])
  const [questions, setQuestions] = useState<LowAccuracyQuizQuestion[]>([])
  const [qualifyingQuizzes, setQualifyingQuizzes] = useState<LowAccuracyQuiz[]>([])
  const [page, setPage] = useState(1)
  const [pageCursors, setPageCursors] = useState<Record<number, number>>({ 1: 0 })
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loadingPage, setLoadingPage] = useState<number | null>(1)
  const [unscoredQuestionCount, setUnscoredQuestionCount] = useState(0)
  const [failedQuizCount, setFailedQuizCount] = useState(0)
  const [selectedQuiz, setSelectedQuiz] = useState('all')
  const [quizPickerOpen, setQuizPickerOpen] = useState(false)
  const [quizSearch, setQuizSearch] = useState('')
  const [quizListScrollTop, setQuizListScrollTop] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingQuizzes, setLoadingQuizzes] = useState(true)
  const [error, setError] = useState('')
  const [quizListError, setQuizListError] = useState('')

  const load = async (quizId: string, cursor = 0, requestedPage = 1, refresh = false) => {
    setLoading(true)
    setLoadingPage(quizId === 'all' ? requestedPage : null)
    setError('')
    try {
      const result = await getLowAccuracyQuizQuestions(quizId, cursor, refresh)
      setQuestions(result.questions)
      setQualifyingQuizzes(result.quizzes)
      setPage(requestedPage)
      setNextCursor(result.nextCursor)
      setHasNextPage(result.hasNextPage)
      setUnscoredQuestionCount(result.unscoredQuestionCount)
      setFailedQuizCount(result.failedQuizCount)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load quiz questions.'
      setError(quizId === 'all' ? `${message} Select one quiz to load its results separately.` : message)
    } finally {
      setLoading(false)
      setLoadingPage(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    getQuizOptions()
      .then((quizOptions) => {
        if (!cancelled) setQuizzes(quizOptions)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setQuizListError(cause instanceof Error ? cause.message : 'Unable to load the quiz list.')
      })
      .finally(() => {
        if (!cancelled) setLoadingQuizzes(false)
      })

    getLowAccuracyQuizQuestions('all', 0)
      .then((result) => {
        if (cancelled) return
        setQuestions(result.questions)
        setQualifyingQuizzes(result.quizzes)
        setPage(1)
        setNextCursor(result.nextCursor)
        setHasNextPage(result.hasNextPage)
        setUnscoredQuestionCount(result.unscoredQuestionCount)
        setFailedQuizCount(result.failedQuizCount)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : 'Unable to load quiz questions.'
          setError(`${message} Select one quiz to load its results separately.`)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setLoadingPage(null)
        }
      })
    return () => { cancelled = true }
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

  const normalizedSearch = quizSearch.trim().toLocaleLowerCase()
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
  const hasPreviousPage = page > 1
  const goToNextPage = () => {
    if (nextCursor === null || loading) return
    const nextPage = page + 1
    setPageCursors((current) => ({ ...current, [nextPage]: nextCursor }))
    void load('all', nextCursor, nextPage)
  }
  const goToPreviousPage = () => {
    if (loading || !hasPreviousPage) return
    const previousPage = page - 1
    void load('all', pageCursors[previousPage] ?? 0, previousPage)
  }

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Assessment review</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Quiz Questions</h1>
          <p className="mt-1 text-sm text-slate-600">Questions answered correctly by 60% or fewer of quiz respondents.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" disabled={loading} onClick={() => void load(selectedQuiz, pageCursors[page] ?? 0, page, true)} aria-label="Refresh quiz questions">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
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
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Quiz</th>
                <th scope="col" className="px-4 py-3 font-semibold">Questions at or below 60%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {qualifyingQuizzes.map((quiz) => (
                <tr key={quiz.id} className="align-top hover:bg-slate-50">
                  <td className="max-w-72 px-4 py-4 font-medium text-slate-700">{quiz.name}</td>
                  <td className="px-4 py-4 text-slate-900">
                    <ul className="space-y-2">
                      {quiz.questions.map((question) => (
                        <li key={question.id} className="flex items-start justify-between gap-4">
                          <span>{question.question}</span>
                          <span className="shrink-0 font-semibold tabular-nums text-red-700">{question.correctPercentage.toFixed(1)}%</span>
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
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Quiz</th>
                <th scope="col" className="px-4 py-3 font-semibold">Question</th>
                <th scope="col" className="w-36 px-4 py-3 text-right font-semibold">Correct</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {questions.map((question) => (
                <tr key={question.id} className="align-top hover:bg-slate-50">
                  <td className="max-w-64 px-4 py-4 font-medium text-slate-700">{question.quizName}</td>
                  <td className="min-w-80 px-4 py-4 text-slate-900">{question.question}</td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums text-red-700">{question.correctPercentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>
      {selectedQuiz === 'all' && (hasPreviousPage || hasNextPage || loading) && (
        <div className="flex items-center justify-end gap-3 border border-slate-200 bg-white px-4 py-3">
          <span className="text-sm text-muted-foreground">{loading ? `Loading page ${loadingPage ?? page}` : `Page ${page}`}</span>
          <Button variant="outline" size="sm" disabled={loading || !hasPreviousPage} onClick={goToPreviousPage}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={loading || !hasNextPage} onClick={goToNextPage}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}