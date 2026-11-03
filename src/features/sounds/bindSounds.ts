import { chimeMaxLateMs, chimeMinGapMs, chimeResumeTimeoutMs } from '../../config/sounds'
import type { Settings } from '../../core/settings/settings'
import { shouldChime } from '../../core/timer/chime'
import type { TimerEvent } from '../../core/timer/engine'
import { createSoundController, type SoundContextLike, type SoundEnv } from './sounds'

interface TimerEvents {
  onEvent(listener: (event: TimerEvent) => void): () => void
}

interface SettingsLike {
  getState(): Settings
  subscribe(listener: () => void): () => void
  setFlag(key: 'sounds', value: boolean): void
}

export interface BindSoundsOptions<C extends SoundContextLike> {
  timer: TimerEvents
  settings: SettingsLike
  env: SoundEnv<C>
  now?: () => number
}

/**
 * Chimes when a session completes and Sounds is on. It only listens to the timer's
 * `sessionCompleted` events (never skips, pauses, resets or ticks), so the timer doesn't know about it.
 */
export function bindSounds<C extends SoundContextLike>({ timer, settings, env, now = Date.now }: BindSoundsOptions<C>) {
  const controller = createSoundController({
    env,
    enabled: () => settings.getState().sounds,
    now,
    minGapMs: chimeMinGapMs,
    resumeTimeoutMs: chimeResumeTimeoutMs,
  })
  const unsubscribe = [
    timer.onEvent((event) => {
      // Never let an audio problem reach the timer's event loop (rewards listen there too).
      try {
        if (event.type === 'sessionCompleted' && shouldChime(event, now(), chimeMaxLateMs)) {
          controller.chime(event.sessionId)
        }
      } catch {
        // The session still completes; the status reports audio failures where it can.
      }
    }),
    settings.subscribe(controller.update),
  ]

  return {
    getStatus: controller.getStatus,
    subscribe: controller.subscribe,
    update: controller.update,
    /** Reset progress: drop a chime still waiting for audio. Sounds stays on or off as it was. */
    cancelPending: controller.cancelPending,

    /** Turn Sounds on from a tap, and play the chime once so the user hears it. */
    enable() {
      if (env.createContext === null) return
      settings.setFlag('sounds', true)
      controller.preview()
    },

    /** Turn Sounds off and release the audio context. */
    disable: () => settings.setFlag('sounds', false),

    dispose() {
      unsubscribe.forEach((stop) => stop())
      controller.dispose()
    },
  }
}
