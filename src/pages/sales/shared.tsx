import { Badge } from '@/components/ui/badge'

export const STATE_OPTIONS: Array<{ code: string; name: string }> = [
  { code: 'AL', name: 'Alabama' },
  { code: 'CA', name: 'California' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MO', name: 'Missouri' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'NV', name: 'Nevada' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'WA', name: 'Washington' },
]

export function formatCurrency(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value || 0))
  } catch {
    return `$${Number(value || 0).toFixed(2)}`
  }
}

export function statusVariant(status: string): 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'outline' {
  const normalized = String(status || '').toUpperCase()
  if (normalized.includes('COMPLETE')) return 'success'
  if (normalized.includes('REFUND')) return 'warning'
  if (normalized.includes('FAILED') || normalized.includes('CANCEL')) return 'error'
  if (normalized.includes('PENDING') || normalized.includes('AWAITING')) return 'secondary'
  return 'outline'
}

export function StatusBadge({ status, displayStatus }: { status?: string; displayStatus?: string }) {
  const label = displayStatus || status || 'N/A'
  return <Badge variant={statusVariant(status || label)}>{label}</Badge>
}
