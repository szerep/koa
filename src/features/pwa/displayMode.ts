/**
 * Whether Koa runs as an installed app (Phase 9, Step 6). The browser side is injected
 * (`DisplayModeEnv`), so it's tested with mocks.
 */

export interface DisplayModeEnv {
  /** `window.matchMedia(query).matches`; false when matchMedia doesn't exist. */
  matches(query: string): boolean
  /** iOS Safari's non-standard `navigator.standalone` (true in a Home Screen app). */
  navigatorStandalone: boolean | undefined
}

/**
 * The installed-app display modes. The manifest asks for `standalone`; a browser may fall back to
 * `fullscreen`, and an installed desktop app with a custom title bar reports
 * `window-controls-overlay`.
 */
export const STANDALONE_QUERIES = [
  '(display-mode: standalone)',
  '(display-mode: fullscreen)',
  '(display-mode: window-controls-overlay)',
] as const

/** True in an installed app: a standalone display mode, or `navigator.standalone` on iOS. */
export function isStandalone(env: DisplayModeEnv): boolean {
  if (env.navigatorStandalone === true) return true
  return STANDALONE_QUERIES.some((query) => {
    try {
      return env.matches(query)
    } catch {
      return false
    }
  })
}

export function browserDisplayModeEnv(): DisplayModeEnv {
  return {
    matches: (query) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    navigatorStandalone:
      typeof navigator !== 'undefined' ? (navigator as Navigator & { standalone?: boolean }).standalone : undefined,
  }
}
