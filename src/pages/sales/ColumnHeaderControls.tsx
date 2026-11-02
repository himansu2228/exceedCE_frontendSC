import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { STATE_OPTIONS } from './shared'

export type SortDir = 'asc' | 'desc'

export interface SortOption {
  label: string
  dir: SortDir
  key?: string
}

export const NUMBER_SORT: SortOption[] = [{ label: 'Highest first', dir: 'desc' }, { label: 'Lowest first', dir: 'asc' }]
export const TEXT_SORT: SortOption[] = [{ label: 'A to Z', dir: 'asc' }, { label: 'Z to A', dir: 'desc' }]
export const DATE_SORT: SortOption[] = [{ label: 'Newest first', dir: 'desc' }, { label: 'Oldest first', dir: 'asc' }]
export const COUNT_SORT: SortOption[] = [{ label: 'Most first', dir: 'desc' }, { label: 'Fewest first', dir: 'asc' }]
export const ORDER_STATUS_SORT: SortOption[] = [
  { label: 'Completed first', dir: 'asc', key: 'status:COMPLETED' },
  { label: 'Refunded first', dir: 'asc', key: 'status:REFUNDED' },
  { label: 'Pending payment first', dir: 'asc', key: 'status:PENDING_PAYMENT' },
  { label: 'Failed first', dir: 'asc', key: 'status:FAILED' },
  { label: 'Cancelled first', dir: 'asc', key: 'status:CANCELLED' },
]

const TRIGGER_CLASS = 'inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface SortHeaderProps {
  label: string
  sortKey: string
  options: SortOption[]
  activeKey: string
  activeDir: SortDir
  onChange: (key: string, dir: SortDir) => void
}

export function SortHeader({ label, sortKey, options, activeKey, activeDir, onChange }: SortHeaderProps) {
  const isActive = options.some((option) => (option.key ?? sortKey) === activeKey)
  const activeValue = options.find((option) => (option.key ?? sortKey) === activeKey && option.dir === activeDir)
  const Icon = !isActive ? ArrowUpDown : activeDir === 'asc' ? ArrowUp : ArrowDown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`${TRIGGER_CLASS} ${isActive ? 'text-foreground' : ''}`}>
        {label}
        <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-blue-600' : 'opacity-50'}`} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={activeValue ? `${activeValue.key ?? sortKey}|${activeValue.dir}` : ''}
          onValueChange={(value) => {
            const [key, dir] = value.split('|')
            onChange(key, dir as SortDir)
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={`${option.key ?? sortKey}|${option.dir}`} value={`${option.key ?? sortKey}|${option.dir}`}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const ALL_STATES_VALUE = '__all__'

export interface SourceOption {
  source: string
  count: number
}

export function SourceHeader({ value, options, onChange }: { value: string; options: SourceOption[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const visible = options.filter((option) => option.source.toLowerCase().includes(filter.trim().toLowerCase()))
  const select = (next: string) => {
    onChange(next)
    setOpen(false)
    setFilter('')
  }
  const itemClass = 'flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm font-normal hover:bg-muted'
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={`${TRIGGER_CLASS} ${value ? 'text-foreground' : ''}`}>
        <span className="max-w-40 truncate">Source{value ? `: ${value}` : ''}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${value ? 'text-blue-600' : 'opacity-50'}`} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search source"
          className="mb-2 h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="max-h-72 overflow-y-auto">
          <button type="button" className={`${itemClass} ${!value ? 'bg-muted' : ''}`} onClick={() => select('')}>All sources</button>
          {visible.map((option) => (
            <button key={option.source} type="button" className={`${itemClass} ${value === option.source ? 'bg-muted' : ''}`} onClick={() => select(option.source)}>
              <span className="truncate">{option.source}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{option.count.toLocaleString()}</span>
            </button>
          ))}
          {visible.length === 0 ? <p className="px-2 py-3 text-center text-sm text-muted-foreground">No matching sources</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function StateHeader({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`${TRIGGER_CLASS} ${value ? 'text-foreground' : ''}`}>
        State{value ? `: ${value}` : ''}
        <ChevronDown className={`h-3.5 w-3.5 ${value ? 'text-blue-600' : 'opacity-50'}`} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={value || ALL_STATES_VALUE}
          onValueChange={(next) => onChange(next === ALL_STATES_VALUE ? '' : next)}
        >
          <DropdownMenuRadioItem value={ALL_STATES_VALUE}>All states</DropdownMenuRadioItem>
          {STATE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.code} value={option.code}>
              {option.name} ({option.code})
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
