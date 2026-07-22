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
  page?: number
  perPage?: number
  totalPages?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

function normalizePaginatedResponse<T>(
  payload: unknown,
  fallbackPage = 1,
  fallbackPerPage = 20
): PaginatedResponse<T> {
  if (Array.isArray(payload)) {
    const total = payload.length
    const perPage = Math.max(1, fallbackPerPage)
    const totalPages = Math.max(1, Math.ceil(total / perPage))
    const page = Math.min(Math.max(1, fallbackPage), totalPages)
    const start = (page - 1) * perPage

    return {
      items: (payload as T[]).slice(start, start + perPage),
      total,
      page,
      perPage,
      totalPages,
    }
  }

  const maybe = payload as Partial<PaginatedResponse<T>> | null
  const items = Array.isArray(maybe?.items) ? maybe.items : []
  const total = Number(maybe?.total)
  const page = Number(maybe?.page)
  const perPage = Number(maybe?.perPage)
  const totalPages = Number(maybe?.totalPages)

  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
    page: Number.isFinite(page) && page > 0 ? page : fallbackPage,
    perPage: Number.isFinite(perPage) && perPage > 0 ? perPage : fallbackPerPage,
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
  }
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

interface FetchApiOptions extends RequestInit {
  timeoutMs?: number
}

async function fetchApi<T>(endpoint: string, options?: FetchApiOptions): Promise<T> {
  const controller = new AbortController()
  const timeoutMs = Math.max(1000, Number(options?.timeoutMs ?? 15000))
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`API timeout after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
  
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

export async function getSCCoursesPaginated(options?: {
  page?: number
  perPage?: number
  search?: string
}): Promise<PaginatedResponse<Course>> {
  const params = new URLSearchParams()
  if (options?.page) params.set('page', String(options.page))
  if (options?.perPage) params.set('perPage', String(options.perPage))
  if (options?.search) params.set('search', options.search)

  const query = params.toString()
  const raw = await fetchApi<PaginatedResponse<Course> | Course[]>(`/courses/sc${query ? `?${query}` : ''}`)
  return normalizePaginatedResponse<Course>(raw, options?.page || 1, options?.perPage || 20)
}

export async function getCourseCompletions(courseId: number): Promise<Student[]> {
  return fetchApi<Student[]>(`/courses/${courseId}/completions`)
}

export async function getCourseCompletionsPaginated(
  courseId: number,
  options?: { page?: number; perPage?: number }
): Promise<PaginatedResponse<Student>> {
  const params = new URLSearchParams()
  if (options?.page) params.set('page', String(options.page))
  if (options?.perPage) params.set('perPage', String(options.perPage))

  const query = params.toString()
  const raw = await fetchApi<PaginatedResponse<Student> | Student[]>(`/courses/${courseId}/completions${query ? `?${query}` : ''}`)
  return normalizePaginatedResponse<Student>(raw, options?.page || 1, options?.perPage || 20)
}

export async function getCompletedEntries(filters?: {
  courseId?: number
  fromDate?: string
  toDate?: string
  search?: string
  resolveProfession?: boolean
  page?: number
  perPage?: number
  timeoutMs?: number
}): Promise<CompletedEntriesResponse> {
  const params = new URLSearchParams()

  if (filters?.courseId) params.set('courseId', String(filters.courseId))
  if (filters?.fromDate) params.set('fromDate', filters.fromDate)
  if (filters?.toDate) params.set('toDate', filters.toDate)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.resolveProfession) params.set('resolveProfession', String(filters.resolveProfession))
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.perPage) params.set('perPage', String(filters.perPage))

  const query = params.toString()
  return fetchApi<CompletedEntriesResponse>(`/completions${query ? `?${query}` : ''}`, {
    timeoutMs: filters?.timeoutMs,
  })
}

// Submissions
export async function getSubmissions(): Promise<SubmissionEntry[]> {
  return fetchApi<SubmissionEntry[]>('/submissions')
}

export async function getSubmissionsPaginated(options?: {
  page?: number
  perPage?: number
  search?: string
  status?: string
}): Promise<PaginatedResponse<SubmissionEntry>> {
  const params = new URLSearchParams()
  if (options?.page) params.set('page', String(options.page))
  if (options?.perPage) params.set('perPage', String(options.perPage))
  if (options?.search) params.set('search', options.search)
  if (options?.status && options.status !== 'all') params.set('status', options.status)

  const query = params.toString()
  const raw = await fetchApi<PaginatedResponse<SubmissionEntry> | SubmissionEntry[]>(`/submissions${query ? `?${query}` : ''}`)
  return normalizePaginatedResponse<SubmissionEntry>(raw, options?.page || 1, options?.perPage || 20)
}

export async function getSubmissionStats(): Promise<DashboardStats> {
  return fetchApi<DashboardStats>('/submissions/stats')
}

// Re-lookup profession for a single license
export interface RelookupProfessionResult {
  success: boolean
  licenseNumber: string
  profession?: { code: string; name: string }
  multiple?: boolean
  professions?: Array<{ code: string; name: string; id?: number }>
  entriesUpdated?: number
  message?: string
}

export async function relookupProfession(licenseNumber: string): Promise<RelookupProfessionResult> {
  return fetchApi<RelookupProfessionResult>('/submissions/relookup-profession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseNumber }),
  })
}

// Batch re-lookup all professions
export interface BatchRelookupResult {
  success: boolean
  total: number
  successful: number
  failed: number
  multiple: number
  updated: Array<{ license: string; profession: string; entriesUpdated: number }>
  errors: Array<{ license: string; error: string }>
}

export async function relookupAllProfessions(): Promise<BatchRelookupResult> {
  return fetchApi<BatchRelookupResult>('/submissions/relookup-all-professions', {
    method: 'POST',
    timeoutMs: 300000, // 5 minutes for batch operation
  })
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
  page?: number
  perPage?: number
  totalPages?: number
}

export interface RosterPostSummary {
  successful: number
  failed: number
  skipped: number
}

export interface RosterVerificationStatus {
  required: boolean
  source: string | null
  reason: string | null
  provider: string | null
  detectedAt: string | null
  instructions: string | null
  resolvedAt: string | null
}

export async function getRosterPipelineEntries(filters?: {
  sinceDate?: string
  courseIds?: number[]
  page?: number
  perPage?: number
}): Promise<RosterEntriesResponse> {
  const params = new URLSearchParams()
  if (filters?.sinceDate) params.set('sinceDate', filters.sinceDate)
  if (filters?.courseIds && filters.courseIds.length > 0) {
    params.set('courseIds', filters.courseIds.join(','))
  }
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.perPage) params.set('perPage', String(filters.perPage))

  const query = params.toString()
  return fetchApi<RosterEntriesResponse>(`/roster-pipeline/entries${query ? `?${query}` : ''}`)
}

export async function postSelectedRosterEntries(payload: {
  entries: RosterPipelineEntry[]
  dryRun?: boolean
  submissionMode?: 'api' | 'browser'
  apiVariant?: 'xml' | 'v2'
  timeoutMs?: number
  providerId?: string
  uploadKey?: string
  endpoint?: string
  v2Endpoint?: string
  v2BearerToken?: string
}): Promise<{ message: string; summary: RosterPostSummary }> {
  return fetchApi<{ message: string; summary: RosterPostSummary }>('/roster-pipeline/post-selected', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getRosterVerificationStatus(): Promise<RosterVerificationStatus> {
  return fetchApi<RosterVerificationStatus>('/roster-pipeline/verification-status')
}

export async function resolveRosterVerification(): Promise<{ success: boolean; verification: RosterVerificationStatus }> {
  return fetchApi<{ success: boolean; verification: RosterVerificationStatus }>('/roster-pipeline/verification/resolve', {
    method: 'POST',
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

export async function getLogsPaginated(options?: {
  page?: number
  perPage?: number
  search?: string
  level?: string
}): Promise<PaginatedResponse<LogEntry>> {
  const params = new URLSearchParams()
  if (options?.page) params.set('page', String(options.page))
  if (options?.perPage) params.set('perPage', String(options.perPage))
  if (options?.search) params.set('search', options.search)
  if (options?.level && options.level !== 'all') params.set('level', options.level)

  const query = params.toString()
  const raw = await fetchApi<PaginatedResponse<LogEntry> | LogEntry[]>(`/logs${query ? `?${query}` : ''}`)
  return normalizePaginatedResponse<LogEntry>(raw, options?.page || 1, options?.perPage || 20)
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

// LLR License Lookup (Real-time Puppeteer-based)
export interface LLRLookupResult {
  license_number: string
  found: boolean
  profession?: string
  professionCode?: string
  error?: string | null
  raw?: {
    found?: boolean
    profession?: string
    professionCode?: string
    status?: string
    name?: string
    expirationDate?: string
  }
}

export async function resolveLicenseProfession(
  licenseNumber: string,
  saveToSubmissionKey?: string
): Promise<LLRLookupResult> {
  return fetchApi<LLRLookupResult>('/llr/lookup', {
    method: 'POST',
    body: JSON.stringify({
      license_number: licenseNumber,
      save_to_submission: saveToSubmissionKey,
    }),
  })
}
