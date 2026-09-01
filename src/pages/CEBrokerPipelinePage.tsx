import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
  Monitor,
  Workflow,
} from 'lucide-react'
import {
  apiUrl,
  getRosterPipelineHistory,
  getRosterPipelineSchedulerStatus,
  getTenantCoursesWithSignal,
  type Course,
} from '@/lib/api'
import { getActiveState, getTenantAccessProfile } from '@/lib/auth'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { getHiddenPipelineTabLabel, toPipelineStateCode } from '@/lib/ceBrokerPipeline'

// ============== Types ==============

// Unified Pipeline step type
interface PipelineStep {
  id: number
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
interface SchedulerStatus {
  enabled: boolean
  schedule: string
  isRunning: boolean
  lastRun: string | null
  nextRun: string
  dryRun: boolean
}

// History entry type
interface HistoryEntry {
  started_at: string
  completed_at: string
  total_completions: number
  successful: number
  failed: number
  skipped: number
  errors: Array<{ error: string }>
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
  forcedStateCode?: 'SC' | 'HI' | 'NC' | 'NV' | 'MI' | 'MO'
}

interface FlowStepTemplate {
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  tracksCount?: boolean
  tracksProgress?: boolean
}

interface ArchitectureNode {
  id: string
  label: string
  subtitle: string
  colorClass: string
  icon?: React.ComponentType<{ className?: string }>
  token?: string
}

interface StateFlowConfig {
  stateCode: 'SC' | 'HI' | 'NC' | 'NV' | 'MI' | 'MO'
  stateName: string
  flowDescription: string
  phaseOneTitle: string
  phaseTwoTitle: string
  phaseConnectorLabel: string
  architectureDescription: string
  lookupPortalLabel: string
  lookupPortalUrl: string
  xmlSteps: FlowStepTemplate[]
  rosterSteps: FlowStepTemplate[]
  architectureNodes: ArchitectureNode[]
}

const DEFAULT_XML_STEPS: FlowStepTemplate[] = [
  {
    name: 'Fetch Courses',
    description: 'Pull courses from ExceedCE API',
    icon: Database,
    tracksCount: true,
  },
  {
    name: 'Filter State',
    description: 'Filter active state mapped courses',
    icon: Filter,
    tracksCount: true,
  },
  {
    name: 'Get Completions',
    description: 'Fetch completed students per course',
    icon: Users,
    tracksCount: true,
    tracksProgress: true,
  },
  {
    name: 'Resolve Attendees',
    description: 'Match licenses and validate data',
    icon: FileCheck,
    tracksCount: true,
  },
]

function createArchitectureNodes(stateCode: string, lookupLabel: string): ArchitectureNode[] {
  return [
    {
      id: 'exceedce',
      label: 'ExceedCE',
      subtitle: 'Data Source',
      colorClass: 'bg-blue-500',
      token: 'ECE',
    },
    {
      id: 'xml',
      label: 'XML Pipeline',
      subtitle: 'Processing',
      colorClass: 'bg-indigo-500',
      icon: Database,
    },
    {
      id: 'lookup',
      label: lookupLabel,
      subtitle: 'Profession Lookup',
      colorClass: 'bg-orange-500',
      icon: Globe,
    },
    {
      id: 'browser',
      label: 'Puppeteer',
      subtitle: 'Browser Bot',
      colorClass: 'bg-purple-500',
      icon: Monitor,
    },
    {
      id: 'cebroker',
      label: 'CE Broker',
      subtitle: `${stateCode} Roster Posted`,
      colorClass: 'bg-green-500',
      token: 'CEB',
    },
  ]
}

function createStateFlowConfig(
  stateCode: 'SC' | 'HI' | 'NC' | 'NV' | 'MI' | 'MO',
  stateName: string,
  lookupPortalUrl: string,
  rosterCreationDescription: string
): StateFlowConfig {
  const lookupPortalLabel = 'License Lookup Portal'
  const architectureLookupLabel = 'License Lookup'

  return {
    stateCode,
    stateName,
    flowDescription: `Full workflow: ExceedCE Data → XML Processing → ${stateCode} Roster Posting → CE Broker`,
    phaseOneTitle: 'Data Processing (XML Pipeline)',
    phaseTwoTitle: `${stateCode} Roster Posting (Browser Automation)`,
    phaseConnectorLabel: `${stateCode} Browser Automation`,
    architectureDescription: `Complete ${stateCode} active-state data flow from ExceedCE to CE Broker`,
    lookupPortalLabel,
    lookupPortalUrl,
    xmlSteps: DEFAULT_XML_STEPS,
    rosterSteps: [
      {
        name: 'Check VPN',
        description: 'Verify lookup portal access',
        icon: Shield,
      },
      {
        name: 'Lookup Profession',
        description: 'Resolve profession from lookup portal',
        icon: Globe,
      },
      {
        name: 'Login CE Broker',
        description: 'Authenticate to CE Broker portal',
        icon: LogIn,
      },
      {
        name: 'Create Roster',
        description: rosterCreationDescription,
        icon: FileEdit,
      },
      {
        name: 'Post Roster',
        description: 'Submit to CE Broker',
        icon: Send,
      },
      {
        name: 'Complete',
        description: 'Pipeline finished',
        icon: CheckCircle2,
      },
    ],
    architectureNodes: createArchitectureNodes(stateCode, architectureLookupLabel),
  }
}

const STATE_FLOW_CONFIG: Record<'SC' | 'HI' | 'NC' | 'NV' | 'MI' | 'MO', StateFlowConfig> = {
  SC: createStateFlowConfig(
    'SC',
    'South Carolina',
    'https://verify.llronline.com/LicLookup/Rec/Rec.aspx?div=19',
    'Fill roster form'
  ),
  HI: createStateFlowConfig(
    'HI',
    'Hawaii',
    'https://cca.hawaii.gov/pvl/boards/real-estate/',
    'Prepare HI roster payload'
  ),
  NC: createStateFlowConfig(
    'NC',
    'North Carolina',
    'https://license.ncrec.gov/ncrec/oecgi3.exe/O4W_LIC_SEARCH_NEW',
    'Prepare NC roster payload'
  ),
  NV: createStateFlowConfig(
    'NV',
    'Nevada',
    'https://red.nv.gov/Content/Compliance/Online_Orders/Verification/',
    'Prepare NV roster payload'
  ),
  MI: createStateFlowConfig(
    'MI',
    'Michigan',
    'https://www.michigan.gov/lara',
    'Prepare MI roster payload'
  ),
  MO: createStateFlowConfig(
    'MO',
    'Missouri',
    'https://pr.mo.gov/realestate.asp',
    'Prepare MO roster payload'
  ),
}

function getFlowConfigForState(stateCode: string): StateFlowConfig {
  if (stateCode === 'HI') return STATE_FLOW_CONFIG.HI
  if (stateCode === 'NC') return STATE_FLOW_CONFIG.NC
  if (stateCode === 'NV') return STATE_FLOW_CONFIG.NV
  if (stateCode === 'MI') return STATE_FLOW_CONFIG.MI
  if (stateCode === 'MO') return STATE_FLOW_CONFIG.MO
  return STATE_FLOW_CONFIG.SC
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

// Combined pipeline steps: XML Pipeline → Roster Posting
const getInitialSteps = (flowConfig: StateFlowConfig): PipelineStep[] => {
  const xmlSteps = flowConfig.xmlSteps.map((step, index) => ({
    id: index + 1,
    name: step.name,
    description: step.description,
    icon: step.icon,
    status: 'pending' as const,
    count: step.tracksCount ? 0 : undefined,
    progress: step.tracksProgress ? 0 : undefined,
    phase: 'xml' as const,
  }))

  const rosterOffset = xmlSteps.length
  const rosterSteps = flowConfig.rosterSteps.map((step, index) => ({
    id: rosterOffset + index + 1,
    name: step.name,
    description: step.description,
    icon: step.icon,
    status: 'pending' as const,
    phase: 'roster' as const,
  }))

  return [...xmlSteps, ...rosterSteps]
}

// ============== Main Component ==============

export function CEBrokerPipelinePage({ forcedStateCode }: CEBrokerPipelinePageProps) {
  const location = useLocation()
  const tenant = getTenantAccessProfile()
  const [activeStateCode, setActiveStateCode] = useState(() => {
    const initial = forcedStateCode || getActiveState() || tenant.stateCode || 'SC'
    return toPipelineStateCode(initial)
  })
  const flowConfig = getFlowConfigForState(activeStateCode)
  const maskedPipelineLabel = getHiddenPipelineTabLabel(activeStateCode)
  const rosterSseOffset = flowConfig.xmlSteps.length
  const PAGE_REQUEST_TIMEOUT_MS = 12000

  // Pipeline state
  const [isRunning, setIsRunning] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [mode, setMode] = useState('test')
  const [selectedCourses, setSelectedCourses] = useState<string>('all')
  const [sinceDate, setSinceDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  
  // Dynamic SC courses from API
  const [stateCourses, setStateCourses] = useState<Course[]>([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  
  // Pipeline steps state
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(() => getInitialSteps(flowConfig))
  
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

  // Active tab is derived from route so sidebar can open the roster tab directly
  const [activeTab, setActiveTab] = useState<'pipeline' | 'roster' | 'scheduler' | 'history'>(
    location.pathname === '/roster-posting' ? 'roster' : 'pipeline'
  )

  // Live roster feed (in-memory while current run is active)
  const [liveRosterFeed, setLiveRosterFeed] = useState<RosterFeedEntry[]>([])
  
  // SSE connection refs (one for each pipeline)
  const xmlEventSourceRef = useRef<EventSource | null>(null)
  const rosterEventSourceRef = useRef<EventSource | null>(null)
  const schedulerAbortRef = useRef<AbortController | null>(null)
  const historyAbortRef = useRef<AbortController | null>(null)
  const coursesAbortRef = useRef<AbortController | null>(null)
  
  // Refs to track current values for SSE callbacks (avoids stale closure issues)
  const dryRunRef = useRef(dryRun)
  const sinceDateRef = useRef(sinceDate)
  const selectedCoursesRef = useRef(selectedCourses)
  
  // Keep refs in sync with state
  useEffect(() => { dryRunRef.current = dryRun }, [dryRun])
  useEffect(() => { sinceDateRef.current = sinceDate }, [sinceDate])
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

  // Load scheduler status only when scheduler tab is opened
  useEffect(() => {
    if (activeTab !== 'scheduler') {
      return
    }

    const loadScheduler = async () => {
      if (schedulerAbortRef.current) {
        schedulerAbortRef.current.abort()
      }
      const controller = new AbortController()
      schedulerAbortRef.current = controller

      try {
        setSchedulerStatus(await getRosterPipelineSchedulerStatus(controller.signal, PAGE_REQUEST_TIMEOUT_MS))
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
  }, [activeTab, activeStateCode])

  // Load history only when history tab is opened
  useEffect(() => {
    if (activeTab !== 'history') {
      return
    }

    loadHistory()
  }, [activeTab, loadHistory, activeStateCode])

  // ============== Pipeline Step Management ==============

  // Update pipeline step
  const updateStep = useCallback((stepId: number, updates: Partial<PipelineStep>) => {
    setPipelineSteps(prev => 
      prev.map(step => step.id === stepId ? { ...step, ...updates } : step)
    )
  }, [])

  // Reset pipeline
  const resetPipeline = useCallback(() => {
    setPipelineSteps(getInitialSteps(flowConfig))
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
    setCurrentPhase('idle')
    setLiveRosterFeed([])
  }, [flowConfig])

  useEffect(() => {
    if (!isRunning) {
      setPipelineSteps(getInitialSteps(flowConfig))
    }
  }, [flowConfig, isRunning])

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
          case 'step-start':
            updateStep(data.stepId, { status: 'active', count: 0, progress: 0 })
            break
            
          case 'step-progress':
            updateStep(data.stepId, { 
              count: data.count, 
              progress: data.progress 
            })
            break
            
          case 'step-complete':
            updateStep(data.stepId, { 
              status: 'completed', 
              count: data.count,
              progress: 100 
            })
            break
            
          case 'step-error':
            updateStep(data.stepId, { status: 'error' })
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
            // XML phase complete, now start roster phase
            setCurrentPhase('roster')
            startRosterPhase()
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
          case 'step-change':
            // Map roster step IDs (1-8) to unified step IDs (5-10)
            const unifiedStepId = data.stepId + rosterSseOffset
            setPipelineSteps(prev => 
              prev.map(step => {
                if (step.id < unifiedStepId && step.phase === 'roster' && step.status !== 'completed') {
                  return { ...step, status: 'completed' }
                }
                if (step.id === unifiedStepId) {
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

            if (data.student) {
              setLiveRosterFeed(prev => {
                const next: RosterFeedEntry = {
                  student: data.student,
                  course: 'Current run',
                  licenseNumber: data.licenseNumber || '-',
                  profession: data.profession || null,
                  status: 'posted',
                  mode: dryRun ? 'dry-run' : 'live',
                  timestamp: new Date().toISOString(),
                }

                const deduped = prev.filter(
                  item => !(item.student === next.student && item.licenseNumber === next.licenseNumber)
                )

                return [next, ...deduped].slice(0, 30)
              })
            }
            break
            
          case 'complete':
            setIsRunning(false)
            setLastRun(new Date())
            setCurrentPhase('idle')
            if (data.summary) {
              setProcessingStats(prev => ({
                ...prev,
                submitted: data.summary.successful || prev.submitted,
                failed: data.summary.failed || prev.failed,
                skipped: data.summary.skipped || prev.skipped,
              }))

              if (Array.isArray(data.summary.entries)) {
                const mapped = data.summary.entries.map(mapRosterEntryToFeed)
                setLiveRosterFeed(mapped.slice(0, 30))
              }
            }
            // Mark all steps as completed
            setPipelineSteps(prev => 
              prev.map(step => ({ ...step, status: 'completed' }))
            )

            loadHistory().catch(() => {})
            break
            
          case 'error':
            setError(data.message)
            setIsRunning(false)
            setCurrentPhase('idle')
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
  }, [rosterSseOffset])

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
  }, [activeStateCode])

  const handleStartRosterOnly = async () => {
    resetPipeline()
    setIsRunning(true)
    setCurrentPhase('roster')
    connectRosterSSE()

    try {
      await fetch(apiUrl('/api/roster-pipeline/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sinceDate: sinceDate || undefined,
          dryRun,
          courseIds: selectedCourses === 'all' ? null : [selectedCourses],
        }),
      })
    } catch (err) {
      console.error('Failed to start roster-only pipeline:', err)
      setIsRunning(false)
      setCurrentPhase('idle')
      setError('Failed to start roster posting')
    }
  }

  // ============== Pipeline Control ==============

  // Start Roster Phase (called after XML phase completes)
  // Uses refs to avoid stale closure issues when called from SSE callback
  const startRosterPhase = async () => {
    connectRosterSSE()
    
    try {
      await fetch(apiUrl('/api/roster-pipeline/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sinceDate: sinceDateRef.current || undefined,
          dryRun: dryRunRef.current,
          courseIds: selectedCoursesRef.current === 'all' ? null : [selectedCoursesRef.current],
        }),
      })
    } catch (err) {
      console.error('Failed to start roster pipeline:', err)
      setError('Failed to start roster posting phase')
      setIsRunning(false)
    }
  }

  // Start full pipeline
  const handleStartPipeline = async () => {
    resetPipeline()
    setIsRunning(true)
    setCurrentPhase('xml')
    connectXmlSSE()
    
    try {
      const courseIds = selectedCourses === 'all' 
        ? undefined 
        : [parseInt(selectedCourses, 10)]
      
      await fetch(apiUrl('/api/pipeline/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseIds,
          sinceDate: sinceDate || undefined,
          dryRun,
          mode,
          // Signal to continue to roster posting after XML completes
          continueToRoster: true,
        }),
      })
    } catch (error) {
      console.error('Failed to start pipeline:', error)
      setIsRunning(false)
      setError('Failed to start pipeline')
    }
  }

  // Stop pipeline
  const handleStopPipeline = async () => {
    try {
      // Stop both pipelines
      await Promise.all([
        fetch(apiUrl('/api/pipeline/stop'), { method: 'POST' }),
        fetch(apiUrl('/api/roster-pipeline/stop'), { method: 'POST' }),
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

  // Update scheduler
  const handleUpdateScheduler = async (updates: Partial<SchedulerStatus>) => {
    try {
      const res = await fetch(apiUrl('/api/roster-pipeline/scheduler/update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const data = await res.json()
        setSchedulerStatus(data.status)
      }
    } catch (err) {
      console.error('Failed to update scheduler:', err)
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
            {maskedPipelineLabel}: ExceedCE → XML Processing → Roster Posting → CE Broker
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
                      <Button onClick={handleStartPipeline}>
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
                    <Select value={mode} onValueChange={setMode}>
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

                  <div className="space-y-2">
                    <Label>Completion On</Label>
                    <Input
                      type="date"
                      value={sinceDate}
                      onChange={(e) => setSinceDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>

                  <div className="flex items-center space-x-4 pt-6">
                    <Switch
                      id="dry-run"
                      checked={dryRun}
                      onCheckedChange={setDryRun}
                    />
                    <Label htmlFor="dry-run" className="flex flex-col">
                      <span>Dry Run</span>
                      <span className="text-xs text-muted-foreground">
                        No actual submissions to CE Broker
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
                      Pipeline will POST real data to CE Broker and perform browser automation.
                      Ensure VPN is connected for protected lookup access.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Quick Links */}
                <div className="flex gap-4 pt-4 border-t">
                  <a
                    href="https://providers.cebroker.com/#rosters/create/1291177"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    CE Broker Roster Page
                  </a>
                </div>
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
            <CardHeader>
              <CardTitle>Complete Pipeline Flow</CardTitle>
              <CardDescription>
                {flowConfig.flowDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Phase 1: XML Pipeline */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={currentPhase === 'xml' ? 'default' : 'outline'} className="text-xs">
                    Phase 1
                  </Badge>
                  <span className="font-semibold text-sm">{flowConfig.phaseOneTitle}</span>
                </div>
                <div className="flex items-center justify-between overflow-x-auto pb-4 px-2">
                  {xmlSteps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
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

              {/* Phase Connector */}
              <div className="flex justify-center my-4">
                <div className={`
                  flex flex-col items-center p-3 rounded-lg border-2 border-dashed
                  ${currentPhase === 'roster' ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}
                `}>
                  <ArrowRight className={`h-6 w-6 rotate-90 ${currentPhase === 'roster' ? 'text-blue-500' : 'text-slate-400'}`} />
                  <span className="text-xs text-muted-foreground mt-1">{flowConfig.phaseConnectorLabel}</span>
                </div>
              </div>

              {/* Phase 2: Roster Posting */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={currentPhase === 'roster' ? 'default' : 'outline'} className="text-xs">
                    Phase 2
                  </Badge>
                  <span className="font-semibold text-sm">{flowConfig.phaseTwoTitle}</span>
                </div>
                <div className="flex items-center justify-between overflow-x-auto pb-4 px-2">
                  {rosterSteps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      {/* Step Card */}
                      <div
                        className={`
                          relative flex flex-col items-center p-3 rounded-lg border-2 min-w-[100px] transition-all duration-300
                          ${step.status === 'completed' ? 'border-green-500 bg-green-50' : ''}
                          ${step.status === 'active' ? 'border-blue-500 bg-blue-50 animate-pulse' : ''}
                          ${step.status === 'pending' ? 'border-slate-200 bg-slate-50' : ''}
                          ${step.status === 'error' ? 'border-red-500 bg-red-50' : ''}
                        `}
                      >
                        {/* Icon */}
                        <div
                          className={`
                            flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300
                            ${step.status === 'completed' ? 'bg-green-500 text-white' : ''}
                            ${step.status === 'active' ? 'bg-gradient-to-br from-blue-600 to-amber-500 text-white' : ''}
                            ${step.status === 'pending' ? 'bg-slate-200 text-slate-500' : ''}
                            ${step.status === 'error' ? 'bg-red-500 text-white' : ''}
                          `}
                        >
                          {step.status === 'active' ? (
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
                      </div>

                      {/* Arrow */}
                      {index < rosterSteps.length - 1 && (
                        <ArrowRight
                          className={`
                            h-4 w-4 mx-1 shrink-0
                            ${step.status === 'completed' ? 'text-green-500' : 'text-slate-300'}
                          `}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
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

          {/* Architecture Diagram */}
         {/* <Card>
            <CardHeader>
              <CardTitle>System Architecture</CardTitle>
              <CardDescription>
                {flowConfig.architectureDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-3 py-8 overflow-x-auto">
                {flowConfig.architectureNodes.map((node, index) => {
                  const NodeIcon = node.icon

                  return (
                    <div key={node.id} className="flex items-center gap-3">
                      <div className="flex flex-col items-center min-w-[80px]">
                        <div className={`h-14 w-14 rounded-xl ${node.colorClass} flex items-center justify-center text-white`}>
                          {NodeIcon ? (
                            <NodeIcon className="h-7 w-7" />
                          ) : (
                            <span className="font-bold text-sm">{node.token || 'N/A'}</span>
                          )}
                        </div>
                        <p className="mt-2 font-semibold text-xs">{node.label}</p>
                        <p className="text-xs text-muted-foreground">{node.subtitle}</p>
                      </div>

                      {index < flowConfig.architectureNodes.length - 1 && (
                        <ArrowRight className="h-5 w-5 text-slate-400 shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>  */}
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
                See live roster creation and either auto-post via pipeline or manually post in CE Broker.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Button onClick={handleStartPipeline} disabled={isRunning}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Full Pipeline
                </Button>
                <Button variant="secondary" onClick={handleStartRosterOnly} disabled={isRunning}>
                  <Zap className="h-4 w-4 mr-2" />
                  Start Roster Only
                </Button>
                <Button asChild variant="outline">
                  <a
                    href="https://providers.cebroker.com/#rosters/create/1291177"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Manual Post in CE Broker
                  </a>
                </Button>
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
                          {schedulerStatus.nextRun}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-sm text-muted-foreground">Last Run</span>
                        <span className="text-sm font-medium">
                          {schedulerStatus.lastRun || 'Never'}
                        </span>
                      </div>
                    </div>

                    {schedulerStatus.isRunning && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-sm text-blue-800 font-medium">
                          Pipeline is currently running...
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={async () => {
                        await fetch(apiUrl('/api/roster-pipeline/scheduler/run-now'), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ dryRun: schedulerStatus.dryRun }),
                        })
                      }}
                      disabled={schedulerStatus.isRunning}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Run Now
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => {
                        fetch(apiUrl('/api/roster-pipeline/scheduler'))
                          .then(res => res.json())
                          .then(setSchedulerStatus)
                          .catch(console.error)
                      }}
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
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(entry.started_at).toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {entry.total_completions} completions processed
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-green-600">{entry.successful}</p>
                          <p className="text-xs text-muted-foreground">Success</p>
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
