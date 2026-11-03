/**
 * Install help (Phase 9, Step 6; decision D8): what the quiet "Install Koa" row in Settings shows.
 * Pure: the browser facts come in as input, so every platform is unit tested.
 *
 * - `installed`: Koa already runs as an installed app (standalone). The row is hidden.
 * - `accepted`: the user just installed Koa from this browser tab. The row says where to find it.
 * - `prompt-available`: Chromium handed us an install prompt (`beforeinstallprompt`). The row shows
 *   an Install button; the prompt opens only from that tap.
 * - `ios-steps`: iPhone or iPad. iOS has no install prompt, so the row shows Share → Add to Home
 *   Screen, and that the Home Screen app keeps its own data (decision D10).
 * - `menu`: a browser that installs from its own menu (Chromium without a prompt right now,
 *   Safari on a Mac, Firefox on Android). The row names the menu item.
 * - `hidden`: installing isn't possible or Koa can't tell (Firefox on desktop, a development
 *   build, an insecure context). The row is hidden.
 */
export type InstallHelp = 'installed' | 'accepted' | 'prompt-available' | 'ios-steps' | 'menu' | 'hidden'

/**
 * The browser family, as far as installing goes.
 * - `apple-mobile`: any browser on iPhone or iPad (all use the Share → Add to Home Screen flow).
 * - `safari-mac`: Safari on a Mac (File → Add to Dock, macOS Sonoma or later).
 * - `chromium-desktop`, `chromium-android`: Chrome, Edge, Samsung Internet, Opera and others
 *   that support `beforeinstallprompt`.
 * - `firefox-android`: Firefox on Android (menu → Add to Home screen).
 * - `other`: anything else (including Firefox on desktop, which can't install web apps).
 */
export type InstallBrowser =
  | 'apple-mobile'
  | 'safari-mac'
  | 'chromium-desktop'
  | 'chromium-android'
  | 'firefox-android'
  | 'other'

export interface InstallInput {
  /** A production build in a secure context (the manifest and service worker exist). */
  supported: boolean
  /** Koa runs as an installed app (`isStandalone`). */
  standalone: boolean
  browser: InstallBrowser
  /** An unused `beforeinstallprompt` event is held. */
  promptAvailable: boolean
  /** The user accepted the install prompt, or `appinstalled` fired, in this tab. */
  accepted: boolean
}

export function installHelp({ supported, standalone, browser, promptAvailable, accepted }: InstallInput): InstallHelp {
  if (standalone) return 'installed'
  if (!supported) return 'hidden'
  if (accepted) return 'accepted'
  if (promptAvailable) return 'prompt-available'
  switch (browser) {
    case 'apple-mobile':
      return 'ios-steps'
    case 'safari-mac':
    case 'chromium-desktop':
    case 'chromium-android':
    case 'firefox-android':
      return 'menu'
    case 'other':
      return 'hidden'
  }
}

/** What the browser tells us, for `detectInstallBrowser`. */
export interface BrowserFacts {
  userAgent: string
  maxTouchPoints: number
  /** `'onbeforeinstallprompt' in window`: only Chromium-based browsers have it. */
  hasBeforeInstallPrompt: boolean
}

/** iPhone, or an iPad (which reports itself as a Mac with a touch screen). */
export function isAppleMobileAgent(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

export function detectInstallBrowser({ userAgent, maxTouchPoints, hasBeforeInstallPrompt }: BrowserFacts): InstallBrowser {
  if (isAppleMobileAgent(userAgent, maxTouchPoints)) return 'apple-mobile'
  const android = /Android/.test(userAgent)
  if (hasBeforeInstallPrompt) return android ? 'chromium-android' : 'chromium-desktop'
  if (android && /Firefox\//.test(userAgent)) return 'firefox-android'
  if (/Macintosh/.test(userAgent) && /Version\/[\d.]+.*Safari\//.test(userAgent) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(userAgent)) {
    return 'safari-mac'
  }
  return 'other'
}
