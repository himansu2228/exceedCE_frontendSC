import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { getSalesSyncLogs } from '@/lib/api'
import type { SalesSyncRun } from '@/lib/api'

export function SalesSyncLogsPage() {
  const [rows, setRows] = useState<SalesSyncRun[]>([])
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const load = async (targetPage = page, targetPerPage = perPage) => {
    const result = await getSalesSyncLogs({ page: targetPage, perPage: targetPerPage })
    setRows(result.items)
    setPage(result.page)
    setPerPage(result.perPage)
    setTotal(result.total)
    setTotalPages(result.totalPages)
  }

  useEffect(() => {
    void load(1, perPage)
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Sync Logs</h1>
        <p className="text-sm text-muted-foreground">Execution history of ExceedCE sales synchronization</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Sync Runs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[90px_110px_1fr_auto_auto] items-center gap-2 rounded-lg border p-3 text-sm">
              <span>#{row.id}</span>
              <Badge variant={row.status === 'success' ? 'success' : row.status === 'failed' ? 'error' : 'warning'}>{row.status}</Badge>
              <span className="text-muted-foreground">{new Date(row.started_at).toLocaleString()}</span>
              <span>{row.processed_orders}/{row.total_orders}</span>
              <span>{row.failed_orders} failed</span>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No sync logs found</p> : null}

          <PaginationControls
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={perPage}
            onPageChange={(targetPage) => void load(targetPage, perPage)}
            onPageSizeChange={(size) => {
              setPerPage(size)
              void load(1, size)
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
