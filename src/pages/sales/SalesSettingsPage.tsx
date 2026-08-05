import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { runSalesSync, getSalesMapping } from '@/lib/api'
import type { SalesMappingRow } from '@/lib/api'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'

export function SalesSettingsPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [mapping, setMapping] = useState<SalesMappingRow[]>([])

  const runSync = async () => {
    try {
      setRunning(true)
      setMessage(null)
      const result = await runSalesSync({
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
      })
      setMessage(`Run #${result.runId}: ${result.status} | Processed ${result.processedOrders}/${result.totalOrders} | Failed ${result.failedOrders}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setRunning(false)
    }
  }

  const loadMapping = async () => {
    try {
      const rows = await getSalesMapping()
      setMapping(rows)
    } catch {
      setMapping([])
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Sales Settings</h1>
        <p className="text-sm text-muted-foreground">Run sync jobs and review spreadsheet-to-API field mapping</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Run Sync</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            showLabels={false}
            className="md:col-span-2"
            selectClassName="w-[170px]"
          />
          <Button disabled={running} onClick={() => void runSync()}>{running ? 'Syncing...' : 'Start Sync'}</Button>
          {message ? <p className="md:col-span-3 text-sm">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Spreadsheet Mapping</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" onClick={() => void loadMapping()}>Load Mapping</Button>
          {mapping.map((row) => (
            <div key={row.spreadsheetColumn} className="rounded-lg border p-3 text-sm">
              <p><strong>{row.spreadsheetColumn}</strong></p>
              <p><span className="text-muted-foreground">Endpoint:</span> {row.apiEndpoint}</p>
              <p><span className="text-muted-foreground">Field:</span> {row.apiField}</p>
              <p><span className="text-muted-foreground">Transform:</span> {row.transformation}</p>
              <p><span className="text-muted-foreground">DB:</span> {row.databaseColumn}</p>
            </div>
          ))}
          {mapping.length === 0 ? <p className="text-sm text-muted-foreground">Load mapping to inspect source traceability.</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
