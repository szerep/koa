import { timerConfigFrom } from '../../core/settings/settings'
import { localStorageAdapter } from '../../storage/adapter'
import { settingsStore } from '../settings/store'
import { createTimerStore } from './timerStore'

/**
 * The app's timer. It starts from the saved settings (importing the settings store guarantees
 * it's loaded first), so an idle session is sized with the user's durations on launch.
 * Later settings changes are pushed in by src/app/connect.ts.
 */
export const timerStore = createTimerStore({
  config: timerConfigFrom(settingsStore.getState()),
  storage: localStorageAdapter,
})
