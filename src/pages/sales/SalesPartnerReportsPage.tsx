import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AlertTriangle, DollarSign, Download, FileSpreadsheet, RefreshCw, Settings, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
import {
  getPartnerVendorsList,
  getPartnerReconciliationReportApi,
  getPartnerReportSettingsApi,
  updatePartnerReportSettingsApi,
  type PartnerConfig,
  type PartnerReportResponse,
  type PartnerReportSettings,
  type ReportFrequency,
} from '@/lib/api'
import * as XLSX from 'xlsx'

const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Real vendor list supplied by client; keep in sync with backend PARTNERS_CONFIG in src/sales/service.js.
const DEFAULT_PARTNERS: PartnerConfig[] = [
  { id: '123-coned', name: '123 ConEd LLC', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'Vendor Partner' },
  { id: 'abe-lee', name: 'Abe Lee Seminars', partnerSharePct: 25, referralFeePct: 0, frequency: 'Quarterly', description: 'Hawaii Real Estate Partner' },
  { id: 'beth-baker-owens', name: 'Beth Baker Owens', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'Instructor Partner' },
  { id: 'cba', name: 'Commercial Brokers Association (CBA)', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'Commercial Brokers Association Washington' },
  { id: 'cheryl-crawford', name: 'Cheryl Crawford', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'Instructor Partner' },
  { id: 'crcbr', name: 'CRCBR', partnerSharePct: 15, referralFeePct: 0, frequency: 'Monthly', description: 'Charlotte Region Commercial Board of Realtors' },
  { id: 'devon-higgins', name: 'Devon Higgins', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'Instructor Partner' },
  { id: 'donald-croteau', name: 'Donald Croteau', partnerSharePct: 40, referralFeePct: 5, frequency: 'Monthly', description: 'Instructor & Course Author Partner' },
  { id: 'house-of-kaos', name: 'House of Kaos LLC', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'Vendor Partner' },
  { id: 'joseph-fisher', name: 'Joseph Fisher', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'Instructor Partner' },
  { id: 'mtritt', name: 'MTritt INC', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'Vendor Partner' },
  { id: 'nc-realtors', name: 'North Carolina Association of REALTORS', partnerSharePct: 15, referralFeePct: 0, frequency: 'Monthly', description: 'State Realtor Association Partner' },
  { id: 'onlineed', name: 'OnlineEd', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'CE Platform Partner' },
  { id: 'taxonics', name: 'Taxonics', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'Vendor Partner' },
]


export function SalesPartnerReportsPage() {
  const [partners, setPartners] = useState<PartnerConfig[]>(DEFAULT_PARTNERS)
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('donald-croteau')
  const [period, setPeriod] = useState<'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'ytd' | 'all'>('all')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })

  const [loading, setLoading] = useState(true)
  const [partnersLoading, setPartnersLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<PartnerReportResponse | null>(null)

  // Reconciliation Report Settings dialog (per-vendor mail schedule)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPartnerId, setSettingsPartnerId] = useState<string>('donald-croteau')
  const [settingsForm, setSettingsForm] = useState<PartnerReportSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const loadSettingsForPartner = useCallback(async (partnerId: string) => {
    setSettingsLoading(true)
    setSettingsError(null)
    setSettingsSaved(false)
    try {
      const settings = await getPartnerReportSettingsApi(partnerId)
      setSettingsForm(settings)
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to load reconciliation report settings')
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  const openSettingsDialog = useCallback(() => {
    setSettingsPartnerId(selectedPartnerId)
    setSettingsOpen(true)
    void loadSettingsForPartner(selectedPartnerId)
  }, [selectedPartnerId, loadSettingsForPartner])

  const handleSettingsPartnerChange = useCallback((partnerId: string) => {
    setSettingsPartnerId(partnerId)
    void loadSettingsForPartner(partnerId)
  }, [loadSettingsForPartner])

  const saveSettings = useCallback(async () => {
    if (!settingsForm) return
    setSettingsSaving(true)
    setSettingsError(null)
    setSettingsSaved(false)
    try {
      const updated = await updatePartnerReportSettingsApi(settingsPartnerId, {
        frequency: settingsForm.frequency,
        dayOfWeek: settingsForm.dayOfWeek,
        dayOfMonth: settingsForm.dayOfMonth,
        sendTime: settingsForm.sendTime,
        timezone: settingsForm.timezone,
        isEnabled: settingsForm.isEnabled,
      })
      setSettingsForm(updated)
      setSettingsSaved(true)
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to save reconciliation report settings')
    } finally {
      setSettingsSaving(false)
    }
  }, [settingsForm, settingsPartnerId])

  const isDayOfWeekFrequency = settingsForm?.frequency === 'weekly' || settingsForm?.frequency === 'biweekly'
  const settingsPartnerName = partners.find((p) => p.id === settingsPartnerId)?.name || settingsPartnerId

  // Fetch partners list on mount
  useEffect(() => {
    async function loadPartners() {
      try {
        setPartnersLoading(true)
        const list = await getPartnerVendorsList()
        if (list && list.length > 0) {
          setPartners(list)
        }
      } catch (err) {
        console.error('Failed to load partners from API, using default list:', err)
      } finally {
        setPartnersLoading(false)
      }
    }
    void loadPartners()
  }, [])

  const selectedPartner = partners.find(p => p.id === selectedPartnerId) || partners[0]

  const loadReport = useCallback(async () => {
    if (!selectedPartnerId) return
    try {
      setLoading(true)
      setError(null)
      const data = await getPartnerReconciliationReportApi({
        partner: selectedPartnerId,
        period,
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
      })
      setReportData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner report data')
    } finally {
      setLoading(false)
    }
  }, [selectedPartnerId, period, dateRange.fromDate, dateRange.toDate])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const exportExcel = () => {
    if (!reportData || reportData.items.length === 0) return

    const partnerName = selectedPartner?.name || 'Partner'
    const headers = [
      'Transaction Date',
      'Customer',
      'Course Title',
      'State',
      'Quantity',
      'Gross Sale ($)',
      'Discounts ($)',
      'Refunds ($)',
      'Net Sales ($)',
      'Stripe Fee ($)',
      'Referral Fee ($)',
      'Partner Share ($)',
      'Remittance from Stripe ($)',
    ]

    const dataRows = reportData.items.map(item => [
      item.date,
      item.customer,
      item.productName,
      item.state,
      item.quantity,
      item.grossSale,
      item.discounts || 0,
      item.refunds || 0,
      item.netSales || item.grossSale,
      item.stripeFee,
      item.referralFee || 0,
      item.partnerShare,
      item.remittanceFromStripe,
    ])

    const totalRefunds = reportData.items.reduce((sum, item) => sum + Number(item.refunds || 0), 0)
    const totalDiscounts = reportData.items.reduce((sum, item) => sum + Number(item.discounts || 0), 0)

    const totalRow = [
      'TOTAL',
      '',
      '',
      '',
      '',
      reportData.summary.totalGrossSale,
      totalDiscounts,
      totalRefunds,
      reportData.items.reduce((sum, item) => sum + Number(item.netSales || item.grossSale || 0), 0),
      reportData.summary.totalStripeFees,
      0,
      reportData.summary.totalPartnerShare,
      reportData.summary.totalRemittanceFromStripe,
    ]

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows, totalRow])
    worksheet['!cols'] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 40 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 24 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Partner Remittance')
    XLSX.writeFile(workbook, `PartnerReport-${partnerName.replace(/[^a-zA-Z0-9]/g, '_')}-${period}.xlsx`)
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-2.5 text-white shadow-md">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Partner & Stripe Reports</h1>
            <p className="text-sm text-muted-foreground">
              Itemized partner sales, Stripe processing fees, and net remittance calculation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={openSettingsDialog}>
            <Settings className="mr-2 h-4 w-4" />
            Reconciliation Report Settings
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={loading || !reportData || reportData.items.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="outline" size="icon" onClick={() => void loadReport()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Control Filters Card */}
      <Card className="border shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-4 items-end">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Select Partner (14 Vendors)
              </label>
              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId} disabled={partnersLoading}>
                <SelectTrigger className="h-10 text-sm font-medium">
                  <SelectValue placeholder="Select a Partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Report Frequency / Period
              </label>
              <Select value={period} onValueChange={(v) => setPeriod(v as 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'ytd' | 'all')}>
                <SelectTrigger className="h-10 text-sm font-medium">
                  <SelectValue placeholder="Select Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly Report (Last 7 Days)</SelectItem>
                  <SelectItem value="biweekly">Biweekly Report (Last 14 Days)</SelectItem>
                  <SelectItem value="monthly">Monthly Report (Last 30 Days)</SelectItem>
                  <SelectItem value="quarterly">Quarterly Report (Last 90 Days)</SelectItem>
                  <SelectItem value="ytd">Year-to-Date (YTD)</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1 lg:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Date Range Filter
              </label>
              <DateRangeFilter value={dateRange} onChange={setDateRange} showLabels={false} />
            </div>
          </div>

          {/* Selected Vendor Configuration Details */}
          {selectedPartner && (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-xs text-blue-950">
              <div className="flex items-center gap-1.5 font-semibold">
                <Users className="h-4 w-4 text-blue-600" />
                <span>{selectedPartner.name}</span>
              </div>
              <div className="h-4 w-px bg-blue-200" />
              <div>
                Partner Share: <strong className="text-blue-700">{selectedPartner.partnerSharePct}%</strong>
              </div>
              {selectedPartner.referralFeePct > 0 && (
                <>
                  <div className="h-4 w-px bg-blue-200" />
                  <div>
                    Referral Fee: <strong className="text-blue-700">{selectedPartner.referralFeePct}%</strong>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Orders
            </CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-20" /> : (reportData?.totalOrders || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Orders for selected period</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gross Sales
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {loading ? <Skeleton className="h-8 w-24" /> : formatUSD(reportData?.summary.totalGrossSale || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total revenue collected</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Stripe Fees
            </CardTitle>
            <Wallet className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {loading ? <Skeleton className="h-8 w-24" /> : formatUSD(reportData?.summary.totalStripeFees || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total card processing fees</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-blue-50/40 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-900">
              Remittance from Stripe
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {loading ? <Skeleton className="h-8 w-28" /> : formatUSD(reportData?.summary.totalRemittanceFromStripe || 0)}
            </div>
            <p className="text-xs text-blue-800/80 mt-1">Net sales after Stripe fees & partner share</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-slate-50/50 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              Itemized Transactions & Remittance Breakdown
            </CardTitle>
            {reportData && (
              <span className="text-xs font-medium text-muted-foreground">
                Showing {reportData.items.length} records
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="m-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : !reportData || reportData.items.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
              <p className="font-semibold text-slate-800">No partner transactions found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try selecting a different partner or adjusting the date range filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Customer</th>
                    <th className="px-4 py-3 text-left font-semibold max-w-[280px]">Course Title</th>
                    <th className="px-3 py-3 text-center font-semibold">State</th>
                    <th className="px-3 py-3 text-center font-semibold">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold">Gross Sale</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500">Discounts</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500">Refunds</th>
                    <th className="px-4 py-3 text-right font-semibold text-emerald-700">Net Sales</th>
                    <th className="px-4 py-3 text-right font-semibold text-amber-700">Stripe Fee</th>
                    <th className="px-4 py-3 text-right font-semibold text-blue-700">Partner Share</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-900 bg-blue-50/50">Remittance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.items.map((item, idx) => (
                    <tr key={item.orderId || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{item.customer}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-[280px] truncate">{item.productName}</td>
                      <td className="px-3 py-3 text-center font-medium text-slate-600">{item.state}</td>
                      <td className="px-3 py-3 text-center font-medium text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatUSD(item.grossSale)}</td>
                      <td className="px-3 py-3 text-right text-slate-500">{formatUSD(item.discounts || 0)}</td>
                      <td className="px-3 py-3 text-right text-slate-500">{formatUSD(item.refunds || 0)}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatUSD(item.netSales || item.grossSale)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{formatUSD(item.stripeFee)}</td>
                      <td className="px-4 py-3 text-right text-blue-700 font-medium">{formatUSD(item.partnerShare)}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700 bg-blue-50/30">
                        {formatUSD(item.remittanceFromStripe)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-slate-900">Total Summary</td>
                    <td className="px-4 py-3 text-right text-slate-900">{formatUSD(reportData.summary.totalGrossSale)}</td>
                    <td className="px-3 py-3 text-right text-slate-500">{formatUSD(reportData.items.reduce((sum, item) => sum + Number(item.discounts || 0), 0))}</td>
                    <td className="px-3 py-3 text-right text-slate-500">{formatUSD(reportData.items.reduce((sum, item) => sum + Number(item.refunds || 0), 0))}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatUSD(reportData.items.reduce((sum, item) => sum + Number(item.netSales || item.grossSale || 0), 0))}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{formatUSD(reportData.summary.totalStripeFees)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{formatUSD(reportData.summary.totalPartnerShare)}</td>
                    <td className="px-4 py-3 text-right text-blue-700 bg-blue-100/60 font-extrabold text-sm">
                      {formatUSD(reportData.summary.totalRemittanceFromStripe)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation Report Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reconciliation Report Settings</DialogTitle>
            <DialogDescription>
              Control when the mail-report is automatically sent for a vendor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Vendor
              </Label>
              <Select value={settingsPartnerId} onValueChange={handleSettingsPartnerChange}>
                <SelectTrigger className="h-10 text-sm font-medium">
                  <SelectValue placeholder="Select a Partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {settingsLoading || !settingsForm ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                      Frequency
                    </Label>
                    <Select
                      value={settingsForm.frequency}
                      onValueChange={(value) =>
                        setSettingsForm({
                          ...settingsForm,
                          frequency: value as ReportFrequency,
                        })
                      }
                    >
                      <SelectTrigger className="h-10 text-sm font-medium">
                        <SelectValue placeholder="Select Frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isDayOfWeekFrequency ? (
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                        Day of Week
                      </Label>
                      <Select
                        value={String(settingsForm.dayOfWeek ?? 1)}
                        onValueChange={(value) => setSettingsForm({ ...settingsForm, dayOfWeek: Number(value) })}
                      >
                        <SelectTrigger className="h-10 text-sm font-medium">
                          <SelectValue placeholder="Select Day" />
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAY_OPTIONS.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                        Day of Month
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={28}
                        value={settingsForm.dayOfMonth ?? 15}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, dayOfMonth: Number(e.target.value) })
                        }
                        className="h-10"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                      Send Time
                    </Label>
                    <Input
                      type="time"
                      value={settingsForm.sendTime}
                      onChange={(e) => setSettingsForm({ ...settingsForm, sendTime: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                      Timezone
                    </Label>
                    <Select
                      value={settingsForm.timezone}
                      onValueChange={(value) => setSettingsForm({ ...settingsForm, timezone: value })}
                    >
                      <SelectTrigger className="h-10 text-sm font-medium">
                        <SelectValue placeholder="Select Timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
                        <SelectItem value="Pacific/Honolulu">Hawaii (HST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-slate-50/60 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Mail Report Enabled</p>
                    <p className="text-xs text-muted-foreground">
                      Turn off to stop sending scheduled mail reports for {settingsPartnerName}.
                    </p>
                  </div>
                  <Switch
                    checked={settingsForm.isEnabled}
                    onCheckedChange={(checked) => setSettingsForm({ ...settingsForm, isEnabled: checked })}
                  />
                </div>

                {settingsForm.lastSentAt && (
                  <p className="text-xs text-muted-foreground">
                    Last sent: {new Date(settingsForm.lastSentAt).toLocaleString()}
                  </p>
                )}
              </>
            )}

            {settingsError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {settingsError}
              </div>
            )}
            {settingsSaved && !settingsError && (
              <p className="text-xs font-medium text-emerald-700">Settings saved.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Close
            </Button>
            <Button onClick={() => void saveSettings()} disabled={settingsLoading || settingsSaving || !settingsForm}>
              {settingsSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
