/**
 * What tapping a session notification does (Phase 9, Step 7). Used by the service worker's
 * `notificationclick` handler (`src/sw.ts`). Only structural types are used here, so this file
 * compiles both in the app (DOM) and in the worker (WebWorker) and is unit tested without either.
 */

/** The parts of a `WindowClient` that matter here. */
export interface WindowClientLike {
  url: string
  focused: boolean
  focus(): Promise<unknown>
}

/** The parts of the worker's `Clients` that matter here. */
export interface ClientsLike<C extends WindowClientLike = WindowClientLike> {
  matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<readonly C[]>
  openWindow(url: string): Promise<unknown>
}

/** Whether a window shows Koa: same origin and inside the worker's scope (any hash tab). */
export function isKoaWindow(clientUrl: string, scope: string): boolean {
  let url: URL
  let base: URL
  try {
    url = new URL(clientUrl)
    base = new URL(scope)
  } catch {
    return false
  }
  return url.origin === base.origin && url.pathname.startsWith(base.pathname)
}

/**
 * The Koa window to bring forward: a focused one first, then any other Koa window (in the order
 * the browser lists them, which is most recently focused first). Null means none is open, so a
 * new one is opened. Windows of other sites or outside Koa's scope are never picked.
 */
export function pickClient<C extends WindowClientLike>(clients: readonly C[], scope: string): C | null {
  const koa = clients.filter((client) => isKoaWindow(client.url, scope))
  return koa.find((client) => client.focused) ?? koa[0] ?? null
}

/**
 * The page to open when no Koa window exists: the notification's `data.url` if it's a path or
 * URL inside Koa's scope, otherwise the scope itself (`/`). A notification can never open
 * another site.
 */
export function notificationTargetUrl(data: unknown, scope: string): string {
  const raw = typeof data === 'object' && data !== null ? (data as { url?: unknown }).url : undefined
  if (typeof raw === 'string') {
    try {
      const target = new URL(raw, scope).href
      if (isKoaWindow(target, scope)) return target
    } catch {
      // Not a URL: use the scope.
    }
  }
  return new URL(scope).href
}

/**
 * Focus an open Koa window, or open Koa if none is open. If the browser refuses to focus the
 * window it picked, Koa is opened instead, so a tap never does nothing. Resolves to what happened.
 */
export async function focusOrOpenKoa(clients: ClientsLike, scope: string, data: unknown): Promise<'focused' | 'opened'> {
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  const client = pickClient(windows, scope)
  if (client) {
    try {
      await client.focus()
      return 'focused'
    } catch {
      // Not allowed to focus it (rare): fall through and open Koa.
    }
  }
  await clients.openWindow(notificationTargetUrl(data, scope))
  return 'opened'
}
