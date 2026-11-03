import {
  applyConfig,
  pause,
  reconcile,
  reset,
  resume,
  selectMode,
  skip,
  start,
  type TimerConfig,
  type TimerEvent,
  type TimerMode,
  type TimerState,
  type Transition,
} from '../../core/timer/engine'
import { restoreTimer } from '../../core/timer/restore'
import type { StorageAdapter } from '../../storage/adapter'
import { loadState, saveSlice } from '../../storage/persistence'

export interface TimerStoreOptions {
  config: TimerConfig
  storage: StorageAdapter
  now?: () => number
  newId?: () => string
}

export type TimerStore = ReturnType<typeof createTimerStore>

function defaultId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Holds the timer state, applies engine transitions, persists every change and
 * broadcasts timer events. Framework-agnostic; React reads it via useSyncExternalStore.
 */
export function createTimerStore({ config: initialConfig, storage, now = Date.now, newId = defaultId }: TimerStoreOptions) {
  /** The current settings. Every transition reads it, so new sessions always use the latest. */
  let config = initialConfig
  let state: TimerState = restoreTimer(loadState(storage).timer, config)
  const listeners = new Set<() => void>()
  const eventListeners = new Set<(event: TimerEvent) => void>()

  const apply = (transition: Transition) => {
    const changed = transition.state !== state
    state = transition.state
    // Events go out before the timer is saved: if the app dies in between, the session
    // completes again on next launch and the (idempotent) reward ledger ignores the repeat.
    // Saving first could instead lose a reward.
    transition.events.forEach((event) => eventListeners.forEach((l) => l(event)))
    if (changed) {
      saveSlice(storage, 'timer', state)
      listeners.forEach((l) => l())
    }
  }

  return {
    getState: () => state,

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /** Session events (completed, skipped). Phase 5 rewards and Phase 8 stats listen here. */
    onEvent(listener: (event: TimerEvent) => void) {
      eventListeners.add(listener)
      return () => {
        eventListeners.delete(listener)
      }
    },

    /** Catch up with the clock: on launch, on every tick and when the app is visible again. */
    sync: () => apply(reconcile(state, now(), config)),

    /** The one primary button: start, pause or resume. */
    toggle() {
      const t = now()
      const current = reconcile(state, t, config)
      apply(current)
      if (current.events.length > 0) return // it just finished; don't act on a stale tap
      if (state.status === 'idle') apply(start(state, t, newId()))
      else if (state.status === 'running') apply(pause(state, t, config))
      else apply(resume(state, t))
    },

    reset: () => apply(reset(state, config)),

    skip() {
      const caughtUp = reconcile(state, now(), config)
      apply(caughtUp)
      if (caughtUp.events.length > 0) return
      apply(skip(state, config))
    },

    selectMode: (mode: TimerMode) => apply(selectMode(state, mode, config)),

    getConfig: () => config,

    /**
     * Re-read the saved timer after Reset progress (here or in another tab). The old session is
     * dropped without events, so it can never complete, pay or announce itself afterwards.
     */
    reload() {
      const next = restoreTimer(loadState(storage).timer, config)
      const changed = JSON.stringify(next) !== JSON.stringify(state)
      state = next
      if (changed) listeners.forEach((l) => l())
    },

    /**
     * New settings (durations, long break interval). A session that hasn't started updates
     * right away; a running or paused session keeps its length and remaining time.
     */
    setConfig(next: TimerConfig) {
      const previous = config
      config = next
      apply(applyConfig(state, config, previous))
    },
  }
}
