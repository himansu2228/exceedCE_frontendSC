import type { SurveyReportResponse } from './api'

export const RATING_LEVELS = [
  { value: 1, label: 'Unsatisfactory', color: '#dc2626' },
  { value: 2, label: 'Needs Improvement', color: '#f97316' },
  { value: 3, label: 'Satisfactory', color: '#16a34a' },
  { value: 4, label: 'Above Average', color: '#7c3aed' },
  { value: 5, label: 'Excellent', color: '#2563eb' },
] as const

export const COMMENT_CATEGORIES = ['Format', 'Instructor', 'Technology', 'Content', 'Other'] as const
export type CommentCategory = (typeof COMMENT_CATEGORIES)[number]
export type QuestionKind = 'rating' | 'choice' | 'text'

export interface QuestionConfig { label?: string; hidden?: boolean }
export type QuestionConfigMap = Record<string, QuestionConfig>

export interface RatingRow {
  question: string
  label: string
  counts: number[]
  na: number
  total: number
}

export interface ChoiceRow { question: string; label: string; counts: Array<{ answer: string; count: number }> }

export interface CommentItem {
  key: string
  responseId: string
  name: string
  question: string
  questionLabel: string
  text: string
  suggested: CommentCategory
}

// "6 = N/A" and "6=N/A" both appear in the source data.
export function parseRating(answer: string): number | 'na' | null {
  const text = answer.trim()
  if (/^6\s*=\s*N\/?A/i.test(text)) return 'na'
  const match = /^([1-5])\s*(?:=.*)?$/.exec(text)
  return match ? Number(match[1]) : null
}

const CHOICE_ANSWER = /^(yes|no|true|false|n\/a|not sure|maybe)\.?$/i
const EMPTY_COMMENT = /^(none|n\/?a|na|no|nope|nothing|no response|no comments?|no suggestions?|-+|\.+)\.?$/i

export function classifyQuestion(report: SurveyReportResponse, question: string): QuestionKind {
  const answers = report.responses.map((response) => (response.answers[question] || '').trim()).filter(Boolean)
  if (!answers.length) return 'text'
  const rated = answers.filter((answer) => parseRating(answer) !== null).length
  if (rated / answers.length >= 0.8) return 'rating'
  if (answers.every((answer) => CHOICE_ANSWER.test(answer))) return 'choice'
  return 'text'
}

// Short chart labels (Ritesh's keyword style) keyed by the question text without its category prefix.
const SHORT_LABELS: Record<string, string> = {
  'content was what i expected': 'Content Expectations',
  'course objectives clearly stated': 'Course Objectives',
  'demonstrated knowledge of course content': 'Instructor Knowledge',
  'ease of use with self paced instruction': 'Ease of Use',
  'instructor/student interaction': 'Student Interaction',
  'organization of content': 'Organization',
  'orientation was thorough and clear': 'Orientation',
  'program met my needs': 'Program Met Needs',
  'responded to my questions quickly': 'Instructor Responsiveness',
  'satisfied with my learning experience': 'Learning Experience',
  'value of resource materials': 'Resource Materials',
}

export function defaultQuestionLabel(question: string): string {
  const colon = question.indexOf(':')
  const withoutPrefix = colon > 0 && colon <= 20 ? question.slice(colon + 1) : question
  const text = withoutPrefix.trim().replace(/[.?]+$/, '')
  return SHORT_LABELS[text.toLowerCase()] || text
}


export function questionLabel(question: string, config: QuestionConfigMap): string {
  return config[question]?.label?.trim() || defaultQuestionLabel(question)
}

export function summarizeRatings(report: SurveyReportResponse, questions: string[], config: QuestionConfigMap): RatingRow[] {
  return questions
    .filter((question) => !config[question]?.hidden)
    .map((question) => {
      const counts = [0, 0, 0, 0, 0]
      let na = 0
      for (const response of report.responses) {
        const rating = parseRating(response.answers[question] || '')
        if (rating === 'na') na += 1
        else if (rating !== null) counts[rating - 1] += 1
      }
      return { question, label: questionLabel(question, config), counts, na, total: counts.reduce((sum, count) => sum + count, 0) }
    })
    .filter((row) => row.total > 0)
    .sort((left, right) => left.label.localeCompare(right.label))
}

export function lowRatingShare(rows: RatingRow[]): { low: number; total: number; share: number | null } {
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const low = rows.reduce((sum, row) => sum + row.counts[0] + row.counts[1], 0)
  return { low, total, share: total ? low / total : null }
}

export function summarizeChoices(report: SurveyReportResponse, questions: string[], config: QuestionConfigMap): ChoiceRow[] {
  return questions.map((question) => {
    const counts = new Map<string, number>()
    for (const response of report.responses) {
      const answer = (response.answers[question] || '').trim()
      if (!answer) continue
      const key = answer.toLowerCase()
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return { question, label: questionLabel(question, config), counts: [...counts.entries()].map(([answer, count]) => ({ answer, count })).sort((a, b) => b.count - a.count) }
  })
}

// Order matters: first match wins. Tuned on Lauren's hand-sorted sample comments.
// Instructor first names/surnames come from the instructor partners in SalesPartnerReportsPage and the Nevada course list.
const CATEGORY_PATTERNS: Array<[CommentCategory, RegExp]> = [
  ['Technology', /technolog|technical|platform|website|web site|log ?in|password|email|spam|browser|computer|navigat|\bslow|glitch|\bbugs?\b|blurry|buffer|freez|crash|error|\bsound\b|\bsystem\b|\bload(ed|ing|s)?\b|\bscroll|\blinks?\b/i],
  ['Format', /online|self[- ]?paced|interactive|\bclass(es)?\b|\bzoom\b|\bteams\b|format|narrat|visuals?|\bppt\b|samples?|shorter|modern|covid|life ?styles?|recommend|printed|handout|rehash|webinar|schedule|at home|in[- ]person|convenien|flexib/i],
  ['Instructor', /instructor|teacher|presenter|speaker|professor|facilitator|taught|teaching|knowledg|easy to follow|explain|\b(?:abe|beth|cheryl|devon|donald|joseph|patricia|lauren|croteau|crawford|higgins|kristensen)\b/i],
  ['Content', /content|material|\bhours?\b|quiz|\blaws?\b|informative|information|topic|example|relevan|\bexams?\b|\btests?\b/i],

]

export function suggestCategory(text: string): CommentCategory {
  return CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || 'Other'
}

export function collectComments(report: SurveyReportResponse, questions: string[], config: QuestionConfigMap): CommentItem[] {
  const items: CommentItem[] = []
  for (const question of questions) {
    if (config[question]?.hidden) continue
    for (const response of report.responses) {
      const text = (response.answers[question] || '').trim()
      if (!text || EMPTY_COMMENT.test(text)) continue
      items.push({
        key: `${report.courseId}:${report.moduleId}:${response.id}:${question}`,
        responseId: response.id,
        name: response.name,
        question,
        questionLabel: questionLabel(question, config),
        text,
        suggested: suggestCategory(text),
      })
    }
  }
  return items
}
