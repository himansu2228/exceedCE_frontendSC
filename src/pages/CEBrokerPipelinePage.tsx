import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Play,
  Pause,
  RefreshCw,
  Database,
  Filter,
  Users,
  FileCheck,
  Globe,
  LogIn,
  FileEdit,
  Send,
  CheckCircle2,
  ArrowRight,
  Zap,
  Settings,
  Clock,
  Loader2,
  Calendar,
  Shield,
  ExternalLink,
  AlertCircle,
  Workflow,
  ListChecks,
  UserPlus,
  Save,
  Settings2,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  ClipboardList,
  Star,
  Upload,
} from 'lucide-react'
import {
  apiUrl,
  authFetch,
  downloadMichiganWorksheetFile,
  downloadNevadaSubmissionFile,
  getMichiganWorksheetFiles,
  getNevadaSubmissionFiles,
  getPipelineFlow,
  getRosterPipelineHistory,
  getRosterPipelineSchedulerStatus,
  getTenantCoursesWithSignal,
  startPipeline,
  startRosterPipeline,
  stopPipeline,
  stopRosterPipeline,
  updateRosterSchedulerSettings,
  type AutomationStepState,
  type Course,
  type MichiganWorksheetFile,
  type NevadaSubmissionFile,
  type RosterSchedulerStatus,
  type StateAutomationFlow,
} from '@/lib/api'
import { HawaiiClosedCoursesCard } from '@/components/roster/HawaiiClosedCoursesCard'
import { getActiveState, getTenantAccessProfile } from '@/lib/auth'
import { PaginationControls } from '@/components/ui/pagination-controls'
import {
  describeSchedule,
  formatInTimeZone,
  getHiddenPipelineTabLabel,
  getPortalSubmitGate,
  getRosterGate,
  readPortalSubmitSwitch,
  savePortalSubmitSwitch,
  shortTimeZoneName,
  toPipelineStateCode,
  type PipelineStateCode,
} from '@/lib/ceBrokerPipeline'
import { DateRangeFilter, type DateRangeValue } from '@/components/filters/DateRangeFilter'

// ============== Types ==============

// Unified Pipeline step type (stepId matches the backend SSE step id within its phase)
interface PipelineStep {
  stepId: number
  key: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  status: 'pending' | 'active' | 'completed' | 'error'
  count?: number
  progress?: number
  phase: 'xml' | 'roster'  // Which phase this step belongs to
}

// Processing stats type
interface ProcessingStats {
  // XML Pipeline stats
  currentCourse: string
  courseIndex: number
  totalCourses: number
  currentStudent: string
  studentIndex: number
  totalStudents: number
  // Roster Pipeline stats
  phase: string
  licenseNumber: string
  profession: string
  // Common stats
  submitted: number
  failed: number
  skipped: number
  duplicate: number
}

// Scheduler status type
type SchedulerStatus = RosterSchedulerStatus

// History entry type
interface HistoryEntry {
  started_at: string
  completed_at: string
  total_completions: number
  successful: number
  failed: number
  skipped: number
  errors: Array<{ error: string }>
  run_status?: 'submitted' | 'already_submitted' | 'blocked' | 'failed' | 'dry_run' | 'no_changes' | 'no_completions' | 'generated'
  message?: string
  entries?: Array<{
    student: string
    course: string
    licenseNumber: string
    profession: string | null
    success: boolean
    skipped: boolean
    error: string | null
    reason: string | null
    timestamp: string
    dryRun?: boolean
  }>
}

interface RosterFeedEntry {
  student: string
  course: string
  licenseNumber: string
  profession: string | null
  status: 'posted' | 'skipped' | 'failed'
  mode: 'dry-run' | 'live'
  timestamp: string
  reason?: string | null
  error?: string | null
}

interface CEBrokerPipelinePageProps {
  forcedStateCode?: PipelineStateCode
}

// Presentation-only icon lookup keyed by backend step key; steps themselves come from the backend.
const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'fetch-courses': Database,
  'filter-state': Filter,
  'get-completions': Users,
  'resolve-attendees': FileCheck,
  'submit-xml': Send,
  'record-results': Save,
  init: Settings2,
  'fetch-completions': ListChecks,
  'check-access': Shield,
  'lookup-profession': Globe,
  login: LogIn,
  'fetch-portal-courses': Database,
  'enroll-attendees': UserPlus,
  'create-roster': FileEdit,
  'post-roster': Send,
  'log-upload-sheet': FileSpreadsheet,
  'match-courses': ClipboardList,
  'build-roster': FileSpreadsheet,
  'build-evaluation': Star,
  'add-credits': UserPlus,
  'add-entries': UserPlus,
  complete: CheckCircle2,
}

// Nevada: the "Email Division" switch sits between these two roster steps.
const NV_EMAIL_GATE_AFTER_KEY = 'build-evaluation'
const NV_EMAIL_DIVISION_STORAGE_KEY = 'exceedce-nv-email-division'

// Michigan: the "Upload" switch sits between Build Worksheet and Upload Worksheet.
const MI_UPLOAD_GATE_AFTER_KEY = 'build-worksheet'
const MI_UPLOAD_STORAGE_KEY = 'exceedce-mi-upload'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}


function isTransientBackendError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('api timeout') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  )
}

function mapRosterEntryToFeed(entry: {
  student: string | { first_name?: string; last_name?: string; license_number?: string } | unknown
  studentName?: string
  course: string | { name?: string } | unknown
  course_name?: string
  licenseNumber?: string
  license_number?: string
  profession: string | null | unknown
  success?: boolean
  skipped?: boolean
  error?: string | null | unknown
  reason?: string | null | unknown
  timestamp?: string
  dryRun?: boolean
}): RosterFeedEntry {
  // Handle student being either a string or an object
  let studentName: string
  if (typeof entry.student === 'string') {
    studentName = entry.student
  } else if (entry.studentName) {
    studentName = entry.studentName
  } else if (entry.student && typeof entry.student === 'object') {
    const s = entry.student as { first_name?: string; last_name?: string }
    studentName = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown'
  } else {
    studentName = 'Unknown'
  }

  // Handle course being either a string or an object
  let courseName: string
  if (typeof entry.course === 'string') {
    courseName = entry.course
  } else if (entry.course_name) {
    courseName = entry.course_name
  } else if (entry.course && typeof entry.course === 'object') {
    const c = entry.course as { name?: string }
    courseName = c.name || '-'
  } else {
    courseName = '-'
  }

  // Handle license number
  const licenseNum = entry.licenseNumber || entry.license_number || ''

  // Handle profession - it could be an object too
  let professionStr: string | null = null
  if (typeof entry.profession === 'string') {
    professionStr = entry.profession
  } else if (entry.profession && typeof entry.profession === 'object') {
    // Just use null if it's an object
    professionStr = null
  }

  // Handle error/reason - they could be objects too
  const errorStr = typeof entry.error === 'string' ? entry.error : null
  const reasonStr = typeof entry.reason === 'string' ? entry.reason : null

  return {
    student: studentName,
    course: courseName,
    licenseNumber: licenseNum,
    profession: professionStr,
    status: entry.success ? 'posted' : entry.skipped ? 'skipped' : 'failed',
    mode: entry.dryRun ? 'dry-run' : 'live',
    timestamp: entry.timestamp || new Date().toISOString(),
    reason: reasonStr,
    error: errorStr,
  }
}

// ============== Initial Pipeline Steps ==============

// Build steps from the backend-provided flow, optionally applying a live runtime snapshot
const getInitialSteps = (
  flow: StateAutomationFlow | null,
  snapshot?: Partial<Record<'xml' | 'roster', AutomationStepState>>
): PipelineStep[] => {
  if (!flow || !flow.configured) return []

  return flow.phases.flatMap((phase) =>
    phase.steps.map((step) => {
      const live = snapshot?.[phase.id]?.[String(step.id)]
      return {
        stepId: step.id,
        key: step.key,
        name: step.name,
        description: step.description,
        icon: STEP_ICONS[step.key] || Zap,
        status: live?.status || ('pending' as const),
        count: step.tracksCount ? live?.count ?? 0 : undefined,
        progress: step.tracksProgress ? live?.progress ?? 0 : undefined,
        phase: phase.id,
      }
    })
  )
}

// ============== Main Component ==============

export function CEBrokerPipelinePage({ forcedStateCode }: CEBrokerPipelinePageProps) {
  const location = useLocation()
  const tenant = getTenantAccessProfile()
  const [activeStateCode, setActiveStateCode] = useState(() => {
    const initial = forcedStateCode || getActiveState() || tenant.stateCode || 'SC'
    return toPipelineStateCode(initial)
  })
  const maskedPipelineLabel = getHiddenPipelineTabLabel(activeStateCode)
  const PAGE_REQUEST_TIMEOUT_MS = 12000

  // State-specific automation flow served by the backend
  const [flow, setFlow] = useState<StateAutomationFlow | null>(null)
  const [flowLoading, setFlowLoading] = useState(true)
  const [flowError, setFlowError] = useState<string | null>(null)
  const [flowReloadKey, setFlowReloadKey] = useState(0)
  const automationUnavailable = flow !== null && !flow.configured

  // Pipeline state
  const [isRunning, setIsRunning] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [mode, setMode] = useState<'test' | 'live'>('test')
  const [selectedCourses, setSelectedCourses] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => {
    const today = new Date().toISOString().split('T')[0]
    return { fromDate: today, toDate: today }
  })
  const isDateRangeValid = Boolean(
    dateRange.fromDate && dateRange.toDate && dateRange.fromDate <= dateRange.toDate,
  )
  
  // Dynamic SC courses from API
  const [stateCourses, setStateCourses] = useState<Course[]>([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  
  // Pipeline steps state
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([])
  
  // Current phase tracking
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'xml' | 'roster'>('idle')
  
  // Processing stats
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({
    currentCourse: '',
    courseIndex: 0,
    totalCourses: 0,
    currentStudent: '',
    studentIndex: 0,
    totalStudents: 0,
    phase: '',
    licenseNumber: '',
    profession: '',
    submitted: 0,
    failed: 0,
    skipped: 0,
    duplicate: 0,
  })
  
  // Scheduler status
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
  
  // History
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPerPage, setHistoryPerPage] = useState(100)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  
  // Last run timestamp
  const [lastRun, setLastRun] = useState<Date | null>(null)
  
  // Error state
  const [error, setError] = useState<string | null>(null)
  const [runNotice, setRunNotice] = useState<string | null>(null)
  // Set when the chosen range had no completions; lets the user jump to a range that has data.
  const [latestCompletionOnFile, setLatestCompletionOnFile] = useState<string | null>(null)

  // Active tab is derived from route so sidebar can open the roster tab directly
  const [activeTab, setActiveTab] = useState<'pipeline' | 'roster' | 'scheduler' | 'history'>(
    location.pathname === '/roster-posting' ? 'roster' : 'pipeline'
  )

  // Live roster feed (in-memory while current run is active)
  const [liveRosterFeed, setLiveRosterFeed] = useState<RosterFeedEntry[]>([])

  // Nevada: when off, the roster phase stops after Build 612D and files are offered for download
  const isNevada = activeStateCode === 'NV'
  const [emailDivisionEnabled, setEmailDivisionEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NV_EMAIL_DIVISION_STORAGE_KEY) === 'on'
    } catch {
      return false
    }
  })
  const emailDivisionRef = useRef(emailDivisionEnabled)
  const isNevadaRef = useRef(isNevada)
  useEffect(() => { isNevadaRef.current = isNevada }, [isNevada])
  const [nvFiles, setNvFiles] = useState<NevadaSubmissionFile[]>([])
  const [nvFilesLoading, setNvFilesLoading] = useState(false)
  const [nvLastRunFiles, setNvLastRunFiles] = useState<string[]>([])
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)

  const handleEmailDivisionChange = useCallback((enabled: boolean) => {
    setEmailDivisionEnabled(enabled)
    try {
      localStorage.setItem(NV_EMAIL_DIVISION_STORAGE_KEY, enabled ? 'on' : 'off')
    } catch {
      // storage unavailable; keep in-memory value
    }
  }, [])

  const loadNevadaFiles = useCallback(async () => {
    setNvFilesLoading(true)
    try {
      setNvFiles(await getNevadaSubmissionFiles(50))
    } catch (err) {
      console.error('Failed to load Nevada files:', err)
    } finally {
      setNvFilesLoading(false)
    }
  }, [])

  const handleDownloadNevadaFile = useCallback(async (fileName: string) => {
    setDownloadingFile(fileName)
    try {
      await downloadNevadaSubmissionFile(fileName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloadingFile(null)
    }
  }, [])

  const handleDownloadLastRun = useCallback(async () => {
    for (const fileName of nvLastRunFiles) {
      await handleDownloadNevadaFile(fileName)
    }
  }, [nvLastRunFiles, handleDownloadNevadaFile])

  useEffect(() => {
    if (!isNevada) return
    let cancelled = false
    getNevadaSubmissionFiles(50)
      .then((files) => { if (!cancelled) setNvFiles(files) })
      .catch((err) => console.error('Failed to load Nevada files:', err))
    return () => { cancelled = true }
  }, [isNevada])

  // Michigan: when off, the roster phase stops after Build Worksheet and worksheets are offered for download.
  // When on (and Dry Run is off) the worksheet is uploaded and "Accept Finalize" is clicked.
  const isMichigan = activeStateCode === 'MI'
  const [miUploadEnabled, setMiUploadEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MI_UPLOAD_STORAGE_KEY) === 'on'
    } catch {
      return false
    }
  })
  const miUploadRef = useRef(miUploadEnabled)
  const isMichiganRef = useRef(isMichigan)
  useEffect(() => { isMichiganRef.current = isMichigan }, [isMichigan])
  useEffect(() => { miUploadRef.current = miUploadEnabled }, [miUploadEnabled])
  const [miFiles, setMiFiles] = useState<MichiganWorksheetFile[]>([])
  const [miFilesLoading, setMiFilesLoading] = useState(false)
  const [miLastRunFiles, setMiLastRunFiles] = useState<string[]>([])

  const handleMiUploadChange = useCallback((enabled: boolean) => {
    setMiUploadEnabled(enabled)
    try {
      localStorage.setItem(MI_UPLOAD_STORAGE_KEY, enabled ? 'on' : 'off')
    } catch {
      // storage unavailable; keep in-memory value
    }
  }, [])

  const loadMichiganFiles = useCallback(async () => {
    setMiFilesLoading(true)
    try {
      setMiFiles(await getMichiganWorksheetFiles(50))
    } catch (err) {
      console.error('Failed to load Michigan worksheets:', err)
    } finally {
      setMiFilesLoading(false)
    }
  }, [])

  const handleDownloadMichiganFile = useCallback(async (fileName: string) => {
    setDownloadingFile(fileName)
    try {
      await downloadMichiganWorksheetFile(fileName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloadingFile(null)
    }
  }, [])

  const handleDownloadMichiganLastRun = useCallback(async () => {
    for (const fileName of miLastRunFiles) {
      await handleDownloadMichiganFile(fileName)
    }
  }, [miLastRunFiles, handleDownloadMichiganFile])

  useEffect(() => {
    if (!isMichigan) return
    let cancelled = false
    getMichiganWorksheetFiles(50)
      .then((files) => { if (!cancelled) setMiFiles(files) })
      .catch((err) => console.error('Failed to load Michigan worksheets:', err))
    return () => { cancelled = true }
  }, [isMichigan])

  // AL Commit / IL Submit: when off, the roster phase stops after the staging step (Add Course
  // Credit / Add Entries). When on (and Dry Run is off) the staged entries are submitted.
  const submitGate = getPortalSubmitGate(activeStateCode)
  const [submitSwitches, setSubmitSwitches] = useState<Record<string, boolean>>({})
  const submitGateEnabled = submitSwitches[activeStateCode] ?? readPortalSubmitSwitch(activeStateCode)
  const submitGateOptionRef = useRef<{ commit: boolean } | null>(null)
  useEffect(() => {
    submitGateOptionRef.current = submitGate ? { commit: submitGateEnabled } : null
  }, [submitGate, submitGateEnabled])

  const handleSubmitGateChange = useCallback((enabled: boolean) => {
    setSubmitSwitches((previous) => ({ ...previous, [activeStateCode]: enabled }))
    savePortalSubmitSwitch(activeStateCode, enabled)
  }, [activeStateCode])

  // State-specific gate switch sent with the roster start request (NV Email Division, MI Upload, AL Commit / IL Submit)
  const rosterGateOption = () => (
    isNevadaRef.current ? { sendEmails: emailDivisionRef.current }
      : isMichiganRef.current ? { upload: miUploadRef.current }
        : submitGateOptionRef.current || {}
  )

  // The switch value saved for scheduled runs ("Save" in Complete Pipeline Flow). Dashboard runs
  // always use the switch as it is on screen; the scheduler uses only what was saved.
  const rosterGate = getRosterGate(activeStateCode)
  const currentGateValue: boolean | null = isNevada
    ? emailDivisionEnabled
    : isMichigan
      ? miUploadEnabled
      : submitGate
        ? submitGateEnabled
        : null
  const [savingGate, setSavingGate] = useState(false)
  const [gateSaveMessage, setGateSaveMessage] = useState<{ tone: 'success' | 'error'; text: string; stateCode: string } | null>(null)
  const appliedSavedGatesRef = useRef(new Set<string>())

  // Show the saved switch once per saved version, so later on-screen edits stay "unsaved".
  const applySchedulerStatus = useCallback((status: SchedulerStatus) => {
    setSchedulerStatus(status)
    const code = String(status.stateCode || '').toUpperCase()
    const key = status.gateKey
    const saved = key ? status.gates?.[key] : undefined
    if (!code || !key || typeof saved !== 'boolean') return
    const version = `${code}:${status.updatedAt || ''}:${saved}`
    if (appliedSavedGatesRef.current.has(version)) return
    appliedSavedGatesRef.current.add(version)
    if (code === 'NV') {
      handleEmailDivisionChange(saved)
    } else if (code === 'MI') {
      handleMiUploadChange(saved)
    } else if (getPortalSubmitGate(code)) {
      setSubmitSwitches((previous) => ({ ...previous, [code]: saved }))
      savePortalSubmitSwitch(code, saved)
    }
  }, [handleEmailDivisionChange, handleMiUploadChange])

  const schedulerForState = schedulerStatus && String(schedulerStatus.stateCode || '').toUpperCase() === activeStateCode
    ? schedulerStatus
    : null
  const savedGateValue = rosterGate && schedulerForState ? schedulerForState.gates?.[rosterGate.key] : undefined
  const gateDirty = currentGateValue !== null && savedGateValue !== currentGateValue
  const schedulerTzShort = shortTimeZoneName(schedulerForState?.timeZone)

  const handleSaveGate = async () => {
    if (!rosterGate || currentGateValue === null) return
    const code = activeStateCode
    setSavingGate(true)
    setGateSaveMessage(null)
    try {
      const status = await updateRosterSchedulerSettings({ gates: { [rosterGate.key]: currentGateValue } })
      applySchedulerStatus(status)
      setGateSaveMessage({
        tone: 'success',
        stateCode: code,
        text: `Saved. Scheduled runs will use ${rosterGate.label} ${currentGateValue ? 'ON' : 'OFF'}.`,
      })
    } catch (err) {
      setGateSaveMessage({ tone: 'error', stateCode: code, text: err instanceof Error ? err.message : 'Could not save the switch' })
    } finally {
      setSavingGate(false)
    }
  }
  
  // SSE connection refs (one for each pipeline)
  const xmlEventSourceRef = useRef<EventSource | null>(null)
  const rosterEventSourceRef = useRef<EventSource | null>(null)
  const schedulerAbortRef = useRef<AbortController | null>(null)
  const historyAbortRef = useRef<AbortController | null>(null)
  const coursesAbortRef = useRef<AbortController | null>(null)
  // True only when this client started the XML phase and must chain the roster phase
  const ownsXmlRunRef = useRef(false)
  
  // Refs to track current values for SSE callbacks (avoids stale closure issues)
  const dryRunRef = useRef(dryRun)
  const dateRangeRef = useRef(dateRange)
  const selectedCoursesRef = useRef(selectedCourses)
  
  // Keep refs in sync with state
  useEffect(() => { dryRunRef.current = dryRun }, [dryRun])
  useEffect(() => { emailDivisionRef.current = emailDivisionEnabled }, [emailDivisionEnabled])
  useEffect(() => { dateRangeRef.current = dateRange }, [dateRange])
  useEffect(() => { selectedCoursesRef.current = selectedCourses }, [selectedCourses])

  // Keep tab in sync with route changes from sidebar clicks
  useEffect(() => {
    setActiveTab(location.pathname === '/roster-posting' ? 'roster' : 'pipeline')
  }, [location.pathname])

  useEffect(() => {
    if (forcedStateCode) {
      const forced = toPipelineStateCode(forcedStateCode)
      setActiveStateCode((previous) => (previous === forced ? previous : forced))
      return
    }

    const syncActiveState = () => {
      const current = toPipelineStateCode(getActiveState() || getTenantAccessProfile().stateCode || 'SC')
      setActiveStateCode((previous) => (previous === current ? previous : current))
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'exceedce-active-state') {
        syncActiveState()
      }
    }

    const onActiveStateChanged = () => {
      syncActiveState()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('exceedce:active-state-changed', onActiveStateChanged as EventListener)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('exceedce:active-state-changed', onActiveStateChanged as EventListener)
    }
  }, [forcedStateCode])

  const loadHistory = useCallback(async () => {
    try {
      if (historyAbortRef.current) {
        historyAbortRef.current.abort()
      }
      const controller = new AbortController()
      historyAbortRef.current = controller

      const payload = await getRosterPipelineHistory({
        page: historyPage,
        perPage: historyPerPage,
        signal: controller.signal,
        timeoutMs: PAGE_REQUEST_TIMEOUT_MS,
      })
      setHistory(Array.isArray(payload.items) ? (payload.items as HistoryEntry[]) : [])
      setHistoryTotal(Number(payload.total) || 0)
      setHistoryTotalPages(Number(payload.totalPages) || 1)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      if (isTransientBackendError(err)) {
        return
      }
      console.error('Failed to load history:', err)
    }
  }, [historyPage, historyPerPage])

  // ============== Load Initial Data ==============

  // Load courses for active tenant state from API
  useEffect(() => {
    let cancelled = false

    const loadCourses = async () => {
      try {
        setLoadingCourses(true)
        let lastError: unknown = null

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const courses = await getTenantCoursesWithSignal(undefined, activeStateCode, PAGE_REQUEST_TIMEOUT_MS)
            if (!cancelled) {
              setStateCourses(courses)
            }
            lastError = null
            break
          } catch (error) {
            lastError = error
            if (attempt === 0) {
              await new Promise((resolve) => setTimeout(resolve, 400))
            }
          }
        }

        if (lastError) {
          throw lastError
        }
      } catch (error) {
        if (cancelled) {
          return
        }
        if (!isTransientBackendError(error)) {
          console.error('Failed to load tenant courses:', error)
        }
        setStateCourses([])
      } finally {
        if (!cancelled) {
          setLoadingCourses(false)
        }
      }
    }
    loadCourses()

    return () => {
      cancelled = true
    }
  }, [activeStateCode])

  // Load scheduler status for the Pipeline tab (saved switch + scheduler summary) and the Scheduler tab
  useEffect(() => {
    if (activeTab !== 'scheduler' && activeTab !== 'pipeline') {
      return
    }

    const loadScheduler = async () => {
      if (schedulerAbortRef.current) {
        schedulerAbortRef.current.abort()
      }
      const controller = new AbortController()
      schedulerAbortRef.current = controller

      try {
        const status = await getRosterPipelineSchedulerStatus(controller.signal, PAGE_REQUEST_TIMEOUT_MS)
        if (controller.signal.aborted) return
        applySchedulerStatus(status)
      } catch (schedulerError) {
        if (schedulerError instanceof DOMException && schedulerError.name === 'AbortError') {
          return
        }
        if (isTransientBackendError(schedulerError)) {
          return
        }
        console.error('Failed to load scheduler status:', schedulerError)
      }
    }

    loadScheduler()
  }, [activeTab, activeStateCode, applySchedulerStatus])

  // Load history only when history tab is opened
  useEffect(() => {
    if (activeTab !== 'history') {
      return
    }

    loadHistory()
  }, [activeTab, loadHistory, activeStateCode])

  // ============== Pipeline Step Management ==============

  // Update pipeline step
  const updateStep = useCallback((phase: 'xml' | 'roster', stepId: number, updates: Partial<PipelineStep>) => {
    setPipelineSteps(prev => 
      prev.map(step => step.phase === phase && step.stepId === stepId ? { ...step, ...updates } : step)
    )
  }, [])

  // Reset pipeline
  const resetPipeline = useCallback(() => {
    setPipelineSteps(getInitialSteps(flow))
    setProcessingStats({
      currentCourse: '',
      courseIndex: 0,
      totalCourses: 0,
      currentStudent: '',
      studentIndex: 0,
      totalStudents: 0,
      phase: '',
      licenseNumber: '',
      profession: '',
      submitted: 0,
      failed: 0,
      skipped: 0,
      duplicate: 0,
    })
    setError(null)
    setRunNotice(null)
    setLatestCompletionOnFile(null)
    setCurrentPhase('idle')
    setLiveRosterFeed([])
    setNvLastRunFiles([])
    setMiLastRunFiles([])
  }, [flow])

  // Load the active state's configured automation flow and any in-progress run snapshot
  useEffect(() => {
    const controller = new AbortController()
    setFlow(null)
    setFlowLoading(true)
    setFlowError(null)
    setPipelineSteps([])

    getPipelineFlow(controller.signal, PAGE_REQUEST_TIMEOUT_MS)
      .then((loaded) => {
        if (controller.signal.aborted) return
        const xmlRunning = Boolean(loaded.runtime?.xml.isRunning)
        const rosterRunning = Boolean(loaded.runtime?.roster.isRunning)
        const lastRosterRun = rosterRunning ? null : loaded.runtime?.roster.lastRun || null
        setFlow(loaded)
        // Roster steps keep the last run's final state (e.g. green through Build 612D) after reload.
        setPipelineSteps(getInitialSteps(loaded, {
          xml: xmlRunning ? loaded.runtime?.xml.stepState : undefined,
          roster: rosterRunning || lastRosterRun ? loaded.runtime?.roster.stepState : undefined,
        }))
        if (rosterRunning || xmlRunning) {
          setIsRunning(true)
          setCurrentPhase(rosterRunning ? 'roster' : 'xml')
        } else if (lastRosterRun) {
          setRunNotice(lastRosterRun.message)
          setLatestCompletionOnFile(lastRosterRun.latestCompletionOnFile || null)
          setLastRun(new Date(lastRosterRun.completedAt))
          setNvLastRunFiles(loaded.stateCode === 'NV' ? lastRosterRun.files || [] : [])
          setMiLastRunFiles(loaded.stateCode === 'MI' ? lastRosterRun.files || [] : [])
        }
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return
        setFlowError(loadError instanceof Error ? loadError.message : 'Failed to load automation flow')
      })
      .finally(() => {
        if (!controller.signal.aborted) setFlowLoading(false)
      })

    return () => controller.abort()
  }, [activeStateCode, flowReloadKey])

  // ============== SSE Connection Management ==============

  // Connect to XML Pipeline SSE
  const connectXmlSSE = useCallback(() => {
    if (xmlEventSourceRef.current) {
      xmlEventSourceRef.current.close()
    }

    const es = new EventSource(apiUrl('/api/pipeline/events'))
    xmlEventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'connected':
            if (data.isRunning && data.stepState) {
              const stepState = data.stepState as AutomationStepState
              setPipelineSteps(prev => prev.map(step => {
                const live = step.phase === 'xml' ? stepState[String(step.stepId)] : undefined
                return live ? { ...step, ...live } : step
              }))
              setIsRunning(true)
              setCurrentPhase(prev => (prev === 'roster' ? prev : 'xml'))
            }
            break

          case 'step-start':
            updateStep('xml', data.stepId, { status: 'active', count: 0, progress: 0 })
            break
            
          case 'step-progress':
            updateStep('xml', data.stepId, { 
              count: data.count, 
              progress: data.progress 
            })
            break
            
          case 'step-complete':
            updateStep('xml', data.stepId, { 
              status: 'completed', 
              count: data.count,
              progress: 100 
            })
            break
            
          case 'step-error':
            updateStep('xml', data.stepId, { status: 'error' })
            break
            
          case 'processing':
            setProcessingStats(prev => ({
              ...prev,
              currentCourse: data.course || prev.currentCourse,
              courseIndex: data.courseIndex ?? prev.courseIndex,
              totalCourses: data.totalCourses ?? prev.totalCourses,
              currentStudent: data.student || prev.currentStudent,
              studentIndex: data.studentIndex ?? prev.studentIndex,
              totalStudents: data.totalStudents ?? prev.totalStudents,
            }))
            break
            
          case 'result':
            setProcessingStats(prev => ({
              ...prev,
              submitted: data.submitted ?? prev.submitted,
              failed: data.failed ?? prev.failed,
              skipped: data.skipped ?? prev.skipped,
              duplicate: data.duplicate ?? prev.duplicate,
            }))
            break
            
          case 'complete':
            if (data.cancelled) {
              ownsXmlRunRef.current = false
              break
            }
            // XML phase complete; only the client that started the run chains the roster phase
            setCurrentPhase('roster')
            if (ownsXmlRunRef.current) {
              ownsXmlRunRef.current = false
              startRosterPhase()
            }
            break

          case 'error':
            ownsXmlRunRef.current = false
            setError(data.message)
            setIsRunning(false)
            setCurrentPhase('idle')
            break
        }
      } catch (err) {
        console.error('XML SSE parse error:', err)
      }
    }

    es.onerror = () => {
      console.error('XML SSE connection error')
      es.close()
      xmlEventSourceRef.current = null
    }
  }, [updateStep])

  // Connect to Roster Pipeline SSE
  const connectRosterSSE = useCallback(() => {
    if (rosterEventSourceRef.current) {
      rosterEventSourceRef.current.close()
    }

    const es = new EventSource(apiUrl('/api/roster-pipeline/events'))
    rosterEventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'connected':
            if (data.isRunning && data.stepState) {
              const stepState = data.stepState as AutomationStepState
              setPipelineSteps(prev => prev.map(step => {
                const live = step.phase === 'roster' ? stepState[String(step.stepId)] : undefined
                return live ? { ...step, status: live.status } : step
              }))
              setIsRunning(true)
              setCurrentPhase('roster')
            }
            break

          case 'step-change':
            setPipelineSteps(prev => 
              prev.map(step => {
                if (step.phase !== 'roster') return step
                if (step.stepId < data.stepId && step.status !== 'completed' && step.status !== 'error') {
                  return { ...step, status: 'completed' }
                }
                if (step.stepId === data.stepId) {
                  return { ...step, status: data.status || 'active' }
                }
                return step
              })
            )
            break
            
          case 'progress':
            setProcessingStats(prev => ({
              ...prev,
              phase: data.phase || prev.phase,
              currentStudent: data.student || prev.currentStudent,
              licenseNumber: data.licenseNumber || prev.licenseNumber,
              profession: data.profession || prev.profession,
              studentIndex: data.current ?? prev.studentIndex,
              totalStudents: data.total ?? prev.totalStudents,
            }))

            break
            
          case 'complete':
            setIsRunning(false)
            setLastRun(new Date())
            setCurrentPhase('idle')
            setRunNotice(data.summary?.message || null)
            setLatestCompletionOnFile(data.summary?.latest_completion_on_file || null)
            setError(Array.isArray(data.summary?.errors) && data.summary.errors.length > 0
              ? data.summary.errors.map((entry: { error?: string }) => entry.error).filter(Boolean).slice(0, 3).join('; ') || 'Roster posting did not complete'
              : null)
            if (data.summary) {
              setProcessingStats(prev => ({
                ...prev,
                submitted: data.summary.successful ?? 0,
                failed: data.summary.failed ?? 0,
                skipped: data.summary.skipped ?? 0,
                duplicate: data.summary.already_posted ?? 0,
              }))

              if (Array.isArray(data.summary.entries)) {
                const mapped = data.summary.entries.map(mapRosterEntryToFeed)
                setLiveRosterFeed(mapped.slice(0, 30))
              }

              if (isNevadaRef.current && Array.isArray(data.summary.roster_submissions)) {
                const files = (data.summary.roster_submissions as Array<{ roster_filename?: string; evaluation_filename?: string }>)
                  .flatMap(sub => [sub.roster_filename, sub.evaluation_filename])
                  .filter((name): name is string => Boolean(name))
                setNvLastRunFiles(files)
                loadNevadaFiles()
              }

              if (isMichiganRef.current && Array.isArray(data.summary.roster_submissions)) {
                const files = (data.summary.roster_submissions as Array<{ worksheet_filename?: string }>)
                  .map(sub => sub.worksheet_filename)
                  .filter((name): name is string => Boolean(name))
                setMiLastRunFiles(files)
                loadMichiganFiles()
              }
            }
            // A step still active here is where the run ended (early exit or final step)
            {
              const endedWithErrors = (Array.isArray(data.summary?.errors) && data.summary.errors.length > 0)
                || data.summary?.run_status === 'blocked' || data.summary?.run_status === 'failed'
              setPipelineSteps(prev =>
                prev.map(step =>
                  step.phase === 'roster' && step.status === 'active'
                    ? { ...step, status: endedWithErrors ? 'error' : 'completed' }
                    : step
                )
              )
            }

            loadHistory().catch(() => {})
            break
            
          case 'error':
            setError(data.message)
            setIsRunning(false)
            setCurrentPhase('idle')
            setPipelineSteps(prev =>
              prev.map(step =>
                step.phase === 'roster' && step.status === 'active' ? { ...step, status: 'error' } : step
              )
            )
            break
        }
      } catch (err) {
        console.error('Roster SSE parse error:', err)
      }
    }

    es.onerror = () => {
      console.error('Roster SSE connection error')
      es.close()
      rosterEventSourceRef.current = null
    }
  }, [loadNevadaFiles, loadMichiganFiles])

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (xmlEventSourceRef.current) {
        xmlEventSourceRef.current.close()
      }
      if (rosterEventSourceRef.current) {
        rosterEventSourceRef.current.close()
      }
      if (schedulerAbortRef.current) {
        schedulerAbortRef.current.abort()
      }
      if (historyAbortRef.current) {
        historyAbortRef.current.abort()
      }
      if (coursesAbortRef.current) {
        coursesAbortRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    // Hard reset on active state switch to avoid stale cross-state pipeline UI.
    setIsRunning(false)
    setCurrentPhase('idle')
    setError(null)
    setRunNotice(null)
    setLatestCompletionOnFile(null)
    setSelectedCourses('all')
    setHistoryPage(1)

    if (xmlEventSourceRef.current) {
      xmlEventSourceRef.current.close()
      xmlEventSourceRef.current = null
    }
    if (rosterEventSourceRef.current) {
      rosterEventSourceRef.current.close()
      rosterEventSourceRef.current = null
    }
    ownsXmlRunRef.current = false
  }, [activeStateCode])

  // Subscribe to the active state's live events so runs started elsewhere are reflected too
  useEffect(() => {
    if (!flow?.configured) return
    if (!xmlEventSourceRef.current) connectXmlSSE()
    if (!rosterEventSourceRef.current) connectRosterSSE()
  }, [flow, connectXmlSSE, connectRosterSSE])

  const handleStartRosterOnly = async () => {
    resetPipeline()
    setIsRunning(true)
    setCurrentPhase('roster')
    connectRosterSSE()

    try {
      await startRosterPipeline({
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
        dryRun,
        courseIds: selectedCourses === 'all' ? undefined : [Number(selectedCourses)],
        ...rosterGateOption(),
      })
    } catch (err) {
      console.error('Failed to start roster-only pipeline:', err)
      setIsRunning(false)
      setCurrentPhase('idle')
      setError(err instanceof Error ? err.message : 'Failed to start roster posting')
    }
  }

  // ============== Pipeline Control ==============

  // Start Roster Phase (called after XML phase completes)
  // Uses refs to avoid stale closure issues when called from SSE callback
  const startRosterPhase = async () => {
    connectRosterSSE()
    
    try {
      await startRosterPipeline({
        fromDate: dateRangeRef.current.fromDate || undefined,
        toDate: dateRangeRef.current.toDate || undefined,
        dryRun: dryRunRef.current,
        courseIds: selectedCoursesRef.current === 'all' ? undefined : [Number(selectedCoursesRef.current)],
        ...rosterGateOption(),
      })
    } catch (err) {
      console.error('Failed to start roster pipeline:', err)
      setError(err instanceof Error ? err.message : 'Failed to start roster posting phase')
      setIsRunning(false)
      setCurrentPhase('idle')
    }
  }

  // Start full pipeline
  const handleStartPipeline = async () => {
    resetPipeline()
    setIsRunning(true)
    setCurrentPhase('xml')
    ownsXmlRunRef.current = true
    connectXmlSSE()
    
    try {
      const courseIds = selectedCourses === 'all' 
        ? undefined 
        : [parseInt(selectedCourses, 10)]
      
      await startPipeline({
        courseIds,
        fromDate: dateRange.fromDate || undefined,
        toDate: dateRange.toDate || undefined,
        dryRun,
        mode,
      })
    } catch (error) {
      console.error('Failed to start pipeline:', error)
      ownsXmlRunRef.current = false
      setIsRunning(false)
      setCurrentPhase('idle')
      setError(error instanceof Error ? error.message : 'Failed to start pipeline')
    }
  }

  // Stop pipeline
  const handleStopPipeline = async () => {
    ownsXmlRunRef.current = false
    try {
      // Stop both pipelines
      await Promise.all([
        stopPipeline(),
        stopRosterPipeline(),
      ])
    } catch (error) {
      console.error('Failed to stop pipeline:', error)
    }
    
    setIsRunning(false)
    setCurrentPhase('idle')
    
    if (xmlEventSourceRef.current) {
      xmlEventSourceRef.current.close()
      xmlEventSourceRef.current = null
    }
    if (rosterEventSourceRef.current) {
      rosterEventSourceRef.current.close()
      rosterEventSourceRef.current = null
    }
  }

  // Update scheduler (saved immediately; the scheduler picks the change up within ~30 seconds)
  const handleUpdateScheduler = async (updates: { enabled?: boolean; schedule?: string; dryRun?: boolean }) => {
    try {
      applySchedulerStatus(await updateRosterSchedulerSettings(updates))
    } catch (err) {
      console.error('Failed to update scheduler:', err)
      setError(err instanceof Error ? err.message : 'Failed to update the scheduler')
    }
  }

  const refreshSchedulerStatus = () => {
    getRosterPipelineSchedulerStatus()
      .then(applySchedulerStatus)
      .catch((err) => console.error('Failed to load scheduler status:', err))
  }

  const handleSchedulerRunNow = async () => {
    try {
      const res = await authFetch(apiUrl('/api/roster-pipeline/scheduler/run-now'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null
        setError(body?.error || `Run Now failed (${res.status})`)
        return
      }
      window.setTimeout(refreshSchedulerStatus, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run Now failed')
    }
  }
  
  // Format last run time
  const formatLastRun = () => {
    if (!lastRun) return 'Never'
    const diff = Date.now() - lastRun.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins === 1) return '1 min ago'
    if (mins < 60) return `${mins} min ago`
    const hours = Math.floor(mins / 60)
    if (hours === 1) return '1 hour ago'
    return `${hours} hours ago`
  }

  // Get XML steps and Roster steps
  const xmlSteps = pipelineSteps.filter(s => s.phase === 'xml')
  const rosterSteps = pipelineSteps.filter(s => s.phase === 'roster')
  const nvGateIndex = isNevada ? rosterSteps.findIndex(s => s.key === NV_EMAIL_GATE_AFTER_KEY) : -1
  const miGateIndex = isMichigan ? rosterSteps.findIndex(s => s.key === MI_UPLOAD_GATE_AFTER_KEY) : -1
  const submitGateIndex = submitGate ? rosterSteps.findIndex(s => s.key === submitGate.afterStepKey) : -1
  const gateIndex = nvGateIndex >= 0 ? nvGateIndex : miGateIndex >= 0 ? miGateIndex : submitGateIndex
  const gateEnabled = nvGateIndex >= 0 ? emailDivisionEnabled : miGateIndex >= 0 ? miUploadEnabled : submitGateEnabled
  // Alabama produces no files, so its gate step has no download point.
  const gateHasFiles = nvGateIndex >= 0 || miGateIndex >= 0
  const gateLastRunFiles = nvGateIndex >= 0 ? nvLastRunFiles : miLastRunFiles
  const handleGateDownloadLastRun = nvGateIndex >= 0 ? handleDownloadLastRun : handleDownloadMichiganLastRun
  const gateFilesAnchor = nvGateIndex >= 0 ? '#nv-generated-files' : '#mi-generated-files'
  const isStepSkippedByGate = (index: number) => gateIndex >= 0 && !gateEnabled && index > gateIndex
  const nvLastRunFileSet = new Set(nvLastRunFiles)
  const miLastRunFileSet = new Set(miLastRunFiles)
  const xmlPhase = flow?.phases.find(p => p.id === 'xml')
  const rosterPhase = flow?.phases.find(p => p.id === 'roster')
  const portal = flow?.stateCode === activeStateCode ? flow.portal : null

  const rosterHistoryFeed: RosterFeedEntry[] = history
    .flatMap(run =>
      (run.entries || []).map(mapRosterEntryToFeed)
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50)

  // ============== Render ==============

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <span className="relative inline-flex shrink-0">
              <span className="absolute inset-0 rounded-xl bg-blue-500/30 blur-md opacity-70" />
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-amber-500 text-white shadow-md">
                <Workflow className="h-5 w-5" />
              </span>
            </span>
            {maskedPipelineLabel}
          </h1>
          <p className="text-muted-foreground mt-1">
            {maskedPipelineLabel}: {flow?.configured ? flow.description : flow ? flow.message : flowLoading ? 'Loading automation flow...' : 'Automation flow unavailable'}
          </p>
        </div>
      </div>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pipeline' | 'roster' | 'scheduler' | 'history')} className="space-y-6">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="roster">Roster Post</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ============== Pipeline Tab ============== */}
        <TabsContent value="pipeline" className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {runNotice && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Run Result</AlertTitle>
              <AlertDescription>
                {runNotice}
                {latestCompletionOnFile && !isRunning && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        const to = latestCompletionOnFile
                        const from = new Date(`${to}T00:00:00Z`)
                        from.setUTCDate(from.getUTCDate() - 90)
                        setDateRange({ fromDate: from.toISOString().slice(0, 10), toDate: to })
                        setRunNotice(null)
                        setLatestCompletionOnFile(null)
                      }}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Use date range ending {latestCompletionOnFile}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Sets the range to the 90 days ending on the latest completion; then press Start Pipeline.
                    </span>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Pipeline Control */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Controls Card */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-yellow-500" />
                      Pipeline Control
                    </CardTitle>
                    <CardDescription>
                      Full pipeline flow: Data fetch → Processing → Roster Posting
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {isRunning ? (
                      <Button variant="destructive" onClick={handleStopPipeline}>
                        <Pause className="h-4 w-4 mr-2" />
                        Stop Pipeline
                      </Button>
                    ) : (
                      <Button onClick={handleStartPipeline} disabled={automationUnavailable || !isDateRangeValid}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Pipeline
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Configuration Options */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <Select value={mode} onValueChange={value => setMode(value === 'live' ? 'live' : 'test')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="test">Test Mode</SelectItem>
                        <SelectItem value="live">Live Mode</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Course Selection</Label>
                    <Select 
                      value={selectedCourses} 
                      onValueChange={setSelectedCourses}
                      disabled={loadingCourses}
                    >
                      <SelectTrigger>
                        {loadingCourses ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading courses...</span>
                          </div>
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">All Active Courses ({stateCourses.length})</SelectItem>
                          {stateCourses.map((course) => (
                          <SelectItem key={course.id} value={String(course.id)}>
                            {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <DateRangeFilter
                    value={dateRange}
                    onChange={setDateRange}
                    className="md:col-span-2"
                    maxDate={new Date().toISOString().split('T')[0]}
                  />
                  {!isDateRangeValid && (
                    <p className="text-xs text-muted-foreground md:col-span-2">
                      Select both a start date and an end date to run the pipeline.
                    </p>
                  )}

                  <div className="flex items-center space-x-4 pt-6">
                    <Switch
                      id="dry-run"
                      checked={dryRun}
                      onCheckedChange={setDryRun}
                    />
                    <Label htmlFor="dry-run" className="flex flex-col">
                      <span>Dry Run</span>
                      <span className="text-xs text-muted-foreground">
                        No actual submissions{portal ? ` to ${portal.name}` : ''}
                      </span>
                    </Label>
                  </div>
                </div>

                {/* Live Mode Warning */}
                {mode === 'live' && !dryRun && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Live Mode Active</AlertTitle>
                    <AlertDescription>
                      Pipeline will POST real data{portal ? ` to ${portal.name}` : ''} and perform browser automation.
                      {activeStateCode === 'SC' && ' Ensure VPN is connected for protected lookup access.'}
                      {submitGate?.liveNote}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Quick Links */}
                {portal && <div className="flex gap-4 pt-4 border-t">
                  <a
                    href={portal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {portal.label}
                  </a>
                </div>}
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Current Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={isRunning ? 'default' : 'secondary'}>
                    {isRunning ? 'Running' : 'Idle'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Phase</span>
                  <Badge variant={currentPhase === 'xml' ? 'default' : currentPhase === 'roster' ? 'secondary' : 'outline'}>
                    {currentPhase === 'xml' ? 'XML Processing' : currentPhase === 'roster' ? 'Roster Posting' : 'Idle'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mode</span>
                  <Badge variant={mode === 'live' ? 'destructive' : 'outline'}>
                    {mode.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Dry Run</span>
                  <Badge variant={dryRun ? 'success' : 'warning'}>
                    {dryRun ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Run</span>
                  <span className="text-sm">{formatLastRun()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scheduler</span>
                  <Badge variant={schedulerStatus?.enabled ? 'success' : 'secondary'}>
                    {schedulerStatus?.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Complete Pipeline Flow Visualization */}
          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <CardTitle>Complete Pipeline Flow</CardTitle>
                <CardDescription>
                  {flow?.configured
                    ? flow.description
                    : flowLoading
                      ? 'Loading automation flow...'
                      : 'Automation flow for the active state'}
                </CardDescription>
              </div>

              {/* Save the pipeline switch for scheduled runs */}
              {rosterGate && flow?.configured && currentGateValue !== null && (
                <div className="flex shrink-0 flex-col gap-1.5 sm:max-w-xs sm:items-end">
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Badge
                      variant={!schedulerForState ? 'outline' : gateDirty ? 'warning' : 'success'}
                      className="text-[10px] uppercase tracking-wide"
                      title={savedGateValue === undefined
                        ? 'This switch has never been saved; scheduled runs use the server default.'
                        : `Saved for scheduled runs: ${rosterGate.label} ${savedGateValue ? 'ON' : 'OFF'}`}
                    >
                      {!schedulerForState
                        ? 'Loading'
                        : savedGateValue === undefined
                          ? 'Not saved'
                          : gateDirty
                            ? 'Unsaved changes'
                            : `Saved · ${rosterGate.label} ${savedGateValue ? 'On' : 'Off'}`}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={handleSaveGate}
                      disabled={!schedulerForState || !gateDirty || savingGate || isRunning}
                      aria-label={`Save the ${rosterGate.label} switch for scheduled runs`}
                    >
                      {savingGate ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground sm:text-right">
                    {!schedulerForState
                      ? 'Loading scheduler settings...'
                      : !schedulerForState.enabled
                        ? 'Scheduler is off. Turn it on in the Scheduler tab to run this flow automatically.'
                        : `Scheduler on: ${describeSchedule(schedulerForState.schedule)} ${schedulerTzShort} · ${schedulerForState.dryRun ? 'Dry Run (nothing is posted)' : 'Live'}`}
                  </p>
                  {gateSaveMessage && gateSaveMessage.stateCode === activeStateCode && (
                    <p className={`text-xs sm:text-right ${gateSaveMessage.tone === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                      {gateSaveMessage.text}
                    </p>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {flowLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading automation flow...
                </div>
              ) : flowError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Unable to load automation flow</AlertTitle>
                  <AlertDescription className="flex items-center justify-between gap-4">
                    <span>{flowError}</span>
                    <Button size="sm" variant="outline" onClick={() => setFlowReloadKey(key => key + 1)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : automationUnavailable ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No automation configured</AlertTitle>
                  <AlertDescription>
                    {flow?.message || 'No roster posting automation is configured for this state.'}
                  </AlertDescription>
                </Alert>
              ) : (
              <>
              {/* Phase 1: Data processing */}
              {xmlSteps.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={currentPhase === 'xml' ? 'default' : 'outline'} className="text-xs">
                    Phase 1
                  </Badge>
                  <span className="font-semibold text-sm">{xmlPhase?.title}</span>
                </div>
                <div className="flex items-center justify-between overflow-x-auto pb-4 px-2">
                  {xmlSteps.map((step, index) => (
                    <div key={`${step.phase}-${step.stepId}`} className="flex items-center">
                      {/* Step Card */}
                      <div
                        className={`
                          relative flex flex-col items-center p-3 rounded-lg border-2 min-w-[110px] transition-all duration-300
                          ${step.status === 'completed' ? 'border-green-500 bg-green-50' : ''}
                          ${step.status === 'active' ? 'border-blue-500 bg-blue-50 animate-pulse' : ''}
                          ${step.status === 'pending' ? 'border-slate-200 bg-slate-50' : ''}
                          ${step.status === 'error' ? 'border-red-500 bg-red-50' : ''}
                        `}
                      >
                        {/* Icon */}
                        <div
                          className={`
                            flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300
                            ${step.status === 'completed' ? 'bg-green-500 text-white' : ''}
                            ${step.status === 'active' ? 'bg-blue-500 text-white' : ''}
                            ${step.status === 'pending' ? 'bg-slate-200 text-slate-500' : ''}
                            ${step.status === 'error' ? 'bg-red-500 text-white' : ''}
                          `}
                        >
                          {step.status === 'active' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <step.icon className="h-5 w-5" />
                          )}
                        </div>

                        {/* Step Info */}
                        <div className="mt-2 text-center">
                          <p className="font-semibold text-xs">{step.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {step.description}
                          </p>
                        </div>

                        {/* Count Badge */}
                        {typeof step.count === 'number' && step.count > 0 && (
                          <Badge
                            variant={step.status === 'completed' ? 'success' : step.status === 'error' ? 'destructive' : 'secondary'}
                            className="mt-2 text-xs"
                          >
                            {step.count} items
                          </Badge>
                        )}

                        {/* Progress Bar */}
                        {step.status === 'active' && typeof step.progress === 'number' && (
                          <div className="w-full mt-2">
                            <Progress value={step.progress} className="h-1.5" />
                          </div>
                        )}
                      </div>

                      {/* Arrow */}
                      {index < xmlSteps.length - 1 && (
                        <ArrowRight
                          className={`
                            h-5 w-5 mx-1 shrink-0
                            ${step.status === 'completed' ? 'text-green-500' : 'text-slate-300'}
                          `}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Phase Connector */}
              {xmlSteps.length > 0 && rosterSteps.length > 0 && (
              <div className="flex justify-center my-4">
                <div className={`
                  flex flex-col items-center p-3 rounded-lg border-2 border-dashed
                  ${currentPhase === 'roster' ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}
                `}>
                  <ArrowRight className={`h-6 w-6 rotate-90 ${currentPhase === 'roster' ? 'text-blue-500' : 'text-slate-400'}`} />
                  <span className="text-xs text-muted-foreground mt-1">{flow?.connectorLabel}</span>
                </div>
              </div>
              )}

              {/* Phase 2: Roster Posting */}
              {rosterSteps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={currentPhase === 'roster' ? 'default' : 'outline'} className="text-xs">
                    Phase {xmlSteps.length > 0 ? 2 : 1}
                  </Badge>
                  <span className="font-semibold text-sm">{rosterPhase?.title}</span>
                </div>
                <div className="flex items-center justify-between overflow-x-auto pb-4 px-2">
                  {rosterSteps.map((step, index) => {
                    const skipped = isStepSkippedByGate(index)
                    const isGateStep = index === gateIndex
                    return (
                    <div key={`${step.phase}-${step.stepId}`} className="flex items-center">
                      {/* Step Card */}
                      <div
                        className={`
                          relative flex flex-col items-center p-3 rounded-lg border-2 min-w-[100px] transition-all duration-300
                          ${skipped ? 'border-dashed border-slate-200 bg-slate-50/60 opacity-50' : ''}
                          ${!skipped && step.status === 'completed' ? 'border-green-500 bg-green-50' : ''}
                          ${!skipped && step.status === 'active' ? 'border-blue-500 bg-blue-50 animate-pulse' : ''}
                          ${!skipped && step.status === 'pending' ? 'border-slate-200 bg-slate-50' : ''}
                          ${!skipped && step.status === 'error' ? 'border-red-500 bg-red-50' : ''}
                        `}
                      >
                        {/* Icon */}
                        <div
                          className={`
                            flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300
                            ${skipped ? 'bg-slate-100 text-slate-400' : ''}
                            ${!skipped && step.status === 'completed' ? 'bg-green-500 text-white' : ''}
                            ${!skipped && step.status === 'active' ? 'bg-gradient-to-br from-blue-600 to-amber-500 text-white' : ''}
                            ${!skipped && step.status === 'pending' ? 'bg-slate-200 text-slate-500' : ''}
                            ${!skipped && step.status === 'error' ? 'bg-red-500 text-white' : ''}
                          `}
                        >
                          {step.status === 'active' && !skipped ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <step.icon className="h-4 w-4" />
                          )}
                        </div>

                        {/* Step Info */}
                        <div className="mt-2 text-center">
                          <p className="font-semibold text-xs">{step.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-[90px]">
                            {step.description}
                          </p>
                        </div>

                        {skipped && (
                          <Badge variant="outline" className="mt-2 text-[10px] uppercase tracking-wide">
                            Skipped
                          </Badge>
                        )}

                        {/* Download point: NV 785A + 612D files, MI attendance worksheets */}
                        {isGateStep && gateHasFiles && (gateLastRunFiles.length > 0 || !gateEnabled) && (
                          gateLastRunFiles.length > 0 ? (
                            <Button
                              size="sm"
                              variant={gateEnabled ? 'outline' : 'default'}
                              className="mt-2 h-7 px-2 text-xs"
                              disabled={downloadingFile !== null}
                              onClick={handleGateDownloadLastRun}
                            >
                              {downloadingFile ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3 mr-1" />
                              )}
                              Download ({gateLastRunFiles.length})
                            </Button>
                          ) : (
                            <a
                              href={gateFilesAnchor}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                            >
                              <Download className="h-3 w-3" />
                              Download here
                            </a>
                          )
                        )}
                      </div>

                      {/* Connector: NV Email Division / MI Upload / AL Commit / IL Submit switch, otherwise a plain arrow */}
                      {index < rosterSteps.length - 1 && (
                        isGateStep && submitGate ? (
                          <div
                            className={`
                              mx-2 flex shrink-0 flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-2 transition-colors
                              ${submitGateEnabled ? 'border-blue-300 bg-blue-50' : 'border-amber-300 bg-amber-50'}
                            `}
                            title={submitGateEnabled ? submitGate.onTitle : submitGate.offTitle}
                          >
                            <Send className={`h-4 w-4 ${submitGateEnabled ? 'text-blue-600' : 'text-amber-600'}`} />
                            <Switch
                              id="portal-submit-gate"
                              checked={submitGateEnabled}
                              onCheckedChange={handleSubmitGateChange}
                              disabled={isRunning}
                              aria-label={`Continue to ${rosterSteps[index + 1]?.name || submitGate.label}`}
                            />
                            <Label htmlFor="portal-submit-gate" className="text-[10px] font-semibold uppercase tracking-wide text-center leading-tight">
                              {submitGate.label} {submitGateEnabled ? 'On' : 'Off'}
                            </Label>
                          </div>
                        ) : isGateStep && isMichigan ? (
                          <div
                            className={`
                              mx-2 flex shrink-0 flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-2 transition-colors
                              ${miUploadEnabled ? 'border-blue-300 bg-blue-50' : 'border-amber-300 bg-amber-50'}
                            `}
                            title={miUploadEnabled
                              ? 'On: flow uploads the worksheet, verifies the roster and clicks Accept Finalize'
                              : 'Off: flow stops after Build Worksheet; download the worksheet instead'}
                          >
                            <Upload className={`h-4 w-4 ${miUploadEnabled ? 'text-blue-600' : 'text-amber-600'}`} />
                            <Switch
                              id="mi-upload"
                              checked={miUploadEnabled}
                              onCheckedChange={handleMiUploadChange}
                              disabled={isRunning}
                              aria-label="Continue to Upload Worksheet"
                            />
                            <Label htmlFor="mi-upload" className="text-[10px] font-semibold uppercase tracking-wide text-center leading-tight">
                              {miUploadEnabled ? 'Upload On' : 'Upload Off'}
                            </Label>
                          </div>
                        ) : isGateStep ? (
                          <div
                            className={`
                              mx-2 flex shrink-0 flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-2 transition-colors
                              ${emailDivisionEnabled ? 'border-blue-300 bg-blue-50' : 'border-amber-300 bg-amber-50'}
                            `}
                            title={emailDivisionEnabled
                              ? 'On: flow continues to Email Division and Complete'
                              : 'Off: flow stops after Build 612D; download the files instead'}
                          >
                            <Mail className={`h-4 w-4 ${emailDivisionEnabled ? 'text-blue-600' : 'text-amber-600'}`} />
                            <Switch
                              id="nv-email-division"
                              checked={emailDivisionEnabled}
                              onCheckedChange={handleEmailDivisionChange}
                              disabled={isRunning}
                              aria-label="Continue to Email Division"
                            />
                            <Label htmlFor="nv-email-division" className="text-[10px] font-semibold uppercase tracking-wide text-center leading-tight">
                              {emailDivisionEnabled ? 'Email On' : 'Email Off'}
                            </Label>
                          </div>
                        ) : (
                          <ArrowRight
                            className={`
                              h-4 w-4 mx-1 shrink-0
                              ${skipped ? 'text-slate-200' : step.status === 'completed' ? 'text-green-500' : 'text-slate-300'}
                            `}
                          />
                        )
                      )}
                    </div>
                    )
                  })}
                </div>
                {nvGateIndex >= 0 && (
                  <p className="text-xs text-muted-foreground px-2">
                    {emailDivisionEnabled
                      ? 'Email Division is ON: the run emails the 785A roster to education@red.nv.gov and the 612D evaluation to Evals@red.nv.gov, then completes.'
                      : 'Email Division is OFF: the run stops after Build 612D Evaluations. Nothing is emailed; download the 785A / 612D files below.'}
                  </p>
                )}
                {miGateIndex >= 0 && (
                  <p className="text-xs text-muted-foreground px-2">
                    {!miUploadEnabled
                      ? 'Upload is OFF: the run stops after Build Worksheet. Nothing is uploaded; download the worksheets below to check them.'
                      : dryRun
                        ? 'Upload is ON, but Dry Run is also on: worksheets are built and nothing is uploaded. Turn Dry Run off to upload.'
                        : 'Upload is ON: the run uploads each worksheet to CE Marketplace, verifies the roster count and clicks Accept Finalize (cannot be undone).'}
                  </p>
                )}
                {submitGate && submitGateIndex >= 0 && (
                  <p className="text-xs text-muted-foreground px-2">
                    {dryRun ? submitGate.dryRunHelp : submitGateEnabled ? submitGate.onHelp : submitGate.offHelp}
                  </p>
                )}
              </div>
              )}

              {/* Michigan generated attendance worksheets */}
              {isMichigan && (
              <div id="mi-generated-files" className="mt-6 rounded-lg border bg-white/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      Generated Attendance Worksheets
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Worksheets built by recent Michigan runs. Latest run files are highlighted.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={loadMichiganFiles} disabled={miFilesLoading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${miFilesLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                {miFiles.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    {miFilesLoading ? 'Loading worksheets...' : 'No worksheets generated yet. Run the pipeline to build attendance worksheets.'}
                  </p>
                ) : (
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {miFiles.map((file) => {
                      const isLatest = miLastRunFileSet.has(file.fileName)
                      return (
                        <div
                          key={file.fileName}
                          className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${isLatest ? 'border-blue-300 bg-blue-50' : 'bg-white'}`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 shrink-0 text-green-600" />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium" title={file.fileName}>{file.fileName}</p>
                              <p className="text-[11px] text-muted-foreground">
                                Attendance Worksheet · {formatFileSize(file.size)} · {new Date(file.modifiedAt).toLocaleString()}
                              </p>
                            </div>
                            {isLatest && <Badge variant="secondary" className="text-[10px]">Latest run</Badge>}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 shrink-0 px-2"
                            disabled={downloadingFile === file.fileName}
                            onClick={() => handleDownloadMichiganFile(file.fileName)}
                            aria-label={`Download ${file.fileName}`}
                          >
                            {downloadingFile === file.fileName ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              )}

              {/* Nevada generated files */}
              {isNevada && (
              <div id="nv-generated-files" className="mt-6 rounded-lg border bg-white/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Download className="h-4 w-4 text-blue-600" />
                      Generated 785A Rosters &amp; 612D Evaluations
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Files built by recent Nevada runs. Latest run files are highlighted.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={loadNevadaFiles} disabled={nvFilesLoading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${nvFilesLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                {nvFiles.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    {nvFilesLoading ? 'Loading files...' : 'No files generated yet. Run the pipeline to build 785A / 612D files.'}
                  </p>
                ) : (
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {nvFiles.map((file) => {
                      const isLatest = nvLastRunFileSet.has(file.fileName)
                      const FileIcon = file.type === 'roster' ? FileSpreadsheet : FileText
                      return (
                        <div
                          key={file.fileName}
                          className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${isLatest ? 'border-blue-300 bg-blue-50' : 'bg-white'}`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <FileIcon className={`h-4 w-4 shrink-0 ${file.type === 'roster' ? 'text-green-600' : 'text-red-500'}`} />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium" title={file.fileName}>{file.fileName}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {file.type === 'roster' ? '785A Roster' : '612D Evaluation'} · {formatFileSize(file.size)} · {new Date(file.modifiedAt).toLocaleString()}
                              </p>
                            </div>
                            {isLatest && <Badge variant="secondary" className="text-[10px]">Latest run</Badge>}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 shrink-0 px-2"
                            disabled={downloadingFile === file.fileName}
                            onClick={() => handleDownloadNevadaFile(file.fileName)}
                            aria-label={`Download ${file.fileName}`}
                          >
                            {downloadingFile === file.fileName ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              )}
              </>
              )}
            </CardContent>
          </Card>

          {/* Current Processing Details */}
          {isRunning && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Processing Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Course Progress (XML Phase) */}
                  {currentPhase === 'xml' && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Course: {processingStats.currentCourse || 'Initializing...'}</span>
                          <span className="text-muted-foreground">
                            {processingStats.courseIndex} of {processingStats.totalCourses}
                          </span>
                        </div>
                        <Progress 
                          value={processingStats.totalCourses > 0 
                            ? (processingStats.courseIndex / processingStats.totalCourses) * 100 
                            : 0} 
                          className="h-2" 
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Student: {processingStats.currentStudent || 'Waiting...'}</span>
                          <span className="text-muted-foreground">
                            {processingStats.studentIndex} of {processingStats.totalStudents}
                          </span>
                        </div>
                        <Progress 
                          value={processingStats.totalStudents > 0 
                            ? (processingStats.studentIndex / processingStats.totalStudents) * 100 
                            : 0} 
                          className="h-2" 
                        />
                      </div>
                    </>
                  )}

                  {/* Student Details (Roster Phase) */}
                  {currentPhase === 'roster' && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Phase: {processingStats.phase || 'Initializing...'}</span>
                          <span className="text-muted-foreground">
                            {processingStats.studentIndex} of {processingStats.totalStudents}
                          </span>
                        </div>
                        <Progress 
                          value={processingStats.totalStudents > 0 
                            ? (processingStats.studentIndex / processingStats.totalStudents) * 100 
                            : 0} 
                          className="h-2" 
                        />
                      </div>

                      {processingStats.currentStudent && (
                        <div className="p-4 bg-slate-50 rounded-lg">
                          <p className="font-semibold">Current Student</p>
                          <p className="text-sm text-muted-foreground">{processingStats.currentStudent}</p>
                          {processingStats.licenseNumber && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">License:</span> {processingStats.licenseNumber}
                            </p>
                          )}
                          {processingStats.profession && (
                            <p className="text-sm">
                              <span className="text-muted-foreground">Profession:</span> {processingStats.profession}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Results Summary */}
                  <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{processingStats.submitted}</p>
                      <p className="text-xs text-muted-foreground">Submitted</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{processingStats.failed}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">{processingStats.skipped}</p>
                      <p className="text-xs text-muted-foreground">Skipped</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">{processingStats.duplicate}</p>
                      <p className="text-xs text-muted-foreground">Duplicate</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============== Roster Post Tab ============== */}
        <TabsContent value="roster" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileEdit className="h-5 w-5" />
                Roster Posting Control
              </CardTitle>
              <CardDescription>
                See live roster creation and either auto-post via pipeline{portal ? ` or manually post in ${portal.name}` : ''}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DateRangeFilter
                value={dateRange}
                onChange={setDateRange}
                maxDate={new Date().toISOString().split('T')[0]}
              />
              <div className="grid gap-3 md:grid-cols-3">
                <Button onClick={handleStartPipeline} disabled={isRunning || automationUnavailable || !isDateRangeValid}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Full Pipeline
                </Button>
                <Button variant="secondary" onClick={handleStartRosterOnly} disabled={isRunning || automationUnavailable || !isDateRangeValid}>
                  <Zap className="h-4 w-4 mr-2" />
                  Start Roster Only
                </Button>
                {portal && <Button asChild variant="outline">
                  <a
                    href={portal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Manual Post in {portal.name}
                  </a>
                </Button>}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={isRunning ? 'default' : 'secondary'}>
                  {isRunning ? 'Pipeline Running' : 'Pipeline Idle'}
                </Badge>
                <Badge variant={currentPhase === 'roster' ? 'success' : 'outline'}>
                  {currentPhase === 'roster' ? 'Roster Phase Active' : 'Roster Phase Inactive'}
                </Badge>
                <Badge variant={mode === 'live' && !dryRun ? 'destructive' : 'outline'}>
                  {mode === 'live' && !dryRun ? 'Live Post Mode' : 'Safe Dry Run'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {activeStateCode === 'HI' && <HawaiiClosedCoursesCard />}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className={isRunning && currentPhase === 'roster' ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
                Live Roster Feed
              </CardTitle>
              <CardDescription>
                Latest roster entries from current run and recent automatic runs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(liveRosterFeed.length > 0 || rosterHistoryFeed.length > 0) ? (
                <div className="space-y-3">
                  {(liveRosterFeed.length > 0 ? liveRosterFeed : rosterHistoryFeed).slice(0, 15).map((entry, index) => {
                    // Ensure all fields are strings, not objects
                    const safeStr = (val: unknown): string => {
                      if (val === null || val === undefined) return '-'
                      if (typeof val === 'string') return val
                      if (typeof val === 'number' || typeof val === 'boolean') return String(val)
                      return '-'
                    }
                    
                    return (
                    <div key={`${safeStr(entry.licenseNumber)}-${safeStr(entry.timestamp)}-${index}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{safeStr(entry.student)}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={entry.status === 'posted' ? 'success' : entry.status === 'skipped' ? 'secondary' : 'destructive'}>
                            {entry.status === 'posted' ? 'Posted' : entry.status === 'skipped' ? 'Skipped' : 'Failed'}
                          </Badge>
                          <Badge variant="outline">{safeStr(entry.mode)}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                        <p>License: {safeStr(entry.licenseNumber)}</p>
                        <p>Profession: {safeStr(entry.profession)}</p>
                        <p>Course: {safeStr(entry.course)}</p>
                        <p>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '-'}</p>
                      </div>
                      {(entry.reason || entry.error) && (
                        <p className="mt-2 text-xs text-amber-700">
                          {safeStr(entry.reason) !== '-' ? safeStr(entry.reason) : safeStr(entry.error)}
                        </p>
                      )}
                    </div>
                  )})}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No roster activity yet. Start full pipeline or roster-only run to see live entries here.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== Scheduler Tab ============== */}
        <TabsContent value="scheduler" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Daily Scheduler
              </CardTitle>
              <CardDescription>
                Configure automatic daily pipeline execution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {schedulerStatus ? (
                <>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="text-base font-semibold">Enable Scheduler</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically run the complete pipeline daily
                      </p>
                    </div>
                    <Switch
                      checked={schedulerStatus.enabled}
                      onCheckedChange={(enabled) => handleUpdateScheduler({ enabled })}
                    />
                  </div>

                  {/* Time Picker */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Schedule Time
                    </Label>
                    
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Hour Selection */}
                      <div className="space-y-2">
                        <Label>Hour</Label>
                        <select
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                          value={(() => {
                            const parts = schedulerStatus.schedule.split(' ')
                            return parts[1] || '18'
                          })()}
                          onChange={(e) => {
                            const parts = schedulerStatus.schedule.split(' ')
                            parts[1] = e.target.value
                            handleUpdateScheduler({ schedule: parts.join(' ') })
                          }}
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>
                              {i.toString().padStart(2, '0')}:00 ({i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Minute Selection */}
                      <div className="space-y-2">
                        <Label>Minute</Label>
                        <select
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                          value={(() => {
                            const parts = schedulerStatus.schedule.split(' ')
                            return parts[0] || '0'
                          })()}
                          onChange={(e) => {
                            const parts = schedulerStatus.schedule.split(' ')
                            parts[0] = e.target.value
                            handleUpdateScheduler({ schedule: parts.join(' ') })
                          }}
                        >
                          <option value="0">:00</option>
                          <option value="15">:15</option>
                          <option value="30">:30</option>
                          <option value="45">:45</option>
                        </select>
                      </div>

                      {/* Days Selection */}
                      <div className="space-y-2">
                        <Label>Days</Label>
                        <select
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                          value={(() => {
                            const parts = schedulerStatus.schedule.split(' ')
                            const dayPart = parts[4] || '*'
                            if (dayPart === '*') return 'everyday'
                            if (dayPart === '1-5') return 'weekdays'
                            return 'everyday'
                          })()}
                          onChange={(e) => {
                            const parts = schedulerStatus.schedule.split(' ')
                            parts[4] = e.target.value === 'weekdays' ? '1-5' : '*'
                            handleUpdateScheduler({ schedule: parts.join(' ') })
                          }}
                        >
                          <option value="everyday">Every Day</option>
                          <option value="weekdays">Weekdays Only (Mon-Fri)</option>
                        </select>
                      </div>
                    </div>

                    {/* Current Schedule Display */}
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <span className="font-semibold">Current Schedule:</span>{' '}
                        {(() => {
                          const parts = schedulerStatus.schedule.split(' ')
                          const minute = parts[0] || '0'
                          const hour = parseInt(parts[1] || '18')
                          const days = parts[4] === '1-5' ? 'Weekdays' : 'Every day'
                          const ampm = hour >= 12 ? 'PM' : 'AM'
                          const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                          return `${hour12}:${minute.padStart(2, '0')} ${ampm} - ${days}`
                        })()}
                        {schedulerStatus.timeZone ? ` (${shortTimeZoneName(schedulerStatus.timeZone)}, ${schedulerStatus.timeZone})` : ''}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Cron: {schedulerStatus.schedule}
                      </p>
                    </div>
                  </div>

                  {/* Dry Run Toggle */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base font-semibold">Dry Run Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Scheduled runs won't make actual submissions
                      </p>
                    </div>
                    <Switch
                      id="scheduler-dry-run"
                      checked={schedulerStatus.dryRun}
                      onCheckedChange={(dryRun) => handleUpdateScheduler({ dryRun })}
                    />
                  </div>

                  {/* Status Panel */}
                  <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
                    <Label className="text-base font-semibold">Scheduler Status</Label>
                    
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge 
                          variant={schedulerStatus.enabled ? 'success' : 'secondary'}
                          className="text-xs"
                        >
                          {schedulerStatus.enabled ? '✓ Active' : '○ Disabled'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-sm text-muted-foreground">Mode</span>
                        <Badge 
                          variant={schedulerStatus.dryRun ? 'outline' : 'destructive'}
                          className="text-xs"
                        >
                          {schedulerStatus.dryRun ? 'Dry Run' : 'Live'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-sm text-muted-foreground">Next Run</span>
                        <span className="text-sm font-medium text-green-600">
                          {schedulerStatus.enabled && schedulerStatus.nextRun
                            ? formatInTimeZone(schedulerStatus.nextRun, schedulerStatus.timeZone)
                            : '—'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-sm text-muted-foreground">Last Run</span>
                        <span className="text-sm font-medium text-right">
                          {schedulerStatus.lastRunDetails
                            ? `${formatInTimeZone(schedulerStatus.lastRunDetails.startedAt, schedulerStatus.timeZone)} · ${schedulerStatus.lastRunDetails.status}`
                            : 'Never'}
                        </span>
                      </div>

                      {rosterGate && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                          <span className="text-sm text-muted-foreground">Saved {rosterGate.label} switch</span>
                          <Badge variant={schedulerStatus.gates?.[rosterGate.key] ? 'success' : 'secondary'} className="text-xs">
                            {typeof schedulerStatus.gates?.[rosterGate.key] === 'boolean'
                              ? (schedulerStatus.gates?.[rosterGate.key] ? 'On' : 'Off')
                              : 'Not saved (server default)'}
                          </Badge>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-sm text-muted-foreground">Completions covered</span>
                        <span className="text-sm font-medium">
                          {schedulerStatus.lookbackDays
                            ? `Last ${schedulerStatus.lookbackDays} day${schedulerStatus.lookbackDays === 1 ? '' : 's'} + today`
                            : 'Today only'}
                        </span>
                      </div>
                    </div>

                    {schedulerStatus.lastRunDetails?.message && (
                      <p className="text-xs text-muted-foreground break-words">
                        Last run: {schedulerStatus.lastRunDetails.message}
                      </p>
                    )}

                    {schedulerStatus.isRunning && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-sm text-blue-800 font-medium">
                          Pipeline is currently running{schedulerStatus.runningTrigger === 'scheduled' ? ' (scheduled run)' : ''}...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleSchedulerRunNow}
                      disabled={schedulerStatus.isRunning}
                      className="flex-1"
                      title="Runs this state's scheduled job now, with the saved settings"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Run Now
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={refreshSchedulerStatus}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== History Tab ============== */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Pipeline Run History
              </CardTitle>
              <CardDescription>
                Recent pipeline executions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((entry, index) => (
                    <div
                      key={index}
                      className="flex flex-wrap items-start justify-between gap-4 p-4 bg-slate-50 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {new Date(entry.started_at).toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {entry.total_completions} completions processed
                        </p>
                        {(entry.run_status || activeStateCode === 'HI') && (
                          <Badge className="mt-2" variant={entry.run_status === 'submitted' || entry.run_status === 'already_submitted' ? 'success' : entry.run_status === 'failed' ? 'destructive' : entry.run_status === 'blocked' ? 'warning' : 'secondary'}>
                            {entry.run_status === 'submitted' ? 'Roster Submitted'
                              : entry.run_status === 'already_submitted' ? 'Roster Already Submitted'
                              : entry.run_status === 'blocked' ? 'Roster Pending'
                              : entry.run_status === 'failed' ? 'Roster Failed'
                              : entry.run_status === 'dry_run' ? 'Dry Run'
                              : entry.run_status === 'no_completions' ? 'No Completions'
                              : entry.run_status === 'no_changes' ? 'No New Submission' : 'Roster Status Not Recorded'}
                          </Badge>
                        )}
                        {entry.message && <p className="mt-2 break-words text-sm text-muted-foreground">{entry.message}</p>}
                      </div>
                      <div className="flex gap-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-green-600">{entry.successful}</p>
                          <p className="text-xs text-muted-foreground">Attendees OK</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-red-600">{entry.failed}</p>
                          <p className="text-xs text-muted-foreground">Failed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-yellow-600">{entry.skipped}</p>
                          <p className="text-xs text-muted-foreground">Skipped</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <PaginationControls
                    page={historyPage}
                    totalPages={historyTotalPages}
                    totalItems={historyTotal}
                    pageSize={historyPerPage}
                    pageSizeOptions={[5, 10, 20, 50]}
                    onPageChange={setHistoryPage}
                    onPageSizeChange={(size) => {
                      setHistoryPerPage(size)
                      setHistoryPage(1)
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pipeline runs yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
