import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType } from 'react'
import { Loader2 } from 'lucide-react'
import { getActiveState, getTenantAccessProfile } from '@/lib/auth'
import { toPipelineStateCode, type PipelineStateCode } from '@/lib/ceBrokerPipeline'

const moduleLoaders: Record<PipelineStateCode, () => Promise<{ default: ComponentType }>> = {
  SC: () => import('./modules/CEBrokerPipelineSC'),
  HI: () => import('./modules/CEBrokerPipelineHI'),
  NC: () => import('./modules/CEBrokerPipelineNC'),
  NV: () => import('./modules/CEBrokerPipelineNV'),
  MI: () => import('./modules/CEBrokerPipelineMI'),
  MO: () => import('./modules/CEBrokerPipelineMO'),
}

export function CEBrokerPipelineStateHostPage() {
  const [activeStateCode, setActiveStateCode] = useState<PipelineStateCode>(() => {
    const initial = getActiveState() || getTenantAccessProfile().stateCode || 'SC'
    return toPipelineStateCode(initial)
  })

  useEffect(() => {
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
  }, [])

  const ActivePipelineModule = useMemo(() => {
    return lazy(moduleLoaders[activeStateCode])
  }, [activeStateCode])

  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading pipeline module...</span>
        </div>
      }
    >
      <ActivePipelineModule key={activeStateCode} />
    </Suspense>
  )
}
