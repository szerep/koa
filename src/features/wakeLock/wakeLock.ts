/**
 * Screen Wake Lock (Phase 8, Step 8). Keeps the screen on while `wanted()` says so and the
 * page is visible. The browser APIs are injected (`WakeLockEnv`), so the logic is tested with
 * mocks. Every failure is caught: a refused or broken wake lock never affects the timer.
 */

/** The part of `WakeLockSentinel` this uses. */
export interface WakeLockSentinelLike {
  readonly released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
  removeEventListener(type: 'release', listener: () => void): void
}

export interface WakeLockEnv {
  /** `navigator.wakeLock.request`, or null where the API isn't available. */
  request: ((type: 'screen') => Promise<WakeLockSentinelLike>) | null
  isVisible(): boolean
  /** Subscribe to page visibility changes; returns the unsubscribe function. */
  onVisibilityChange(listener: () => void): () => void
}

/**
 * - `unsupported`: the browser has no Screen Wake Lock API (or the page isn't a secure context).
 * - `off`: supported, not holding a lock right now.
 * - `active`: the screen is being kept on.
 * - `failed`: the last request was refused (low battery, policy, permissions). Tried again
 *   the next time the lock is wanted (a timer or setting change, or the page becoming visible).
 */
export type WakeLockStatus = 'unsupported' | 'off' | 'active' | 'failed'

export interface WakeLockControllerOptions {
  env: WakeLockEnv
  /** Whether the lock should be held right now, ignoring visibility. */
  wanted: () => boolean
}

export type WakeLockController = ReturnType<typeof createWakeLockController>

export function createWakeLockController({ env, wanted }: WakeLockControllerOptions) {
  const { request } = env
  let sentinel: WakeLockSentinelLike | null = null
  let pending = false
  let disposed = false
  let status: WakeLockStatus = request ? 'off' : 'unsupported'
  const listeners = new Set<() => void>()

  const setStatus = (next: WakeLockStatus) => {
    if (next === status) return
    status = next
    listeners.forEach((l) => l())
  }

  const shouldHold = () => !disposed && env.isVisible() && wanted()

  /** The browser released it (page hidden) or we did. Forget it; `update` decides what's next. */
  const onReleased = () => {
    if (sentinel === null || !sentinel.released) return
    sentinel.removeEventListener('release', onReleased)
    sentinel = null
    if (status === 'active') setStatus('off')
  }

  const release = () => {
    const held = sentinel
    if (!held) return
    held.removeEventListener('release', onReleased)
    sentinel = null
    if (status === 'active') setStatus('off')
    held.release().catch(() => {
      // Already released by the browser; nothing to do.
    })
  }

  const acquire = () => {
    if (!request || sentinel || pending) return
    pending = true
    let attempt: Promise<WakeLockSentinelLike>
    try {
      attempt = request('screen')
    } catch (error) {
      attempt = Promise.reject(error)
    }
    attempt.then(
      (lock) => {
        pending = false
        // Things may have changed while waiting (paused, hidden, setting off).
        if (!shouldHold() || lock.released) {
          lock.release().catch(() => {})
          update()
          return
        }
        sentinel = lock
        lock.addEventListener('release', onReleased)
        setStatus('active')
      },
      () => {
        pending = false
        setStatus('failed')
      },
    )
  }

  function update() {
    if (!request || disposed) return
    if (sentinel?.released) onReleased()
    if (shouldHold()) acquire()
    else {
      release()
      // Turning the setting off (or the session ending) clears an earlier failure.
      if (status === 'failed' && !wanted()) setStatus('off')
    }
  }

  const stopVisibility = request ? env.onVisibilityChange(update) : () => {}

  return {
    getStatus: () => status,

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /** Re-check whether the lock should be held; call on every timer or setting change. */
    update,

    /** Stop listening and release any lock. */
    dispose() {
      if (disposed) return
      disposed = true
      stopVisibility()
      release()
      listeners.clear()
    },
  }
}

/** The real browser environment. Unsupported outside a secure context or without the API. */
export function browserWakeLockEnv(): WakeLockEnv {
  const api =
    typeof window !== 'undefined' && window.isSecureContext && 'wakeLock' in navigator ? navigator.wakeLock : null
  return {
    request: api ? (type) => api.request(type) : null,
    isVisible: () => document.visibilityState === 'visible',
    onVisibilityChange(listener) {
      document.addEventListener('visibilitychange', listener)
      return () => document.removeEventListener('visibilitychange', listener)
    },
  }
}
