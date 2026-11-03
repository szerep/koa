import { settingsStore } from '../settings/store'
import { timerStore } from '../timer/store'
import { bindSounds } from './bindSounds'
import { browserSoundEnv } from './sounds'

/**
 * The app's session-complete chime, driven by timer events and the Sounds setting.
 * No audio is set up until Sounds is on and the user taps or types in Koa.
 */
export const sounds = bindSounds({ timer: timerStore, settings: settingsStore, env: browserSoundEnv() })
