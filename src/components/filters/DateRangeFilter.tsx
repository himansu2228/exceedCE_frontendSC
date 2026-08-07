import { useEffect, useMemo, useState } from 'react'
import {
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { CalendarDays, ChevronDown, Funnel, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type DateRangePreset =
  | 'custom'
  | 'last30Days'
  | 'last90Days'
  | 'last365Days'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'

export interface DateRangeValue {
  fromDate: string
  toDate: string
}

interface DateRangeFilterProps {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  className?: string
  inputClassName?: string
  selectClassName?: string
  showLabels?: boolean
  maxDate?: string
}

const PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'custom', label: 'Custom Range' },
  { id: 'last30Days', label: 'Last 30 days' },
  { id: 'last90Days', label: 'Last 90 days' },
  { id: 'last365Days', label: 'Last 365 days' },
  { id: 'thisWeek', label: 'This week' },
  { id: 'lastWeek', label: 'Last week' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
]

function toIsoDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function fromIsoDate(value: string): Date | undefined {
  if (!value) return undefined
  return parseISO(value)
}

function isSameRange(a: DateRangeValue, b: DateRangeValue): boolean {
  return a.fromDate === b.fromDate && a.toDate === b.toDate
}

function getPresetRange(preset: DateRangePreset): DateRangeValue {
  const today = new Date()
  switch (preset) {
    case 'last30Days':
      return { fromDate: toIsoDate(subDays(today, 29)), toDate: toIsoDate(today) }
    case 'last90Days':
      return { fromDate: toIsoDate(subDays(today, 89)), toDate: toIsoDate(today) }
    case 'last365Days':
      return { fromDate: toIsoDate(subDays(today, 364)), toDate: toIsoDate(today) }
    case 'thisWeek': {
      const start = startOfWeek(today, { weekStartsOn: 1 })
      return { fromDate: toIsoDate(start), toDate: toIsoDate(today) }
    }
    case 'lastWeek': {
      const lastWeekRef = subWeeks(today, 1)
      const start = startOfWeek(lastWeekRef, { weekStartsOn: 1 })
      const end = endOfWeek(lastWeekRef, { weekStartsOn: 1 })
      return { fromDate: toIsoDate(start), toDate: toIsoDate(end) }
    }
    case 'thisMonth': {
      const start = startOfMonth(today)
      return { fromDate: toIsoDate(start), toDate: toIsoDate(today) }
    }
    case 'lastMonth': {
      const lastMonthRef = subMonths(today, 1)
      const start = startOfMonth(lastMonthRef)
      const end = endOfMonth(lastMonthRef)
      return { fromDate: toIsoDate(start), toDate: toIsoDate(end) }
    }
    case 'custom':
    default:
      return { fromDate: '', toDate: '' }
  }
}

export function DateRangeFilter({
  value,
  onChange,
  className,
  inputClassName,
  selectClassName,
  showLabels = true,
  maxDate,
}: DateRangeFilterProps) {
  const todayIso = useMemo(() => toIsoDate(new Date()), [])
  const effectiveMaxDate = maxDate || todayIso
  const maxDateValue = useMemo(() => fromIsoDate(effectiveMaxDate), [effectiveMaxDate])
  const [preset, setPreset] = useState<DateRangePreset>('custom')
  const [isOpen, setIsOpen] = useState(false)

  const calendarRange = useMemo<DateRange>(
    () => ({ from: fromIsoDate(value.fromDate), to: fromIsoDate(value.toDate) }),
    [value.fromDate, value.toDate],
  )

  useEffect(() => {
    const matchedPreset = PRESETS.find((item) => {
      if (item.id === 'custom') return false
      return isSameRange(getPresetRange(item.id), value)
    })
    setPreset(matchedPreset?.id || 'custom')
  }, [value])

  const rangeLabel = useMemo(() => {
    const from = calendarRange.from
    const to = calendarRange.to
    if (!from && !to) return 'From Date - To Date'
    if (from && to) {
      if (isSameDay(from, to)) return format(from, 'dd MMM yyyy')
      return `${format(from, 'dd MMM yyyy')} - ${format(to, 'dd MMM yyyy')}`
    }
    if (from) return `${format(from, 'dd MMM yyyy')} - ...`
    return `... - ${to ? format(to, 'dd MMM yyyy') : ''}`
  }, [calendarRange.from, calendarRange.to])

  const applyPreset = (nextPreset: DateRangePreset) => {
    setPreset(nextPreset)
    if (nextPreset === 'custom') return
    onChange(getPresetRange(nextPreset))
  }

  const clearRange = () => {
    setPreset('custom')
    onChange({ fromDate: '', toDate: '' })
  }

  const handleCalendarChange = (range: DateRange | undefined) => {
    setPreset('custom')
    onChange({
      fromDate: range?.from ? toIsoDate(range.from) : '',
      toDate: range?.to ? toIsoDate(range.to) : '',
    })
  }

  return (
    <div className={cn('flex flex-wrap items-end gap-2', className)}>
      <div className="min-w-[300px]">
        {showLabels ? <p className="mb-1 text-xs text-muted-foreground">Date Range</p> : null}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                'h-10 w-full justify-between border-sky-300/70 bg-white/80 text-left text-sm font-normal shadow-sm hover:bg-sky-50/60',
                !value.fromDate && !value.toDate ? 'text-muted-foreground' : 'text-foreground',
                inputClassName,
              )}
            >
              <span className="flex items-center gap-2 truncate">
                <CalendarDays className="h-4 w-4 shrink-0 text-sky-600" />
                {rangeLabel}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn('w-[760px] max-w-[96vw] p-0', selectClassName)} align="start">
            <div className="flex flex-col md:flex-row">
              <div className="w-full border-b bg-zinc-50/70 p-3 md:w-[180px] md:border-b-0 md:border-r">
                <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <Funnel className="h-3 w-3" />
                  Quick Ranges
                </div>
                <div className="space-y-1">
                  {PRESETS.filter((item) => item.id !== 'custom').map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => applyPreset(item.id)}
                      className={cn(
                        'w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                        preset === item.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-foreground hover:bg-blue-50',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 p-2">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={calendarRange}
                  onSelect={handleCalendarChange}
                  defaultMonth={calendarRange.from || maxDateValue}
                  disabled={{ after: maxDateValue }}
                />

                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-muted-foreground">Selected: {rangeLabel}</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={clearRange}>
                      <X className="mr-1 h-3.5 w-3.5" />
                      Clear
                    </Button>
                    <Button type="button" size="sm" onClick={() => setIsOpen(false)}>
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}