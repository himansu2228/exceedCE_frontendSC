import { useState, useEffect, useRef, useCallback } from 'react'
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
import { getSCCourses, type Course } from '@/lib/api'

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
}

// ============== Initial Pipeline Steps ==============

// Combined pipeline steps: XML Pipeline → Roster Posting
const getInitialSteps = (): PipelineStep[] => [
  // Phase 1: XML Pipeline (Data Preparation)
  {
    id: 1,
    name: 'Fetch Courses',
    description: 'Pull courses from ExceedCE API',
    icon: Database,
    status: 'pending',
    count: 0,
    phase: 'xml',
  },
  {
    id: 2,
    name: 'Filter SC',
    description: 'Filter South Carolina mapped courses',
    icon: Filter,
    status: 'pending',
    count: 0,
    phase: 'xml',
  },
  {
    id: 3,
    name: 'Get Completions',
    description: 'Fetch completed students per course',
    icon: Users,
    status: 'pending',
    count: 0,
    progress: 0,
    phase: 'xml',
  },
  {
    id: 4,
    name: 'Resolve Attendees',
    description: 'Match licenses and validate data',
    icon: FileCheck,
    status: 'pending',
    count: 0,
    phase: 'xml',
  },
  // Phase 2: Roster Posting (Browser Automation)
  {
    id: 5,
    name: 'Check VPN',
    description: 'Verify LLR SC access',
    icon: Shield,
    status: 'pending',
    phase: 'roster',
  },
  {
    id: 6,
    name: 'Lookup Profession',
    description: 'Get profession from LLR SC',
    icon: Globe,
    status: 'pending',
    phase: 'roster',
  },
  {
    id: 7,
    name: 'Login CE Broker',
    description: 'Authenticate to portal',
    icon: LogIn,
    status: 'pending',
    phase: 'roster',
  },
  {
    id: 8,
    name: 'Create Roster',
    description: 'Fill roster form',
    icon: FileEdit,
    status: 'pending',
    phase: 'roster',
  },
  {
    id: 9,
    name: 'Post Roster',
    description: 'Submit to CE Broker',
    icon: Send,
    status: 'pending',
    phase: 'roster',
  },
  {
    id: 10,
    name: 'Complete',
    description: 'Pipeline finished',
    icon: CheckCircle2,
    status: 'pending',
    phase: 'roster',
  },
]

// ============== Main Component ==============

export function CEBrokerPipelinePage() {
  // Pipeline state
  const [isRunning, setIsRunning] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [mode, setMode] = useState('test')
  const [selectedCourses, setSelectedCourses] = useState<string>('all')
  const [sinceDate, setSinceDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  
  // Dynamic SC courses from API
  const [scCourses, setScCourses] = useState<Course[]>([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  
  // Pipeline steps state
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(getInitialSteps())
  
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
  
  // Last run timestamp
  const [lastRun, setLastRun] = useState<Date | null>(null)
  
  // Error state
  const [error, setError] = useState<string | null>(null)
  
  // SSE connection refs (one for each pipeline)
  const xmlEventSourceRef = useRef<EventSource | null>(null)
  const rosterEventSourceRef = useRef<EventSource | null>(null)

  // ============== Load Initial Data ==============

  // Load SC courses from API
  useEffect(() => {
    const loadCourses = async () => {
      try {
        setLoadingCourses(true)
        const courses = await getSCCourses()
        setScCourses(courses)
      } catch (error) {
        console.error('Failed to load SC courses:', error)
      } finally {
        setLoadingCourses(false)
      }
    }
    loadCourses()
  }, [])

  // Load scheduler status and history
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load scheduler status
        const schedRes = await fetch('/api/roster-pipeline/scheduler')
        if (schedRes.ok) {
          setSchedulerStatus(await schedRes.json())
        }
        
        // Load history
        const histRes = await fetch('/api/roster-pipeline/history')
        if (histRes.ok) {
          setHistory(await histRes.json())
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }
    loadData()
  }, [])

  // ============== Pipeline Step Management ==============

  // Update pipeline step
  const updateStep = useCallback((stepId: number, updates: Partial<PipelineStep>) => {
    setPipelineSteps(prev => 
      prev.map(step => step.id === stepId ? { ...step, ...updates } : step)
    )
  }, [])

  // Reset pipeline
  const resetPipeline = useCallback(() => {
    setPipelineSteps(getInitialSteps())
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
  }, [])

  // ============== SSE Connection Management ==============

  // Connect to XML Pipeline SSE
  const connectXmlSSE = useCallback(() => {
    if (xmlEventSourceRef.current) {
      xmlEventSourceRef.current.close()
    }

    const es = new EventSource('/api/pipeline/events')
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

    const es = new EventSource('/api/roster-pipeline/events')
    rosterEventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'step-change':
            // Map roster step IDs (1-8) to unified step IDs (5-10)
            const unifiedStepId = data.stepId + 4 // Offset by XML steps
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
            }
            // Mark all steps as completed
            setPipelineSteps(prev => 
              prev.map(step => ({ ...step, status: 'completed' }))
            )
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
  }, [])

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (xmlEventSourceRef.current) {
        xmlEventSourceRef.current.close()
      }
      if (rosterEventSourceRef.current) {
        rosterEventSourceRef.current.close()
      }
    }
  }, [])

  // ============== Pipeline Control ==============

  // Start Roster Phase (called after XML phase completes)
  const startRosterPhase = async () => {
    connectRosterSSE()
    
    try {
      await fetch('/api/roster-pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sinceDate: sinceDate || undefined,
          dryRun,
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
      
      await fetch('/api/pipeline/start', {
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
        fetch('/api/pipeline/stop', { method: 'POST' }),
        fetch('/api/roster-pipeline/stop', { method: 'POST' }),
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
      const res = await fetch('/api/roster-pipeline/scheduler/update', {
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

  // ============== Render ==============

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Workflow className="h-8 w-8 text-blue-500" />
            CE Broker Pipeline
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete automation: ExceedCE → XML Processing → Roster Posting → CE Broker
          </p>
        </div>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
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
                      Full pipeline: Data fetch → Processing → Roster Posting
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
                        <SelectItem value="all">All SC Courses ({scCourses.length})</SelectItem>
                        {scCourses.map((course) => (
                          <SelectItem key={course.id} value={String(course.id)}>
                            {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Completions Since</Label>
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
                      Ensure VPN is connected for LLR SC lookup.
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
                  <a
                    href="https://verify.llronline.com/LicLookup/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    LLR SC License Lookup
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
                Full workflow: ExceedCE Data → XML Processing → Roster Posting → CE Broker
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Phase 1: XML Pipeline */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={currentPhase === 'xml' ? 'default' : 'outline'} className="text-xs">
                    Phase 1
                  </Badge>
                  <span className="font-semibold text-sm">Data Processing (XML Pipeline)</span>
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
                  <span className="text-xs text-muted-foreground mt-1">Browser Automation</span>
                </div>
              </div>

              {/* Phase 2: Roster Posting */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={currentPhase === 'roster' ? 'default' : 'outline'} className="text-xs">
                    Phase 2
                  </Badge>
                  <span className="font-semibold text-sm">Roster Posting (Browser Automation)</span>
                </div>
                <div className="flex items-center justify-between overflow-x-auto pb-4 px-2">
                  {rosterSteps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      {/* Step Card */}
                      <div
                        className={`
                          relative flex flex-col items-center p-3 rounded-lg border-2 min-w-[100px] transition-all duration-300
                          ${step.status === 'completed' ? 'border-green-500 bg-green-50' : ''}
                          ${step.status === 'active' ? 'border-purple-500 bg-purple-50 animate-pulse' : ''}
                          ${step.status === 'pending' ? 'border-slate-200 bg-slate-50' : ''}
                          ${step.status === 'error' ? 'border-red-500 bg-red-50' : ''}
                        `}
                      >
                        {/* Icon */}
                        <div
                          className={`
                            flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300
                            ${step.status === 'completed' ? 'bg-green-500 text-white' : ''}
                            ${step.status === 'active' ? 'bg-purple-500 text-white' : ''}
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
          <Card>
            <CardHeader>
              <CardTitle>System Architecture</CardTitle>
              <CardDescription>
                Complete data flow from ExceedCE to CE Broker
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-3 py-8 overflow-x-auto">
                {/* ExceedCE */}
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className="h-14 w-14 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                    ECE
                  </div>
                  <p className="mt-2 font-semibold text-xs">ExceedCE</p>
                  <p className="text-xs text-muted-foreground">Data Source</p>
                </div>

                <ArrowRight className="h-5 w-5 text-slate-400 shrink-0" />

                {/* XML Pipeline */}
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className="h-14 w-14 rounded-xl bg-indigo-500 flex items-center justify-center text-white">
                    <Database className="h-7 w-7" />
                  </div>
                  <p className="mt-2 font-semibold text-xs">XML Pipeline</p>
                  <p className="text-xs text-muted-foreground">Processing</p>
                </div>

                <ArrowRight className="h-5 w-5 text-slate-400 shrink-0" />

                {/* LLR SC */}
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className="h-14 w-14 rounded-xl bg-orange-500 flex items-center justify-center text-white">
                    <Globe className="h-7 w-7" />
                  </div>
                  <p className="mt-2 font-semibold text-xs">LLR SC</p>
                  <p className="text-xs text-muted-foreground">Profession Lookup</p>
                </div>

                <ArrowRight className="h-5 w-5 text-slate-400 shrink-0" />

                {/* Browser */}
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className="h-14 w-14 rounded-xl bg-purple-500 flex items-center justify-center text-white">
                    <Monitor className="h-7 w-7" />
                  </div>
                  <p className="mt-2 font-semibold text-xs">Puppeteer</p>
                  <p className="text-xs text-muted-foreground">Browser Bot</p>
                </div>

                <ArrowRight className="h-5 w-5 text-slate-400 shrink-0" />

                {/* CE Broker */}
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className="h-14 w-14 rounded-xl bg-green-500 flex items-center justify-center text-white font-bold text-sm">
                    CEB
                  </div>
                  <p className="mt-2 font-semibold text-xs">CE Broker</p>
                  <p className="text-xs text-muted-foreground">Roster Posted</p>
                </div>
              </div>
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
                        await fetch('/api/roster-pipeline/scheduler/run-now', {
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
                        fetch('/api/roster-pipeline/scheduler')
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
