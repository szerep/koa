import { timerDefaults } from '../../config/timerDefaults'
import { localStorageAdapter } from '../../storage/adapter'
import { createTimerStore } from './timerStore'

/** The app's timer. Settings (Phase 8) will pass user-chosen durations here. */
export const timerStore = createTimerStore({ config: timerDefaults, storage: localStorageAdapter })
