/**
 * Export and reset progress (Phase 8, Step 11). Pure: no storage, DOM or clock; `now` is a parameter.
 *
 * - The export is the app's own save (`koa:v1`: version, timer, wallet, wardrobe, settings) wrapped
 *   in a small envelope that says what the file is and when it was made. Import is out of scope.
 * - Reset progress keeps only Settings. Coins, purchases, the outfit, stats (the earned ledger),
 *   the timer and the cycle all start over, because their slices are simply left out.
 */
import type { Wallet } from '../rewards/wallet'
import type { Wardrobe } from '../shop/shop'
import { isInProgress, type TimerState } from '../timer/engine'
import { dayKey } from '../time'
import { SCHEMA_VERSION, STORAGE_KEY, type PersistedState } from '../../storage/persistence'

export const EXPORT_FORMAT = 'koa-export'
/** Version of the envelope. The save inside carries its own `version` (the `koa:v1` schema). */
export const EXPORT_VERSION = 1

export interface KoaExport {
  format: typeof EXPORT_FORMAT
  exportVersion: typeof EXPORT_VERSION
  /** ISO 8601, UTC. */
  exportedAt: string
  /** Where this data lives in the browser. */
  storageKey: typeof STORAGE_KEY
  /** The save itself, in the same structure as `koa:v1`. */
  data: PersistedState
}

/** Wrap a save for export. Only the known slices are copied, and `version` is always set. */
export function buildExport(state: PersistedState, now: number): KoaExport {
  const data: PersistedState = { version: SCHEMA_VERSION }
  if (state.timer !== undefined) data.timer = state.timer
  if (state.wallet !== undefined) data.wallet = state.wallet
  if (state.wardrobe !== undefined) data.wardrobe = state.wardrobe
  if (state.settings !== undefined) data.settings = state.settings
  return {
    format: EXPORT_FORMAT,
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    storageKey: STORAGE_KEY,
    data,
  }
}

/** Pretty-printed, so the file is readable on its own. */
export const serializeExport = (file: KoaExport): string => `${JSON.stringify(file, null, 2)}\n`

/** `koa-data-2026-11-03.json`, by the local day. */
export const exportFileName = (now: number): string => `koa-data-${dayKey(now)}.json`

/** The save after Reset progress: Settings only. Every other slice loads as new. */
export function progressResetState(settings: unknown): PersistedState {
  return settings === undefined ? { version: SCHEMA_VERSION } : { version: SCHEMA_VERSION, settings }
}

/** What Reset progress would delete, for the confirmation. */
export interface ProgressSummary {
  /** Coins to spend right now. */
  balance: number
  /** All coins ever earned. */
  totalEarned: number
  itemsOwned: number
  itemsWorn: number
  focusSessions: number
  /** Unrounded. */
  focusMinutes: number
  /** Focus sessions done in the current cycle. */
  cycleSessions: number
  /** A session has started (running or paused) and would stop without paying. */
  sessionInProgress: boolean
}

export function progressSummary(wallet: Wallet, wardrobe: Wardrobe, timer: TimerState): ProgressSummary {
  let focusSessions = 0
  let focusMinutes = 0
  for (const entry of Object.values(wallet.ledger)) {
    if (entry.kind !== 'focus') continue
    focusSessions += 1
    focusMinutes += entry.minutes ?? 0
  }
  return {
    balance: wallet.balance,
    totalEarned: wallet.totalEarned,
    itemsOwned: Object.values(wallet.spending).filter((e) => e.kind === 'purchase').length,
    itemsWorn: Object.values(wardrobe).filter((id) => id !== null).length,
    focusSessions,
    focusMinutes,
    cycleSessions: timer.completedInCycle,
    sessionInProgress: isInProgress(timer),
  }
}

/** True when there's nothing to delete (the reset would change nothing but the timer's idle state). */
export const hasNoProgress = (s: ProgressSummary): boolean =>
  s.totalEarned === 0 && s.itemsOwned === 0 && s.itemsWorn === 0 && s.cycleSessions === 0 && !s.sessionInProgress

const PROGRESS_SLICES = ['timer', 'wallet', 'wardrobe'] as const

function parseSave(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Did another tab just reset progress? Seen in a `storage` event for `koa:v1`: the old save had
 * progress (a timer, wallet or wardrobe slice) and the new one has none. Normal saves never drop
 * a slice (each write keeps the others), so only a reset does this.
 */
export function isProgressReset(oldValue: string | null, newValue: string | null): boolean {
  const before = parseSave(oldValue)
  const after = parseSave(newValue)
  if (!before || !after) return false
  const had = PROGRESS_SLICES.some((key) => before[key] !== undefined)
  const has = PROGRESS_SLICES.some((key) => after[key] !== undefined)
  return had && !has
}
