import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | Date): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(dateStr: string | Date): string {
  const date = new Date(dateStr)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getStatusColor(status: string): string {
  if (!status) return 'bg-gray-100 text-gray-800 border-gray-200'
  
  const statusMap: Record<string, string> = {
    'ok': 'bg-green-100 text-green-800 border-green-200',
    'success': 'bg-green-100 text-green-800 border-green-200',
    'completed': 'bg-green-100 text-green-800 border-green-200',
    'error': 'bg-red-100 text-red-800 border-red-200',
    'failed': 'bg-red-100 text-red-800 border-red-200',
    'skipped': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'pending': 'bg-blue-100 text-blue-800 border-blue-200',
    'dry-run': 'bg-purple-100 text-purple-800 border-purple-200',
    'duplicate': 'bg-orange-100 text-orange-800 border-orange-200',
  }
  return statusMap[status.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200'
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}
