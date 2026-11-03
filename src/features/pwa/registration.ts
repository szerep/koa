/**
 * Service worker registration (Phase 9, Step 3). Registers Koa's offline service worker once,
 * after the page has loaded. The browser side is injected (`PwaEnv`), so the logic is tested with
 * mocks. Every failure is caught: a missing or broken service worker never affects the app, which
 * keeps working online exactly as before.
 *
 * A new version installs in the background and waits. `onNeedRefresh` reports it to the update
 * flow (Step 4, `updateStore.ts`), which applies it only when the user taps Update.
 */

export interface PwaRegisterHandlers {
  /** The service worker is registered (it may still be installing). */
  onRegistered(registration: ServiceWorkerRegistration | undefined): void
  /** Registering failed (for example a network error or a broken worker script). */
  onError(error: unknown): void
  /** A new version is installed and waiting (may be reported more than once). */
  onNeedRefresh(): void
}

export interface PwaEnv {
  /**
   * Whether a service worker can be used: a production build (never `pnpm dev`), a secure
   * context and `navigator.serviceWorker`.
   */
  supported: boolean
  /** Run `callback` once the page has finished loading (right away if it already has). */
  afterLoad(callback: () => void): void
  /** Register the worker (`virtual:pwa-register`'s `registerSW`). May throw. */
  register(handlers: PwaRegisterHandlers): void
}

/**
 * - `unsupported`: no service worker here (dev server, insecure context, or no API).
 * - `idle`: supported, `register()` not called yet.
 * - `waiting`: waiting for the page to finish loading.
 * - `registering`: registration started.
 * - `registered`: the browser accepted the worker.
 * - `failed`: registration threw or reported an error. The app works online as before.
 */
export type PwaStatus = 'unsupported' | 'idle' | 'waiting' | 'registering' | 'registered' | 'failed'

export type PwaRegistration = ReturnType<typeof createPwaRegistration>

export function createPwaRegistration({ env }: { env: PwaEnv }) {
  let status: PwaStatus = env.supported ? 'idle' : 'unsupported'
  let registration: ServiceWorkerRegistration | undefined
  const listeners = new Set<() => void>()
  const updateListeners = new Set<() => void>()

  const setStatus = (next: PwaStatus) => {
    if (next === status) return
    status = next
    listeners.forEach((listener) => {
      try {
        listener()
      } catch {
        // A broken listener never stops registration.
      }
    })
  }

  const start = () => {
    if (status !== 'waiting') return
    setStatus('registering')
    try {
      env.register({
        onRegistered(reg) {
          registration = reg
          if (status === 'registering') setStatus('registered')
        },
        onError() {
          if (status === 'registering') setStatus('failed')
        },
        onNeedRefresh() {
          updateListeners.forEach((listener) => {
            try {
              listener()
            } catch {
              // A broken listener never stops registration.
            }
          })
        },
      })
    } catch {
      setStatus('failed')
    }
  }

  return {
    getState: () => status,
    /** The registration once `registered` (used by the update flow). */
    getRegistration: () => registration,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** Called whenever a new version is installed and waiting. */
    onUpdateReady(listener: () => void) {
      updateListeners.add(listener)
      return () => {
        updateListeners.delete(listener)
      }
    },
    /** Register once, after the page has loaded. Further calls do nothing. */
    register() {
      if (status !== 'idle') return
      setStatus('waiting')
      try {
        env.afterLoad(start)
      } catch {
        setStatus('failed')
      }
    },
  }
}
