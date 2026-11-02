import { createTimer, fitIdleSession, type TimerConfig, type TimerMode, type TimerState } from './engine'

const MODES: readonly TimerMode[] = ['focus', 'shortBreak', 'longBreak']
const STATUSES = ['idle', 'running', 'paused'] as const

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isNullableNumber = (v: unknown): v is number | null => v === null || isFiniteNumber(v)

/**
 * Before Phase 8 every focus session was 25 minutes, so a saved timer without `cycleFocusMs`
 * had exactly this much focus per completed session in its cycle.
 */
const LEGACY_FOCUS_MS = 25 * 60_000

/** The cycle's focus time: the saved value if it's valid, else what the cycle count implies. */
function restoreCycleFocusMs(raw: unknown, completedInCycle: number): number {
  if (completedInCycle === 0) return 0
  if (isFiniteNumber(raw) && raw >= 0) return raw
  return completedInCycle * LEGACY_FOCUS_MS
}

/**
 * Turn persisted data back into a valid TimerState.
 * Anything malformed falls back to a fresh timer: a broken save must never break the app.
 */
export function restoreTimer(raw: unknown, config: TimerConfig): TimerState {
  if (!isObject(raw)) return createTimer(config)

  const { mode, status, durationMs, endsAt, remainingMs, sessionId, startedAt, completedInCycle } = raw
  if (
    !MODES.includes(mode as TimerMode) ||
    !STATUSES.includes(status as (typeof STATUSES)[number]) ||
    !isFiniteNumber(durationMs) ||
    durationMs <= 0 ||
    !isNullableNumber(endsAt) ||
    !isFiniteNumber(remainingMs) ||
    !(sessionId === null || typeof sessionId === 'string') ||
    !isNullableNumber(startedAt) ||
    !isFiniteNumber(completedInCycle)
  ) {
    return createTimer(config)
  }

  const cycleCount = Math.min(config.sessionsPerCycle, Math.max(0, Math.floor(completedInCycle)))
  const state: TimerState = {
    mode: mode as TimerMode,
    status: status as TimerState['status'],
    durationMs,
    endsAt,
    remainingMs: Math.min(durationMs, Math.max(0, remainingMs)),
    sessionId,
    startedAt,
    completedInCycle: cycleCount,
    cycleFocusMs: restoreCycleFocusMs(raw.cycleFocusMs, cycleCount),
  }

  if (state.status === 'running' && (state.endsAt === null || state.sessionId === null || state.startedAt === null)) {
    return createTimer(config)
  }
  if (state.status === 'paused' && (state.sessionId === null || state.startedAt === null)) {
    return createTimer(config)
  }
  if (state.status === 'idle') {
    // Not started yet: follow the current durations, with the cycle count capped at the interval.
    return fitIdleSession(state, config)
  }
  return state
}
