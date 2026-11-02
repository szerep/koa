import { createTimer, durationFor, type TimerConfig, type TimerMode, type TimerState } from './engine'

const MODES: readonly TimerMode[] = ['focus', 'shortBreak', 'longBreak']
const STATUSES = ['idle', 'running', 'paused'] as const

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isNullableNumber = (v: unknown): v is number | null => v === null || isFiniteNumber(v)

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

  const state: TimerState = {
    mode: mode as TimerMode,
    status: status as TimerState['status'],
    durationMs,
    endsAt,
    remainingMs: Math.min(durationMs, Math.max(0, remainingMs)),
    sessionId,
    startedAt,
    completedInCycle: Math.min(config.sessionsPerCycle, Math.max(0, Math.floor(completedInCycle))),
  }

  if (state.status === 'running' && (state.endsAt === null || state.sessionId === null || state.startedAt === null)) {
    return createTimer(config)
  }
  if (state.status === 'paused' && (state.sessionId === null || state.startedAt === null)) {
    return createTimer(config)
  }
  if (state.status === 'idle') {
    // Not started yet: follow the current settings.
    const fresh = durationFor(state.mode, config)
    return { ...state, durationMs: fresh, remainingMs: fresh, endsAt: null, sessionId: null, startedAt: null }
  }
  return state
}
