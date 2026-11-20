import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  Check,
  Copy,
  Download,
  ExternalLink,
  PackageCheck,
  Percent,
  RefreshCw,
  Search,
  Tag,
  Ticket,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'
import {
  getCouponOrders,
  getCouponsReport,
  type CouponItem,
  type CouponOrder,
  type CouponSummary,
} from '@/lib/api'
import { exportCouponsToXlsx } from '@/lib/exportCoupons'
import { formatCurrency } from './shared'

export function SalesCouponsPage() {
  const [coupons, setCoupons] = useState<CouponItem[]>([])
  const [summary, setSummary] = useState<CouponSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'archived'>('all')
  const [usageFilter, setUsageFilter] = useState<'all' | 'used' | 'unused'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'percent_amount' | 'fixed_amount'>('all')
  const [sortBy, setSortBy] = useState<'usage' | 'revenue' | 'discount' | 'code' | 'expiry'>('usage')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [dateRange, setDateRange] = useState<DateRangeValue>({ fromDate: '', toDate: '' })

  // Pagination
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  // Orders drilldown modal
  const [selectedCoupon, setSelectedCoupon] = useState<CouponItem | null>(null)
  const [couponOrders, setCouponOrders] = useState<CouponOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [ordersSearch, setOrdersSearch] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    try {
      setLoading(true)
      setError(null)
      const res = await getCouponsReport({
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
        refresh,
      })
      setCoupons(res.coupons || [])
      setSummary(res.summary || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coupons report')
      setCoupons([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openOrdersModal = async (coupon: CouponItem) => {
    setSelectedCoupon(coupon)
    setOrdersSearch('')
    setCouponOrders([])
    setLoadingOrders(true)
    try {
      const res = await getCouponOrders(coupon.code, {
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
        limit: 300,
      })
      setCouponOrders(res.orders || [])
    } catch (err) {
      console.error('Failed to load coupon orders:', err)
      setCouponOrders([])
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 1800)
  }

  const handleExport = () => {
    if (!summary) return
    const rangeLabel = dateRange.fromDate && dateRange.toDate
      ? `${dateRange.fromDate} to ${dateRange.toDate}`
      : dateRange.fromDate
        ? `From ${dateRange.fromDate}`
        : dateRange.toDate
          ? `Until ${dateRange.toDate}`
          : 'All Time'
    exportCouponsToXlsx(summary, filteredCoupons, rangeLabel)
  }

  // Filtered & Sorted Coupons
  const filteredCoupons = useMemo(() => {
    return coupons.filter((item) => {
      if (search.trim()) {
        const term = search.trim().toLowerCase()
        if (!item.code.toLowerCase().includes(term)) return false
      }
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (usageFilter === 'used' && item.usageCount === 0) return false
      if (usageFilter === 'unused' && item.usageCount > 0) return false
      if (typeFilter !== 'all' && item.type !== typeFilter) return false
      return true
    })
  }, [coupons, search, statusFilter, usageFilter, typeFilter])

  const sortedCoupons = useMemo(() => {
    const list = [...filteredCoupons]
    list.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'usage') {
        comparison = a.usageCount - b.usageCount
      } else if (sortBy === 'revenue') {
        comparison = a.totalRevenue - b.totalRevenue
      } else if (sortBy === 'discount') {
        comparison = a.totalDiscount - b.totalDiscount
      } else if (sortBy === 'code') {
        comparison = a.code.localeCompare(b.code)
      } else if (sortBy === 'expiry') {
        const aDate = a.expiredAt === 'Never' ? '9999-99-99' : a.expiredAt || ''
        const bDate = b.expiredAt === 'Never' ? '9999-99-99' : b.expiredAt || ''
        comparison = aDate.localeCompare(bDate)
      }
      return sortDir === 'asc' ? comparison : -comparison
    })
    return list
  }, [filteredCoupons, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedCoupons.length / perPage))
  const currentPage = Math.min(page, totalPages)
  const paginatedCoupons = sortedCoupons.slice((currentPage - 1) * perPage, currentPage * perPage)

  // Filtered orders in drilldown modal
  const filteredModalOrders = useMemo(() => {
    if (!ordersSearch.trim()) return couponOrders
    const term = ordersSearch.trim().toLowerCase()
    return couponOrders.filter((order) => {
      return (
        order.aomOrderId?.toLowerCase().includes(term) ||
        order.customerName.toLowerCase().includes(term) ||
        order.customerEmail.toLowerCase().includes(term) ||
        order.items.toLowerCase().includes(term) ||
        order.state.toLowerCase().includes(term)
      )
    })
  }, [couponOrders, ordersSearch])

  return (
    <div className="space-y-6 pb-10 animate-fadeIn">
      {/* Header Banner */}
      <section className="overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-emerald-50/50 shadow-[0_24px_70px_-45px_rgba(13,148,136,0.35)]">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/60 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-800">
              <Ticket className="h-3.5 w-3.5" />
              Promotion & Discount Analytics
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Coupons Directory & Usage
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Complete inventory of LMS promotional coupons with real-time redemption counts, gross revenue generated, and learner discount totals from historical order ledgers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void load(true)}
              className="gap-2 border-slate-300 bg-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="default"
              disabled={loading || !coupons.length}
              onClick={handleExport}
              className="gap-2 bg-teal-700 hover:bg-teal-800 text-white shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>
      </section>

      {/* Date Range Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <TrendingUp className="h-4 w-4 text-teal-600" />
          <span className="font-semibold text-slate-800">Filter Redemption Window:</span>
          <span className="text-xs text-slate-500">Limits usage counts & revenue to orders within this range</span>
        </div>
        <DateRangeFilter
          value={dateRange}
          onChange={(newVal) => {
            setDateRange(newVal)
            setPage(1)
          }}
          showLabels={false}
          showToday
        />
      </div>

      {/* Metric KPI Cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Coupon summary statistics">
        <Card className="border-t-4 border-t-teal-600 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Total Coupons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !summary ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <p className="text-2xl font-bold text-slate-900">{summary?.totalCoupons ?? 0}</p>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="font-medium text-emerald-700">{summary?.activeCoupons ?? 0} active</span>
                  {' · '}
                  <span>{summary?.expiredCoupons ?? 0} expired</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-emerald-600 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Coupons Redeemed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !summary ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <p className="text-2xl font-bold text-slate-900">{summary?.usedCoupons ?? 0}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {summary?.totalCoupons ? `${Math.round(((summary.usedCoupons) / summary.totalCoupons) * 100)}% utilization rate` : '0%'}
                  {' · '}
                  <span className="text-slate-400">{summary?.unusedCoupons ?? 0} unused</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-blue-600 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Total Redemptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !summary ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <p className="text-2xl font-bold text-slate-900">
                  {summary?.totalRedemptions?.toLocaleString() ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-500">Total orders with coupon applied</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-violet-600 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Gross Sales Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !summary ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(summary?.totalRevenue ?? 0)}
                </p>
                <p className="mt-1 text-xs text-slate-500">Gross revenue generated via coupons</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-amber-500 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Total Discounts Given
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !summary ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(summary?.totalDiscounts ?? 0)}
                </p>
                <p className="mt-1 text-xs text-slate-500">Total savings granted to learners</p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Filter and Control Toolbar */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search coupon code…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(val: 'all' | 'active' | 'expired' | 'archived') => {
              setStatusFilter(val)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="expired">Expired Only</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          {/* Usage Filter */}
          <Select
            value={usageFilter}
            onValueChange={(val: 'all' | 'used' | 'unused') => {
              setUsageFilter(val)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Usage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Coupons</SelectItem>
              <SelectItem value="used">Redeemed (&gt; 0)</SelectItem>
              <SelectItem value="unused">Zero Usage (0)</SelectItem>
            </SelectContent>
          </Select>

          {/* Discount Type Filter */}
          <Select
            value={typeFilter}
            onValueChange={(val: 'all' | 'percent_amount' | 'fixed_amount') => {
              setTypeFilter(val)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Discount Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="percent_amount">Percentage (%)</SelectItem>
              <SelectItem value="fixed_amount">Fixed ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Sort:</span>
          <Select
            value={sortBy}
            onValueChange={(val: 'usage' | 'revenue' | 'discount' | 'code' | 'expiry') => {
              setSortBy(val)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usage">Times Used</SelectItem>
              <SelectItem value="revenue">Gross Revenue</SelectItem>
              <SelectItem value="discount">Total Discounts</SelectItem>
              <SelectItem value="code">Coupon Code</SelectItem>
              <SelectItem value="expiry">Expiration Date</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            className="px-2.5"
          >
            <ArrowUpDown className="h-4 w-4" />
            <span className="ml-1 text-xs">{sortDir.toUpperCase()}</span>
          </Button>
        </div>
      </section>

      {error && (
        <div role="alert" className="border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-800 rounded-r-md">
          {error}
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3.5">Coupon Code</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Discount</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Limit</th>
                <th className="px-4 py-3.5">Expires</th>
                <th className="px-4 py-3.5 text-right">Times Used</th>
                <th className="px-4 py-3.5 text-right">Gross Revenue</th>
                <th className="px-4 py-3.5 text-right">Total Discounts</th>
                <th className="px-4 py-3.5">Last Redeemed</th>
                <th className="px-4 py-3.5 text-center">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !coupons.length ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 11 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedCoupons.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-sm text-slate-500">
                    No coupons match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedCoupons.map((row) => (
                  <tr
                    key={row.code}
                    className={`transition-colors hover:bg-slate-50/70 ${
                      row.usageCount > 0 ? 'bg-white' : 'bg-slate-50/30 text-slate-500'
                    }`}
                  >
                    {/* Code */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-slate-900">
                        <span>{row.code}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(row.code)}
                          title="Copy coupon code"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          {copiedCode === row.code ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      {row.status === 'active' ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          Active
                        </Badge>
                      ) : row.status === 'expired' ? (
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                          Expired
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                          Archived
                        </Badge>
                      )}
                    </td>

                    {/* Discount */}
                    <td className="px-4 py-3.5 font-semibold text-teal-700">
                      {row.discountFormatted}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {row.type === 'percent_amount' ? (
                        <span className="inline-flex items-center gap-1">
                          <Percent className="h-3 w-3 text-slate-400" /> Percentage
                        </span>
                      ) : row.type === 'fixed_amount' ? (
                        <span className="inline-flex items-center gap-1">
                          <Tag className="h-3 w-3 text-slate-400" /> Fixed ($)
                        </span>
                      ) : (
                        row.type
                      )}
                    </td>

                    {/* Limit */}
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {row.totalLimit}
                    </td>

                    {/* Expiration */}
                    <td className="px-4 py-3.5 text-xs">
                      {row.expiredAt === 'Never' ? (
                        <span className="text-emerald-700 font-medium">Never</span>
                      ) : (
                        <span className={row.status === 'expired' ? 'text-amber-800 font-medium' : 'text-slate-700'}>
                          {row.expiredAt}
                        </span>
                      )}
                    </td>

                    {/* Times Used */}
                    <td className="px-4 py-3.5 text-right font-medium">
                      {row.usageCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => openOrdersModal(row)}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:underline"
                          title="Click to view orders"
                        >
                          <PackageCheck className="h-3.5 w-3.5" />
                          {row.usageCount}
                        </button>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Gross Revenue */}
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                      {row.totalRevenue > 0 ? formatCurrency(row.totalRevenue) : '—'}
                    </td>

                    {/* Total Discounts */}
                    <td className="px-4 py-3.5 text-right font-medium text-amber-700">
                      {row.totalDiscount > 0 ? formatCurrency(row.totalDiscount) : '—'}
                    </td>

                    {/* Last Redeemed */}
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {row.lastUsed ? (
                        <span>{new Date(row.lastUsed).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-slate-400">Never</span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="px-4 py-3.5 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={row.usageCount === 0}
                        onClick={() => openOrdersModal(row)}
                        className="h-8 gap-1 px-2.5 text-xs text-teal-700 hover:text-teal-900 hover:bg-teal-50 disabled:opacity-30"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Orders
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer Totals */}
            {paginatedCoupons.length > 0 && (
              <tfoot className="border-t-2 border-teal-600 bg-teal-50/60 font-semibold text-slate-900">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-sm">
                    Showing {paginatedCoupons.length} of {filteredCoupons.length} coupons
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-blue-800">
                    {filteredCoupons.reduce((sum, c) => sum + c.usageCount, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(filteredCoupons.reduce((sum, c) => sum + c.totalRevenue, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-amber-800">
                    {formatCurrency(filteredCoupons.reduce((sum, c) => sum + c.totalDiscount, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="border-t border-slate-200 px-4 py-3">
          <PaginationControls
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredCoupons.length}
            pageSize={perPage}
            pageSizeOptions={[15, 25, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPerPage(size)
              setPage(1)
            }}
          />
        </div>
      </div>

      {/* Orders Drilldown Dialog Modal */}
      <Dialog open={selectedCoupon !== null} onOpenChange={(open) => !open && setSelectedCoupon(null)}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <div className="flex items-center justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                  <Ticket className="h-5 w-5 text-teal-600" />
                  Orders for Coupon <span className="font-mono text-teal-700">{selectedCoupon?.code}</span>
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {selectedCoupon && (
                    <span>
                      Discount: <strong className="text-teal-700">{selectedCoupon.discountFormatted}</strong>
                      {' · '}
                      Total redemptions: <strong className="text-slate-900">{couponOrders.length} orders</strong>
                      {' · '}
                      Total Revenue:{' '}
                      <strong className="text-slate-900">
                        {formatCurrency(couponOrders.reduce((sum, o) => sum + o.total, 0))}
                      </strong>
                      {' · '}
                      Total Discount Given:{' '}
                      <strong className="text-amber-700">
                        {formatCurrency(couponOrders.reduce((sum, o) => sum + o.discountAmount, 0))}
                      </strong>
                    </span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Search inside modal */}
          <div className="pt-2">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Filter by learner name, email, course, order #…"
                value={ordersSearch}
                onChange={(e) => setOrdersSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Orders Table */}
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200">
            {loadingOrders ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : filteredModalOrders.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No orders match your filter.
              </div>
            ) : (
              <table className="w-full min-w-[800px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Order ID</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Learner</th>
                    <th className="px-3 py-2.5">Email</th>
                    <th className="px-3 py-2.5">Course / Package</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                    <th className="px-3 py-2.5 text-right">Discount</th>
                    <th className="px-3 py-2.5 text-right">Paid</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredModalOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-mono font-medium text-teal-700">
                        #{ord.aomOrderId || ord.id}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {ord.orderDate ? new Date(ord.orderDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900 max-w-xs truncate">
                        {ord.customerName}
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-xs truncate">
                        {ord.customerEmail}
                      </td>
                      <td className="px-3 py-2 text-slate-800 max-w-md truncate" title={ord.items}>
                        {ord.items}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {formatCurrency(ord.subTotal)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-amber-700">
                        {formatCurrency(ord.discountAmount)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                        {formatCurrency(ord.total)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                          {ord.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

