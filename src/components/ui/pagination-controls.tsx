import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PaginationControlsProps {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  className?: string
}

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationControlsProps) {
  const safeTotalPages = Math.max(1, totalPages)
  const safePage = Math.min(Math.max(1, page), safeTotalPages)

  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(totalItems, safePage * pageSize)

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className || ''}`}>
      <div className="text-sm text-muted-foreground">
        Showing {from}-{to} of {totalItems}
      </div>

      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="w-[110px]">
            <SelectValue placeholder="Page size" />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
        >
          Prev
        </Button>

        <span className="min-w-[90px] text-center text-sm text-muted-foreground">
          Page {safePage} of {safeTotalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safeTotalPages}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
