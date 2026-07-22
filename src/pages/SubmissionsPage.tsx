import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  Download,
  Code,
  Loader2,
  Zap,
  RefreshCw,
} from 'lucide-react'
import { formatDateTime, getStatusColor } from '@/lib/utils'
import { getCompletedEntries, getSubmissionsPaginated, resolveLicenseProfession, relookupAllProfessions } from '@/lib/api'
import type { CompletedEntry, SubmissionEntry } from '@/lib/api'
import { PaginationControls } from '@/components/ui/pagination-controls'

// Map profession names to CE Broker codes
const PROFESSION_TO_CODE: Record<string, string> = {
  'associate': 'RELS',
  'salesperson': 'RELS',
  'real estate salesperson': 'RELS',
  'broker': 'REB',
  'real estate broker': 'REB',
  'broker-in-charge': 'BIC',
  'property manager': 'PM',
  // Already codes
  'rels': 'RELS',
  'reb': 'REB',
  'rebr': 'REB',
  'bic': 'BIC',
  'pm': 'PM',
}

// Invalid profession values that shouldn't be displayed
const INVALID_PROFESSIONS = new Set(['rn', 'registered nurse', 're', 'n/a', 'none', ''])

// Map raw profession to display code
function mapProfessionToCode(raw: string | null | undefined): string {
  if (!raw) return ''
  const normalized = raw.toLowerCase().trim()
  
  // Skip invalid values
  if (INVALID_PROFESSIONS.has(normalized)) return ''
  
  // Check if already a valid code
  const mapped = PROFESSION_TO_CODE[normalized]
  if (mapped) return mapped
  
  // Return original if it looks like a valid CE Broker code (2-4 uppercase letters)
  if (/^[A-Z]{2,4}$/i.test(raw.trim())) return raw.trim().toUpperCase()
  
  // If looks like a name (has spaces or long), just return empty
  // This will trigger the "Resolve" button to appear
  return ''
}

const statusIcons: Record<string, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
  skipped: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  duplicate: <Clock className="h-4 w-4 text-orange-500" />,
  'dry-run': <Code className="h-4 w-4 text-purple-500" />,
}

export function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionEntry[]>([])
  const [completedEntries, setCompletedEntries] = useState<CompletedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedFallbackNotice, setCompletedFallbackNotice] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [_selectedSubmission, setSelectedSubmission] = useState<SubmissionEntry | null>(null)
  const [lookupInProgress, setLookupInProgress] = useState<Set<string>>(new Set())
  const [lookupResults, setLookupResults] = useState<Map<string, string>>(new Map())
  const [batchLookupInProgress, setBatchLookupInProgress] = useState(false)
  const [batchLookupResult, setBatchLookupResult] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [totalSubmissions, setTotalSubmissions] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const normalizeLicense = (value?: string | null) => String(value || '').trim().toUpperCase()

  const professionLookup = useMemo(() => {
    const byUserId = new Map<number, string>()
    const byLicense = new Map<string, string>()
    const byEmail = new Map<string, string>()

    for (const entry of completedEntries) {
      const rawProfession = String(entry.licensee_profession || '').trim()
      // Map and validate profession - skip invalid values
      const profession = mapProfessionToCode(rawProfession)
      if (!profession) continue

      if (typeof entry.user_id === 'number' && !byUserId.has(entry.user_id)) {
        byUserId.set(entry.user_id, profession)
      }

      const license = normalizeLicense(entry.license_number)
      if (license && !byLicense.has(license)) {
        byLicense.set(license, profession)
      }

      const email = String(entry.email || '').trim().toLowerCase()
      if (email && !byEmail.has(email)) {
        byEmail.set(email, profession)
      }
    }

    return { byUserId, byLicense, byEmail }
  }, [completedEntries])

  const getSubmissionProfession = (sub: SubmissionEntry): string => {
    // First try exceedce_profession (actual profession name from CE Broker/LLR lookup)
    const exceedceProfession = String(sub.student?.exceedce_profession || '').trim()
    const mappedExceedce = mapProfessionToCode(exceedceProfession)
    if (mappedExceedce) return mappedExceedce

    // Then try licensee_profession (stored code)
    const licenseeProfession = String(sub.student?.licensee_profession || '').trim()
    const mappedLicensee = mapProfessionToCode(licenseeProfession)
    if (mappedLicensee) return mappedLicensee

    // Fallback to lookup from completed entries
    if (typeof sub.student?.user_id === 'number') {
      const fromUser = professionLookup.byUserId.get(sub.student.user_id)
      const mappedUser = mapProfessionToCode(fromUser)
      if (mappedUser) return mappedUser
    }

    const license = normalizeLicense(sub.student?.exceedce_license || sub.student?.license_number)
    if (license) {
      const fromLicense = professionLookup.byLicense.get(license)
      const mappedLicense = mapProfessionToCode(fromLicense)
      if (mappedLicense) return mappedLicense
    }

    const email = String(sub.student?.email || '').trim().toLowerCase()
    if (email) {
      const fromEmail = professionLookup.byEmail.get(email)
      const mappedEmail = mapProfessionToCode(fromEmail)
      if (mappedEmail) return mappedEmail
    }

    // Check if we have a real-time lookup result
    if (license) {
      const fromLookup = lookupResults.get(license)
      const mappedLookup = mapProfessionToCode(fromLookup)
      if (mappedLookup) return mappedLookup
    }

    return ''
  }

  // Real-time LLR license resolution
  const handleResolveLicenseRealtime = async (licenseNumber: string) => {
    if (!licenseNumber) return
    
    const normalized = normalizeLicense(licenseNumber)
    if (!normalized) return

    // Skip if already resolved or in progress
    if (lookupResults.has(normalized) || lookupInProgress.has(normalized)) {
      return
    }

    setLookupInProgress(prev => new Set(prev).add(normalized))

    try {
      const result = await resolveLicenseProfession(normalized)
      if (result.found && result.professionCode) {
        setLookupResults(prev => new Map(prev).set(normalized, result.professionCode || 'RE'))
      } else if (result.error) {
        console.warn(`LLR lookup error for ${normalized}: ${result.error}`)
      }
    } catch (err) {
      console.error(`LLR lookup failed for ${normalized}:`, err)
    } finally {
      setLookupInProgress(prev => {
        const next = new Set(prev)
        next.delete(normalized)
        return next
      })
    }
  }

  // Batch re-lookup professions from CE Broker
  const handleBatchRelookupProfessions = async () => {
    setBatchLookupInProgress(true)
    setBatchLookupResult(null)
    try {
      const result = await relookupAllProfessions()
      if (result.success) {
        setBatchLookupResult(`Updated ${result.successful}/${result.total} licenses. ${result.multiple > 0 ? `${result.multiple} had multiple professions.` : ''} ${result.failed > 0 ? `${result.failed} failed.` : ''}`)
        // Refresh the data
        const [submissionResult, completedResult] = await Promise.allSettled([
          getSubmissionsPaginated({
            page,
            perPage,
            search: searchTerm.trim() || undefined,
            status: statusFilter,
          }),
          getCompletedEntries({ resolveProfession: true, timeoutMs: 12000 }),
        ])
        if (submissionResult.status === 'fulfilled') {
          setSubmissions(submissionResult.value.items)
          setTotalSubmissions(submissionResult.value.total)
          setTotalPages(submissionResult.value.totalPages)
        }
        if (completedResult.status === 'fulfilled') {
          setCompletedEntries(completedResult.value.entries)
        }
      } else {
        setBatchLookupResult('Failed to re-lookup professions')
      }
    } catch (err) {
      setBatchLookupResult(err instanceof Error ? err.message : 'Failed to re-lookup professions')
    } finally {
      setBatchLookupInProgress(false)
    }
  }

  const fetchSubmissionsPage = async (loadCompleted = false) => {
    try {
      setLoading(true)
      setError(null)
      if (loadCompleted) {
        setCompletedFallbackNotice(null)
      }

      const [submissionResult, completedResult] = await Promise.allSettled([
        getSubmissionsPaginated({
          page,
          perPage,
          search: searchTerm.trim() || undefined,
          status: statusFilter,
        }),
        loadCompleted
          ? getCompletedEntries({ resolveProfession: true, timeoutMs: 12000 })
          : Promise.resolve({ entries: completedEntries, total: completedEntries.length, courses_scanned: 0 }),
      ])

      if (submissionResult.status !== 'fulfilled') {
        throw submissionResult.reason
      }

      setSubmissions(submissionResult.value.items)
      setTotalSubmissions(submissionResult.value.total)
      setTotalPages(submissionResult.value.totalPages)

      if (loadCompleted) {
        if (completedResult.status === 'fulfilled') {
          setCompletedEntries(completedResult.value.entries)
        } else {
          setCompletedEntries([])
          setCompletedFallbackNotice('Completed-enrichment data timed out, so profession badges may be partial right now.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch submissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchSubmissionsPage(true)
  }, [])

  useEffect(() => {
    if (!loading) {
      void fetchSubmissionsPage(false)
    }
  }, [page, perPage, searchTerm, statusFilter])

  // Export submissions to CSV
  const handleExport = () => {
    const headers = [
      'Student Name',
      'Email',
      'Course',
      'CE Broker Course ID',
      'License Number',
      'License Type',
      'Completed Date',
      'Submitted Date',
      'Status',
      'Error Code',
      'Error Message'
    ]

    const csvRows = [
      headers.join(','),
      ...submissions.map(sub => {
        const row = [
          `"${sub.student?.first_name || ''} ${sub.student?.last_name || ''}"`,
          `"${sub.student?.email || ''}"`,
          `"${sub.exceed_course_name || ''}"`,
          sub.ceb_course_id || '',
          sub.student?.exceedce_license || sub.student?.license_number || 'N/A',
          getSubmissionProfession(sub) || 'N/A',
          sub.student?.date_completed || '',
          `"${formatDateTime(sub.submission?.attempted_at)}"`,
          sub.submission?.status || '',
          sub.submission?.error_code || '',
          `"${sub.submission?.error_message || sub.submission?.reason || ''}"`
        ]
        return row.join(',')
      })
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `ce-broker-submissions-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const stats = {
    total: totalSubmissions,
    ok: submissions.filter((s) => s.submission?.status === 'ok').length,
    error: submissions.filter((s) => s.submission?.status === 'error').length,
    skipped: submissions.filter((s) => s.submission?.status === 'skipped').length,
    duplicate: submissions.filter((s) => s.submission?.status === 'duplicate').length,
  }

  const statTiles = [
    {
      key: 'all',
      label: 'Total',
      value: stats.total.toLocaleString(),
      icon: Search,
      accent: 'from-blue-500 to-indigo-500',
      ring: 'ring-blue-200',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      key: 'ok',
      label: 'Successful',
      value: stats.ok.toLocaleString(),
      icon: CheckCircle2,
      accent: 'from-emerald-500 to-green-500',
      ring: 'ring-emerald-200',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      key: 'error',
      label: 'Errors',
      value: stats.error.toLocaleString(),
      icon: XCircle,
      accent: 'from-rose-500 to-red-500',
      ring: 'ring-rose-200',
      bg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
    {
      key: 'skipped',
      label: 'Skipped',
      value: stats.skipped.toLocaleString(),
      icon: AlertTriangle,
      accent: 'from-amber-500 to-yellow-500',
      ring: 'ring-amber-200',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      key: 'duplicate',
      label: 'Duplicates',
      value: stats.duplicate.toLocaleString(),
      icon: Clock,
      accent: 'from-orange-500 to-amber-500',
      ring: 'ring-orange-200',
      bg: 'bg-orange-50',
      iconColor: 'text-orange-600',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading submissions...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <p className="text-red-600 font-medium">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {completedFallbackNotice && (
        <Alert>
          <AlertDescription>{completedFallbackNotice}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
        {statTiles.map((tile) => {
          const active = statusFilter === tile.key
          return (
            <Card
              key={tile.key}
              className={`relative cursor-pointer overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-[6px] ${active ? 'ring-2 ring-primary/35 border-primary/45' : ''}`}
              onClick={() => {
                setStatusFilter(tile.key)
                setPage(1)
              }}
            >
              <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${tile.accent}`} />
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-[11px]">{tile.label}</p>
                    <p className="mt-1 text-xl font-semibold leading-tight text-foreground sm:text-2xl">{tile.value}</p>
                  </div>
                  <div className={`rounded-md p-1.5 ring-1 ${tile.ring} ${tile.bg}`}>
                    <tile.icon className={`h-3.5 w-3.5 ${tile.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>CE Broker Submissions</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search submissions..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setPage(1)
                  }}
                  className="pl-9"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBatchRelookupProfessions}
                disabled={batchLookupInProgress}
              >
                {batchLookupInProgress ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Fix Professions
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
            {batchLookupResult && (
              <div className="mt-2 text-sm text-muted-foreground">
                {batchLookupResult}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={totalSubmissions}
              pageSize={perPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPerPage(size)
                setPage(1)
              }}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => (
                <TableRow key={sub.key}>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {sub.student?.first_name || ''} {sub.student?.last_name || ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{sub.student?.email || ''}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      <p className="text-sm truncate">{sub.exceed_course_name || ''}</p>
                      <p className="text-xs text-muted-foreground">CEB: {sub.ceb_course_id || ''}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <code className="text-sm">{sub.student?.exceedce_license || sub.student?.license_number || 'N/A'}</code>
                      {getSubmissionProfession(sub) && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {getSubmissionProfession(sub)}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{sub.student?.date_completed || ''}</TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(sub.submission?.attempted_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusIcons[sub.submission?.status || 'skipped']}
                      <Badge className={getStatusColor(sub.submission?.status || '')}>
                        {sub.submission?.status || 'unknown'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSubmission(sub)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Submission Details</DialogTitle>
                          <DialogDescription>
                            Key: {sub.key}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold text-sm text-muted-foreground mb-1">Student</h4>
                              <p className="font-medium">{sub.student?.first_name || ''} {sub.student?.last_name || ''}</p>
                              <p className="text-sm text-muted-foreground">{sub.student?.email || ''}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-muted-foreground mb-1">License (ExceedCE)</h4>
                              <p className="font-medium">{sub.student?.exceedce_license || sub.student?.license_number || 'N/A'}</p>
                              <div className="flex items-center gap-2 mt-2">
                                {getSubmissionProfession(sub) && (
                                  <Badge variant="outline" className="text-xs">
                                    {getSubmissionProfession(sub)}
                                  </Badge>
                                )}
                                {(sub.student?.exceedce_license || sub.student?.license_number) && !getSubmissionProfession(sub) && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleResolveLicenseRealtime(sub.student?.exceedce_license || sub.student?.license_number || '')}
                                    disabled={lookupInProgress.has(normalizeLicense(sub.student?.exceedce_license || sub.student?.license_number))}
                                  >
                                    {lookupInProgress.has(normalizeLicense(sub.student?.exceedce_license || sub.student?.license_number)) ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Zap className="h-3 w-3 mr-1" />
                                    )}
                                    Resolve
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Course</h4>
                            <p className="font-medium">{sub.exceed_course_name || ''}</p>
                            <p className="text-sm text-muted-foreground">
                              ExceedCE ID: {sub.exceed_course_id || ''} | CE Broker ID: {sub.ceb_course_id || ''}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold text-sm text-muted-foreground mb-1">Status</h4>
                              <div className="flex items-center gap-2">
                                {statusIcons[sub.submission?.status || 'skipped']}
                                <Badge className={getStatusColor(sub.submission?.status || '')}>
                                  {sub.submission?.status || 'unknown'}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-muted-foreground mb-1">HTTP Status</h4>
                              <p className="font-medium">{sub.submission?.httpStatus || 'N/A'}</p>
                            </div>
                          </div>

                          {(sub.submission?.error_code || sub.submission?.error_message || sub.submission?.reason) && (
                            <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                              <h4 className="font-semibold text-red-800 mb-1">Error Details</h4>
                              {sub.submission?.error_code && (
                                <p className="text-sm text-red-700">Code: {sub.submission.error_code}</p>
                              )}
                              <p className="text-sm text-red-700">
                                {sub.submission?.error_message || sub.submission?.reason}
                              </p>
                            </div>
                          )}

                          <div>
                            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Attempted At</h4>
                            <p className="font-medium">{formatDateTime(sub.submission?.attempted_at)}</p>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
