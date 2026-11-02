import type { Settings } from '../../core/settings/settings'
import type { TimerState } from '../../core/timer/engine'
import { shouldKeepScreenOn } from '../../core/timer/wakeLock'
import { createWakeLockController, type WakeLockEnv } from './wakeLock'

interface Readable<T> {
  getState(): T
  subscribe(listener: () => void): () => void
}

export interface BindWakeLockOptions {
  timer: Readable<TimerState>
  settings: Readable<Settings>
  env: WakeLockEnv
  now?: () => number
}

/**
 * Keeps the screen on while the Keep screen on setting is enabled and a focus session is
 * running. It only reads the timer: start, pause, completion, skip and reset all arrive as
 * timer state changes, so nothing in the timestamp-based timer has to know about it.
 */
export function bindWakeLock({ timer, settings, env, now = Date.now }: BindWakeLockOptions) {
  const controller = createWakeLockController({
    env,
    wanted: () => shouldKeepScreenOn(timer.getState(), settings.getState().keepScreenOn, now()),
  })
  const unsubscribe = [timer.subscribe(controller.update), settings.subscribe(controller.update)]
  controller.update()

  return {
    getStatus: controller.getStatus,
    subscribe: controller.subscribe,
    update: controller.update,
    dispose() {
      unsubscribe.forEach((stop) => stop())
      controller.dispose()
    },
  }
}
