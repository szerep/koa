import type { TimerState } from '../timer/engine'
import type { KoalaContext } from './brain'

/**
 * What the timer means for Koa.
 * - A running focus session: `focus` (calm, quiet).
 * - A started break, running or paused: `break` (pausing a break doesn't restart it).
 * - Anything else, including a paused focus session: `idle`.
 */
export function koalaContextFor(timer: Pick<TimerState, 'mode' | 'status'>): KoalaContext {
  if (timer.mode === 'focus') return timer.status === 'running' ? 'focus' : 'idle'
  return timer.status === 'idle' ? 'idle' : 'break'
}
