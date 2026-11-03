import { settingsStore } from '../settings/store'
import { timerStore } from '../timer/store'
import { bindNotifications } from './bindNotifications'
import { browserNotificationEnv } from './notifications'

/**
 * The app's session-complete notifications, driven by timer events and the setting.
 * Creating it never asks for permission; only the Settings switch does.
 */
export const notifications = bindNotifications({ timer: timerStore, settings: settingsStore, env: browserNotificationEnv() })
