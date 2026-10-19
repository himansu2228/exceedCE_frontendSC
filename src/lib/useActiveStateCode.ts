import { useEffect, useState } from 'react'
import { getTenantAccessProfile, normalizeStateCode } from '@/lib/auth'

function readActiveStateCode() {
  return normalizeStateCode(getTenantAccessProfile().stateCode || 'SC')
}

// Tracks the dashboard's active state (sidebar selector), including changes from other tabs.
export function useActiveStateCode(): string {
  const [stateCode, setStateCode] = useState(readActiveStateCode)

  useEffect(() => {
    const sync = () => {
      const next = readActiveStateCode()
      setStateCode((previous) => (previous === next ? previous : next))
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'exceedce-active-state') sync()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('exceedce:active-state-changed', sync as EventListener)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('exceedce:active-state-changed', sync as EventListener)
    }
  }, [])

  return stateCode
}
