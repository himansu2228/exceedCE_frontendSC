import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { STATE_OPTIONS } from './shared'

export type SortDir = 'asc' | 'desc'

export interface SortOption {
  label: string
  dir: SortDir
}

export const NUMBER_SORT: SortOption[] = [{ label: 'Highest first', dir: 'desc' }, { label: 'Lowest first', dir: 'asc' }]
export const TEXT_SORT: SortOption[] = [{ label: 'A to Z', dir: 'asc' }, { label: 'Z to A', dir: 'desc' }]
export const DATE_SORT: SortOption[] = [{ label: 'Newest first', dir: 'desc' }, { label: 'Oldest first', dir: 'asc' }]
export const COUNT_SORT: SortOption[] = [{ label: 'Most first', dir: 'desc' }, { label: 'Fewest first', dir: 'asc' }]

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
  const isActive = activeKey === sortKey
  const Icon = !isActive ? ArrowUpDown : activeDir === 'asc' ? ArrowUp : ArrowDown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`${TRIGGER_CLASS} ${isActive ? 'text-foreground' : ''}`}>
        {label}
        <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-blue-600' : 'opacity-50'}`} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={isActive ? activeDir : ''}
          onValueChange={(value) => onChange(sortKey, value as SortDir)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.dir} value={option.dir}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const ALL_STATES_VALUE = '__all__'

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
