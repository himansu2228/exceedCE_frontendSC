import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AlertTriangle, ArrowLeft, BookOpen, DollarSign, Download, Eye, FileSpreadsheet, Mail, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Settings, Trash2, Users, Wallet } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
import {
  createPartnerApi,
  getPartnerProductsApi,
  getPartnerVendorsList,
  getPartnerReconciliationReportApi,
  getPartnerReportEmailPreviewApi,
  getPartnerReportSettingsApi,
  setPartnerProductApi,
  updatePartnerReportSettingsApi,
  updatePartnerShareApi,
  type PartnerConfig,
  type PartnerEmailPreview,
  type PartnerProduct,
  type PartnerProductsResponse,
  type PartnerReportResponse,
  type PartnerReportSettings,
  type ReportFrequency,
} from '@/lib/api'

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

  // Fallback partner list used only when the partner API is unavailable.
const DEFAULT_PARTNERS: PartnerConfig[] = [
  { id: '123-coned', name: '123 ConEd LLC', partnerSharePct: 50, referralFeePct: 0, frequency: 'Monthly', description: 'Vendor Partner' },
  { id: 'abe-lee', name: 'Abe Lee Seminars', partnerSharePct: 50, referralFeePct: 0, frequency: 'Quarterly', description: 'Hawaii Real Estate Partner' },
  { id: 'beth-baker-owens', name: 'Beth Baker Owens', partnerSharePct: 50, referralFeePct: 0, frequency: 'Monthly', description: 'Instructor Partner' },
  { id: 'cba', name: 'Commercial Brokers Association (CBA)', partnerSharePct: 50, referralFeePct: 0, frequency: 'Monthly', description: 'Commercial Brokers Association Washington' },
  { id: 'cheryl-crawford', name: 'Cheryl Crawford', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'Instructor Partner' },
  { id: 'crcbr', name: 'CRCBR', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'Charlotte Region Commercial Board of Realtors' },
  { id: 'devon-higgins', name: 'Devon Higgins', partnerSharePct: 50, referralFeePct: 0, frequency: 'Monthly', description: 'Instructor Partner' },
  { id: 'donald-croteau', name: 'Donald Croteau', partnerSharePct: 35, referralFeePct: 0, frequency: 'Monthly', description: 'Instructor & Course Author Partner' },
  { id: 'house-of-kaos', name: 'House of Kaos LLC', partnerSharePct: 50, referralFeePct: 0, frequency: 'Monthly', description: 'Vendor Partner' },
  { id: 'joseph-fisher', name: 'Joseph Fisher', partnerSharePct: 50, referralFeePct: 0, frequency: 'Monthly', description: 'Instructor Partner' },
  { id: 'mtritt', name: 'MTritt INC', partnerSharePct: 50, referralFeePct: 0, frequency: 'Monthly', description: 'Vendor Partner' },
  { id: 'nc-realtors', name: 'North Carolina Association of REALTORS', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'State Realtor Association Partner' },
  { id: 'onlineed', name: 'OnlineEd', partnerSharePct: 20, referralFeePct: 0, frequency: 'Monthly', description: 'CE Platform Partner' },
  { id: 'taxonics', name: 'Taxonics', partnerSharePct: 50, referralFeePct: 0, frequency: 'Monthly', description: 'Vendor Partner' },
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

  // Preview of the email a partner would receive (nothing is sent)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [emailPreview, setEmailPreview] = useState<PartnerEmailPreview | null>(null)

  const openEmailPreview = useCallback(async () => {
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewError(null)
    setEmailPreview(null)
    try {
      setEmailPreview(await getPartnerReportEmailPreviewApi({
        partner: settingsPartnerId,
        frequency: settingsForm?.frequency,
      }))
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to build email preview')
    } finally {
      setPreviewLoading(false)
    }
  }, [settingsPartnerId, settingsForm?.frequency])
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

  // Add a new partner
  const [manageOpen, setManageOpen] = useState(false)
  const runManageAction = (action: () => void) => {
    setManageOpen(false)
    action()
  }
  const backToManage = (close: () => void, disabled = false) => (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      className="sm:mr-auto"
      onClick={() => {
        close()
        setManageOpen(true)
      }}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back
    </Button>
  )

  const EMPTY_NEW_PARTNER = { name: '', email: '', share: '20', frequency: 'monthly' as ReportFrequency, academyId: '', description: '' }
  const [addPartnerOpen, setAddPartnerOpen] = useState(false)
  const [newPartner, setNewPartner] = useState(EMPTY_NEW_PARTNER)
  const [addPartnerSaving, setAddPartnerSaving] = useState(false)
  const [addPartnerError, setAddPartnerError] = useState<string | null>(null)

  const openAddPartnerDialog = () => {
    setNewPartner(EMPTY_NEW_PARTNER)
    setAddPartnerError(null)
    setAddPartnerOpen(true)
  }

  const saveNewPartner = async () => {
    setAddPartnerSaving(true)
    setAddPartnerError(null)
    try {
      const created = await createPartnerApi({
        name: newPartner.name.trim(),
        notificationEmail: newPartner.email.trim() || undefined,
        partnerSharePct: Number(newPartner.share),
        frequency: newPartner.frequency,
        academyPartnerId: newPartner.academyId.trim() ? Number(newPartner.academyId) : undefined,
        description: newPartner.description.trim() || undefined,
      })
      setPartners((current) => [...current, created])
      setSelectedPartnerId(created.id)
      setAddPartnerOpen(false)
    } catch (saveError) {
      setAddPartnerError(saveError instanceof Error ? saveError.message : 'Unable to add the partner.')
    } finally {
      setAddPartnerSaving(false)
    }
  }

  // Manage the selected partner's courses and optional fixed fee per course
  const [coursesOpen, setCoursesOpen] = useState(false)
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [coursesError, setCoursesError] = useState<string | null>(null)
  const [partnerCourses, setPartnerCourses] = useState<PartnerProductsResponse | null>(null)
  const [feeDrafts, setFeeDrafts] = useState<Record<number, string>>({})
  const [courseSearch, setCourseSearch] = useState('')
  const [courseBusyId, setCourseBusyId] = useState<number | null>(null)
  const [coursesChanged, setCoursesChanged] = useState(false)
  const [coursesView, setCoursesView] = useState<'edit' | 'add'>('edit')

  const openCoursesDialog = async (view: 'edit' | 'add') => {
    if (!selectedPartner) return
    setCoursesView(view)
    setCoursesOpen(true)
    setCoursesLoading(true)
    setCoursesError(null)
    setPartnerCourses(null)
    setFeeDrafts({})
    setCourseSearch('')
    setCoursesChanged(false)
    try {
      setPartnerCourses(await getPartnerProductsApi(selectedPartner.id))
    } catch (loadError) {
      setCoursesError(loadError instanceof Error ? loadError.message : 'Unable to load the partner courses.')
    } finally {
      setCoursesLoading(false)
    }
  }

  const closeCoursesDialog = () => {
    setCoursesOpen(false)
    if (coursesChanged) void loadReport()
  }

  const changeCourse = async (productId: number, action: 'include' | 'exclude' | 'reset', flatFee?: number | null) => {
    if (!selectedPartner) return
    setCourseBusyId(productId)
    setCoursesError(null)
    try {
      setPartnerCourses(await setPartnerProductApi(selectedPartner.id, productId, action, flatFee))
      setFeeDrafts((current) => {
        const next = { ...current }
        delete next[productId]
        return next
      })
      setCoursesChanged(true)
    } catch (saveError) {
      setCoursesError(saveError instanceof Error ? saveError.message : 'Unable to update the partner courses.')
    } finally {
      setCourseBusyId(null)
    }
  }

  const saveCourseFee = (course: PartnerProduct) => {
    const draft = (feeDrafts[course.productId] ?? '').trim()
    if (draft === '') {
      // Blank means "use the share %": drop a custom fee, or fall back to the Academy default for linked courses.
      void changeCourse(course.productId, course.source === 'academy' ? 'reset' : 'include', null)
      return
    }
    void changeCourse(course.productId, 'include', Number(draft))
  }

  const removeCourse = (course: PartnerProduct) =>
    changeCourse(course.productId, course.source === 'academy' ? 'exclude' : 'reset')

  const addableCourses = (partnerCourses?.available ?? [])
    .filter((course) => !courseSearch.trim() || course.title.toLowerCase().includes(courseSearch.trim().toLowerCase()))

  // Edit the selected partner's default share % (course-specific flat fees are not affected)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareValue, setShareValue] = useState('')
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  const openShareDialog = () => {
    setShareValue(selectedPartner?.partnerSharePct !== null && selectedPartner?.partnerSharePct !== undefined ? String(selectedPartner.partnerSharePct) : '')
    setShareError(null)
    setShareOpen(true)
  }

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

  const saveShare = async (percentage: number | null) => {
    if (!selectedPartner) return
    setShareSaving(true)
    setShareError(null)
    try {
      const updated = await updatePartnerShareApi(selectedPartner.id, percentage)
      setPartners((current) => current.map((partner) => (partner.id === updated.id ? { ...partner, ...updated } : partner)))
      setShareOpen(false)
      await loadReport()
    } catch (saveError) {
      setShareError(saveError instanceof Error ? saveError.message : 'Unable to update the partner share.')
    } finally {
      setShareSaving(false)
    }
  }

  const exportExcel = async () => {
    const [XLSX, { formatDataWorksheet }] = await Promise.all([
      import('xlsx-js-style'),
      import('@/lib/excelFormatting'),
    ])
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
      'Partner Share ($)',
      'Remittance from Stripe ($)',
      'Stripe Transaction ID',
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
      item.partnerShare ?? '',
      item.remittanceFromStripe,
      item.stripeChargeId || '',
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
      reportData.summary.totalPartnerShare,
      reportData.summary.totalRemittanceFromStripe,
      '',
    ]

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows, totalRow])
    formatDataWorksheet(worksheet, {
      headerRow: 0,
      dataEndRow: dataRows.length + 1,
      totalRow: dataRows.length + 1,
      columnWidths: [18, 26, 40, 10, 12, 16, 16, 16, 16, 16, 18, 24, 34],
      currencyColumns: [5, 6, 7, 8, 9, 10, 11],
      centerContent: true,
    })

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
          <Button variant="outline" onClick={() => setManageOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Manage
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
                Select Partner ({partners.length} Vendors)
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

          {selectedPartner && (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-xs text-blue-950">
              <div className="flex items-center gap-1.5 font-semibold">
                <Users className="h-4 w-4 text-blue-600" />
                <span>{selectedPartner.name}</span>
              </div>
              <div className="h-4 w-px bg-blue-200" />
              <div>Partner Share is calculated from each course's vendor payment system rate.</div>
              <div className="h-4 w-px bg-blue-200" />
              <div>
                Default share: <span className="font-semibold">{selectedPartner.partnerSharePct !== null && selectedPartner.partnerSharePct !== undefined ? `${selectedPartner.partnerSharePct}%` : 'Not set'}</span>
                {selectedPartner.isCustomShare ? <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-800">Custom</span> : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Orders</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-20" /> : (reportData?.totalOrders || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Orders for selected period</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gross Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{loading ? <Skeleton className="h-8 w-24" /> : formatUSD(reportData?.summary.totalGrossSale || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total revenue collected</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stripe Fees</CardTitle>
            <Wallet className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{loading ? <Skeleton className="h-8 w-24" /> : formatUSD(reportData?.summary.totalStripeFees || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total card processing fees</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-blue-50/40 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-900">Remittance from Stripe</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{loading ? <Skeleton className="h-8 w-28" /> : formatUSD(reportData?.summary.totalRemittanceFromStripe || 0)}</div>
            <p className="text-xs text-blue-800/80 mt-1">Net sales after Stripe fees &amp; partner share</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="border-b bg-slate-50/50 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">Itemized Transactions &amp; Remittance Breakdown</CardTitle>
            {reportData && <span className="text-xs font-medium text-muted-foreground">Showing {reportData.items.length} records</span>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : error ? (
            <div className="m-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />{error}
            </div>
          ) : !reportData || reportData.items.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
              <p className="font-semibold text-slate-800">No partner transactions found</p>
              <p className="mt-1 text-xs text-muted-foreground">Try selecting a different partner or adjusting the date range filter.</p>
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
                      <td className="px-4 py-3 text-right text-blue-700 font-medium">{item.partnerShare === null ? '' : formatUSD(item.partnerShare)}</td>
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

      {/* Manage Partner Courses Dialog */}
      <Dialog open={coursesOpen} onOpenChange={(open) => { if (!open) closeCoursesDialog() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{coursesView === 'add' ? 'Add course for' : 'Courses for'} {selectedPartner?.name}</DialogTitle>
            <DialogDescription>
              {coursesView === 'add'
                ? 'Pick a course to assign to this partner. Its sales will be reported for them.'
                : 'Sales of these courses are reported for this partner. A fixed fee replaces the share % for that course; leave it blank to use the share %.'}
            </DialogDescription>
          </DialogHeader>

          {coursesLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div>
          ) : null}
          {coursesError ? <p role="alert" className="text-xs text-red-700">{coursesError}</p> : null}

          {partnerCourses ? (
            <div className="space-y-5">
              {coursesView === 'edit' ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold">Assigned courses ({partnerCourses.assigned.length})</h3>
                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
                  {partnerCourses.assigned.map((course) => {
                    const draft = feeDrafts[course.productId]
                    const currentFee = course.flatFee === null ? '' : String(course.flatFee)
                    const dirty = draft !== undefined && draft.trim() !== currentFee
                    return (
                      <div key={course.productId} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-slate-900">{course.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {course.source === 'manual' ? 'Added manually' : 'From Academy assignment'}
                            {course.feeSource === 'built-in' ? ' · built-in fixed fee' : ''}
                            {course.noFee ? ' · no partner fee' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="Use %"
                            aria-label={`Fixed fee for ${course.title}`}
                            value={draft ?? currentFee}
                            onChange={(event) => setFeeDrafts((current) => ({ ...current, [course.productId]: event.target.value }))}
                            className="h-8 w-24 text-xs"
                          />
                          {dirty ? (
                            <Button size="sm" className="h-8 px-2 text-xs" disabled={courseBusyId === course.productId} onClick={() => saveCourseFee(course)}>Save</Button>
                          ) : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" size="icon" variant="ghost" disabled={courseBusyId === course.productId} aria-label={`Actions for ${course.title}`} className="h-8 w-8 text-slate-500 hover:text-slate-900">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => void removeCourse(course)} className="text-red-700 focus:text-red-800">
                                <Trash2 className="mr-2 h-4 w-4" />Remove course
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )
                  })}
                  {partnerCourses.assigned.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-500">No courses assigned yet.</p> : null}
                </div>
              </section>
              ) : null}

              {coursesView === 'add' ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold">Add a course</h3>
                <div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} placeholder="Search courses" className="h-10 pl-9" /></div>
                <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
                  {addableCourses.slice(0, 100).map((course) => (
                    <div key={course.productId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 break-words text-slate-800">{course.title}</span>
                      <Button type="button" size="sm" variant="outline" disabled={courseBusyId === course.productId} onClick={() => void changeCourse(course.productId, 'include', null)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add</Button>
                    </div>
                  ))}
                  {addableCourses.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-500">No matching courses.</p> : null}
                </div>
                {addableCourses.length > 100 ? <p className="mt-1 text-xs text-slate-500">Showing the first 100 of {addableCourses.length}. Narrow the search to see more.</p> : null}
              </section>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:space-x-0">
            {backToManage(closeCoursesDialog)}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Dialog: entry point for all partner management actions */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage partners</DialogTitle>
            <DialogDescription>
              Selected partner: <span className="font-medium text-foreground">{selectedPartner?.name}</span>. Add Partner applies to everyone; the other options apply to the selected partner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { icon: Plus, label: 'Add partner', hint: 'Create a new partner', run: openAddPartnerDialog },
              { icon: Pencil, label: 'Edit share %', hint: 'Change the default partner share', run: openShareDialog },
              { icon: Plus, label: 'Add course', hint: 'Assign more courses to this partner', run: () => void openCoursesDialog('add') },
              { icon: BookOpen, label: 'Edit courses', hint: 'Review assigned courses, set fixed fees or remove', run: () => void openCoursesDialog('edit') },
              { icon: Mail, label: 'Reconciliation report', hint: 'Email schedule and preview', run: openSettingsDialog },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => runManageAction(option.run)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700"><option.icon className="h-4 w-4" /></span>
                <span>
                  <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Partner Dialog */}
      <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add partner</DialogTitle>
            <DialogDescription>
              New partners start with scheduled report emails turned off. Turn them on in Reconciliation Report Settings when ready.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-partner-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Partner name *</Label>
              <Input id="new-partner-name" value={newPartner.name} onChange={(event) => setNewPartner({ ...newPartner, name: event.target.value })} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-partner-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notification email</Label>
              <Input id="new-partner-email" type="email" value={newPartner.email} onChange={(event) => setNewPartner({ ...newPartner, email: event.target.value })} className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-partner-share" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Partner share (%) *</Label>
                <Input id="new-partner-share" type="number" min={0} max={100} step={0.01} value={newPartner.share} onChange={(event) => setNewPartner({ ...newPartner, share: event.target.value })} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report frequency</Label>
                <Select value={newPartner.frequency} onValueChange={(value) => setNewPartner({ ...newPartner, frequency: value as ReportFrequency })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-partner-academy" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Academy partner ID</Label>
              <Input id="new-partner-academy" type="number" min={1} value={newPartner.academyId} onChange={(event) => setNewPartner({ ...newPartner, academyId: event.target.value })} className="h-10" />
              <p className="text-xs text-muted-foreground">Links the partner's courses from the Academy payout-partner list. Without it, sales are matched by the partner name in the order source.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-partner-description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
              <Input id="new-partner-description" value={newPartner.description} onChange={(event) => setNewPartner({ ...newPartner, description: event.target.value })} className="h-10" />
            </div>
            {addPartnerError ? <p role="alert" className="text-xs text-red-700">{addPartnerError}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:space-x-0">
            {backToManage(() => setAddPartnerOpen(false), addPartnerSaving)}
            <Button
              disabled={addPartnerSaving || !newPartner.name.trim() || newPartner.share.trim() === '' || !Number.isFinite(Number(newPartner.share))}
              onClick={() => void saveNewPartner()}
            >
              {addPartnerSaving ? 'Adding...' : 'Add partner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit partner share %</DialogTitle>
            <DialogDescription>
              Default share for {selectedPartner?.name}. It applies to courses without a fixed per-course fee; courses with a fixed fee keep that fee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="partner-share-pct" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Partner share (%)</Label>
            <Input
              id="partner-share-pct"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={shareValue}
              onChange={(event) => setShareValue(event.target.value)}
              className="h-10"
            />
            {selectedPartner?.defaultPartnerSharePct !== null && selectedPartner?.defaultPartnerSharePct !== undefined ? (
              <p className="text-xs text-muted-foreground">Built-in rate: {selectedPartner.defaultPartnerSharePct}%</p>
            ) : null}
            {shareError ? <p role="alert" className="text-xs text-red-700">{shareError}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:space-x-0">
            {backToManage(() => setShareOpen(false), shareSaving)}
            {selectedPartner?.isCustomShare ? (
              <Button variant="outline" disabled={shareSaving} onClick={() => void saveShare(null)}>Reset to built-in</Button>
            ) : null}
            <Button
              disabled={shareSaving || shareValue.trim() === '' || !Number.isFinite(Number(shareValue))}
              onClick={() => void saveShare(Number(shareValue))}
            >
              {shareSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reconciliation Report Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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

          <DialogFooter className="gap-2 sm:flex-wrap sm:space-x-0">
            {backToManage(() => setSettingsOpen(false))}
            <Button variant="outline" onClick={() => void openEmailPreview()} disabled={settingsLoading || !settingsForm}>
              <Eye className="mr-2 h-4 w-4" />
              Preview Email
            </Button>
            <Button onClick={() => void saveSettings()} disabled={settingsLoading || settingsSaving || !settingsForm}>
              {settingsSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              This is how the report email for {settingsPartnerName} will look. Nothing has been sent.
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : null}

          {previewError ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {previewError}
            </div>
          ) : null}

          {emailPreview ? (
            <div className="space-y-3">
              <div className="space-y-1 rounded-lg border bg-slate-50/60 p-3 text-xs text-slate-700">
                <p><span className="font-semibold">To:</span> {emailPreview.to.length > 0 ? emailPreview.to.join(', ') : 'No notification email configured for this partner'}</p>
                {emailPreview.cc.length > 0 ? <p><span className="font-semibold">Cc:</span> {emailPreview.cc.join(', ')}</p> : null}
                <p><span className="font-semibold">Subject:</span> {emailPreview.subject}</p>
                <p><span className="font-semibold">Period:</span> {emailPreview.window.fromDate} to {emailPreview.window.toDate}</p>
                {emailPreview.attachments.map((attachment) => (
                  <p key={attachment.filename}>
                    <span className="font-semibold">Attachment:</span> {attachment.filename} ({Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB)
                  </p>
                ))}
              </div>
              {!emailPreview.hasRecipient ? (
                <p className="text-xs font-medium text-amber-700">This partner has no notification email, so this report would be skipped when sending.</p>
              ) : null}
              <iframe
                title="Partner report email preview"
                sandbox=""
                srcDoc={emailPreview.html}
                className="h-[28rem] w-full rounded-lg border bg-white"
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

