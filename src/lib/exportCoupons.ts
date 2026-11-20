import * as XLSX from 'xlsx-js-style'
import type { CouponItem, CouponSummary } from './api'
import { formatDataWorksheet } from './excelFormatting'

export function buildCouponsWorkbook(
  summary: CouponSummary,
  coupons: CouponItem[],
  dateRangeLabel?: string
) {
  const workbook = XLSX.utils.book_new()

  const summarySheetData: (string | number)[][] = [
    ['COUPON USAGE & PERFORMANCE REPORT'],
    ['Report field', 'Value'],
    ['Exported at (UTC)', new Date().toISOString()],
    ['Date Filter Scope', dateRangeLabel || 'All Time'],
    ['Total Coupons Tracked', summary.totalCoupons],
    ['Active Coupons', summary.activeCoupons],
    ['Expired Coupons', summary.expiredCoupons],
    ['Archived / Historical Coupons', summary.archivedCoupons],
    ['Coupons with >= 1 Usage', summary.usedCoupons],
    ['Coupons with 0 Usage', summary.unusedCoupons],
    ['Total Coupon Redemptions (Orders)', summary.totalRedemptions],
    ['Total Sales Revenue via Coupons', summary.totalRevenue],
    ['Total Discounts Granted', summary.totalDiscounts],
  ]
  const metadata = XLSX.utils.aoa_to_sheet(summarySheetData)

  const couponsTableData: (string | number)[][] = [
    ['COUPON DIRECTORY & REDEMPTION TELEMETRY'],
    [
      'Coupon Code',
      'Status',
      'Discount',
      'Discount Type',
      'Usage Limit',
      'Expiration Date',
      'Times Used',
      'Gross Sales Revenue',
      'Total Discounts Given',
      'First Used',
      'Last Used',
    ],
    ...coupons.map((c) => [
      c.code,
      c.status.toUpperCase(),
      c.discountFormatted,
      c.type === 'percent_amount' ? 'Percentage' : c.type === 'fixed_amount' ? 'Fixed Amount' : c.type,
      String(c.totalLimit),
      c.expiredAt || 'Never',
      c.usageCount,
      c.totalRevenue,
      c.totalDiscount,
      c.firstUsed ? c.firstUsed.slice(0, 10) : 'Never',
      c.lastUsed ? c.lastUsed.slice(0, 10) : 'Never',
    ]),
    [
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      summary.totalRedemptions,
      summary.totalRevenue,
      summary.totalDiscounts,
      '',
      '',
    ],
  ]
  const couponsSheet = XLSX.utils.aoa_to_sheet(couponsTableData)

  formatDataWorksheet(metadata, {
    titleRow: 0,
    headerRow: 1,
    dataEndRow: summarySheetData.length - 1,
    columnWidths: [32, 45],
  })

  formatDataWorksheet(couponsSheet, {
    titleRow: 0,
    headerRow: 1,
    dataEndRow: coupons.length + 1,
    totalRow: coupons.length + 2,
    columnWidths: [18, 14, 14, 18, 16, 18, 14, 22, 22, 16, 16],
  })

  // Format currency cells in metadata and coupons table
  const metaRevenueCell = metadata['B12']
  if (metaRevenueCell) {
    metaRevenueCell.t = 'n'
    metaRevenueCell.z = '$#,##0.00'
  }
  const metaDiscountCell = metadata['B13']
  if (metaDiscountCell) {
    metaDiscountCell.t = 'n'
    metaDiscountCell.z = '$#,##0.00'
  }

  for (let row = 2; row <= coupons.length + 2; row += 1) {
    const revCell = couponsSheet[XLSX.utils.encode_cell({ r: row, c: 7 })]
    if (revCell && typeof revCell.v === 'number') {
      revCell.t = 'n'
      revCell.z = '$#,##0.00'
    }
    const discCell = couponsSheet[XLSX.utils.encode_cell({ r: row, c: 8 })]
    if (discCell && typeof discCell.v === 'number') {
      discCell.t = 'n'
      discCell.z = '$#,##0.00'
    }
    const usedCell = couponsSheet[XLSX.utils.encode_cell({ r: row, c: 6 })]
    if (usedCell && typeof usedCell.v === 'number') {
      usedCell.t = 'n'
      usedCell.z = '#,##0'
    }
  }

  XLSX.utils.book_append_sheet(workbook, metadata, 'Summary')
  XLSX.utils.book_append_sheet(workbook, couponsSheet, 'Coupons')

  return workbook
}

export function exportCouponsToXlsx(
  summary: CouponSummary,
  coupons: CouponItem[],
  dateRangeLabel?: string
) {
  const workbook = buildCouponsWorkbook(summary, coupons, dateRangeLabel)
  const filename = `Coupons-Usage-Report-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(workbook, filename)
}

