import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardList, Copy, RefreshCw } from 'lucide-react'
import {
  OUTCOME_LABELS,
  RUN_STATUS_LABELS,
  type RosterRunReport,
  type StudentOutcome,
} from '@/lib/rosterRunReport'

const OUTCOME_STYLES: Record<StudentOutcome, string> = {
  submitted: 'bg-green-100 text-green-800 border-green-200',
  dry_run: 'bg-blue-100 text-blue-800 border-blue-200',
  already: 'bg-slate-100 text-slate-700 border-slate-200',
  skipped: 'bg-amber-100 text-amber-800 border-amber-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
}

function statusVariant(status: string): 'success' | 'destructive' | 'warning' | 'secondary' {
  if (status === 'submitted' || status === 'already_submitted') return 'success'
  if (status === 'failed') return 'destructive'
  if (status === 'blocked' || status === 'generated') return 'warning'
  return 'secondary'
}

function formatWhen(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

interface LastRunDetailsCardProps {
  report: RosterRunReport | null
  loading?: boolean
  onRefresh?: () => void
}

/** What the last roster run did: result, every error/warning, and each student's outcome with the reason. */
export function LastRunDetailsCard({ report, loading = false, onRefresh }: LastRunDetailsCardProps) {
  const problemCount = report ? report.students.filter((s) => s.outcome === 'failed' || s.outcome === 'skipped').length : 0
  const [onlyProblems, setOnlyProblems] = useState(true)
  const [copied, setCopied] = useState(false)

  const rows = useMemo(() => {
    if (!report) return []
    const order: Record<StudentOutcome, number> = { failed: 0, skipped: 1, already: 2, dry_run: 3, submitted: 4 }
    const list = onlyProblems && problemCount > 0
      ? report.students.filter((s) => s.outcome === 'failed' || s.outcome === 'skipped')
      : report.students
    return [...list].sort((a, b) => order[a.outcome] - order[b.outcome])
  }, [report, onlyProblems, problemCount])

  const copyIssues = async () => {
    if (!report) return
    const lines = [
      `Run ${formatWhen(report.completedAt)} - ${RUN_STATUS_LABELS[report.runStatus] || report.runStatus}${report.dryRun ? ' (Dry Run)' : ''}`,
      report.message,
      ...report.errors.map((e) => `ERROR${e.count > 1 ? ` x${e.count}` : ''}: ${e.text}`),
      ...report.warnings.map((w) => `WARNING${w.count > 1 ? ` x${w.count}` : ''}: ${w.text}`),
      ...report.rosters.filter((r) => r.error).map((r) => `ROSTER ${r.file || r.course}: ${r.status} - ${r.error}`),
      ...report.students
        .filter((s) => s.outcome === 'failed' || s.outcome === 'skipped')
        .map((s) => `${OUTCOME_LABELS[s.outcome]}: ${s.name} | ${s.course} | ${s.license || 'no license'} | ${s.reason}`),
    ].filter(Boolean)
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <Card id="last-run-details">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Last Run Details
            </CardTitle>
            <CardDescription>
              {report
                ? `Finished ${formatWhen(report.completedAt)}. Every error, warning and each student's result from the last roster run.`
                : 'Errors and student results from the last roster run appear here.'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <>
                {report.dryRun && <Badge variant="secondary">Dry Run</Badge>}
                <Badge variant={statusVariant(report.runStatus)}>{RUN_STATUS_LABELS[report.runStatus] || report.runStatus}</Badge>
                <Button size="sm" variant="outline" onClick={copyIssues}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  {copied ? 'Copied' : 'Copy issues'}
                </Button>
              </>
            )}
            {onRefresh && (
              <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!report ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{loading ? 'Loading last run...' : 'No roster run yet for this state.'}</p>
        ) : (
          <>
            {report.message && <p className="text-sm">{report.message}</p>}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: 'Completions', value: report.totals.completions, tone: 'text-foreground' },
                { label: report.dryRun ? 'Dry run OK' : 'Submitted', value: report.totals.submitted, tone: 'text-green-600' },
                { label: 'Already reported', value: report.totals.already, tone: 'text-slate-600' },
                { label: 'Not reported', value: report.totals.skipped, tone: 'text-amber-600' },
                { label: 'Failed', value: report.totals.failed, tone: 'text-red-600' },
              ].map((item) => (
                <div key={item.label} className="rounded-md border bg-white/60 p-2 text-center">
                  <p className={`text-xl font-bold ${item.tone}`}>{item.value}</p>
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>

            {report.errors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  Errors ({report.errors.reduce((n, e) => n + e.count, 0)})
                </p>
                <ul className="space-y-1 text-sm text-red-900">
                  {report.errors.map((issue) => (
                    <li key={issue.text} className="break-words">
                      • {issue.text}{issue.count > 1 && <span className="ml-1 text-xs text-red-700">(x{issue.count})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.warnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings ({report.warnings.length})
                </p>
                <ul className="space-y-1 text-sm text-amber-900">
                  {report.warnings.map((issue) => (
                    <li key={issue.text} className="break-words">• {issue.text}{issue.count > 1 && <span className="ml-1 text-xs">(x{issue.count})</span>}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.errors.length === 0 && report.warnings.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                No errors or warnings in this run.
              </p>
            )}

            {report.rosters.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">Roster files ({report.rosters.length})</p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">Course</th>
                        <th className="px-2 py-1.5 font-medium">Date</th>
                        <th className="px-2 py-1.5 font-medium">Students</th>
                        <th className="px-2 py-1.5 font-medium">Status</th>
                        <th className="px-2 py-1.5 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rosters.map((roster, index) => (
                        <tr key={`${roster.file}-${index}`} className={`border-t ${roster.error ? 'bg-red-50' : ''}`}>
                          <td className="px-2 py-1.5" title={roster.file}>{roster.course}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{roster.date || '-'}</td>
                          <td className="px-2 py-1.5">{roster.students}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{roster.status.replace(/_/g, ' ')}</td>
                          <td className="px-2 py-1.5 break-words text-muted-foreground">{roster.error || roster.message || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {report.students.length > 0 && (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    Students ({report.students.length}){problemCount > 0 && <span className="ml-1 font-normal text-amber-700">· {problemCount} not reported or failed</span>}
                  </p>
                  {problemCount > 0 && problemCount < report.students.length && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOnlyProblems((v) => !v)}>
                      {onlyProblems ? `Show all ${report.students.length}` : 'Show only problems'}
                    </Button>
                  )}
                </div>
                <div className="max-h-96 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted text-left">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">Student</th>
                        <th className="px-2 py-1.5 font-medium">Course</th>
                        <th className="px-2 py-1.5 font-medium">License</th>
                        <th className="px-2 py-1.5 font-medium">Completed</th>
                        <th className="px-2 py-1.5 font-medium">Result</th>
                        <th className="px-2 py-1.5 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={`${row.name}-${row.course}-${index}`} className="border-t align-top">
                          <td className="px-2 py-1.5 font-medium">{row.name}</td>
                          <td className="px-2 py-1.5">{row.course}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{row.license || <span className="text-red-600">missing</span>}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{row.completionDate || '-'}</td>
                          <td className="px-2 py-1.5">
                            <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] ${OUTCOME_STYLES[row.outcome]}`}>
                              {OUTCOME_LABELS[row.outcome]}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 break-words text-muted-foreground">{row.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
