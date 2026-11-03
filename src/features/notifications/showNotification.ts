/**
 * How a session notification is delivered (Phase 9, Step 7). The browser APIs are injected so
 * every path is unit tested.
 *
 * 1. With a service worker: wait for the *active* registration (`navigator.serviceWorker.ready`,
 *    with a timeout, because `getRegistration()` can return one whose worker isn't active yet and
 *    `ready` never settles without a worker) and show it there. That's the only way on Android
 *    Chrome and on iPhone, and a tap is handled by the worker's `notificationclick` (`src/sw.ts`).
 * 2. Without an active worker (`pnpm dev`, or the worker failed): the `Notification` constructor,
 *    but only where it's allowed (desktop). Android Chrome throws on it and iOS doesn't offer it.
 * 3. Otherwise the promise rejects, and the notifier reports `failed`.
 */
import { notificationAssets } from '../../config/notifications'
import type { SessionNotification } from '../../core/timer/notification'

/** The parts of `ServiceWorkerRegistration` used here. */
export interface RegistrationLike {
  showNotification(title: string, options: NotificationOptions): Promise<void>
}

export interface ShowNotificationDeps {
  /** `navigator.serviceWorker`, or undefined where service workers aren't available. */
  serviceWorker?: {
    getRegistration(): Promise<RegistrationLike | undefined>
    ready: Promise<RegistrationLike>
  }
  /** False on Android and iPhone/iPad, where `new Notification` isn't allowed. */
  constructorAllowed: boolean
  /** `new Notification(title, options)` with a click that focuses the page. */
  construct(title: string, options: NotificationOptions): void
  timeoutMs: number
  setTimeout?: (fn: () => void, ms: number) => unknown
  clearTimeout?: (id: unknown) => void
}

/** Every notification's options: the session id as tag (a second tab replaces, never adds). */
export function notificationOptions({ body, tag }: SessionNotification): NotificationOptions {
  return {
    body,
    tag,
    lang: 'en',
    icon: notificationAssets.icon,
    badge: notificationAssets.badge,
    data: { url: notificationAssets.url },
  }
}

/** The active registration, or null if there's no worker or it didn't become active in time. */
async function activeRegistration(deps: ShowNotificationDeps): Promise<RegistrationLike | null> {
  const sw = deps.serviceWorker
  if (!sw) return null
  // No registration at all: `ready` would never settle, so don't wait for it.
  if (!(await sw.getRegistration().catch(() => undefined))) return null
  const set = deps.setTimeout ?? ((fn, ms) => globalThis.setTimeout(fn, ms))
  const clear = deps.clearTimeout ?? ((id) => globalThis.clearTimeout(id as ReturnType<typeof globalThis.setTimeout>))
  let timer: unknown
  const timeout = new Promise<null>((resolve) => {
    timer = set(() => resolve(null), deps.timeoutMs)
  })
  try {
    return await Promise.race([sw.ready.catch(() => null), timeout])
  } finally {
    clear(timer)
  }
}

export function createShowNotification(deps: ShowNotificationDeps) {
  return async function show(notification: SessionNotification): Promise<void> {
    const options = notificationOptions(notification)
    const registration = await activeRegistration(deps)
    if (registration) {
      await registration.showNotification(notification.title, options)
      return
    }
    if (!deps.constructorAllowed) throw new Error('No active service worker to show the notification')
    deps.construct(notification.title, options)
  }
}
