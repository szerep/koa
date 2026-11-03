/**
 * Session-complete chime (Phase 8, Step 10). The browser APIs are injected (`SoundEnv`), so the
 * logic is tested with mocks. Browsers only let a page play audio after the user has interacted
 * with it, so the audio context is created (or woken) only inside a tap or key press, and only
 * while Sounds is on. Every failure is caught: audio never affects the timer, rewards,
 * saving or notifications.
 */
import { chimeSpec } from '../../config/sounds'
import { scheduleChime } from './chime'

/** The part of `AudioContext` the controller uses. */
export interface SoundContextLike {
  readonly state: string
  resume(): Promise<void>
  close(): Promise<void>
  addEventListener(type: 'statechange', listener: () => void): void
  removeEventListener(type: 'statechange', listener: () => void): void
}

export interface SoundEnv<C extends SoundContextLike = SoundContextLike> {
  /** `new AudioContext()`, or null where Web Audio isn't available. */
  createContext: (() => C) | null
  /** Schedule the chime on a running context. */
  play(ctx: C): void
  /** Subscribe to user gestures that let a page start audio (tap, click, key). Returns the unsubscribe. */
  onUserGesture(listener: () => void): () => void
}

/**
 * - `unsupported`: no Web Audio in this browser.
 * - `off`: the setting is off (no audio resources are held).
 * - `locked`: on, but the browser needs a tap in Koa first (after a reload, or after iOS paused audio).
 * - `ready`: on, and the chime can play.
 * - `failed`: the last chime couldn't be played. Tried again next time.
 */
export type SoundStatus = 'unsupported' | 'off' | 'locked' | 'ready' | 'failed'

export interface SoundControllerOptions<C extends SoundContextLike> {
  env: SoundEnv<C>
  enabled: () => boolean
  now?: () => number
  /** Chimes closer together than this are dropped. */
  minGapMs: number
  /** Playback the browser allows only later than this is dropped, not played late. */
  resumeTimeoutMs: number
}

/** How many recent session ids are remembered to never chime twice for one session. */
const RECENT = 20

export type SoundController = ReturnType<typeof createSoundController>

export function createSoundController<C extends SoundContextLike>({
  env,
  enabled,
  now = Date.now,
  minGapMs,
  resumeTimeoutMs,
}: SoundControllerOptions<C>) {
  const { createContext } = env
  let ctx: C | null = null
  let failed = false
  let disposed = false
  let lastPlayedAt = Number.NEGATIVE_INFINITY
  /** Bumped by `cancelPending()`: a chime still waiting for the browser is then dropped. */
  let generation = 0
  const chimed: string[] = []
  const listeners = new Set<() => void>()

  const compute = (): SoundStatus => {
    if (!createContext) return 'unsupported'
    if (!enabled()) return 'off'
    if (failed) return 'failed'
    return ctx?.state === 'running' ? 'ready' : 'locked'
  }
  let status = compute()

  const closeContext = () => {
    const held = ctx
    failed = false
    if (!held) return
    ctx = null
    held.removeEventListener('statechange', update)
    held.close().catch(() => {
      // Already closed; nothing to release.
    })
  }

  /** Re-check the setting and the context; tell subscribers if the status changed. */
  function update() {
    if (disposed) return
    if (!enabled()) closeContext()
    const next = compute()
    if (next === status) return
    status = next
    listeners.forEach((l) => l())
  }

  /** Called inside a user gesture: create or wake the audio context, as browsers require. */
  const unlock = () => {
    if (disposed || !createContext || !enabled()) return
    try {
      if (ctx === null || ctx.state === 'closed') {
        if (ctx) ctx.removeEventListener('statechange', update)
        ctx = createContext()
        ctx.addEventListener('statechange', update)
      }
      if (ctx.state !== 'running') ctx.resume().then(update, update)
    } catch {
      failed = true
    }
    update()
  }

  const play = (c: C) => {
    if (disposed || ctx !== c || !enabled()) return
    const t = now()
    if (t - lastPlayedAt < minGapMs) return
    try {
      env.play(c)
      lastPlayedAt = t
      failed = false
    } catch {
      failed = true
    }
    update()
  }

  /** Play the chime now if the browser allows it; otherwise drop it (never play it late). */
  const chime = (sessionId?: string) => {
    if (disposed || !createContext || !enabled()) return
    if (sessionId !== undefined) {
      if (chimed.includes(sessionId)) return
      chimed.push(sessionId)
      if (chimed.length > RECENT) chimed.shift()
    }
    const c = ctx
    if (c === null) return // no tap in this page yet: the browser wouldn't play it
    if (c.state === 'running') {
      play(c)
      return
    }
    const askedAt = now()
    const asked = generation
    let resuming: Promise<void>
    try {
      resuming = c.resume()
    } catch (error) {
      resuming = Promise.reject(error)
    }
    resuming.then(
      () => {
        if (asked === generation && c.state === 'running' && now() - askedAt <= resumeTimeoutMs) play(c)
        else update()
      },
      () => update(),
    )
  }

  const stopGestures = createContext ? env.onUserGesture(unlock) : () => {}

  return {
    getStatus: () => status,

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /** A completed session (the caller checks it's a real, fresh completion). Once per session. */
    chime,

    /**
     * Sounds was just turned on by a tap: set up audio inside that tap and play the chime once,
     * so the user hears it and its volume. Call after the setting is saved as on.
     */
    preview() {
      unlock()
      chime()
    },

    /** Re-check the setting (turning it off closes the audio context). */
    update,

    /**
     * Drop a chime still waiting for the browser to allow audio, and forget which sessions
     * chimed (Reset progress). The audio context and the setting are kept.
     */
    cancelPending() {
      generation += 1
      chimed.length = 0
    },

    /** Stop listening for gestures and close the audio context. */
    dispose() {
      if (disposed) return
      stopGestures()
      closeContext()
      disposed = true
      listeners.clear()
    },
  }
}

interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext
}

/** Events that count as a user gesture for audio in Chrome, Firefox and Safari (iOS needs touchend). */
const GESTURES = ['pointerup', 'touchend', 'keydown', 'click'] as const

/** The real browser environment. Unsupported without Web Audio. */
export function browserSoundEnv(): SoundEnv<AudioContext> {
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : 'AudioContext' in window
        ? window.AudioContext
        : (window as Window & WebkitWindow).webkitAudioContext
  return {
    createContext: Ctor ? () => new Ctor({ latencyHint: 'interactive' }) : null,
    play: (ctx) => scheduleChime(ctx, chimeSpec),
    onUserGesture(listener) {
      const options = { capture: true, passive: true }
      GESTURES.forEach((type) => window.addEventListener(type, listener, options))
      return () => GESTURES.forEach((type) => window.removeEventListener(type, listener, options))
    },
  }
}
