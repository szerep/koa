import type { TimerEvent } from './engine'

/**
 * Whether a timer event should chime (Phase 8, Step 10): only a session that actually
 * completed (focus or break), never a skip, and only if the completion is fresh. A session
 * caught up long after it ended (the app was closed or suspended) completes silently.
 */
export function shouldChime(event: TimerEvent, now: number, maxLateMs: number): boolean {
  return event.type === 'sessionCompleted' && now - event.completedAt <= maxLateMs
}
