import { useEffect, useState } from 'react'
import { getActiveState, getTenantAccessProfile } from '@/lib/auth'
import { toPipelineStateCode, type PipelineStateCode } from '@/lib/ceBrokerPipeline'
import { CEBrokerPipelinePage } from '@/pages/CEBrokerPipelinePage'

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

  return <CEBrokerPipelinePage forcedStateCode={activeStateCode} />
}
