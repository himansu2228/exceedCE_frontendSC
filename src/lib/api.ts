import { getAccessToken, getTenantAccessProfile, signOut } from '@/lib/auth'

const DEFAULT_PROD_API_ORIGIN = 'https://scexceedceapi.cognitiev.com'

const requestedApiOrigin = (
  (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim() ||
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  (import.meta.env.DEV ? 'http://localhost:3000' : DEFAULT_PROD_API_ORIGIN)
)

const isLocalhostOrigin = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(requestedApiOrigin)
const isKnownFrontendOrigin = /^(https?:\/\/)?(?:www\.)?(?:exceedce|scexceedceautomate)\.cognitiev\.com(?::\d+)?\/?$/i.test(requestedApiOrigin)
const shouldForceProdApiOrigin = !import.meta.env.DEV && (isLocalhostOrigin || isKnownFrontendOrigin)
const rawApiOrigin = shouldForceProdApiOrigin ? DEFAULT_PROD_API_ORIGIN : requestedApiOrigin

const API_ORIGIN = rawApiOrigin.replace(/\/+$/, '')
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : '/api'
const DEFAULT_API_TIMEOUT_MS = Math.max(
  1000,
  Number((import.meta.env.VITE_API_TIMEOUT_MS as string | undefined) ?? 45000)
)

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const rawUrl = API_ORIGIN ? `${API_ORIGIN}${normalizedPath}` : normalizedPath
  const token = getAccessToken()

  if (!token) {
    return rawUrl
  }

  const requiresQueryToken = /\/api\/.+(\/events|\/stream)(\?|$)/i.test(normalizedPath)
  if (!requiresQueryToken) {
    return rawUrl
  }

  const tenant = getTenantAccessProfile()
  const params: Record<string, string> = { authToken: token }
  if (tenant.allowedStates) {
    params.state = tenant.stateCode
  }

  const separator = rawUrl.includes('?') ? '&' : '?'
  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return `${rawUrl}${separator}${queryString}`
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
  repeat_students?: number
  one_time_students?: number
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

interface ResponseCacheEntry {
  value: unknown
  expiresAt: number
}

const DEFAULT_GET_CACHE_TTL_MS = Math.max(
  1000,
  Number((import.meta.env.VITE_GET_CACHE_TTL_MS as string | undefined) ?? 12000)
)

const GET_CACHE_OVERRIDES_MS: Array<{ test: RegExp; ttlMs: number }> = [
  { test: /^\/sales\/(dashboard|analytics|revenue)(\?|$)/, ttlMs: 15000 },
  { test: /^\/sales\/(orders|customers|reports)(\?|$)/, ttlMs: 30000 },
  { test: /^\/sales\/sync\/(logs|failures)(\?|$)/, ttlMs: 20000 },
  { test: /^\/notifications(\?|$)/, ttlMs: 5000 },
]

const inFlightGetRequests = new Map<string, Promise<unknown>>()
const responseGetCache = new Map<string, ResponseCacheEntry>()

function getCacheTtlMs(endpoint: string): number {
  const override = GET_CACHE_OVERRIDES_MS.find((entry) => entry.test.test(endpoint))
  return override ? override.ttlMs : DEFAULT_GET_CACHE_TTL_MS
}

function getRequestCacheKey(endpoint: string): string {
  const tenant = getTenantAccessProfile()
  const token = getAccessToken() || 'anonymous'
  return `${tenant.stateCode}:${token}:${endpoint}`
}

function readCachedResponse<T>(cacheKey: string): T | null {
  const entry = responseGetCache.get(cacheKey)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    responseGetCache.delete(cacheKey)
    return null
  }
  return entry.value as T
}

function writeCachedResponse(cacheKey: string, endpoint: string, value: unknown): void {
  responseGetCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + getCacheTtlMs(endpoint),
  })
}

export function invalidateApiCache(endpointPrefix?: string): void {
  if (!endpointPrefix) {
    responseGetCache.clear()
    return
  }

  for (const key of responseGetCache.keys()) {
    if (key.includes(endpointPrefix)) {
      responseGetCache.delete(key)
    }
  }
}

function getTenantHeaders(): Record<string, string> {
  const tenant = getTenantAccessProfile()
  const token = getAccessToken()
  return {
    'x-dashboard-state': tenant.stateCode,
    'x-dashboard-scope': tenant.isSuperAdmin ? 'global' : 'state',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchApi<T>(endpoint: string, options?: FetchApiOptions): Promise<T> {
  const token = getAccessToken()
  if (!token) {
    throw new Error('AUTH_REQUIRED')
  }

  const method = String(options?.method || 'GET').toUpperCase()
  const cacheable = method === 'GET' && !options?.body
  const cacheKey = cacheable ? getRequestCacheKey(endpoint) : null

  if (cacheable && cacheKey) {
    const cached = readCachedResponse<T>(cacheKey)
    if (cached !== null) {
      return cached
    }

    const pending = inFlightGetRequests.get(cacheKey)
    if (pending) {
      return pending as Promise<T>
    }
  }

  const controller = new AbortController()
  const externalSignal = options?.signal
  const onExternalAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }
  }
  const timeoutMs = Math.max(1000, Number(options?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS))
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  const requestPromise = (async () => {
    let response: Response
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        method,
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...getTenantHeaders(),
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
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort)
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        signOut()
        invalidateApiCache()
        throw new Error('AUTH_REQUIRED')
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const payload = await response.json() as T
    if (cacheable && cacheKey) {
      writeCachedResponse(cacheKey, endpoint, payload)
    } else {
      invalidateApiCache()
    }
    return payload
  })()

  if (cacheable && cacheKey) {
    inFlightGetRequests.set(cacheKey, requestPromise as Promise<unknown>)
    return requestPromise.finally(() => {
      inFlightGetRequests.delete(cacheKey)
    })
  }

  return requestPromise
}

export async function prefetchSuperAdminSidebarData(): Promise<void> {
  const tenant = getTenantAccessProfile()
  if (!tenant.isSuperAdmin) return

  const endpoints = [
    '/sales/dashboard',
    '/sales/orders?page=1&perPage=20',
    '/sales/customers?page=1&perPage=20',
    '/sales/analytics',
    '/sales/reports?page=1&perPage=50',
    '/sales/sync/logs?page=1&perPage=20',
    '/sales/sync/failures?page=1&perPage=20&unresolvedOnly=true',
    '/notifications?limit=10',
  ]

  await Promise.allSettled(endpoints.map((endpoint) => fetchApi<unknown>(endpoint, { timeoutMs: 12000 })))
}

export interface AdminOverview {
  totalUsers: number
  totalStates: number
  totalSubmissions: number
  successfulSubmissions: number
  failedSubmissions: number
  stateBreakdown: Array<{
    state: string
    users: number
    submissions: number
    successful: number
    failed: number
  }>
}

export interface DashboardUserListItem {
  id: number
  username: string
  state: string
  role: string
  is_active: boolean
  last_login_at: string | null
  created_at: string | null
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

export async function getTenantCourses(): Promise<Course[]> {
  return fetchApi<Course[]>('/courses/sc')
}

export async function getTenantCoursesWithSignal(
  signal?: AbortSignal,
  stateCode?: string,
  timeoutMs?: number
): Promise<Course[]> {
  const params = new URLSearchParams()
  const scopedState = (stateCode || getTenantAccessProfile().stateCode || '').trim()
  if (scopedState) {
    params.set('state', scopedState)
  }
  const query = params.toString()
  return fetchApi<Course[]>(`/courses/sc${query ? `?${query}` : ''}`, {
    signal,
    timeoutMs,
  })
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
  refresh?: boolean
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
  if (filters?.refresh) params.set('refresh', 'true')
  // Put the active state in the URL so the browser caches each state separately and a
  // state switch never reuses another state's cached response.
  params.set('state', getTenantAccessProfile().stateCode)

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

export async function getAdminOverview(): Promise<AdminOverview> {
  return fetchApi<AdminOverview>('/admin/overview')
}

export async function getDashboardUsers(): Promise<DashboardUserListItem[]> {
  return fetchApi<DashboardUserListItem[]>('/admin/users')
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

export async function getRosterPipelineSchedulerStatus(
  signal?: AbortSignal,
  timeoutMs?: number
): Promise<{ enabled: boolean; schedule: string; isRunning: boolean; lastRun: string | null; nextRun: string; dryRun: boolean }> {
  return fetchApi<{ enabled: boolean; schedule: string; isRunning: boolean; lastRun: string | null; nextRun: string; dryRun: boolean }>('/roster-pipeline/scheduler', {
    signal,
    timeoutMs,
  })
}

export async function getRosterPipelineHistory(options?: {
  page?: number
  perPage?: number
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<{ items: unknown[]; total: number; page: number; perPage: number; totalPages: number }> {
  const params = new URLSearchParams()
  if (options?.page) params.set('page', String(options.page))
  if (options?.perPage) params.set('perPage', String(options.perPage))
  const query = params.toString()

  const payload = await fetchApi<{
    items?: unknown[]
    total?: number
    page?: number
    perPage?: number
    totalPages?: number
  }>(`/roster-pipeline/history${query ? `?${query}` : ''}`, {
    signal: options?.signal,
    timeoutMs: options?.timeoutMs,
  })

  const items = Array.isArray(payload.items) ? payload.items : []

  return {
    items,
    total: Number(payload.total) || items.length,
    page: Number(payload.page) || options?.page || 1,
    perPage: Number(payload.perPage) || options?.perPage || 10,
    totalPages: Number(payload.totalPages) || 1,
  }
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

export interface SalesKpi {
  totalSales: number
  revenue: number
  orders: number
  averageOrderValue: number
  todaySales: number
  weeklySales: number
  monthlySales: number
  yearlySales: number
  salesGrowthPercent: number
  pendingOrders: number
  completedOrders: number
  refundedOrders: number
  failedPayments: number
}

export interface RevenueSeriesPoint {
  month: string
  revenue: number
  orders: number
}

export interface RevenueByStatePoint {
  state: string
  revenue: number
  orders: number
}

export interface RevenueByCoursePoint {
  course: string
  revenue: number
  quantity: number
}

export interface TopCustomerPoint {
  id: number
  fullName: string
  email: string
  revenue: number
  orders: number
}

export interface SalesDashboardResponse {
  summary: {
    totalRevenue: number
    totalOrders: number
    averageOrderValue: number
    completedOrders: number
    refundedOrders: number
    failedPayments: number
    pendingOrders: number
  }
  revenueByMonth: RevenueSeriesPoint[]
  revenueByState: RevenueByStatePoint[]
  revenueByCourse: RevenueByCoursePoint[]
  topCustomers: TopCustomerPoint[]
  kpi: SalesKpi
}

export interface SalesOrderItem {
  id: number
  productTitle: string
  quantity: number
  lineTotal: number
  unitPrice: number
  stateCode: string
}

export interface SalesOrder {
  id: number
  aomOrderId: number
  orderDate: string
  status: string
  displayStatus: string
  total: number
  subTotal: number
  taxAmount: number
  discountAmount: number
  couponUsed: string | null
  currency: string
  billingStateCode: string | null
  shippingStateCode: string | null
  source: string | null
  customer: {
    id: number
    fullName: string
    email: string
    companyName: string | null
    registeredAt: string | null
  }
  items: SalesOrderItem[]
}

export interface SalesCustomer {
  id: number
  aomUserId: number | null
  fullName: string
  email: string
  companyName: string | null
  source: string | null
  registeredAt: string | null
  stateCode: string | null
  totalOrders: number
  totalSpending: number
  latestOrderDate: string | null
}

export interface SalesReportRow {
  orderId: number
  aomOrderId: number
  itemId: number
  weekOf: string | null
  customer: string
  state: string
  company: string
  course: string
  amount: number
  source: string
  coupon: string
  datePurchased: string | null
  dateRegistered: string | null
  runningTotal: number | null
  currency: string
  status: string
  displayStatus: string
  total: number
  subTotal: number
  taxAmount: number
  discountAmount: number
  email: string
  feedback?: string | null
  feedbackOther?: string | null
}

export interface SalesSyncRun {
  id: number
  status: string
  started_at: string
  ended_at: string | null
  requested_by: string | null
  total_orders: number
  processed_orders: number
  inserted_orders: number
  updated_orders: number
  failed_orders: number
  notes: string | null
}

export interface SalesSyncFailure {
  id: number
  run_id: number | null
  aom_order_id: number | null
  stage: string
  error_message: string
  payload: Record<string, unknown>
  retry_count: number
  last_attempt_at: string
  resolved_at: string | null
  run_status: string | null
  run_started_at: string | null
}

export interface SalesMappingRow {
  spreadsheetColumn: string
  apiEndpoint: string
  apiField: string
  transformation: string
  databaseColumn: string
}

export interface CustomerCohortAnalysis {
  new: {
    customerCount: number
    totalOrders: number
    revenue: number
    avgCustomerValue: number
    percentOfRevenue: number
  }
  returning: {
    customerCount: number
    totalOrders: number
    revenue: number
    avgCustomerValue: number
    percentOfRevenue: number
  }
}

export interface SalesAttributionBySource {
  sources: Array<{
    source: string
    customerCount: number
    orderCount: number
    revenue: number
    percentOfRevenue: number
  }>
  totalRevenue: number
}

export async function getSalesDashboard(filters?: {
  fromDate?: string
  toDate?: string
}): Promise<SalesDashboardResponse> {
  const params = new URLSearchParams()
  if (filters?.fromDate) params.set('fromDate', filters.fromDate)
  if (filters?.toDate) params.set('toDate', filters.toDate)
  const query = params.toString()
  return fetchApi<SalesDashboardResponse>(`/sales/dashboard${query ? `?${query}` : ''}`)
}

export async function getSalesAnalytics(filters?: {
  fromDate?: string
  toDate?: string
}): Promise<SalesDashboardResponse> {
  const params = new URLSearchParams()
  if (filters?.fromDate) params.set('fromDate', filters.fromDate)
  if (filters?.toDate) params.set('toDate', filters.toDate)
  const query = params.toString()
  return fetchApi<SalesDashboardResponse>(`/sales/analytics${query ? `?${query}` : ''}`)
}

export async function getSalesCustomerCohort(filters?: {
  fromDate?: string
  toDate?: string
}): Promise<CustomerCohortAnalysis> {
  const params = new URLSearchParams()
  if (filters?.fromDate) params.set('fromDate', filters.fromDate)
  if (filters?.toDate) params.set('toDate', filters.toDate)
  const query = params.toString()
  return fetchApi<CustomerCohortAnalysis>(`/sales/cohort${query ? `?${query}` : ''}`)
}

export async function getSalesAttributionBySource(filters?: {
  fromDate?: string
  toDate?: string
}): Promise<SalesAttributionBySource> {
  const params = new URLSearchParams()
  if (filters?.fromDate) params.set('fromDate', filters.fromDate)
  if (filters?.toDate) params.set('toDate', filters.toDate)
  const query = params.toString()
  return fetchApi<SalesAttributionBySource>(`/sales/attribution${query ? `?${query}` : ''}`)
}

export async function getSalesOrders(filters?: {
  page?: number
  perPage?: number
  search?: string
  status?: string
  fromDate?: string
  toDate?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}): Promise<PaginatedResponse<SalesOrder>> {
  const params = new URLSearchParams()
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.perPage) params.set('perPage', String(filters.perPage))
  if (filters?.search) params.set('search', filters.search)
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters?.fromDate) params.set('fromDate', filters.fromDate)
  if (filters?.toDate) params.set('toDate', filters.toDate)
  if (filters?.sortBy) params.set('sortBy', filters.sortBy)
  if (filters?.sortDir) params.set('sortDir', filters.sortDir)

  const query = params.toString()
  return fetchApi<PaginatedResponse<SalesOrder>>(`/sales/orders${query ? `?${query}` : ''}`)
}

export async function getSalesOrderById(id: number): Promise<SalesOrder> {
  const result = await fetchApi<{ item: SalesOrder }>(`/sales/orders/${id}`)
  return result.item
}

export async function getSalesCustomers(filters?: {
  page?: number
  perPage?: number
  search?: string
}): Promise<PaginatedResponse<SalesCustomer>> {
  const params = new URLSearchParams()
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.perPage) params.set('perPage', String(filters.perPage))
  if (filters?.search) params.set('search', filters.search)

  const query = params.toString()
  return fetchApi<PaginatedResponse<SalesCustomer>>(`/sales/customers${query ? `?${query}` : ''}`)
}

export async function getSalesReports(filters?: {
  page?: number
  perPage?: number
  fromDate?: string
  toDate?: string
  state?: string
  source?: string
  course?: string
  customer?: string
  orderStatus?: string
}): Promise<PaginatedResponse<SalesReportRow> & { grandTotal: number }> {
  const params = new URLSearchParams()
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.perPage) params.set('perPage', String(filters.perPage))
  if (filters?.fromDate) params.set('fromDate', filters.fromDate)
  if (filters?.toDate) params.set('toDate', filters.toDate)
  if (filters?.state) params.set('state', filters.state)
  if (filters?.source) params.set('source', filters.source)
  if (filters?.course) params.set('course', filters.course)
  if (filters?.customer) params.set('customer', filters.customer)
  if (filters?.orderStatus && filters.orderStatus !== 'all') params.set('orderStatus', filters.orderStatus)

  const query = params.toString()
  return fetchApi<PaginatedResponse<SalesReportRow> & { grandTotal: number }>(`/sales/reports${query ? `?${query}` : ''}`)
}

export function getSalesReportExportUrl(filters?: {
  fromDate?: string
  toDate?: string
  state?: string
  source?: string
  course?: string
  customer?: string
  orderStatus?: string
  format?: 'csv' | 'xlsx'
}): string {
  const params = new URLSearchParams()
  params.set('format', filters?.format || 'csv')
  if (filters?.fromDate) params.set('fromDate', filters.fromDate)
  if (filters?.toDate) params.set('toDate', filters.toDate)
  if (filters?.state) params.set('state', filters.state)
  if (filters?.source) params.set('source', filters.source)
  if (filters?.course) params.set('course', filters.course)
  if (filters?.customer) params.set('customer', filters.customer)
  if (filters?.orderStatus && filters.orderStatus !== 'all') params.set('orderStatus', filters.orderStatus)
  
  // Add auth token for direct link access
  const token = getAccessToken()
  if (token) {
    params.set('authToken', token)
  }
  
  return `${API_ORIGIN}/api/sales/reports?${params.toString()}`
}

export async function runSalesSync(payload?: {
  fromDate?: string
  toDate?: string
}): Promise<{
  runId: number
  status: string
  totalOrders: number
  processedOrders: number
  insertedOrders: number
  updatedOrders: number
  failedOrders: number
  notes: string | null
}> {
  return fetchApi('/sales/sync', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
    timeoutMs: 300000,
  })
}

export async function getSalesSyncLogs(filters?: {
  page?: number
  perPage?: number
}): Promise<PaginatedResponse<SalesSyncRun>> {
  const params = new URLSearchParams()
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.perPage) params.set('perPage', String(filters.perPage))
  const query = params.toString()
  return fetchApi<PaginatedResponse<SalesSyncRun>>(`/sales/sync/logs${query ? `?${query}` : ''}`)
}

export async function getSalesSyncFailures(filters?: {
  page?: number
  perPage?: number
  unresolvedOnly?: boolean
}): Promise<PaginatedResponse<SalesSyncFailure>> {
  const params = new URLSearchParams()
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.perPage) params.set('perPage', String(filters.perPage))
  if (typeof filters?.unresolvedOnly === 'boolean') {
    params.set('unresolvedOnly', String(filters.unresolvedOnly))
  }
  const query = params.toString()
  return fetchApi<PaginatedResponse<SalesSyncFailure>>(`/sales/sync/failures${query ? `?${query}` : ''}`)
}

export async function getSalesMapping(): Promise<SalesMappingRow[]> {
  const result = await fetchApi<{ items: SalesMappingRow[] }>('/sales/mapping')
  return result.items
}
