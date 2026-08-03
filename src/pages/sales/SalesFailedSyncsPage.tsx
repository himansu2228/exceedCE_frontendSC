import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { getSalesSyncFailures } from '@/lib/api'
import type { SalesSyncFailure } from '@/lib/api'

export function SalesFailedSyncsPage() {
  const [rows, setRows] = useState<SalesSyncFailure[]>([])
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const load = async (targetPage = page, targetPerPage = perPage, unresolved = onlyOpen) => {
    const result = await getSalesSyncFailures({ page: targetPage, perPage: targetPerPage, unresolvedOnly: unresolved })
    setRows(result.items)
    setPage(result.page)
    setPerPage(result.perPage)
    setTotal(result.total)
    setTotalPages(result.totalPages)
  }

  useEffect(() => {
    void load(1, perPage, true)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Failed Syncs</h1>
          <p className="text-sm text-muted-foreground">Review and retry failed order sync records</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            const next = !onlyOpen
            setOnlyOpen(next)
            void load(1, perPage, next)
          }}
        >
          {onlyOpen ? 'Show All' : 'Show Unresolved Only'}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Failures</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <strong>Failure #{row.id}</strong>
                <span>{row.resolved_at ? 'Resolved' : 'Open'}</span>
              </div>
              <p><span className="text-muted-foreground">Stage:</span> {row.stage}</p>
              <p><span className="text-muted-foreground">Order:</span> {row.aom_order_id || 'N/A'}</p>
              <p><span className="text-muted-foreground">Message:</span> {row.error_message}</p>
            </div>
          ))}

          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No failed sync records</p> : null}

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
