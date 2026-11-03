/**
 * Install help store (Phase 9, Step 6; decision D8). Holds Chromium's `beforeinstallprompt` event
 * and decides what the "Install Koa" row shows (`installHelp`).
 *
 * - The browser's own install banner is suppressed (`preventDefault` in the env): no banners.
 * - The install prompt opens **only** from `install()`, which only the row's Install button calls.
 * - A captured event is used **once**: it's dropped before `prompt()` runs, whatever the outcome.
 *   Chromium may hand over a new one later, which shows the button again.
 *
 * The browser side is injected (`InstallEnv`) and mocked in tests. Every failure is caught.
 */
import { installHelp, type InstallBrowser, type InstallHelp } from '../../core/pwa/install'
import { STANDALONE_QUERIES } from './displayMode'

/** The `beforeinstallprompt` event's useful part (Chromium only, not in the DOM typings). */
export interface DeferredInstallPrompt {
  prompt(): Promise<unknown>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallEnv {
  /** A production build in a secure context. */
  supported: boolean
  browser: InstallBrowser
  /** `isStandalone()` right now. */
  isStandalone(): boolean
  /** Calls back when the display mode changes (e.g. the page moves into the installed app). */
  onDisplayModeChange(callback: () => void): () => void
  /** Calls back with each `beforeinstallprompt` (the env has already called `preventDefault`). */
  onBeforeInstallPrompt(callback: (event: DeferredInstallPrompt) => void): () => void
  /** Calls back on `appinstalled`. */
  onAppInstalled(callback: () => void): () => void
}

export interface InstallSnapshot {
  help: InstallHelp
  /** The prompt is open (between the tap and the user's answer). */
  prompting: boolean
}

export type InstallStore = ReturnType<typeof createInstallStore>

export function createInstallStore({ env }: { env: InstallEnv }) {
  let deferred: DeferredInstallPrompt | null = null
  let accepted = false
  let prompting = false
  let stops: (() => void)[] = []
  const listeners = new Set<() => void>()

  const compute = (): InstallSnapshot => {
    let standalone = false
    try {
      standalone = env.isStandalone()
    } catch {
      // Unknown: treat as a browser tab.
    }
    return {
      help: installHelp({
        supported: env.supported,
        standalone,
        browser: env.browser,
        // While the prompt is open the (disabled) Install button stays in place.
        promptAvailable: deferred !== null || prompting,
        accepted,
      }),
      prompting,
    }
  }

  let snapshot = compute()

  const refresh = () => {
    const next = compute()
    if (next.help === snapshot.help && next.prompting === snapshot.prompting) return
    snapshot = next
    listeners.forEach((listener) => {
      try {
        listener()
      } catch {
        // A broken listener never stops the store.
      }
    })
  }

  return {
    /** Which browser family this is (for the menu wording). Doesn't change. */
    browser: env.browser,
    getState: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /** Start listening for the browser's install events. Call once, early (before the event fires). */
    start() {
      if (stops.length > 0 || !env.supported) return
      const listen = (attach: () => () => void) => {
        try {
          stops.push(attach())
        } catch {
          // A missing API just means that event never arrives.
        }
      }
      listen(() =>
        env.onBeforeInstallPrompt((event) => {
          deferred = event
          refresh()
        }),
      )
      listen(() =>
        env.onAppInstalled(() => {
          accepted = true
          deferred = null
          refresh()
        }),
      )
      listen(() => env.onDisplayModeChange(refresh))
      refresh()
    },

    /**
     * Open the browser's install prompt. Only call this from the user's tap on Install. Uses the
     * captured event once; without one (or while a prompt is open) it does nothing.
     */
    async install(): Promise<void> {
      const event = deferred
      if (!event || prompting) return
      deferred = null // used once, whatever happens next
      prompting = true
      refresh()
      try {
        await event.prompt()
        const { outcome } = await event.userChoice
        if (outcome === 'accepted') accepted = true
      } catch {
        // The browser refused (e.g. the event went stale). The row falls back to the menu steps.
      } finally {
        prompting = false
        refresh()
      }
    },

    stop() {
      stops.forEach((stopListening) => stopListening())
      stops = []
    },
  }
}

/** The real browser environment. */
export function browserInstallEnv({
  supported,
  browser,
  isStandalone,
}: {
  supported: boolean
  browser: InstallBrowser
  isStandalone: () => boolean
}): InstallEnv {
  return {
    supported,
    browser,
    isStandalone,
    onDisplayModeChange(callback) {
      if (typeof window.matchMedia !== 'function') return () => {}
      const lists = STANDALONE_QUERIES.map((q) => window.matchMedia(q))
      lists.forEach((list) => list.addEventListener('change', callback))
      return () => lists.forEach((list) => list.removeEventListener('change', callback))
    },
    onBeforeInstallPrompt(callback) {
      const handler = (event: Event) => {
        // No mini-infobar or banner (decision D8); Koa offers it quietly in Settings instead.
        event.preventDefault()
        callback(event as Event & DeferredInstallPrompt)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    },
    onAppInstalled(callback) {
      window.addEventListener('appinstalled', callback)
      return () => window.removeEventListener('appinstalled', callback)
    },
  }
}
