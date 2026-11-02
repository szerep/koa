/**
 * Pomodoro timer engine: pure, deterministic, timestamp-based.
 *
 * - No React, DOM or real clock: every function takes `now` (ms since epoch).
 * - A running session stores `endsAt`; remaining time is always derived from the clock,
 *   so the timer stays correct when the tab is suspended or the phone is locked.
 * - Transitions return a new state plus events (e.g. a completed session) for other
 *   features to react to (rewards in Phase 5, stats in Phase 8).
 */

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak'
export type TimerStatus = 'idle' | 'running' | 'paused'

export interface TimerConfig {
  /** Minutes per mode. */
  durations: Record<TimerMode, number>
  /** A long break follows this many completed focus sessions. */
  sessionsPerCycle: number
}

export interface TimerState {
  mode: TimerMode
  status: TimerStatus
  /** Length of the current session, fixed when it was set up. */
  durationMs: number
  /** Running only: when the session ends. */
  endsAt: number | null
  /** Idle/paused: time left. Running: time left at the last start/resume. */
  remainingMs: number
  /** Assigned on first start; identifies the session for idempotent rewards. */
  sessionId: string | null
  /** When the session was first started. */
  startedAt: number | null
  /** Focus sessions completed in the current cycle (0..sessionsPerCycle). */
  completedInCycle: number
}

export interface SessionCompleted {
  type: 'sessionCompleted'
  sessionId: string
  mode: TimerMode
  durationMs: number
  startedAt: number
  /** The scheduled end, even if the app only noticed later. */
  completedAt: number
  /** True when this focus session completed the cycle (earns the long break). */
  endsCycle: boolean
}

export interface SessionSkipped {
  type: 'sessionSkipped'
  sessionId: string | null
  mode: TimerMode
}

export type TimerEvent = SessionCompleted | SessionSkipped

export interface Transition {
  state: TimerState
  events: TimerEvent[]
}

const MINUTE = 60_000

export function durationFor(mode: TimerMode, config: TimerConfig): number {
  const minutes = config.durations[mode]
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new RangeError(`Invalid duration for ${mode}: ${minutes}`)
  }
  return Math.round(minutes * MINUTE)
}

/** A fresh, not-yet-started session of `mode`. */
function idleSession(mode: TimerMode, config: TimerConfig, completedInCycle: number): TimerState {
  const durationMs = durationFor(mode, config)
  // A finished cycle whose long break was abandoned starts over with the next focus session.
  if (mode === 'focus' && completedInCycle >= config.sessionsPerCycle) completedInCycle = 0
  return {
    mode,
    status: 'idle',
    durationMs,
    endsAt: null,
    remainingMs: durationMs,
    sessionId: null,
    startedAt: null,
    completedInCycle,
  }
}

export function createTimer(config: TimerConfig): TimerState {
  return idleSession('focus', config, 0)
}

const unchanged = (state: TimerState): Transition => ({ state, events: [] })

/** Time left, clamped to [0, durationMs] (guards against clock changes). */
export function remainingMs(state: TimerState, now: number): number {
  if (state.status === 'running' && state.endsAt !== null) {
    return Math.min(state.durationMs, Math.max(0, state.endsAt - now))
  }
  return Math.min(state.durationMs, Math.max(0, state.remainingMs))
}

/** 0..1 */
export function progress(state: TimerState, now: number): number {
  return 1 - remainingMs(state, now) / state.durationMs
}

/** Whether the session has been started and not finished (running or paused). */
export function isInProgress(state: TimerState): boolean {
  return state.status !== 'idle'
}

/** Which mode follows `mode`, given how many focus sessions are done in the cycle. */
export function nextMode(mode: TimerMode, completedInCycle: number, config: TimerConfig): TimerMode {
  if (mode !== 'focus') return 'focus'
  return completedInCycle >= config.sessionsPerCycle ? 'longBreak' : 'shortBreak'
}

export function start(state: TimerState, now: number, sessionId: string): Transition {
  if (state.status !== 'idle') return unchanged(state)
  return {
    state: {
      ...state,
      status: 'running',
      endsAt: now + state.remainingMs,
      sessionId,
      startedAt: now,
    },
    events: [],
  }
}

export function pause(state: TimerState, now: number, config: TimerConfig): Transition {
  if (state.status !== 'running') return unchanged(state)
  const left = remainingMs(state, now)
  if (left <= 0) return complete(state, config)
  return {
    state: { ...state, status: 'paused', endsAt: null, remainingMs: left },
    events: [],
  }
}

export function resume(state: TimerState, now: number): Transition {
  if (state.status !== 'paused') return unchanged(state)
  return {
    state: { ...state, status: 'running', endsAt: now + state.remainingMs },
    events: [],
  }
}

/** Back to the full duration of the current mode. The cycle is kept. */
export function reset(state: TimerState, config: TimerConfig): Transition {
  if (state.status === 'idle') return unchanged(state) // already at full length
  return unchanged(idleSession(state.mode, config, state.completedInCycle))
}

/** Pick a mode by hand. Discards any session in progress; the cycle is kept. */
export function selectMode(state: TimerState, mode: TimerMode, config: TimerConfig): Transition {
  if (mode === state.mode && state.status === 'idle') return unchanged(state)
  return unchanged(idleSession(mode, config, state.completedInCycle))
}

/**
 * Move on without finishing. Skipped sessions never count:
 * a skipped focus session does not advance the cycle; skipping the long break ends the cycle.
 */
export function skip(state: TimerState, config: TimerConfig): Transition {
  const event: SessionSkipped = { type: 'sessionSkipped', sessionId: state.sessionId, mode: state.mode }
  if (state.mode === 'focus') {
    return { state: idleSession('shortBreak', config, state.completedInCycle), events: [event] }
  }
  const cycle = state.mode === 'longBreak' ? 0 : state.completedInCycle
  return { state: idleSession('focus', config, cycle), events: [event] }
}

/** Finish the running session at its scheduled end and set up the next one (not started). */
function complete(state: TimerState, config: TimerConfig): Transition {
  if (state.sessionId === null || state.startedAt === null || state.endsAt === null) {
    return unchanged(state)
  }
  let cycle = state.completedInCycle
  if (state.mode === 'focus') cycle += 1

  const event: SessionCompleted = {
    type: 'sessionCompleted',
    sessionId: state.sessionId,
    mode: state.mode,
    durationMs: state.durationMs,
    startedAt: state.startedAt,
    completedAt: state.endsAt,
    endsCycle: state.mode === 'focus' && cycle >= config.sessionsPerCycle,
  }

  const mode = nextMode(state.mode, cycle, config)
  if (state.mode === 'longBreak') cycle = 0

  return { state: idleSession(mode, config, cycle), events: [event] }
}

/**
 * Bring the state up to date with the clock. Call on every tick, on app launch,
 * and when the app becomes visible again. Completes the session if its time is up.
 */
export function reconcile(state: TimerState, now: number, config: TimerConfig): Transition {
  if (state.status === 'running' && state.endsAt !== null && now >= state.endsAt) {
    return complete(state, config)
  }
  return unchanged(state)
}

/** Apply new durations to a session that hasn't started yet. Sessions in progress keep their length. */
export function applyConfig(state: TimerState, config: TimerConfig): Transition {
  if (state.status !== 'idle') return unchanged(state)
  const durationMs = durationFor(state.mode, config)
  const completedInCycle = Math.min(state.completedInCycle, config.sessionsPerCycle)
  if (durationMs === state.durationMs && completedInCycle === state.completedInCycle) return unchanged(state)
  return unchanged({ ...state, durationMs, remainingMs: durationMs, completedInCycle })
}
