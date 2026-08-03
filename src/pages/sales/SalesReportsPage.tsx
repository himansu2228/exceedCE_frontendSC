import { FileSpreadsheet, Filter, TableProperties } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const reportList = [
  'Daily Sales Summary',
  'State-wise Sales Comparison',
  'Product Performance Report',
  'Refund and Return Report',
]

export function SalesReportsPage() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-600 p-2 text-white shadow-md">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sales Reports</h1>
          <p className="text-sm text-muted-foreground">Prebuilt reports available only for super admin access.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TableProperties className="h-4 w-4" />
            Available Reports
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reportList.map((name) => (
            <div key={name} className="rounded-lg border bg-background px-3 py-2 text-sm">
              {name}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Add date range, state, and product filters for downloadable reports.</p>
        </CardContent>
      </Card>
    </div>
  )
}
