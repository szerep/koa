/**
 * Where persisted data lives. LocalStorage today; IndexedDB or cloud sync later
 * can implement the same interface without touching features.
 */
export interface StorageAdapter {
  read(key: string): string | null
  write(key: string, value: string): void
  remove(key: string): void
}

/** LocalStorage, failing soft: private mode, quota or blocked storage never crash the app. */
export const localStorageAdapter: StorageAdapter = {
  read(key) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  write(key, value) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Storage unavailable or full: the app keeps working in memory.
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
}

/** In-memory adapter for tests and environments without storage. */
export function createMemoryAdapter(initial: Record<string, string> = {}): StorageAdapter & {
  data: Record<string, string>
} {
  const data = { ...initial }
  return {
    data,
    read: (key) => (key in data ? data[key] : null),
    write: (key, value) => {
      data[key] = value
    },
    remove: (key) => {
      delete data[key]
    },
  }
}
