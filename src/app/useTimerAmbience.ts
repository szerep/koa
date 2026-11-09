import { useEffect, useState } from 'react'
import { modeLabels } from '../config/timerDefaults'
import { formatClock } from '../features/timer/format'
import { timerStore } from '../features/timer/store'
import { useTimer } from '../features/timer/useTimer'

const BASE_TITLE = 'Koa'

/**
 * App-wide timer side effects: the tab title shows the countdown while a session runs,
 * the chrome dims during focus, and finished sessions are announced to screen readers.
 */
export function useTimerAmbience() {
  const { state, remainingMs } = useTimer()
  const [announcement, setAnnouncement] = useState('')
  const running = state.status === 'running'

  const title = running ? `${formatClock(remainingMs / 1000)} ${modeLabels[state.mode]} · ${BASE_TITLE}` : BASE_TITLE
  useEffect(() => {
    document.title = title
  }, [title])

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

  return { focusRunning: running && state.mode === 'focus', announcement }
}
