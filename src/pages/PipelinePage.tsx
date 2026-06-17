import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
  Send,
  CheckCircle2,
  ArrowRight,
  Zap,
  Settings,
  Loader2,
} from 'lucide-react'
import { getSCCourses, apiUrl, type Course } from '@/lib/api'

// Pipeline step type
interface PipelineStep {
  id: number
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  status: 'pending' | 'active' | 'completed' | 'error'
  count: number
  progress?: number
}

// Initial pipeline steps
const getInitialSteps = (): PipelineStep[] => [
  {
    id: 1,
    name: 'Fetch Courses',
    description: 'Pull courses from ExceedCE API',
    icon: Database,
    status: 'pending',
    count: 0,
  },
  {
    id: 2,
    name: 'Filter SC',
    description: 'Filter South Carolina mapped courses',
    icon: Filter,
    status: 'pending',
    count: 0,
  },
  {
    id: 3,
    name: 'Get Completions',
    description: 'Fetch completed students per course',
    icon: Users,
    status: 'pending',
    count: 0,
    progress: 0,
  },
  {
    id: 4,
    name: 'Resolve Attendees',
    description: 'Match licenses and professions',
    icon: FileCheck,
    status: 'pending',
    count: 0,
  },
  {
    id: 5,
    name: 'Submit to CE Broker',
    description: 'POST roster XML to CE Broker',
    icon: Send,
    status: 'pending',
    count: 0,
  },
  {
    id: 6,
    name: 'Record Results',
    description: 'Save to submissions ledger',
    icon: CheckCircle2,
    status: 'pending',
    count: 0,
  },
]

// Processing stats type
interface ProcessingStats {
  currentCourse: string
  courseIndex: number
  totalCourses: number
  currentStudent: string
  studentIndex: number
  totalStudents: number
  submitted: number
  failed: number
  skipped: number
  duplicate: number
}

export function PipelinePage() {
  const [isRunning, setIsRunning] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [mode, setMode] = useState('test')
  const [selectedCourses, setSelectedCourses] = useState<string>('all')
  const [sinceDate, setSinceDate] = useState('')
  
  // Dynamic SC courses from API
  const [scCourses, setScCourses] = useState<Course[]>([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  
  // Pipeline steps state (dynamic)
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(getInitialSteps())
  
  // Processing stats
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({
    currentCourse: '',
    courseIndex: 0,
    totalCourses: 0,
    currentStudent: '',
    studentIndex: 0,
    totalStudents: 0,
    submitted: 0,
    failed: 0,
    skipped: 0,
    duplicate: 0,
  })
  
  // Last run timestamp
  const [lastRun, setLastRun] = useState<Date | null>(null)
  
  // SSE connection ref
  const eventSourceRef = useRef<EventSource | null>(null)

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
      submitted: 0,
      failed: 0,
      skipped: 0,
      duplicate: 0,
    })
  }, [])

  // Connect to SSE for pipeline updates
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource(apiUrl('/api/pipeline/events'))
    eventSourceRef.current = es

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
            setIsRunning(false)
            setLastRun(new Date())
            break
        }
      } catch (err) {
        console.error('SSE parse error:', err)
      }
    }

    es.onerror = () => {
      console.error('SSE connection error')
      es.close()
      eventSourceRef.current = null
    }
  }, [updateStep])

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const handleStartPipeline = async () => {
    resetPipeline()
    setIsRunning(true)
    connectSSE()
    
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
        }),
      })
    } catch (error) {
      console.error('Failed to start pipeline:', error)
      setIsRunning(false)
    }
  }

  const handleStopPipeline = async () => {
    try {
      await fetch(apiUrl('/api/pipeline/stop'), { method: 'POST' })
    } catch (error) {
      console.error('Failed to stop pipeline:', error)
    }
    
    setIsRunning(false)
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
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

  return (
    <div className="space-y-6 animate-fadeIn">
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
                  Configure and run the SC CE Broker submission pipeline
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

            {/* Mode Warning */}
            {mode === 'live' && !dryRun && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800 font-medium">
                  ⚠️ Live Submission Mode Active
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Running the pipeline will POST real data to CE Broker. Please verify your configuration.
                </p>
              </div>
            )}
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
              <span className="text-sm text-muted-foreground">Provider ID</span>
              <code className="text-sm bg-slate-100 px-2 py-1 rounded">32093</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Run</span>
              <span className="text-sm">{formatLastRun()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Flow</CardTitle>
          <CardDescription>
            Visual representation of the ExceedCE → CE Broker data pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between overflow-x-auto pb-4">
            {pipelineSteps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                {/* Step Card */}
                <div
                  className={`
                    relative flex flex-col items-center p-4 rounded-lg border-2 min-w-[140px] transition-all duration-300
                    ${step.status === 'completed' ? 'border-green-500 bg-green-50' : ''}
                    ${step.status === 'active' ? 'border-blue-500 bg-blue-50 animate-pulse' : ''}
                    ${step.status === 'pending' ? 'border-slate-200 bg-slate-50' : ''}
                    ${step.status === 'error' ? 'border-red-500 bg-red-50' : ''}
                  `}
                >
                  {/* Icon */}
                  <div
                    className={`
                      flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300
                      ${step.status === 'completed' ? 'bg-green-500 text-white' : ''}
                      ${step.status === 'active' ? 'bg-blue-500 text-white' : ''}
                      ${step.status === 'pending' ? 'bg-slate-200 text-slate-500' : ''}
                      ${step.status === 'error' ? 'bg-red-500 text-white' : ''}
                    `}
                  >
                    {step.status === 'active' ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <step.icon className="h-6 w-6" />
                    )}
                  </div>

                  {/* Step Info */}
                  <div className="mt-3 text-center">
                    <p className="font-semibold text-sm">{step.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>

                  {/* Count Badge */}
                  {step.count > 0 && (
                    <Badge
                      variant={step.status === 'completed' ? 'success' : step.status === 'error' ? 'destructive' : 'secondary'}
                      className="mt-2"
                    >
                      {step.count} items
                    </Badge>
                  )}

                  {/* Progress Bar */}
                  {step.status === 'active' && typeof step.progress === 'number' && (
                    <div className="w-full mt-2">
                      <Progress value={step.progress} className="h-2" />
                      <p className="text-xs text-center mt-1 text-blue-600">
                        {Math.round(step.progress)}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                {index < pipelineSteps.length - 1 && (
                  <ArrowRight
                    className={`
                      h-6 w-6 mx-2 shrink-0
                      ${step.status === 'completed' ? 'text-green-500' : 'text-slate-300'}
                    `}
                  />
                )}
              </div>
            ))}
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
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Current Course: {processingStats.currentCourse || 'Initializing...'}</span>
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
                  <span>Current Student: {processingStats.currentStudent || 'Waiting...'}</span>
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

      {/* Pipeline Architecture Diagram */}
      <Card>
        <CardHeader>
          <CardTitle>System Architecture</CardTitle>
          <CardDescription>
            How data flows from ExceedCE to CE Broker
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-8">
            {/* ExceedCE */}
            <div className="flex flex-col items-center">
              <div className="h-20 w-20 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold">
                ECE
              </div>
              <p className="mt-2 font-semibold">ExceedCE</p>
              <p className="text-xs text-muted-foreground">Course Platform</p>
            </div>

            <ArrowRight className="h-8 w-8 text-slate-400" />

            {/* Pipeline */}
            <div className="flex flex-col items-center">
              <div className="h-20 w-20 rounded-xl bg-purple-500 flex items-center justify-center text-white">
                <Zap className="h-10 w-10" />
              </div>
              <p className="mt-2 font-semibold">SC Pipeline</p>
              <p className="text-xs text-muted-foreground">Transform & Submit</p>
            </div>

            <ArrowRight className="h-8 w-8 text-slate-400" />

            {/* CE Broker */}
            <div className="flex flex-col items-center">
              <div className="h-20 w-20 rounded-xl bg-green-500 flex items-center justify-center text-white font-bold">
                CEB
              </div>
              <p className="mt-2 font-semibold">CE Broker</p>
              <p className="text-xs text-muted-foreground">SC License Board</p>
            </div>

            <ArrowRight className="h-8 w-8 text-slate-400" />

            {/* Ledger */}
            <div className="flex flex-col items-center">
              <div className="h-20 w-20 rounded-xl bg-slate-700 flex items-center justify-center text-white">
                <Database className="h-10 w-10" />
              </div>
              <p className="mt-2 font-semibold">Ledger</p>
              <p className="text-xs text-muted-foreground">submissions.json</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
