import type { TimerState } from './engine'

/**
 * Whether the screen should be kept on (Phase 8, Step 8): only while the setting is on and a
 * focus session is actually counting down. Breaks, paused and waiting sessions never qualify,
 * and neither does a running session whose end time has already passed (it's about to complete;
 * this also covers coming back to the app after the session ended while it was away).
 */
export function shouldKeepScreenOn(timer: TimerState, enabled: boolean, now: number): boolean {
  return (
    enabled &&
    timer.mode === 'focus' &&
    timer.status === 'running' &&
    timer.endsAt !== null &&
    now < timer.endsAt
  )
}
