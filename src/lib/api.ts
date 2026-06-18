const DEFAULT_PROD_API_ORIGIN = 'https://scexceedceapi.cognitiev.com'

const requestedApiOrigin = (
  (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim() ||
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  (import.meta.env.DEV ? 'http://localhost:3000' : DEFAULT_PROD_API_ORIGIN)
)

const isLocalhostOrigin = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(requestedApiOrigin)
const rawApiOrigin = !import.meta.env.DEV && isLocalhostOrigin
  ? DEFAULT_PROD_API_ORIGIN
  : requestedApiOrigin

const API_ORIGIN = rawApiOrigin.replace(/\/+$/, '')
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : '/api'

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return API_ORIGIN ? `${API_ORIGIN}${normalizedPath}` : normalizedPath
}

export interface Course {
  id: number
  name: string
  ceb_course_id?: string
  state?: string
  total_enrolled?: number
  total_completed?: number
}

export interface Student {
  user_id: number
  first_name: string
  last_name: string
  email: string
  license_number?: string
  licensee_profession?: string
  date_completed?: string
  // Actual license from ExceedCE (before any test override)
  exceedce_license?: string
  exceedce_profession?: string
}

export interface CompletedEntry {
  id: string
  course_id: number
  course_name: string
  ceb_course_id: string | null
  state: string
  user_id: number | null
  first_name: string
  last_name: string
  full_name: string
  email: string
  license_number: string
  licensee_profession: string
  date_completed: string | null
  date_completed_iso: string | null
}

export interface CompletedEntriesResponse {
  entries: CompletedEntry[]
  total: number
  courses_scanned: number
}

export interface SubmissionEntry {
  key: string
  ceb_course_id: string
  exceed_course_id: number
  exceed_course_name: string
  state: string
  student: Student
  submission: {
    attempted_at: string
    status: string
    httpStatus?: number
    error_code?: string | null
    error_message?: string | null
    licensee_name_matched?: string
    raw_response?: string
    xml_sent?: string
    reason?: string
  }
}

export interface DashboardStats {
  total_courses: number
  total_submissions: number
  successful_submissions: number
  failed_submissions: number
  skipped_submissions: number
  dry_run_submissions: number
  duplicate_submissions: number
}

export interface PipelineConfig {
  mode: 'test' | 'live'
  dry_run: boolean
  provider_id: string
  sc_profession: string
  default_profession: string
}

export interface PipelineStatus {
  is_running: boolean
  current_course?: string
  current_student?: number
  total_students?: number
  progress?: number
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }
  
  return response.json()
}

// Dashboard
export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchApi<DashboardStats>('/dashboard/stats')
}

// Courses
export async function getAllCourses(): Promise<Course[]> {
  return fetchApi<Course[]>('/courses')
}

export async function getSCCourses(): Promise<Course[]> {
  return fetchApi<Course[]>('/courses/sc')
}

export async function getCourseCompletions(courseId: number): Promise<Student[]> {
  return fetchApi<Student[]>(`/courses/${courseId}/completions`)
}

export async function getCompletedEntries(filters?: {
  courseId?: number
  fromDate?: string
  toDate?: string
  search?: string
}): Promise<CompletedEntriesResponse> {
  const params = new URLSearchParams()

  if (filters?.courseId) params.set('courseId', String(filters.courseId))
  if (filters?.fromDate) params.set('fromDate', filters.fromDate)
  if (filters?.toDate) params.set('toDate', filters.toDate)
  if (filters?.search) params.set('search', filters.search)

  const query = params.toString()
  return fetchApi<CompletedEntriesResponse>(`/completions${query ? `?${query}` : ''}`)
}

// Submissions
export async function getSubmissions(): Promise<SubmissionEntry[]> {
  return fetchApi<SubmissionEntry[]>('/submissions')
}

export async function getSubmissionStats(): Promise<DashboardStats> {
  return fetchApi<DashboardStats>('/submissions/stats')
}

// Recent activity
export interface RecentActivity {
  student: string
  course: string
  status: string
  time: string
  error_message: string | null
}

export async function getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
  return fetchApi<RecentActivity[]>(`/submissions/recent?limit=${limit}`)
}

// Submission trends
export interface SubmissionTrend {
  date: string
  fullDate: string
  submissions: number
  successful: number
}

export async function getSubmissionTrend(days: number = 7): Promise<SubmissionTrend[]> {
  return fetchApi<SubmissionTrend[]>(`/submissions/trend?days=${days}`)
}

// Course breakdown
export interface CourseBreakdown {
  name: string
  completions: number
  submitted: number
}

export async function getCourseBreakdown(): Promise<CourseBreakdown[]> {
  return fetchApi<CourseBreakdown[]>('/courses/breakdown')
}

// Notifications
export interface Notification {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: string
  read: boolean
  link?: string
}

export async function getNotifications(limit: number = 10): Promise<Notification[]> {
  return fetchApi<Notification[]>(`/notifications?limit=${limit}`)
}

export async function markNotificationsRead(ids: number[]): Promise<{ success: boolean; readIds: number[] }> {
  return fetchApi<{ success: boolean; readIds: number[] }>('/notifications/mark-read', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export async function markAllNotificationsRead(): Promise<{ success: boolean; readIds: number[] }> {
  return fetchApi<{ success: boolean; readIds: number[] }>('/notifications/mark-all-read', {
    method: 'POST',
  })
}

export async function clearAllNotifications(): Promise<{ success: boolean; clearedUntil: string }> {
  return fetchApi<{ success: boolean; clearedUntil: string }>('/notifications/clear-all', {
    method: 'POST',
  })
}

// Pipeline
export async function getPipelineConfig(): Promise<PipelineConfig> {
  return fetchApi<PipelineConfig>('/pipeline/config')
}

export async function updatePipelineConfig(config: Partial<PipelineConfig>): Promise<PipelineConfig> {
  return fetchApi<PipelineConfig>('/pipeline/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

export async function getPipelineStatus(): Promise<PipelineStatus> {
  return fetchApi<PipelineStatus>('/pipeline/status')
}

export interface RosterPipelineEntry {
  id: string
  user_id: number | null
  first_name: string
  last_name: string
  email: string
  course_id: number | null
  course_name: string
  licenseNumber: string
  completion_date: string | null
}

export interface RosterEntriesResponse {
  total: number
  entries: RosterPipelineEntry[]
}

export interface RosterPostSummary {
  successful: number
  failed: number
  skipped: number
}

export async function getRosterPipelineEntries(filters?: { sinceDate?: string; courseIds?: number[] }): Promise<RosterEntriesResponse> {
  const params = new URLSearchParams()
  if (filters?.sinceDate) params.set('sinceDate', filters.sinceDate)
  if (filters?.courseIds && filters.courseIds.length > 0) {
    params.set('courseIds', filters.courseIds.join(','))
  }

  const query = params.toString()
  return fetchApi<RosterEntriesResponse>(`/roster-pipeline/entries${query ? `?${query}` : ''}`)
}

export async function postSelectedRosterEntries(payload: {
  entries: RosterPipelineEntry[]
  dryRun?: boolean
}): Promise<{ message: string; summary: RosterPostSummary }> {
  return fetchApi<{ message: string; summary: RosterPostSummary }>('/roster-pipeline/post-selected', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function startPipeline(options?: { courseIds?: number[], sinceDate?: string, dryRun?: boolean }): Promise<{ message: string }> {
  return fetchApi<{ message: string }>('/pipeline/start', {
    method: 'POST',
    body: JSON.stringify(options || {}),
  })
}

export async function stopPipeline(): Promise<{ message: string }> {
  return fetchApi<{ message: string }>('/pipeline/stop', {
    method: 'POST',
  })
}

// Logs
export interface LogEntry {
  id: string
  timestamp: string
  level: 'success' | 'error' | 'warning' | 'info'
  message: string
  details: {
    course?: string
    ceb_course_id?: string
    license_number?: string
    error_code?: string | null
    http_status?: number
  }
}

export async function getLogs(limit: number = 50): Promise<LogEntry[]> {
  return fetchApi<LogEntry[]>(`/logs?limit=${limit}`)
}

// Settings
export interface Settings {
  // ExceedCE
  exceedce_base_url: string
  exceedce_api_key: string
  
  // CE Broker
  ceb_endpoint: string
  ceb_provider_id: string
  ceb_upload_key: string
  ceb_mode: 'test' | 'live'
  ceb_dry_run: boolean
  ceb_print_xml: boolean
  
  // SC Specific
  ceb_sc_profession: string
  ceb_default_profession: string
  ceb_test_license_override: string
  ceb_test_course_override: string
  
  // Ledger
  ledger_path: string
  
  // Notifications
  enable_notifications: boolean
  email_on_error: boolean
  email_recipients: string
}

export async function getSettings(): Promise<Settings> {
  return fetchApi<Settings>('/settings')
}

export async function saveSettings(settings: Partial<Settings>): Promise<{ success: boolean; message: string }> {
  return fetchApi<{ success: boolean; message: string }>('/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

export async function resetSettings(): Promise<{ success: boolean; message: string; settings: Settings }> {
  return fetchApi<{ success: boolean; message: string; settings: Settings }>('/settings/reset', {
    method: 'POST',
  })
}
