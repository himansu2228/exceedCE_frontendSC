import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { CalendarCheck2, RefreshCw, Search } from 'lucide-react'

import { getCbaTabularUsers, getCompletedEntries, invalidateApiCache, type CbaUserRow, type CompletedEntry } from '@/lib/api'

type SortKey = 'date' | 'name' | 'course' | 'state'
type SortDirection = 'asc' | 'desc'

interface CbaCompletionRow extends CompletedEntry {
  cbaUser: CbaUserRow
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

function normalizeId(value: string | number | null | undefined): string {
  return String(value ?? '').trim()
}

export function SalesCBACompletionsPage() {
  const [rows, setRows] = useState<CbaCompletionRow[]>([])
  const [cbaUsers, setCbaUsers] = useState<CbaUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)

  const loadRows = async (refresh = false) => {
    setLoading(true)
    setError(null)
    if (refresh) {
      invalidateApiCache('/sales/cba-users')
      invalidateApiCache('/completions')
    }

    const [completionResult, cbaResult] = await Promise.allSettled([
      getCompletedEntries({ allStates: true, rawFields: true, refresh, timeoutMs: 90000 }),
      getCbaTabularUsers(),
    ])

    const completionResponse = completionResult.status === 'fulfilled' ? completionResult.value : null
    const cbaResponse = cbaResult.status === 'fulfilled' ? cbaResult.value : null

    if (!completionResponse || !cbaResponse) {
      const messages = [
        completionResult.status === 'rejected'
          ? `Completions: ${completionResult.reason instanceof Error ? completionResult.reason.message : 'failed'}`
          : '',
        cbaResult.status === 'rejected'
          ? `CBA users: ${cbaResult.reason instanceof Error ? cbaResult.reason.message : 'failed'}`
          : '',
      ].filter(Boolean)
      setError(messages.join(' | ') || 'Failed to load CBA completions')
    }

    const nextCbaUsers = cbaResponse?.items ?? []
    const cbaByUserId = new Map<string, CbaUserRow>()
    for (const user of nextCbaUsers) {
      const id = normalizeId(user.id)
      if (id) cbaByUserId.set(id, user)
    }

    const matchedRows = (completionResponse?.entries ?? [])
      .map((entry) => {
        const user = cbaByUserId.get(normalizeId(entry.user_id))
        return user ? { ...entry, cbaUser: user } : null
      })
      .filter((entry): entry is CbaCompletionRow => entry !== null)

    setCbaUsers(nextCbaUsers)
    setRows(matchedRows)
    setPage(1)
    setLoading(false)
  }

  useEffect(() => {
    void loadRows()
  }, [])

  const filteredRows = useMemo(() => {
    const searchText = search.trim().toLowerCase()
    if (!searchText) return rows

    return rows.filter((row) => {
      const haystack = [
        row.user_id,
        row.full_name,
        row.email,
        row.course_name,
        row.state,
        row.license_number,
        row.licensee_profession,
        row.cbaUser.completion,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(searchText)
    })
  }, [rows, search])

  const sortedRows = useMemo(() => {
    const nextRows = [...filteredRows]
    nextRows.sort((a, b) => {
      let result = 0

      if (sortBy === 'date') {
        const aTs = a.date_completed_iso ? Date.parse(a.date_completed_iso) : 0
        const bTs = b.date_completed_iso ? Date.parse(b.date_completed_iso) : 0
        result = aTs - bTs
      } else if (sortBy === 'name') {
        result = a.full_name.localeCompare(b.full_name)
      } else if (sortBy === 'course') {
        result = a.course_name.localeCompare(b.course_name)
      } else {
        result = a.state.localeCompare(b.state)
      }

      return sortDirection === 'asc' ? result : -result
    })
    return nextRows
  }, [filteredRows, sortBy, sortDirection])

  const uniqueUsers = useMemo(() => new Set(rows.map((row) => normalizeId(row.user_id))).size, [rows])
  const totalItems = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * perPage
    return sortedRows.slice(start, start + perPage)
  }, [safePage, perPage, sortedRows])

  useEffect(() => {
    setPage(1)
  }, [search, sortBy, sortDirection, perPage])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CalendarCheck2 className="h-8 w-8 text-emerald-500" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">CBA Completion</h1>
            <p className="text-sm text-muted-foreground">
              Completed learners matched with Commercial Brokers Association portal members
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => void loadRows(true)}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search user, email, course, state, license"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Completion Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="course">Course</SelectItem>
              <SelectItem value="state">State</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as SortDirection)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">CBA users: {cbaUsers.length}</Badge>
            <Badge variant="outline">Completed users: {uniqueUsers}</Badge>
            <Badge variant="outline">Completion rows: {rows.length}</Badge>
            <Badge variant="outline">Filtered: {totalItems}</Badge>
            <Badge variant="outline">Page: {safePage}/{totalPages}</Badge>
            {loading ? <Badge variant="warning">Loading...</Badge> : null}
            {error ? <Badge variant="error">{error}</Badge> : null}
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table className="min-w-[1250px]">
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Profession</TableHead>
                  <TableHead>CBA Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && pagedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                      No CBA completion rows found.
                    </TableCell>
                  </TableRow>
                ) : null}

                {pagedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.user_id || '-'}</TableCell>
                    <TableCell>{row.full_name || '-'}</TableCell>
                    <TableCell>{row.email || '-'}</TableCell>
                    <TableCell className="max-w-[360px] truncate">{row.course_name || '-'}</TableCell>
                    <TableCell>{row.state || '-'}</TableCell>
                    <TableCell>{formatDate(row.date_completed_iso || row.date_completed)}</TableCell>
                    <TableCell>{row.license_number || '-'}</TableCell>
                    <TableCell>{row.licensee_profession || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="success">{row.cbaUser.completion || 'CBA member'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationControls
            page={safePage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={perPage}
            pageSizeOptions={[20, 50, 100, 200]}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPageSizeChange={(size) => setPerPage(size)}
          />
        </CardContent>
      </Card>
    </div>
  )
}