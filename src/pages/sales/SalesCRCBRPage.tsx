import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target } from 'lucide-react'

export function SalesCRCBRPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Target className="h-8 w-8 text-blue-400" />
        <h1 className="text-3xl font-bold text-white">CRCBR</h1>
      </div>

      <Card className="border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Under Working</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-blue-500/20 p-6 mb-4">
              <Target className="h-12 w-12 text-blue-400" />
            </div>
            <p className="text-lg text-slate-300">This section is currently under development.</p>
            <p className="text-sm text-slate-400 mt-2">Check back soon for updates!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
