import { useEffect, useState } from 'react'
import { modeLabels } from '../config/timerDefaults'
import { formatClock } from '../features/timer/format'
import { timerStore } from '../features/timer/store'
import { useTimer } from '../features/timer/useTimer'

/**
 * App-wide timer side effects: the countdown for the tab title while a session runs (App sets
 * the title, so the tab's own title comes back when it stops), the chrome dims during focus, and
 * finished sessions are announced to screen readers.
 */
export function useTimerAmbience() {
  const { state, remainingMs } = useTimer()
  const [announcement, setAnnouncement] = useState('')
  const running = state.status === 'running'

  const countdown = running ? `${formatClock(remainingMs / 1000)} ${modeLabels[state.mode]}` : null

  useEffect(
    () =>
      timerStore.onEvent((event) => {
        if (event.type !== 'sessionCompleted') return
        const next = modeLabels[timerStore.getState().mode].toLowerCase()
        setAnnouncement(
          event.mode === 'focus'
            ? `Focus session complete. Your ${next} is ready.`
            : `Break's over. Ready to focus when you are.`,
        )
      }),
    [],
  )

  return { focusRunning: running && state.mode === 'focus', announcement, countdown }
}
