import { useEffect, useState } from 'react'
import { AlertTriangle, BadgeCheck, RefreshCw, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getLicenseRenewals, updateLicenseRenewalCycle } from '@/lib/api'
import type { LicenseRenewalCycle, LicenseRenewalRow, LicenseRenewalStatus, LicenseRenewalsResponse } from '@/lib/api'

const STATUS_META: Record<LicenseRenewalStatus, { label: string; className: string }> = {
  outreach: { label: 'Renews within 12 mo', className: 'bg-amber-100 text-amber-800' },
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-800' },
  expired: { label: 'Past expiry', className: 'bg-red-100 text-red-800' },
  no_expiry: { label: 'No expiry on file', className: 'bg-slate-100 text-slate-600' },
  no_license: { label: 'No license on file', className: 'bg-slate-100 text-slate-500' },
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

const selectClass = 'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700'

const US_STATES: Array<[string, string]> = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'],
  ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'],
  ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'],
  ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
]

function StateOptions({ placeholder }: { placeholder: string }) {
  return (
    <>
      <option value="">{placeholder}</option>
      {US_STATES.map(([code, name]) => <option key={code} value={code}>{code} - {name}</option>)}
    </>
  )
}

export function SalesLicenseRenewalsPage() {
  const [rows, setRows] = useState<LicenseRenewalRow[]>([])
  const [summary, setSummary] = useState<LicenseRenewalsResponse['summary'] | null>(null)
  const [cycles, setCycles] = useState<LicenseRenewalCycle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [status, setStatus] = useState('all')
  const [cycleDrafts, setCycleDrafts] = useState<Record<string, string>>({})
  const [newState, setNewState] = useState('')
  const [newYears, setNewYears] = useState('')
  const [cycleError, setCycleError] = useState<string | null>(null)

  const load = async (targetPage = page, targetPerPage = perPage, overrides?: { status?: string; state?: string }) => {
    try {
      setLoading(true)
      setError(null)
      const result = await getLicenseRenewals({
        page: targetPage,
        perPage: targetPerPage,
        search: search || undefined,
        state: (overrides?.state ?? stateFilter) || undefined,
        status: overrides?.status ?? status,
      })
      setRows(result.items)
      setPage(result.page)
      setPerPage(result.perPage)
      setTotal(result.total)
      setTotalPages(result.totalPages)
      setSummary(result.summary)
      setCycles(result.cycles)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load license renewals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, perPage)
  }, [])

  const saveCycle = async (stateCode: string, years: string) => {
    try {
      setCycleError(null)
      await updateLicenseRenewalCycle(stateCode, Number(years))
      setCycleDrafts((current) => {
        const next = { ...current }
        delete next[stateCode]
        return next
      })
      setNewState('')
      setNewYears('')
      await load(1, perPage)
    } catch (err) {
      setCycleError(err instanceof Error ? err.message : 'Failed to save renewal cycle')
    }
  }

  const summaryCards: Array<{ label: string; value: number; key: string; filter: string }> = summary
    ? [
        { label: 'Renews within 12 months', value: summary.outreach, key: 'outreach', filter: 'outreach' },
        { label: 'Active', value: summary.active, key: 'active', filter: 'active' },
        { label: 'Past expiry', value: summary.expired, key: 'expired', filter: 'expired' },
        { label: 'No license on file', value: summary.noLicense, key: 'no_license', filter: 'no_license' },
      ]
    : []

  return (
    <div className="space-y-6 pb-8 animate-fadeIn">
      <section className="overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-emerald-50/50 shadow-[0_24px_70px_-45px_rgba(2,132,199,0.5)]">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-[0_12px_28px_-12px_rgba(2,132,199,0.9)]"><BadgeCheck className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Sales Directory</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">Student License Renewals</h1>
              <p className="mt-1 text-sm text-slate-600">License expiry and next renewal date per student, based on the license stored in their ExceedCE profile and the renewal cycle for their state.</p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => void load(1, perPage)} disabled={loading} className="border-sky-200 bg-white text-sky-700 hover:bg-sky-50"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </section>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => { setStatus(card.filter); void load(1, perPage, { status: card.filter }) }}
              className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-sky-300 ${status === card.filter ? 'border-sky-400 ring-1 ring-sky-300' : 'border-slate-200'}`}
            >
              <p className="text-xs font-medium text-slate-500">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{card.value.toLocaleString()}</p>
            </button>
          ))}
        </div>
      ) : null}

      <Card className="border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
        <CardHeader className="border-b border-slate-100 pb-4"><CardTitle className="text-base">Renewal Cycle by State</CardTitle></CardHeader>
        <CardContent className="space-y-3 pt-5">
          <p className="text-sm text-muted-foreground">Years between renewals. Used to project the next renewal date when the license on file has already passed its expiry.</p>
          <div className="flex flex-wrap items-center gap-3">
            {cycles.map((cycle) => (
              <div key={cycle.stateCode} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm font-semibold text-slate-800">{cycle.stateCode}</span>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className="h-8 w-16"
                  value={cycleDrafts[cycle.stateCode] ?? String(cycle.cycleYears)}
                  onChange={(event) => setCycleDrafts((current) => ({ ...current, [cycle.stateCode]: event.target.value }))}
                />
                <span className="text-xs text-slate-500">yrs</span>
                {cycleDrafts[cycle.stateCode] !== undefined && cycleDrafts[cycle.stateCode] !== String(cycle.cycleYears) ? (
                  <Button type="button" size="sm" className="h-8" onClick={() => void saveCycle(cycle.stateCode, cycleDrafts[cycle.stateCode])}>Save</Button>
                ) : null}
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2">
              <select className={`${selectClass} h-8 w-40 px-2`} value={newState} onChange={(event) => setNewState(event.target.value)}>
                <StateOptions placeholder="Select state" />
              </select>
              <Input type="number" min={1} max={20} placeholder="Yrs" className="h-8 w-16" value={newYears} onChange={(event) => setNewYears(event.target.value)} />
              <Button type="button" size="sm" variant="outline" className="h-8" disabled={!newState || !newYears} onClick={() => void saveCycle(newState, newYears)}>Add</Button>
            </div>
          </div>
          {cycleError ? <p className="text-sm text-red-600">{cycleError}</p> : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
        <CardHeader className="border-b border-slate-100 pb-4"><CardTitle className="text-base">Find Students</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input placeholder="Search name, email, company, or license number" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load(1, perPage) }} className="h-10 border-slate-200 pl-9" /></div>
          <select className={selectClass} value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); void load(1, perPage, { state: event.target.value }) }}>
            <StateOptions placeholder="All states" />
          </select>
          <select className={selectClass} value={status} onChange={(event) => { setStatus(event.target.value); void load(1, perPage, { status: event.target.value }) }}>
            <option value="all">All statuses</option>
            <option value="outreach">Renews within 12 mo</option>
            <option value="active">Active</option>
            <option value="expired">Past expiry</option>
            <option value="no_expiry">No expiry on file</option>
            <option value="no_license">No license on file</option>
          </select>
          <Button type="button" onClick={() => void load(1, perPage)} disabled={loading} className="h-10 bg-slate-900 hover:bg-slate-800">Search</Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
          <div><CardTitle className="text-base">Student Licenses</CardTitle><p className="mt-1 text-sm text-muted-foreground">Sorted by next renewal date. Completing a course does not confirm a renewal.</p></div>
          <span className="rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{total.toLocaleString()} total</span>
        </CardHeader>
        <CardContent className="p-0">
          {error ? <div className="m-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div> : null}
          {loading ? <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : null}
          {!loading && !error && rows.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center"><p className="font-medium text-slate-900">No students found</p><p className="mt-1 text-sm text-muted-foreground">Try a different search or filter.</p></div> : null}
          {!loading && rows.length > 0 ? <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>License #</TableHead>
                  <TableHead>License Expiry</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Next Renewal</TableHead>
                  <TableHead>Outreach Starts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Purchase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const meta = STATUS_META[row.status]
                  return (
                    <TableRow key={`${row.customerId}-${row.licenseState}-${row.licenseNumber}-${index}`} className="hover:bg-sky-50/40">
                      <TableCell>
                        <p className="font-medium text-slate-900">{row.fullName || '-'}</p>
                        <p className="max-w-56 truncate text-xs text-muted-foreground">{row.email || '-'}</p>
                      </TableCell>
                      <TableCell className="text-slate-600">{row.companyName || '-'}</TableCell>
                      <TableCell className="font-medium text-slate-600">{row.licenseState || '-'}</TableCell>
                      <TableCell className="text-slate-600">{row.licenseNumber || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-600">{formatDate(row.licenseExpiry)}</TableCell>
                      <TableCell className="text-slate-600">{row.cycleYears ? `${row.cycleYears} yr` : '-'}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-slate-900">
                        {formatDate(row.nextRenewalDate)}
                        {row.renewalEstimated ? <span className="ml-1 text-xs font-normal text-slate-500">(est.)</span> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-600">{formatDate(row.outreachStartDate)}</TableCell>
                      <TableCell><span className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${meta.className}`}>{meta.label}</span></TableCell>
                      <TableCell className="whitespace-nowrap text-slate-600">{formatDate(row.latestOrderDate)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div> : null}

          {!loading && !error ? <PaginationControls
            className="border-t border-slate-100 px-5 py-4"
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={perPage}
            onPageChange={(targetPage) => void load(targetPage, perPage)}
            onPageSizeChange={(size) => {
              setPerPage(size)
              void load(1, size)
            }}
          /> : null}
        </CardContent>
      </Card>
    </div>
  )
}
