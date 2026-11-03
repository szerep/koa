/**
 * Export and Reset progress (Phase 8, Step 11). Framework-agnostic: the save, the download, the
 * share sheet and the stores to reload are injected, so every path (failures included) is tested
 * without a browser.
 *
 * Export (Phase 9, Step 8, D11): in an installed app that can share the file, the Export tap opens
 * the system share sheet; everywhere else it's the Phase 8 download. The file is the same in both.
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
import { exportMethod, isShareCancelled } from '../../core/data/exportMethod'
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

/**
 * The Web Share API, as Koa uses it (Phase 9, Step 8). Injected so tests never open a real sheet.
 * Leave it out (or let `canShare` say false) and Export always downloads.
 */
export interface FileShare {
  /** Running as an installed app, checked at tap time. */
  isStandalone(): boolean
  /** `navigator.canShare(data)`; false when the API is missing. */
  canShare(data: ShareData): boolean
  /** `navigator.share(data)`. Rejects with `AbortError` when the user closes the sheet. */
  share(data: ShareData): Promise<void>
}

/**
 * - `exported`: the download was handed to the browser.
 * - `sharing`: the share sheet is open (a second tap is ignored until it closes).
 * - `shared`: the user picked where the file goes.
 * - `failed`: neither the share sheet nor the download worked.
 */
export type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'exported'; fileName: string }
  | { kind: 'sharing'; fileName: string }
  | { kind: 'shared'; fileName: string }
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
  /** The share sheet for installed apps (Step 8). Without it, Export always downloads. */
  share?: FileShare
  now?: () => number
}

/** The share sheet's title for the export file. */
export const SHARE_TITLE = 'Koa data'

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

/** Never throws: a broken capability check just means "no". */
function safely(check: () => boolean): boolean {
  try {
    return check() === true
  } catch {
    return false
  }
}

export function createProgressData({ storage, snapshot, reload, download, share, now = Date.now }: ProgressDataOptions) {
  let state: DataState = { export: { kind: 'idle' }, reset: { kind: 'idle' } }
  /** The share sheet is open: further Export taps are ignored (a second `share()` would reject). */
  let sharing = false
  /** Bumped by `dismiss()`, so a sheet that closes after the user left the screen sets no message. */
  let exportGeneration = 0
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

    /**
     * Save everything as a JSON file. Never changes any data. Call it only from the Export tap:
     * the share sheet needs that user gesture, so the file is built and `share()` is called
     * synchronously, with no await before it.
     *
     * Download: returns true/false right away, as in Phase 8. Share sheet: returns a promise that
     * resolves when the sheet closes (true if shared, false if cancelled or nothing worked).
     */
    exportData(): boolean | Promise<boolean> {
      if (sharing) return false
      const fileName = exportFileName(now())
      const text = exportText()
      if (text === null) {
        set({ export: { kind: 'failed' } })
        return false
      }

      const downloadFile = (): boolean => {
        try {
          download(fileName, text, JSON_TYPE)
        } catch {
          set({ export: { kind: 'failed' } })
          return false
        }
        set({ export: { kind: 'exported', fileName } })
        return true
      }

      if (!share) return downloadFile()
      let data: ShareData
      try {
        data = { files: [new File([text], fileName, { type: JSON_TYPE })], title: SHARE_TITLE }
      } catch {
        return downloadFile() // no File constructor: no file sharing either
      }
      const method = exportMethod({
        standalone: safely(() => share.isStandalone()),
        canShareFiles: safely(() => share.canShare(data)),
      })
      if (method === 'download') return downloadFile()

      let shared: Promise<void>
      try {
        shared = share.share(data)
      } catch (error) {
        shared = Promise.reject(error)
      }
      sharing = true
      const generation = exportGeneration
      set({ export: { kind: 'sharing', fileName } })

      return shared.then(
        () => {
          sharing = false
          if (generation === exportGeneration) set({ export: { kind: 'shared', fileName } })
          return true
        },
        (error: unknown) => {
          sharing = false
          if (isShareCancelled(error)) {
            // The user closed the sheet: their choice, not a failure.
            if (generation === exportGeneration) set({ export: { kind: 'idle' } })
            return false
          }
          // A real failure: the Phase 8 download is the fallback, then its failure message.
          return downloadFile()
        },
      )
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
      exportGeneration += 1
      set({ export: { kind: 'idle' }, reset: state.reset.kind === 'confirming' ? state.reset : { kind: 'idle' } })
    },
  }
}

/**
 * The real Web Share API (Step 8). `canShare` is false when `navigator.share` or
 * `navigator.canShare` is missing, so those browsers download.
 */
export function browserFileShare(isStandalone: () => boolean): FileShare {
  return {
    isStandalone,
    canShare: (data) =>
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare(data),
    share: (data) => navigator.share(data),
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
