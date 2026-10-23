import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { ClassEmailPreview } from '@/lib/api'

interface ClassEmailPreviewDialogProps {
  open: boolean
  loading: boolean
  error: string | null
  preview: ClassEmailPreview | null
  onClose: () => void
}

export function ClassEmailPreviewDialog({ open, loading, error, preview, onClose }: ClassEmailPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Instructor email preview</DialogTitle>
          <DialogDescription>
            {preview ? `This is the roster email for ${preview.classTitle}. Nothing has been sent.` : 'Building the roster email.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {preview ? (
          <div className="space-y-3">
            <div className="space-y-1 rounded-lg border bg-slate-50/60 p-3 text-xs text-slate-700">
              <p><span className="font-semibold">To:</span> {preview.to.length > 0 ? preview.to.join(', ') : 'No instructor email configured'}</p>
              {preview.cc.length > 0 ? <p><span className="font-semibold">Cc:</span> {preview.cc.join(', ')}</p> : null}
              <p><span className="font-semibold">Subject:</span> {preview.subject}</p>
              {preview.attachments.map((attachment) => (
                <p key={attachment.filename}>
                  <span className="font-semibold">Attachment:</span> {attachment.filename} ({Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB)
                </p>
              ))}
            </div>
            {!preview.hasRecipient ? (
              <p className="text-xs font-medium text-amber-700">No instructor email is configured for this class, so the email would not be sent.</p>
            ) : null}
            <iframe
              title="Instructor roster email preview"
              sandbox=""
              srcDoc={preview.html}
              className="h-[28rem] w-full rounded-lg border bg-white"
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
