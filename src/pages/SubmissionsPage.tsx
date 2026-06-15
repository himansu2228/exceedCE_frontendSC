import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Filter,
  Code,
  Loader2,
} from 'lucide-react'
import { formatDateTime, getStatusColor } from '@/lib/utils'
import { getSubmissions } from '@/lib/api'
import type { SubmissionEntry } from '@/lib/api'

const statusIcons: Record<string, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
  skipped: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  duplicate: <Clock className="h-4 w-4 text-orange-500" />,
  'dry-run': <Code className="h-4 w-4 text-purple-500" />,
}

export function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionEntry | null>(null)

  // Fetch submissions from API
  useEffect(() => {
    async function fetchSubmissions() {
      try {
        setLoading(true)
        setError(null)
        const data = await getSubmissions()
        setSubmissions(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch submissions')
      } finally {
        setLoading(false)
      }
    }
    fetchSubmissions()
  }, [])

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
      ...filteredSubmissions.map(sub => {
        const row = [
          `"${sub.student.first_name} ${sub.student.last_name}"`,
          `"${sub.student.email}"`,
          `"${sub.exceed_course_name}"`,
          sub.ceb_course_id,
          sub.student.exceedce_license || sub.student.license_number || 'N/A',
          sub.student.exceedce_profession || sub.student.licensee_profession || 'N/A',
          sub.student.date_completed,
          `"${formatDateTime(sub.submission.attempted_at)}"`,
          sub.submission.status,
          sub.submission.error_code || '',
          `"${sub.submission.error_message || sub.submission.reason || ''}"`
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

  const filteredSubmissions = submissions.filter((sub) => {
    const matchesSearch =
      sub.student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.exceed_course_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || sub.submission.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const stats = {
    total: submissions.length,
    ok: submissions.filter((s) => s.submission.status === 'ok').length,
    error: submissions.filter((s) => s.submission.status === 'error').length,
    skipped: submissions.filter((s) => s.submission.status === 'skipped').length,
    duplicate: submissions.filter((s) => s.submission.status === 'duplicate').length,
  }

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
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="cursor-pointer hover:border-blue-300" onClick={() => setStatusFilter('all')}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-300" onClick={() => setStatusFilter('ok')}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
            <p className="text-sm text-muted-foreground">Successful</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-red-300" onClick={() => setStatusFilter('error')}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">{stats.error}</p>
            <p className="text-sm text-muted-foreground">Errors</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-yellow-300" onClick={() => setStatusFilter('skipped')}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-yellow-600">{stats.skipped}</p>
            <p className="text-sm text-muted-foreground">Skipped</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-orange-300" onClick={() => setStatusFilter('duplicate')}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-orange-600">{stats.duplicate}</p>
            <p className="text-sm text-muted-foreground">Duplicates</p>
          </CardContent>
        </Card>
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
              {filteredSubmissions.map((sub) => (
                <TableRow key={sub.key}>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {sub.student.first_name} {sub.student.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{sub.student.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      <p className="text-sm truncate">{sub.exceed_course_name}</p>
                      <p className="text-xs text-muted-foreground">CEB: {sub.ceb_course_id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <code className="text-sm">{sub.student.exceedce_license || sub.student.license_number || 'N/A'}</code>
                      {(sub.student.exceedce_profession || sub.student.licensee_profession) && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {sub.student.exceedce_profession || sub.student.licensee_profession}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{sub.student.date_completed}</TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(sub.submission.attempted_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusIcons[sub.submission.status]}
                      <Badge className={getStatusColor(sub.submission.status)}>
                        {sub.submission.status}
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
                              <p className="font-medium">{sub.student.first_name} {sub.student.last_name}</p>
                              <p className="text-sm text-muted-foreground">{sub.student.email}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-muted-foreground mb-1">License (ExceedCE)</h4>
                              <p className="font-medium">{sub.student.exceedce_license || sub.student.license_number || 'N/A'}</p>
                              <p className="text-sm text-muted-foreground">{sub.student.exceedce_profession || sub.student.licensee_profession || 'N/A'}</p>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Course</h4>
                            <p className="font-medium">{sub.exceed_course_name}</p>
                            <p className="text-sm text-muted-foreground">
                              ExceedCE ID: {sub.exceed_course_id} | CE Broker ID: {sub.ceb_course_id}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold text-sm text-muted-foreground mb-1">Status</h4>
                              <div className="flex items-center gap-2">
                                {statusIcons[sub.submission.status]}
                                <Badge className={getStatusColor(sub.submission.status)}>
                                  {sub.submission.status}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-muted-foreground mb-1">HTTP Status</h4>
                              <p className="font-medium">{sub.submission.httpStatus || 'N/A'}</p>
                            </div>
                          </div>

                          {(sub.submission.error_code || sub.submission.error_message || sub.submission.reason) && (
                            <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                              <h4 className="font-semibold text-red-800 mb-1">Error Details</h4>
                              {sub.submission.error_code && (
                                <p className="text-sm text-red-700">Code: {sub.submission.error_code}</p>
                              )}
                              <p className="text-sm text-red-700">
                                {sub.submission.error_message || sub.submission.reason}
                              </p>
                            </div>
                          )}

                          <div>
                            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Attempted At</h4>
                            <p className="font-medium">{formatDateTime(sub.submission.attempted_at)}</p>
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
