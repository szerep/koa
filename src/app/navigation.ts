/**
 * Koa's screens and how the Wardrobe is opened and left (Phase 12).
 *
 * Every screen is a hash route (#/shop), so refresh and back work. The four tabs are in the bottom
 * nav; the Wardrobe is a route outside it, opened from Home or the Shop. Its "Done" returns to the
 * screen it was opened from, as a new history entry (like a tab tap, never `history.back()`, which
 * could leave Koa after a direct link). Loaded directly, or after leaving it some other way, Done
 * goes Home.
 */

export const TABS = ['home', 'shop', 'stats', 'settings'] as const
export type Tab = (typeof TABS)[number]

export const ROUTES = [...TABS, 'wardrobe'] as const
export type Route = (typeof ROUTES)[number]

export const isTab = (route: unknown): route is Tab => (TABS as readonly unknown[]).includes(route)

/** Where Done goes: the remembered screen if it's a tab, otherwise Home. */
export const returnTarget = (origin: unknown): Tab => (isTab(origin) ? origin : 'home')

export type WardrobeNavigation = ReturnType<typeof createWardrobeNavigation>

/**
 * `go` changes the route (the hash in the app). Keyboard focus follows the user: opening the
 * Wardrobe moves it to the Wardrobe's heading, and Done moves it back to the button that opened
 * it. A screen claims such a request with `takeFocus` when it mounts. State is in memory only.
 */
export function createWardrobeNavigation(go: (route: Route) => void) {
  let origin: Tab | null = null
  let focusRequest: Route | null = null

  return {
    /** Open the Wardrobe from a tab; Done will come back there. */
    open(from: Tab) {
      origin = from
      focusRequest = 'wardrobe'
      go('wardrobe')
    },

    /** Done: back to where the Wardrobe was opened from (Home if unknown). */
    close() {
      const to = returnTarget(origin)
      origin = null
      focusRequest = to
      go(to)
    },

    /** Go to a tab from the Wardrobe without coming back (the empty state's "Visit the Shop"). */
    visit(tab: Tab) {
      origin = null
      focusRequest = null
      go(tab)
    },

    /**
     * The app reports every route it shows. Leaving the Wardrobe in any other way (a nav tab, the
     * back gesture) forgets where it was opened from, and a focus request for another screen lapses.
     */
    arrived(route: Route) {
      if (route !== 'wardrobe') origin = null
      if (focusRequest !== route) focusRequest = null
    },

    /** True once if `screen` should take keyboard focus now that it has mounted. */
    takeFocus(screen: Route): boolean {
      if (focusRequest !== screen) return false
      focusRequest = null
      return true
    },
  }
}

export const wardrobeNav = createWardrobeNavigation((route) => {
  window.location.hash = `/${route}`
})
