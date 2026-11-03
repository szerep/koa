import type { TimerEvent } from './engine'

export interface NotificationCopy {
  title: string
  body: string
}

export interface NotificationRules {
  copy: {
    focusDone: NotificationCopy
    cycleDone: NotificationCopy
    breakDone: NotificationCopy
  }
  /** Completions noticed later than this aren't announced. */
  maxLateMs: number
}

export interface SessionNotification extends NotificationCopy {
  /** The session id: a second tab announcing the same session replaces the first notification. */
  tag: string
}

/**
 * What to announce for a timer event (Phase 8, Step 9), or null. Only completed sessions are
 * announced (never skips), and only if the completion is fresh: a session that ended long ago
 * while the app was closed is caught up on launch without a stale notification.
 */
export function sessionNotification(event: TimerEvent, now: number, rules: NotificationRules): SessionNotification | null {
  if (event.type !== 'sessionCompleted') return null
  if (now - event.completedAt > rules.maxLateMs) return null
  const copy =
    event.mode !== 'focus' ? rules.copy.breakDone : event.endsCycle ? rules.copy.cycleDone : rules.copy.focusDone
  return { title: copy.title, body: copy.body, tag: event.sessionId }
}
