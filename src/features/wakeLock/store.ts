import { settingsStore } from '../settings/store'
import { timerStore } from '../timer/store'
import { bindWakeLock } from './bindWakeLock'
import { browserWakeLockEnv } from './wakeLock'

/** The app's screen wake lock, driven by the timer and the Keep screen on setting. */
export const wakeLock = bindWakeLock({ timer: timerStore, settings: settingsStore, env: browserWakeLockEnv() })
