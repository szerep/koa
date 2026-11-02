import { useEffect, useState } from 'react'
import { msUntilNextDay } from './format'

/**
 * A timestamp that stays on the current local day: it refreshes at midnight and whenever the
 * app comes back into view, so "today" and the 7-day window roll over without a reload.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setTimeout(() => setNow(Date.now()), msUntilNextDay(now) + 50)
    return () => window.clearTimeout(id)
  }, [now])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [])

  return now
}
