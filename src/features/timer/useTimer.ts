import { useEffect, useState, useSyncExternalStore } from 'react'
import { progress, remainingMs } from '../../core/timer/engine'
import { timerStore } from './store'

const TICK_MS = 250

/** Timer state plus a clock that ticks only while a session runs. */
export function useTimer() {
  const state = useSyncExternalStore(timerStore.subscribe, timerStore.getState)
  const [now, setNow] = useState(() => Date.now())
  const running = state.status === 'running'

  // Catch up on launch and whenever the app comes back (tab switch, unlock, bfcache restore).
  useEffect(() => {
    const catchUp = () => {
      timerStore.sync()
      setNow(Date.now())
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') catchUp()
    }
    const id = window.setTimeout(catchUp, 0)
    // Re-read the clock on every transition (start/resume), so the display never lags a tap.
    const unsubscribe = timerStore.subscribe(() => setNow(Date.now()))
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', catchUp)
    window.addEventListener('pageshow', catchUp)
    return () => {
      window.clearTimeout(id)
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', catchUp)
      window.removeEventListener('pageshow', catchUp)
    }
  }, [])

  // The interval only re-renders and checks for completion; time comes from timestamps.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setNow(Date.now())
      timerStore.sync()
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [running])

  return {
    state,
    remainingMs: remainingMs(state, now),
    progress: progress(state, now),
    toggle: timerStore.toggle,
    reset: timerStore.reset,
    skip: timerStore.skip,
    selectMode: timerStore.selectMode,
  }
}
