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
  Play,
  Pause,
  RefreshCw,
  Globe,
  Search,
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
} from 'lucide-react'
import { apiUrl } from '@/lib/api'

// Roster Pipeline step type
interface RosterPipelineStep {
  id: number
  name: string
  description: string
  status: 'pending' | 'active' | 'completed' | 'error'
}

// Initial pipeline steps for roster posting
const getInitialSteps = (): RosterPipelineStep[] => [
  {
    id: 1,
    name: 'Initialize',
    description: 'Setup browser and connections',
    status: 'pending',
  },
  {
    id: 2,
    name: 'Fetch Completions',
    description: "Get today's course completions",
    status: 'pending',
  },
  {
    id: 3,
    name: 'Check VPN Access',
    description: 'Verify LLR SC site accessibility',
    status: 'pending',
  },
  {
    id: 4,
    name: 'Lookup Profession',
    description: 'Get profession from LLR SC',
    status: 'pending',
  },
  {
    id: 5,
    name: 'Login CE Broker',
    description: 'Authenticate to CE Broker portal',
    status: 'pending',
  },
  {
    id: 6,
    name: 'Create Roster',
    description: 'Fill roster form',
    status: 'pending',
  },
  {
    id: 7,
    name: 'Post Roster',
    description: 'Submit roster to CE Broker',
    status: 'pending',
  },
  {
    id: 8,
    name: 'Complete',
    description: 'Pipeline finished',
    status: 'pending',
  },
]

// Step icons mapping
const stepIcons: Record<number, React.ComponentType<{ className?: string }>> = {
  1: Settings,
  2: Search,
  3: Shield,
  4: Globe,
  5: LogIn,
  6: FileEdit,
  7: Send,
  8: CheckCircle2,
}

// Processing stats type
interface ProcessingStats {
  phase: string
  current: number
  total: number
  student: string
  licenseNumber: string
  profession: string
  successful: number
  failed: number
  skipped: number
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

export function RosterPipelinePage() {
  const [isRunning, setIsRunning] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [sinceDate, setSinceDate] = useState(() => {
    // Default to today's date
    return new Date().toISOString().split('T')[0]
  })
  
  // Pipeline steps state
  const [pipelineSteps, setPipelineSteps] = useState<RosterPipelineStep[]>(getInitialSteps())
  
  // Processing stats
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({
    phase: '',
    current: 0,
    total: 0,
    student: '',
    licenseNumber: '',
    profession: '',
    successful: 0,
    failed: 0,
    skipped: 0,
  })
  
  // Scheduler status
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
  
  // History
  const [history, setHistory] = useState<HistoryEntry[]>([])
  
  // Last run timestamp
  const [lastRun, setLastRun] = useState<Date | null>(null)
  
  // Error state
  const [error, setError] = useState<string | null>(null)
  
  // SSE connection ref
  const eventSourceRef = useRef<EventSource | null>(null)

  // Load scheduler status and history
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load scheduler status
        const schedRes = await fetch(apiUrl('/api/roster-pipeline/scheduler'))
        if (schedRes.ok) {
          setSchedulerStatus(await schedRes.json())
        }
        
        // Load history
        const histRes = await fetch(apiUrl('/api/roster-pipeline/history'))
        if (histRes.ok) {
          setHistory(await histRes.json())
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }
    loadData()
  }, [])

  // Reset pipeline
  const resetPipeline = useCallback(() => {
    setPipelineSteps(getInitialSteps())
    setProcessingStats({
      phase: '',
      current: 0,
      total: 0,
      student: '',
      licenseNumber: '',
      profession: '',
      successful: 0,
      failed: 0,
      skipped: 0,
    })
    setError(null)
  }, [])

  // Connect to SSE for pipeline updates
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource(apiUrl('/api/roster-pipeline/events'))
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'step-change':
            // Mark previous steps as completed if moving forward
            setPipelineSteps(prev => 
              prev.map(step => {
                if (step.id < data.stepId && step.status !== 'completed') {
                  return { ...step, status: 'completed' }
                }
                if (step.id === data.stepId) {
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
              current: data.current ?? prev.current,
              total: data.total ?? prev.total,
              student: data.student || prev.student,
              licenseNumber: data.licenseNumber || prev.licenseNumber,
              profession: data.profession || prev.profession,
            }))
            break
            
          case 'complete':
            setIsRunning(false)
            setLastRun(new Date())
            if (data.summary) {
              setProcessingStats(prev => ({
                ...prev,
                successful: data.summary.successful || 0,
                failed: data.summary.failed || 0,
                skipped: data.summary.skipped || 0,
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
  }, [])

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
      await fetch(apiUrl('/api/roster-pipeline/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sinceDate: sinceDate || undefined,
          dryRun,
        }),
      })
    } catch (err) {
      console.error('Failed to start pipeline:', err)
      setIsRunning(false)
      setError('Failed to start pipeline')
    }
  }

  const handleStopPipeline = async () => {
    try {
      await fetch(apiUrl('/api/roster-pipeline/stop'), { method: 'POST' })
    } catch (err) {
      console.error('Failed to stop pipeline:', err)
    }
    
    setIsRunning(false)
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }

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

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Monitor className="h-8 w-8 text-blue-500" />
            Roster Posting Pipeline
          </h1>
          <p className="text-muted-foreground mt-1">
            Automated browser workflow for CE Broker roster submission
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

        {/* Pipeline Tab */}
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
                      Browser automation for roster posting to CE Broker portal
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
                    <Label>Completions Since</Label>
                    <Input
                      type="date"
                      value={sinceDate}
                      onChange={(e) => setSinceDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                    />
                    <p className="text-xs text-muted-foreground">
                      Process completions from this date (default: today)
                    </p>
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
                        No actual browser actions or submissions
                      </span>
                    </Label>
                  </div>
                </div>

                {/* Live Mode Warning */}
                {!dryRun && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Live Mode Active</AlertTitle>
                    <AlertDescription>
                      Pipeline will perform real browser automation and post rosters to CE Broker.
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
                    href="https://verify.llronline.com/LicLookup/Rec/Rec.aspx?div=19"
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

          {/* Pipeline Flow Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Flow</CardTitle>
              <CardDescription>
                Browser automation workflow: Completions → LLR Lookup → CE Broker Post
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between overflow-x-auto pb-4">
                {pipelineSteps.map((step, index) => {
                  const IconComponent = stepIcons[step.id] || Settings
                  return (
                    <div key={step.id} className="flex items-center">
                      {/* Step Card */}
                      <div
                        className={`
                          relative flex flex-col items-center p-4 rounded-lg border-2 min-w-[120px] transition-all duration-300
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
                            <IconComponent className="h-5 w-5" />
                          )}
                        </div>

                        {/* Step Info */}
                        <div className="mt-2 text-center">
                          <p className="font-semibold text-xs">{step.name}</p>
                          <p className="text-xs text-muted-foreground mt-1 max-w-[100px]">
                            {step.description}
                          </p>
                        </div>
                      </div>

                      {/* Arrow */}
                      {index < pipelineSteps.length - 1 && (
                        <ArrowRight
                          className={`
                            h-5 w-5 mx-1 shrink-0
                            ${step.status === 'completed' ? 'text-green-500' : 'text-slate-300'}
                          `}
                        />
                      )}
                    </div>
                  )
                })}
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
                      <span>Phase: {processingStats.phase || 'Initializing...'}</span>
                      <span className="text-muted-foreground">
                        {processingStats.current} of {processingStats.total}
                      </span>
                    </div>
                    <Progress 
                      value={processingStats.total > 0 
                        ? (processingStats.current / processingStats.total) * 100 
                        : 0} 
                      className="h-2" 
                    />
                  </div>

                  {processingStats.student && (
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="font-semibold">Current Student</p>
                      <p className="text-sm text-muted-foreground">{processingStats.student}</p>
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

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{processingStats.successful}</p>
                      <p className="text-xs text-muted-foreground">Successful</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{processingStats.failed}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">{processingStats.skipped}</p>
                      <p className="text-xs text-muted-foreground">Skipped</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Architecture Diagram */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Architecture</CardTitle>
              <CardDescription>
                How data flows through the roster posting pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-4 py-8 overflow-x-auto">
                {/* ExceedCE */}
                <div className="flex flex-col items-center min-w-[100px]">
                  <div className="h-16 w-16 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold">
                    ECE
                  </div>
                  <p className="mt-2 font-semibold text-sm">ExceedCE</p>
                  <p className="text-xs text-muted-foreground">Completions</p>
                </div>

                <ArrowRight className="h-6 w-6 text-slate-400 shrink-0" />

                {/* LLR SC */}
                <div className="flex flex-col items-center min-w-[100px]">
                  <div className="h-16 w-16 rounded-xl bg-orange-500 flex items-center justify-center text-white">
                    <Globe className="h-8 w-8" />
                  </div>
                  <p className="mt-2 font-semibold text-sm">LLR SC</p>
                  <p className="text-xs text-muted-foreground">Profession Lookup</p>
                </div>

                <ArrowRight className="h-6 w-6 text-slate-400 shrink-0" />

                {/* Browser */}
                <div className="flex flex-col items-center min-w-[100px]">
                  <div className="h-16 w-16 rounded-xl bg-purple-500 flex items-center justify-center text-white">
                    <Monitor className="h-8 w-8" />
                  </div>
                  <p className="mt-2 font-semibold text-sm">Puppeteer</p>
                  <p className="text-xs text-muted-foreground">Browser Automation</p>
                </div>

                <ArrowRight className="h-6 w-6 text-slate-400 shrink-0" />

                {/* CE Broker */}
                <div className="flex flex-col items-center min-w-[100px]">
                  <div className="h-16 w-16 rounded-xl bg-green-500 flex items-center justify-center text-white font-bold">
                    CEB
                  </div>
                  <p className="mt-2 font-semibold text-sm">CE Broker</p>
                  <p className="text-xs text-muted-foreground">Roster Posted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduler Tab */}
        <TabsContent value="scheduler" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Daily Scheduler
              </CardTitle>
              <CardDescription>
                Configure automatic daily roster posting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {schedulerStatus ? (
                <>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <Label className="text-base font-semibold">Enable Scheduler</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically run the pipeline daily at the scheduled time
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
                        // Refresh scheduler status
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

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Pipeline Run History
              </CardTitle>
              <CardDescription>
                Recent roster posting pipeline executions
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
