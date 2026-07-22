import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, FileEdit, RefreshCw, AlertCircle } from 'lucide-react'
import {
  getRosterPipelineEntries,
  postSelectedRosterEntries,
  type RosterPipelineEntry,
} from '@/lib/api'
import { PaginationControls } from '@/components/ui/pagination-controls'

export function RosterPostingEntriesPage() {
  const [entries, setEntries] = useState<RosterPipelineEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postingIds, setPostingIds] = useState<Record<string, boolean>>({})
  const [dryRun, setDryRun] = useState(true)
  const [sinceDate, setSinceDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [totalEntries, setTotalEntries] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const data = await getRosterPipelineEntries({ sinceDate, page, perPage })
      setEntries(data.entries || [])
      setTotalEntries(data.total || 0)
      setTotalPages(data.totalPages || 1)
      setSelectedIds({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roster entries')
    } finally {
      setLoading(false)
    }
  }, [sinceDate, page, perPage])

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds({})
  }

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedIds[entry.id]),
    [entries, selectedIds]
  )

  const allSelected = entries.length > 0 && selectedEntries.length === entries.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds({})
      return
    }

    const next: Record<string, boolean> = {}
    entries.forEach((entry) => {
      next[entry.id] = true
    })
    setSelectedIds(next)
  }

  const handleSinglePost = async (entry: RosterPipelineEntry) => {
    setError(null)
    setSuccess(null)
    setPostingIds((prev) => ({ ...prev, [entry.id]: true }))

    try {
      const result = await postSelectedRosterEntries({ entries: [entry], dryRun })
      const done = result.summary?.successful ?? 0
      const failed = result.summary?.failed ?? 0
      const skipped = result.summary?.skipped ?? 0
      setSuccess(`Single post completed. Success: ${done}, Failed: ${failed}, Skipped: ${skipped}`)
      await loadEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Single post failed')
    } finally {
      setPostingIds((prev) => ({ ...prev, [entry.id]: false }))
    }
  }

  const handleBulkPost = async () => {
    if (selectedEntries.length === 0) {
      setError('Please select at least one entry')
      return
    }

    setPosting(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await postSelectedRosterEntries({ entries: selectedEntries, dryRun })
      const done = result.summary?.successful ?? 0
      const failed = result.summary?.failed ?? 0
      const skipped = result.summary?.skipped ?? 0
      setSuccess(`Bulk post completed. Success: ${done}, Failed: ${failed}, Skipped: ${skipped}`)
      await loadEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk post failed')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileEdit className="h-8 w-8 text-blue-500" />
            Roster Entries
          </h1>
          <p className="text-muted-foreground mt-1">
            Entries list with single post and multi-select bulk post actions.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>Load entries first, then post single or bulk selections.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Completion On</Label>
              <Input
                type="date"
                value={sinceDate}
                onChange={(e) => setSinceDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <Switch id="roster-dry-run" checked={dryRun} onCheckedChange={setDryRun} />
              <Label htmlFor="roster-dry-run">Dry Run</Label>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <Button onClick={loadEntries} disabled={loading || posting}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Load Entries
              </Button>
              <Button
                variant="secondary"
                onClick={handleBulkPost}
                disabled={posting || selectedEntries.length === 0 || loading}
              >
                {posting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Post Selected ({selectedEntries.length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Entries
            <Badge variant="secondary">{totalEntries}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading entries...
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No entries found. Load entries first.
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  totalItems={totalEntries}
                  pageSize={perPage}
                  onPageChange={handlePageChange}
                  onPageSizeChange={(size) => {
                    setPerPage(size)
                    setPage(1)
                    setSelectedIds({})
                  }}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-2 text-left">
                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                      </th>
                      <th className="py-3 px-2 text-left">Student</th>
                      <th className="py-3 px-2 text-left">License</th>
                      <th className="py-3 px-2 text-left">Course</th>
                      <th className="py-3 px-2 text-left">Date</th>
                      <th className="py-3 px-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b last:border-none">
                        <td className="py-3 px-2">
                          <input
                            type="checkbox"
                            checked={!!selectedIds[entry.id]}
                            onChange={(e) =>
                              setSelectedIds((prev) => ({ ...prev, [entry.id]: e.target.checked }))
                            }
                          />
                        </td>
                        <td className="py-3 px-2 font-medium">{entry.first_name} {entry.last_name}</td>
                        <td className="py-3 px-2">{entry.licenseNumber || '-'}</td>
                        <td className="py-3 px-2">{entry.course_name}</td>
                        <td className="py-3 px-2">{entry.completion_date ? new Date(entry.completion_date).toLocaleString() : '-'}</td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleSinglePost(entry)}
                            disabled={posting || loading || postingIds[entry.id]}
                          >
                            {postingIds[entry.id] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Post
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
