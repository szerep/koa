/**
 * The update flow (Phase 9, Step 4; decision D3). A new version of Koa installs in the background
 * and waits. This store knows whether one is waiting and applies it only when the user taps
 * Update. It never reloads on its own.
 *
 * - `none`: no new version is waiting (or none was found yet).
 * - `ready`: a new version is installed and waiting (the plugin's `onNeedRefresh`).
 * - `updating`: Update was tapped; the waiting version is taking over, then the page reloads once.
 *
 * "Later" sets `dismissed`, which hides the prompt until the next launch (it isn't saved). When
 * the prompt may be shown at all (never during a running focus session) is decided by
 * `shouldOfferUpdate` in the component, so the store stays independent of the timer.
 *
 * The browser side is injected (`UpdateEnv`) and mocked in tests. Every failure is caught.
 */
import { pwaUpdateConfig } from '../../config/pwa'
import { isUpdateCheckDue } from '../../core/pwa/update'

export type UpdateState = 'none' | 'ready' | 'updating'

export interface UpdateSnapshot {
  state: UpdateState
  /** "Later" was tapped in this launch. */
  dismissed: boolean
}

export interface UpdateEnv {
  /** `navigator.onLine`. */
  isOnline(): boolean
  /** Ask the browser to look for a new worker (`registration.update()`). May reject. */
  check(): Promise<void>
  /**
   * Tell the waiting worker to take over (`SKIP_WAITING`). Resolves once it controls this page
   * (or there's nothing waiting any more, e.g. another tab already applied it). Rejects if it
   * can't take over.
   */
  activate(): Promise<void>
  /** Reload the page into the new version. */
  reload(): void
}

export interface UpdateStoreOptions {
  env: UpdateEnv
  now?: () => number
  checkIntervalMs?: number
  activateTimeoutMs?: number
}

export type UpdateStore = ReturnType<typeof createUpdateStore>

export function createUpdateStore({
  env,
  now = Date.now,
  checkIntervalMs = pwaUpdateConfig.checkIntervalMs,
  activateTimeoutMs = pwaUpdateConfig.activateTimeoutMs,
}: UpdateStoreOptions) {
  let snapshot: UpdateSnapshot = { state: 'none', dismissed: false }
  let lastCheckAt: number | null = null
  let checking = false
  let reloaded = false
  const listeners = new Set<() => void>()

  const set = (next: Partial<UpdateSnapshot>) => {
    const merged = { ...snapshot, ...next }
    if (merged.state === snapshot.state && merged.dismissed === snapshot.dismissed) return
    snapshot = merged
    listeners.forEach((listener) => {
      try {
        listener()
      } catch {
        // A broken listener never stops the update flow.
      }
    })
  }

  const withTimeout = (promise: Promise<void>) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), activateTimeoutMs)
      promise.then(
        () => {
          clearTimeout(timer)
          resolve()
        },
        (error: unknown) => {
          clearTimeout(timer)
          reject(error)
        },
      )
    })

  return {
    getState: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /** A new version is installed and waiting (`onNeedRefresh`). May be reported more than once. */
    ready() {
      if (snapshot.state === 'none') set({ state: 'ready' })
    },

    /**
     * Look for a new version: on launch and when Koa becomes visible. At most once per interval,
     * never offline (an offline attempt doesn't count), never while one is already waiting.
     */
    async check() {
      if (checking || snapshot.state !== 'none') return
      let online: boolean
      try {
        online = env.isOnline()
      } catch {
        online = true
      }
      const at = now()
      if (!isUpdateCheckDue({ lastCheckAt, now: at, online, intervalMs: checkIntervalMs })) return
      lastCheckAt = at
      checking = true
      try {
        await env.check()
      } catch {
        // A failed check (network, server) is retried after the next interval.
      } finally {
        checking = false
      }
    },

    /** The Update tap: hand over to the waiting version and reload once. */
    async update() {
      if (snapshot.state !== 'ready') return
      set({ state: 'updating' })
      try {
        await withTimeout(Promise.resolve().then(() => env.activate()))
      } catch {
        set({ state: 'ready' })
        return
      }
      if (reloaded) return
      reloaded = true
      try {
        env.reload()
      } catch {
        reloaded = false
        set({ state: 'ready' })
      }
    },

    /** The Later tap: hide the prompt until the next launch. */
    later() {
      set({ dismissed: true })
    },
  }
}
