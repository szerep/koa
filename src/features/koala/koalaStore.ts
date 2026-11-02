import { koalaBehavior } from '../../config/koalaBehavior'
import { koalaLines } from '../../config/koalaLines'
import {
  activity,
  breakOver,
  celebrate,
  createKoala,
  greet,
  setContext,
  showOff,
  tap,
  tick,
  type CelebrationLevel,
  type KoalaContext,
  type KoalaEnv,
  type KoalaState,
  type TickInput,
} from '../../core/koala/brain'

export interface KoalaStoreOptions {
  context: KoalaContext
  /** Read on every tick (e.g. whether a shop hint makes sense). */
  getTickInput: () => TickInput
  now?: () => number
  random?: () => number
  /** Local hour of day, for greetings. */
  hour?: () => number
}

export type KoalaStore = ReturnType<typeof createKoalaStore>

const TICK_MS = 1000

/**
 * Holds Koa's current behavior. Not persisted: Koa's mood starts fresh on every launch.
 * Ticks only while something is subscribed and the page is visible.
 */
export function createKoalaStore({
  context,
  getTickInput,
  now = Date.now,
  random = Math.random,
  hour = () => new Date().getHours(),
}: KoalaStoreOptions) {
  const env: KoalaEnv = { behavior: koalaBehavior, lines: koalaLines, random }
  let state: KoalaState = createKoala(now(), context, env)
  const listeners = new Set<() => void>()
  let interval: ReturnType<typeof setInterval> | undefined

  const set = (next: KoalaState) => {
    if (next === state) return
    // Input timestamps alone don't change what Koa looks like; skip the re-render.
    const visible =
      next.motion !== state.motion ||
      next.bubble !== state.bubble ||
      next.napping !== state.napping ||
      next.context !== state.context
    state = next
    if (visible) listeners.forEach((l) => l())
  }

  const onTick = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    set(tick(state, now(), env, getTickInput()))
  }

  const startTicking = () => {
    if (interval === undefined) interval = setInterval(onTick, TICK_MS)
  }
  const stopTicking = () => {
    clearInterval(interval)
    interval = undefined
  }

  return {
    getState: () => state,

    subscribe(listener: () => void) {
      listeners.add(listener)
      startTicking()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stopTicking()
      }
    },

    setContext: (next: KoalaContext, opts?: { longBreak?: boolean }) => set(setContext(state, next, now(), env, opts)),
    activity: () => set(activity(state, now(), env)),
    tap: () => set(tap(state, now(), env)),
    celebrate: (level: CelebrationLevel) => set(celebrate(state, level, now(), env)),
    breakOver: () => set(breakOver(state, now(), env)),
    showOff: () => set(showOff(state, now(), env)),
    greet: () => set(greet(state, now(), hour(), env)),
    /** Advance time now (tests, and catching up when the page becomes visible). */
    tick: onTick,
  }
}
