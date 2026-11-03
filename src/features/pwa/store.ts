import { detectInstallBrowser } from '../../core/pwa/install'
import { browserPwaEnv, browserUpdateEnv } from './browserPwaEnv'
import { browserDisplayModeEnv, isStandalone } from './displayMode'
import { browserInstallEnv, createInstallStore } from './installStore'
import { createPwaRegistration } from './registration'
import { createUpdateStore } from './updateStore'

const pwaEnv = browserPwaEnv()

/** Koa's service worker registration (offline support). */
export const pwa = createPwaRegistration({ env: pwaEnv })

/** The update flow: a waiting new version, applied only when the user taps Update. */
export const updates = createUpdateStore({ env: browserUpdateEnv(() => pwa.getRegistration()) })

/** Install help for the "Install Koa" row in Settings (Step 6). Listening starts in connect.ts. */
export const install = createInstallStore({
  env: browserInstallEnv({
    // Installing needs the manifest and the service worker: production, secure context.
    supported: pwaEnv.supported,
    browser:
      typeof navigator === 'undefined'
        ? 'other'
        : detectInstallBrowser({
            userAgent: navigator.userAgent,
            maxTouchPoints: navigator.maxTouchPoints ?? 0,
            hasBeforeInstallPrompt: typeof window !== 'undefined' && 'onbeforeinstallprompt' in window,
          }),
    isStandalone: () => isStandalone(browserDisplayModeEnv()),
  }),
})
