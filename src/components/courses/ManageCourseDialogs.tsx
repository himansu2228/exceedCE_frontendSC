import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, GraduationCap, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  addManagedCourse,
  getCourseCatalogCandidates,
  removeManagedCourse,
  type CatalogCourseCandidate,
  type ManagedCourse,
} from '@/lib/api'
import { cn } from '@/lib/utils'

function matchesAllKeywords(value: string, query: string) {
  const haystack = value.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((keyword) => haystack.includes(keyword))
}

interface AddCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stateName: string
  onAdded: (course: ManagedCourse) => void
}

export function AddCourseDialog({ open, onOpenChange, stateName, onAdded }: AddCourseDialogProps) {
  const [saving, setSaving] = useState(false)

  // DialogContent unmounts when closed, so the form starts fresh every time it opens.
  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <AddCourseForm
          stateName={stateName}
          saving={saving}
          setSaving={setSaving}
          onCancel={() => onOpenChange(false)}
          onAdded={(course) => {
            onAdded(course)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

interface AddCourseFormProps {
  stateName: string
  saving: boolean
  setSaving: (saving: boolean) => void
  onCancel: () => void
  onAdded: (course: ManagedCourse) => void
}

function AddCourseForm({ stateName, saving, setSaving, onCancel, onAdded }: AddCourseFormProps) {
  const [candidates, setCandidates] = useState<CatalogCourseCandidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(true)
  const [candidatesError, setCandidatesError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CatalogCourseCandidate | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualName, setManualName] = useState('')
  const [cebId, setCebId] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getCourseCatalogCandidates()
      .then((list) => {
        if (!cancelled) setCandidates(list)
      })
      .catch((err) => {
        if (cancelled) return
        setCandidatesError(err instanceof Error ? err.message : 'Could not load the ExceedCE course catalog')
        setManualMode(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingCandidates(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(
    () => (search.trim() ? candidates.filter((course) => matchesAllKeywords(course.name, search)) : candidates),
    [candidates, search]
  )
  const suggested = filtered.filter((course) => course.suggested)
  const others = filtered.filter((course) => !course.suggested)

  const courseName = manualMode ? manualName.trim() : selected?.name || ''
  const cebIdValid = /^\d{3,12}$/.test(cebId)
  const canSubmit = Boolean(courseName) && cebIdValid && !saving

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const result = await addManagedCourse({
        name: courseName,
        id_course: cebId,
        exceed_course_id: manualMode ? null : selected?.id ?? null,
      })
      onAdded(result.course)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add course')
    } finally {
      setSaving(false)
    }
  }

  const renderGroup =  (title: string, items: CatalogCourseCandidate[]) => {
    if (items.length === 0) return null
    return (
      <div>
        <p className="sticky top-0 z-10 bg-slate-50/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur">
          {title} ({items.length})
        </p>
        <ul className="divide-y divide-slate-100">
          {items.map((course) => {
            const isSelected = selected?.id === course.id
            return (
              <li key={course.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(course)
                    setError(null)
                  }}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                    isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                    )}
                  >
                    {isSelected && <CheckCircle2 className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium">{course.name}</span>
                    <span className="text-xs text-slate-500">ExceedCE course #{course.id}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <>
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/60 px-6 py-5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-600" />
            Add state-approved course
          </DialogTitle>
          <DialogDescription className="pt-1">
            Once {stateName} approves a course, add it here with its CE Broker course ID. New completions of the course
            are then reported to CE Broker automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={manualMode ? 'add-course-manual-name' : 'add-course-search'}>1. ExceedCE course</Label>
              {!candidatesError && (
                <button
                  type="button"
                  className="text-xs font-medium text-blue-700 hover:underline"
                  onClick={() => {
                    setManualMode((value) => !value)
                    setError(null)
                  }}
                >
                  {manualMode ? 'Pick from the ExceedCE catalog' : "Can't find it? Enter the name manually"}
                </button>
              )}
            </div>

            {manualMode ? (
              <div className="space-y-1.5">
                <Input
                  id="add-course-manual-name"
                  placeholder="e.g. SC Fair Housing Update"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the title exactly as it appears in ExceedCE. Completions are matched to the course by this title.
                </p>
                {candidatesError && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {candidatesError}
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="relative border-b border-slate-200 bg-white">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="add-course-search"
                    placeholder="Search ExceedCE courses (e.g. fair housing)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-none border-0 pl-9 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    autoFocus
                  />
                </div>
                <div className="h-64 overflow-y-auto bg-white">
                  {loadingCandidates ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading ExceedCE courses...
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center text-sm text-muted-foreground">
                      <p>No matching courses that aren't already in the list.</p>
                      <button type="button" className="text-xs font-medium text-blue-700 hover:underline" onClick={() => setManualMode(true)}>
                        Enter the course name manually
                      </button>
                    </div>
                  ) : (
                    <>
                      {renderGroup(`Suggested ${stateName} courses`, suggested)}
                      {renderGroup('Other ExceedCE courses', others)}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-course-ceb-id">2. CE Broker course ID</Label>
            <Input
              id="add-course-ceb-id"
              inputMode="numeric"
              placeholder="e.g. 942523"
              value={cebId}
              onChange={(e) => {
                setCebId(e.target.value.replace(/\D/g, '').slice(0, 12))
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSubmit()
              }}
              className="max-w-xs font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The numeric course ID from the course's approval in CE Broker.
            </p>
          </div>

          {courseName && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">Will be added</p>
              <p className="mt-1 break-words font-medium text-slate-900">{courseName}</p>
              <p className="mt-0.5 text-xs text-slate-600">
                CE Broker ID: <span className="font-mono">{cebId || '—'}</span>
              </p>
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="flex shrink-0 items-start gap-2 border-t border-red-200 bg-red-50 px-6 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add course
          </Button>
        </DialogFooter>
    </>
  )
}

interface RemoveCourseDialogProps {
  course: { name: string; ceb_course_id?: string | null } | null
  stateName: string
  onOpenChange: (open: boolean) => void
  onRemoved: (course: ManagedCourse) => void
}

export function RemoveCourseDialog({ course, stateName, onOpenChange, onRemoved }: RemoveCourseDialogProps) {
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setError(null)
    onOpenChange(false)
  }

  const handleRemove = async () => {
    if (!course) return
    setRemoving(true)
    setError(null)
    try {
      const result = await removeManagedCourse(course.name)
      onRemoved(result.course)
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove course')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Dialog open={Boolean(course)} onOpenChange={(next) => !removing && !next && close()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            Remove course?
          </DialogTitle>
          <DialogDescription className="pt-1">
            New completions of this course will no longer be reported to CE Broker for {stateName}. Past submissions are
            kept, and you can add the course again at any time.
          </DialogDescription>
        </DialogHeader>

        {course && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="break-words text-sm font-medium text-slate-900">{course.name}</p>
            {course.ceb_course_id && (
              <Badge variant="outline" className="mt-1.5 font-mono text-xs">
                CE Broker ID {course.ceb_course_id}
              </Badge>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close} disabled={removing}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={removing}>
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remove course
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
