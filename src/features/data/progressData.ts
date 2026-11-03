/**
 * Export and Reset progress (Phase 8, Step 11). Framework-agnostic: the save, the download and
 * the stores to reload are injected, so every path (failures included) is tested without a browser.
 *
 * Reset is two steps: `requestReset()` shows what would be deleted, and only `confirmReset()`
 * deletes it. Before deleting, the current data is written to `koa:backup:reset` and read back;
 * if that backup (or the reset save itself) can't be stored, nothing is deleted.
 * Settings are kept, and browser permissions are never touched.
 */
import {
  buildExport,
  exportFileName,
  progressResetState,
  progressSummary,
  serializeExport,
  type ProgressSummary,
} from '../../core/data/data'
import type { Wallet } from '../../core/rewards/wallet'
import type { Wardrobe } from '../../core/shop/shop'
import type { TimerState } from '../../core/timer/engine'
import type { StorageAdapter } from '../../storage/adapter'
import { RESET_BACKUP_KEY, SCHEMA_VERSION, STORAGE_KEY, type PersistedState } from '../../storage/persistence'

/** The app's current data, as the stores hold it (what the user sees, even if a save failed). */
export interface ProgressSnapshot {
  timer: TimerState
  wallet: Wallet
  wardrobe: Wardrobe
  settings: unknown
}

/** Save a text file for the user. Throws if the browser can't. */
export type Download = (fileName: string, text: string, mimeType: string) => void

export type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'exported'; fileName: string }
  | { kind: 'failed' }

/**
 * - `confirming`: the confirmation is showing (with what would be deleted).
 * - `done`: progress was reset; the backup is on this device.
 * - `backupFailed`: the backup couldn't be stored, so nothing was deleted.
 * - `saveFailed`: the reset couldn't be stored, so nothing was deleted.
 */
export type ResetStatus =
  | { kind: 'idle' }
  | { kind: 'confirming'; summary: ProgressSummary }
  | { kind: 'done' }
  | { kind: 'backupFailed' }
  | { kind: 'saveFailed' }

export interface DataState {
  export: ExportStatus
  reset: ResetStatus
}

export interface ProgressDataOptions {
  storage: StorageAdapter
  snapshot: () => ProgressSnapshot
  /** Re-read every store from the save (timer, wallet, wardrobe, Koa…). Called after a reset. */
  reload: () => void
  download: Download
  now?: () => number
}

export type ProgressData = ReturnType<typeof createProgressData>

const JSON_TYPE = 'application/json'

/** Write and read back: the adapter swallows storage errors, so this is how a failed write shows. */
function writeVerified(storage: StorageAdapter, key: string, value: string): boolean {
  try {
    storage.write(key, value)
    return storage.read(key) === value
  } catch {
    return false
  }
}

export function createProgressData({ storage, snapshot, reload, download, now = Date.now }: ProgressDataOptions) {
  let state: DataState = { export: { kind: 'idle' }, reset: { kind: 'idle' } }
  const listeners = new Set<() => void>()

  const set = (next: Partial<DataState>) => {
    state = { ...state, ...next }
    listeners.forEach((l) => l())
  }

  const current = (): PersistedState => {
    const { timer, wallet, wardrobe, settings } = snapshot()
    return { version: SCHEMA_VERSION, timer, wallet, wardrobe, settings }
  }

  /** The export file's text; null if it can't be built. */
  const exportText = (): string | null => {
    try {
      return serializeExport(buildExport(current(), now()))
    } catch {
      return null
    }
  }

  return {
    getState: () => state,

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /** Download everything as a JSON file. Never changes any data. */
    exportData(): boolean {
      const fileName = exportFileName(now())
      const text = exportText()
      if (text === null) {
        set({ export: { kind: 'failed' } })
        return false
      }
      try {
        download(fileName, text, JSON_TYPE)
      } catch {
        set({ export: { kind: 'failed' } })
        return false
      }
      set({ export: { kind: 'exported', fileName } })
      return true
    },

    /** Step 1: show what Reset progress would delete. Nothing changes yet. */
    requestReset() {
      const { wallet, wardrobe, timer } = snapshot()
      set({ reset: { kind: 'confirming', summary: progressSummary(wallet, wardrobe, timer) } })
    },

    /** Keep everything. */
    cancelReset() {
      if (state.reset.kind === 'confirming') set({ reset: { kind: 'idle' } })
    },

    /** Step 2: back up, then reset. Does nothing unless the confirmation is showing. */
    confirmReset(): boolean {
      if (state.reset.kind !== 'confirming') return false

      const backup = exportText()
      if (backup === null || !writeVerified(storage, RESET_BACKUP_KEY, backup)) {
        set({ reset: { kind: 'backupFailed' } })
        return false
      }

      const fresh = JSON.stringify(progressResetState(snapshot().settings))
      if (!writeVerified(storage, STORAGE_KEY, fresh)) {
        set({ reset: { kind: 'saveFailed' } })
        return false
      }

      reload()
      set({ reset: { kind: 'done' } })
      return true
    },

    /** Clear a result message (e.g. when leaving the screen). */
    dismiss() {
      set({ export: { kind: 'idle' }, reset: state.reset.kind === 'confirming' ? state.reset : { kind: 'idle' } })
    },
  }
}

/** The real browser download: a Blob behind a temporary link. iOS Safari saves it to Files. */
export function browserDownload(fileName: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    // Safari needs the URL a little longer than the click.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
