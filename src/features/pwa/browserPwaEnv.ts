import { registerSW } from 'virtual:pwa-register'
import type { PwaEnv } from './registration'
import type { UpdateEnv } from './updateStore'

/**
 * The real browser environment. Kept apart from `registration.ts` because it imports the
 * plugin's virtual module, which only exists inside a Vite build.
 *
 * Never supported in development: `devOptions.enabled` is off, so `pnpm dev` has no worker,
 * and `import.meta.env.PROD` keeps this from even trying.
 */
export function browserPwaEnv(): PwaEnv {
  const supported =
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator

  return {
    supported,
    afterLoad(callback) {
      if (document.readyState === 'complete') callback()
      else window.addEventListener('load', () => callback(), { once: true })
    },
    register({ onRegistered, onError, onNeedRefresh }) {
      // `immediate`: the load event has already been waited for (afterLoad).
      registerSW({
        immediate: true,
        onRegisteredSW: (_url, registration) => onRegistered(registration),
        onRegisterError: onError,
        onNeedRefresh,
        // Without this, the plugin reloads the page as soon as a new worker takes control,
        // including in *other* tabs when one tab applies an update (decision D3: never reload
        // on its own). Only the tab where Update was tapped reloads (`browserUpdateEnv`).
        onNeedReload: () => {},
      })
    },
  }
}

/**
 * The update flow's browser side. `getRegistration` comes from the registration store; before
 * Koa is registered there's nothing to check or apply.
 */
export function browserUpdateEnv(getRegistration: () => ServiceWorkerRegistration | undefined): UpdateEnv {
  return {
    isOnline: () => navigator.onLine !== false,
    async check() {
      await getRegistration()?.update()
    },
    activate() {
      return new Promise<void>((resolve, reject) => {
        const waiting = getRegistration()?.waiting
        // Nothing waiting any more: another tab already applied the update, so this tab is
        // controlled by the new worker but still runs the old page. A reload is all it needs.
        if (!waiting) {
          resolve()
          return
        }
        const done = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', done)
          resolve()
        }
        // A controlled page sees `controllerchange`. A page the old worker never controlled (the
        // very first visit, no clientsClaim) doesn't, so the worker's own state is watched too.
        navigator.serviceWorker.addEventListener('controllerchange', done)
        waiting.addEventListener('statechange', () => {
          if (waiting.state === 'activated') done()
          else if (waiting.state === 'redundant') reject(new Error('the new version was discarded'))
        })
        waiting.postMessage({ type: 'SKIP_WAITING' })
      })
    },
    reload: () => window.location.reload(),
  }
}
