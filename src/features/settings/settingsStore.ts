import {
  getNumber,
  restoreSettings,
  sameSettings,
  setFlag,
  setNumber,
  type FlagSetting,
  type NumericSetting,
  type Settings,
  type SettingsSpec,
} from '../../core/settings/settings'
import type { StorageAdapter } from '../../storage/adapter'
import { loadState, saveSlice } from '../../storage/persistence'

export interface SettingsStoreOptions {
  spec: SettingsSpec
  storage: StorageAdapter
}

export type SettingsStore = ReturnType<typeof createSettingsStore>

/**
 * The user's settings. Loaded (and validated) once on creation, saved on every change.
 * Changes apply to the in-memory settings, so a failed write (private mode, full storage)
 * never loses an earlier change; other tabs' changes arrive through `refresh()`.
 * It doesn't know about the timer or rewards: they read it (wired in src/app/connect.ts).
 */
export function createSettingsStore({ spec, storage }: SettingsStoreOptions) {
  let settings: Settings = restoreSettings(loadState(storage).settings, spec)
  const listeners = new Set<() => void>()

  const notify = () => listeners.forEach((l) => l())

  const commit = (next: Settings) => {
    if (next === settings) return
    settings = next
    saveSlice(storage, 'settings', settings)
    notify()
  }

  return {
    getState: () => settings,

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /**
     * Change a duration, the long break interval or the daily goal.
     * Returns false (and changes nothing) for an invalid value.
     */
    setNumber(key: NumericSetting, value: number): boolean {
      commit(setNumber(settings, key, value, spec))
      return getNumber(settings, key) === value
    },

    setFlag: (key: FlagSetting, value: boolean) => commit(setFlag(settings, key, value)),

    /** Re-read the saved settings (another tab changed them). Notifies only if a value changed. */
    refresh() {
      const latest = restoreSettings(loadState(storage).settings, spec)
      if (sameSettings(latest, settings)) return
      settings = latest
      notify()
    },
  }
}
