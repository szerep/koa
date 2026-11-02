import { settingsSpec } from '../../config/settings'
import { localStorageAdapter } from '../../storage/adapter'
import { createSettingsStore } from './settingsStore'

/** The app's settings. Other tabs' changes are picked up in src/app/connect.ts. */
export const settingsStore = createSettingsStore({ spec: settingsSpec, storage: localStorageAdapter })
