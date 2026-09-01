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
import { Search, RefreshCw, Zap } from 'lucide-react'

import { getCbaTabularUsers } from '@/lib/api'

const CBA_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1Ybwii_XozjqthwI77fmalbWbmOWBcAXrXAsAFLd8UfA/gviz/tq?tqx=out:csv&sheet=Live_List'

interface CbaRow {
  addedToCba: string
  id: string
  firstName: string
  lastName: string
  email: string
  completion: string
  lastLogin: string
  removedFromCba: string
  emailUpdate: string
  lockAcct: string
  missingCourses: string
  addedLlProUpdate: string
}

type SortKey = 'id' | 'firstName' | 'completion' | 'lastLogin'
type SortDirection = 'asc' | 'desc'

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => parseCsvLine(line))
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseCompletionValue(value: string): { done: number; total: number } {
  const match = value.match(/(\d+)\s*\/\s*(\d+)/)
  if (!match) return { done: 0, total: 0 }
  return {
    done: Number(match[1]) || 0,
    total: Number(match[2]) || 0,
  }
}



function parseLastLoginAgeDays(value: string): number {
  const input = value.trim().toLowerCase()
  if (!input) return Number.POSITIVE_INFINITY
  if (input === 'never') return Number.POSITIVE_INFINITY
  if (input === 'today') return 0

  const match = input.match(/(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago/)
  if (!match) return Number.POSITIVE_INFINITY

  const amount = Number(match[1]) || 0
  const unit = match[2]

  if (unit.startsWith('day')) return amount
  if (unit.startsWith('week')) return amount * 7
  if (unit.startsWith('month')) return amount * 30
  if (unit.startsWith('year')) return amount * 365
  return Number.POSITIVE_INFINITY
}

function mapSheetRows(rows: string[][]): CbaRow[] {
  if (rows.length <= 1) return []

  const headers = rows[0].map((col) => normalizeHeader(col))
  const findIndex = (name: string): number => headers.indexOf(normalizeHeader(name))

  const indexes = {
    addedToCba: findIndex('Added to CBA'),
    id: findIndex('ID'),
    firstName: findIndex('First Name'),
    lastName: findIndex('Last Name'),
    email: findIndex('Email'),
    completion: findIndex('Completion'),
    lastLogin: findIndex('Last Login'),
    removedFromCba: findIndex('Removed from CBA'),
    emailUpdate: findIndex('Email Update'),
    lockAcct: findIndex('Lock Acct'),
    missingCourses: findIndex('Missing courses'),
    addedLlProUpdate: findIndex('Added LL Pro Update'),
  }

  return rows
    .slice(1)
    .map((row) => ({
      addedToCba: row[indexes.addedToCba] || '',
      id: row[indexes.id] || '',
      firstName: row[indexes.firstName] || '',
      lastName: row[indexes.lastName] || '',
      email: row[indexes.email] || '',
      completion: row[indexes.completion] || '',
      lastLogin: row[indexes.lastLogin] || '',
      removedFromCba: row[indexes.removedFromCba] || '',
      emailUpdate: row[indexes.emailUpdate] || '',
      lockAcct: row[indexes.lockAcct] || '',
      missingCourses: row[indexes.missingCourses] || '',
      addedLlProUpdate: row[indexes.addedLlProUpdate] || '',
    }))
    .filter((row) => row.id || row.email || row.firstName || row.lastName)
}

function completionBadgeVariant(completion: string): 'success' | 'warning' | 'secondary' {
  const { done, total } = parseCompletionValue(completion)
  if (total > 0 && done >= total) return 'success'
  if (done > 0) return 'warning'
  return 'secondary'
}

export function SalesCBAPage() {
  const [allRows, setAllRows] = useState<CbaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showOnlyActive, setShowOnlyActive] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [sortBy, setSortBy] = useState<SortKey>('id')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const loadRows = async () => {
    try {
      setLoading(true)
      setError(null)
      try {
        const { items } = await getCbaTabularUsers()
        if (items && items.length > 0) {
          setAllRows(items)
          setPage(1)
          return
        }
      } catch (apiErr) {
        console.warn('CBA API fetch unavailable, using sheet fallback:', apiErr)
      }

      const response = await fetch(CBA_SHEET_CSV_URL, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Failed to load sheet (${response.status})`)
      }
      const text = await response.text()
      const parsed = parseCsv(text)
      const mappedRows = mapSheetRows(parsed)
      setAllRows(mappedRows)
      setPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CBA list')
      setAllRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRows()
  }, [])

  const filteredRows = useMemo(() => {
    const searchText = search.trim().toLowerCase()

    return allRows.filter((row) => {
      if (showOnlyActive && !row.lastLogin.trim()) {
        return false
      }

      if (!searchText) {
        return true
      }

      const haystack = [
        row.id,
        row.firstName,
        row.lastName,
        row.email,
        row.completion,
        row.lastLogin,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(searchText)
    })
  }, [allRows, search, showOnlyActive])

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows]

    rows.sort((a, b) => {
      let aValue = 0
      let bValue = 0

      if (sortBy === 'id') {
        aValue = Number(a.id) || 0
        bValue = Number(b.id) || 0
      } else if (sortBy === 'completion') {
        const aCompletion = parseCompletionValue(a.completion)
        const bCompletion = parseCompletionValue(b.completion)
        aValue = aCompletion.total > 0 ? aCompletion.done / aCompletion.total : 0
        bValue = bCompletion.total > 0 ? bCompletion.done / bCompletion.total : 0
      } else if (sortBy === 'lastLogin') {
        aValue = parseLastLoginAgeDays(a.lastLogin)
        bValue = parseLastLoginAgeDays(b.lastLogin)
      } else {
        const aText = `${a.firstName} ${a.lastName}`.toLowerCase()
        const bText = `${b.firstName} ${b.lastName}`.toLowerCase()
        if (aText < bText) return sortDirection === 'asc' ? -1 : 1
        if (aText > bText) return sortDirection === 'asc' ? 1 : -1
        return 0
      }

      if (aValue === bValue) return 0
      if (sortDirection === 'asc') return aValue < bValue ? -1 : 1
      return aValue > bValue ? -1 : 1
    })

    return rows
  }, [filteredRows, sortBy, sortDirection])

  const totalItems = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * perPage
    return sortedRows.slice(start, start + perPage)
  }, [safePage, perPage, sortedRows])

  useEffect(() => {
    setPage(1)
  }, [search, showOnlyActive, sortBy, sortDirection, perPage])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-8 w-8 text-amber-400" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">CBA Master List</h1>
            <p className="text-sm text-muted-foreground">
              Google Sheet aligned table for CBA learner tracking
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => void loadRows()}
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
        <CardContent className="grid gap-3 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search ID, name, email, completion"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="id">ID</SelectItem>
              <SelectItem value="firstName">First Name</SelectItem>
              <SelectItem value="completion">Completion</SelectItem>
              <SelectItem value="lastLogin">Last Login</SelectItem>
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

          <Button
            variant={showOnlyActive ? 'default' : 'outline'}
            onClick={() => setShowOnlyActive((prev) => !prev)}
          >
            {showOnlyActive ? 'Showing Active Login Rows' : 'Filter Active Login Rows'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Total: {allRows.length}</Badge>
            <Badge variant="outline">Filtered: {totalItems}</Badge>
            <Badge variant="outline">Page: {safePage}/{totalPages}</Badge>
            {loading ? <Badge variant="warning">Loading...</Badge> : null}
            {error ? <Badge variant="error">{error}</Badge> : null}
          </div>

          <div className="rounded-lg border bg-card">
            <Table className="min-w-[1500px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 bg-card">ID</TableHead>
                  <TableHead>Added to CBA</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Removed from CBA</TableHead>
                  <TableHead>Email Update</TableHead>
                  <TableHead>Lock Acct</TableHead>
                  <TableHead>Missing courses</TableHead>
                  <TableHead>Added LL Pro Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && pagedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground">
                      No CBA entries found.
                    </TableCell>
                  </TableRow>
                ) : null}

                {pagedRows.map((row, idx) => (
                  <TableRow key={`${row.id}-${row.email}-${idx}`}>
                    <TableCell className="sticky left-0 bg-card font-medium">{row.id || '-'}</TableCell>
                    <TableCell>{row.addedToCba || '-'}</TableCell>
                    <TableCell>{row.firstName || '-'}</TableCell>
                    <TableCell>{row.lastName || '-'}</TableCell>
                    <TableCell>{row.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={completionBadgeVariant(row.completion)}>
                        {row.completion || 'Not started'}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.lastLogin || '-'}</TableCell>
                    <TableCell>{row.removedFromCba || '-'}</TableCell>
                    <TableCell>{row.emailUpdate || '-'}</TableCell>
                    <TableCell>{row.lockAcct || '-'}</TableCell>
                    <TableCell>{row.missingCourses || '-'}</TableCell>
                    <TableCell>{row.addedLlProUpdate || '-'}</TableCell>
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

      <Card>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground">
            Source: Live_List tab from CBA/ExceedCE Master List Google Sheet.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
