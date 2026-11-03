import { notificationCopy, notificationMaxLateMs } from '../../config/notifications'
import type { Settings } from '../../core/settings/settings'
import type { TimerEvent } from '../../core/timer/engine'
import { sessionNotification } from '../../core/timer/notification'
import { createNotifier, type NotificationEnv } from './notifications'

interface TimerEvents {
  onEvent(listener: (event: TimerEvent) => void): () => void
}

interface SettingsLike {
  getState(): Settings
  subscribe(listener: () => void): () => void
  setFlag(key: 'notifications', value: boolean): void
}

export interface BindNotificationsOptions {
  timer: TimerEvents
  settings: SettingsLike
  env: NotificationEnv
  now?: () => number
}

const rules = { copy: notificationCopy, maxLateMs: notificationMaxLateMs }

/**
 * Announces completed sessions while Koa is in the background. It only listens to the timer's
 * `sessionCompleted` events, so the timestamp-based timer doesn't know about it. The setting
 * lives in the settings store (other tabs' changes arrive there too).
 */
export function bindNotifications({ timer, settings, env, now = Date.now }: BindNotificationsOptions) {
  const notifier = createNotifier({
    env,
    enabled: () => settings.getState().notifications,
    setEnabled: (on) => settings.setFlag('notifications', on),
  })
  const unsubscribe = [
    timer.onEvent((event) => {
      // Never let a notification problem reach the timer's event loop (rewards listen there too).
      try {
        notifier.notify(sessionNotification(event, now(), rules))
      } catch {
        // Reported through the status where possible; the session still completes.
      }
    }),
    settings.subscribe(notifier.update),
  ]

  return {
    appleMobile: env.appleMobile,
    getStatus: notifier.getStatus,
    subscribe: notifier.subscribe,
    enable: notifier.enable,
    disable: notifier.disable,
    update: notifier.update,
    dispose() {
      unsubscribe.forEach((stop) => stop())
      notifier.dispose()
    },
  }
}
