// Turns a saved roster run summary (/roster-pipeline/history) into what the dashboard shows after a
// run: the result, every error and warning, and what happened to each student and roster file.

export type StudentOutcome = 'submitted' | 'dry_run' | 'already' | 'skipped' | 'failed'

export interface RunStudentRow {
  name: string
  course: string
  license: string
  completionDate: string
  outcome: StudentOutcome
  reason: string
}

export interface RunRosterRow {
  file: string
  course: string
  date: string
  students: number
  status: string
  error: string
  message: string
}

export interface RunIssue {
  text: string
  count: number
}

export interface RosterRunReport {
  startedAt: string | null
  completedAt: string | null
  dryRun: boolean
  runStatus: string
  message: string
  totals: { completions: number; submitted: number; already: number; skipped: number; failed: number }
  errors: RunIssue[]
  warnings: RunIssue[]
  students: RunStudentRow[]
  rosters: RunRosterRow[]
}

type Json = Record<string, unknown>

const text = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

const isObject = (value: unknown): value is Json => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function personName(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!isObject(value)) return ''
  return `${text(value.first_name)} ${text(value.last_name)}`.trim()
}

function countIssues(list: string[]): RunIssue[] {
  const counts = new Map<string, number>()
  for (const item of list) {
    if (!item) continue
    counts.set(item, (counts.get(item) || 0) + 1)
  }
  return [...counts.entries()].map(([issue, count]) => ({ text: issue, count }))
}

function studentOutcome(entry: Json): StudentOutcome {
  const reason = text(entry.reason)
  if (text(entry.error)) return 'failed'
  if (entry.success === true) return entry.dryRun === true || /dry run/i.test(reason) ? 'dry_run' : 'submitted'
  if (/already (reported|submitted|posted)|previously submitted|duplicate/i.test(reason)) return 'already'
  if (entry.skipped === true) return 'skipped'
  return reason ? 'skipped' : 'failed'
}

export function buildRosterRunReport(run: unknown): RosterRunReport | null {
  if (!isObject(run)) return null

  const errors = (Array.isArray(run.errors) ? run.errors : []).map((entry) => {
    if (typeof entry === 'string') return entry
    if (!isObject(entry)) return ''
    const message = text(entry.error) || text(entry.message)
    const who = personName(entry.completion)
    const course = isObject(entry.completion) ? text(entry.completion.course_name) : ''
    return who ? `${who}${course ? ` (${course})` : ''}: ${message}` : message
  })
  const warnings = (Array.isArray(run.warnings) ? run.warnings : []).map((warning) => (typeof warning === 'string' ? warning : text(isObject(warning) ? warning.message : '')))

  const students: RunStudentRow[] = (Array.isArray(run.entries) ? run.entries : [])
    .filter(isObject)
    .map((entry) => {
      const student = isObject(entry.student) ? entry.student : {}
      return {
        name: text(entry.studentName) || personName(entry.student) || 'Unknown student',
        course: text(entry.course) || text(entry.course_name) || '-',
        license: text(entry.licenseNumber) || text(student.license_number),
        completionDate: text(entry.completionDate) || text(student.date_completed),
        outcome: studentOutcome(entry),
        reason: text(entry.error) || text(entry.reason),
      }
    })

  const rosters: RunRosterRow[] = (Array.isArray(run.roster_submissions) ? run.roster_submissions : [])
    .filter(isObject)
    .map((roster) => ({
      file: text(roster.worksheet_filename) || text(roster.roster_filename),
      course: [text(roster.course_id), text(roster.title)].filter(Boolean).join(' - ') || '-',
      date: text(roster.date),
      students: Number(roster.attendees) || 0,
      status: text(roster.status) || '-',
      error: text(roster.error),
      message: text(roster.portal_message),
    }))

  return {
    startedAt: text(run.started_at) || null,
    completedAt: text(run.completed_at) || null,
    dryRun: run.dry_run === true || students.some((s) => s.outcome === 'dry_run'),
    runStatus: text(run.run_status) || (errors.length > 0 ? 'failed' : 'completed'),
    message: text(run.message),
    totals: {
      completions: Number(run.total_completions) || students.length,
      submitted: Number(run.successful) || 0,
      already: Number(run.already_posted) || 0,
      skipped: Math.max(0, (Number(run.skipped) || 0) - (Number(run.already_posted) || 0)),
      failed: Number(run.failed) || 0,
    },
    errors: countIssues(errors),
    warnings: countIssues(warnings),
    students,
    rosters,
  }
}

export const RUN_STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  already_submitted: 'Already Submitted',
  generated: 'Built, Not Submitted',
  dry_run: 'Dry Run',
  no_changes: 'Nothing New',
  no_completions: 'No Completions',
  blocked: 'Waiting',
  failed: 'Failed',
  completed: 'Completed',
}

export const OUTCOME_LABELS: Record<StudentOutcome, string> = {
  submitted: 'Submitted',
  dry_run: 'Dry run',
  already: 'Already reported',
  skipped: 'Not reported',
  failed: 'Failed',
}
