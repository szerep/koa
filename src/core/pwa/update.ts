import type { TimerState } from '../timer/engine'

/**
 * Whether Koa may offer a new version right now (Phase 9, Step 4; decision D3). Focus is sacred:
 * never while a focus session is running. Everything else is fine, including a paused focus
 * session and breaks, because the timer is timestamp-based and survives the reload.
 */
export function shouldOfferUpdate(timer: Pick<TimerState, 'mode' | 'status'>): boolean {
  return !(timer.mode === 'focus' && timer.status === 'running')
}

export interface UpdateCheckInput {
  /** When Koa last asked the browser to check for a new version, or null if it never has. */
  lastCheckAt: number | null
  now: number
  /** `navigator.onLine`. Offline checks are skipped (and don't count as a check). */
  online: boolean
  intervalMs: number
}

/**
 * Whether to look for a new version now: online, and never more than once per interval. A clock
 * that moved backwards (`now` before the last check) allows a check, so Koa can't get stuck.
 */
export function isUpdateCheckDue({ lastCheckAt, now, online, intervalMs }: UpdateCheckInput): boolean {
  if (!online) return false
  if (lastCheckAt === null) return true
  return now < lastCheckAt || now - lastCheckAt >= intervalMs
}
