import type { StorageAdapter } from './adapter'

/**
 * Versioned app save. One key holds everything; each feature owns a slice.
 * Slices are stored as `unknown` and validated by their feature on load
 * (e.g. core/timer/restore.ts), so a damaged slice only resets that feature.
 */
export const STORAGE_KEY = 'koa:v1'
export const BACKUP_KEY = 'koa:backup'
export const SCHEMA_VERSION = 1

export interface PersistedState {
  version: typeof SCHEMA_VERSION
  timer?: unknown
  wallet?: unknown
  wardrobe?: unknown
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>

/** migrations[n] upgrades a save from version n to n + 1. */
const migrations: Record<number, Migration> = {}

function migrate(data: Record<string, unknown>): PersistedState | null {
  let current = data
  let version = typeof current.version === 'number' ? current.version : NaN
  while (Number.isInteger(version) && version < SCHEMA_VERSION) {
    const step = migrations[version]
    if (!step) return null
    current = step(current)
    version += 1
  }
  if (version !== SCHEMA_VERSION) return null
  return { ...current, version: SCHEMA_VERSION } as PersistedState
}

export function loadState(storage: StorageAdapter): PersistedState {
  const raw = storage.read(STORAGE_KEY)
  if (raw === null) return { version: SCHEMA_VERSION }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      const migrated = migrate(parsed as Record<string, unknown>)
      if (migrated) return migrated
    }
  } catch {
    // fall through to backup + reset
  }
  // Unreadable or from an unknown future version: keep a copy, start fresh.
  storage.write(BACKUP_KEY, raw)
  return { version: SCHEMA_VERSION }
}

export function saveSlice<K extends Exclude<keyof PersistedState, 'version'>>(
  storage: StorageAdapter,
  key: K,
  value: PersistedState[K],
): void {
  const current = loadState(storage)
  const next: PersistedState = { ...current, [key]: value, version: SCHEMA_VERSION }
  storage.write(STORAGE_KEY, JSON.stringify(next))
}
