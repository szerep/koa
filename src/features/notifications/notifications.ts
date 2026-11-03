/**
 * Session-complete notifications (Phase 8, Step 9). The browser APIs are injected
 * (`NotificationEnv`), so the logic is tested with mocks. Permission is requested only from
 * `enable()`, which the Settings switch calls on a tap; nothing asks on launch. Every failure
 * is caught: a refused or broken notification never affects the timer or rewards.
 */
import { notificationWorkerTimeoutMs } from '../../config/notifications'
import type { SessionNotification } from '../../core/timer/notification'
import { createShowNotification } from './showNotification'

export type PermissionState = 'default' | 'granted' | 'denied'

export interface NotificationEnv {
  /** False without the Notification API, or outside a secure context. Nothing else is called then. */
  supported: boolean
  /** iPhone or iPad: notifications need the installed Home Screen app there (explains `unsupported`). */
  appleMobile: boolean
  permission(): PermissionState
  /** Must be called straight from a user gesture (Safari ignores it otherwise). */
  requestPermission(): Promise<PermissionState>
  show(notification: SessionNotification): Promise<void>
  /** The user is looking at Koa (page visible and focused): no notification needed. */
  isAttentive(): boolean
  /**
   * Subscribe to moments the permission may have changed (the user came back from the
   * browser's site settings, or the Permissions API reported a change). Returns the unsubscribe.
   */
  onPermissionChange(listener: () => void): () => void
}

/**
 * - `unsupported`: no Notification API here (on iPhone: not the installed Home Screen app).
 * - `default`: not asked yet. Turning the switch on asks.
 * - `requesting`: the browser's prompt is open.
 * - `dismissed`: the prompt was closed without an answer. Turning the switch on asks again.
 * - `denied`: blocked. Only the browser's site settings can change that.
 * - `granted`: allowed (the setting decides whether Koa uses it).
 * - `failed`: allowed, but the last notification couldn't be shown. Tried again next time.
 */
export type NotificationStatus = 'unsupported' | 'default' | 'requesting' | 'dismissed' | 'denied' | 'granted' | 'failed'

export interface NotifierOptions {
  env: NotificationEnv
  /** The saved setting. */
  enabled: () => boolean
  setEnabled: (on: boolean) => void
}

export type Notifier = ReturnType<typeof createNotifier>

export function createNotifier({ env, enabled, setEnabled }: NotifierOptions) {
  /** What happened in this session on top of the browser's permission. */
  let transient: 'requesting' | 'dismissed' | 'failed' | null = null
  let disposed = false
  const listeners = new Set<() => void>()

  const permission = (): PermissionState => {
    try {
      return env.permission()
    } catch {
      return 'default'
    }
  }

  const compute = (): NotificationStatus => {
    if (!env.supported) return 'unsupported'
    if (transient === 'requesting') return 'requesting'
    const current = permission()
    if (current === 'denied') return 'denied'
    if (current === 'granted') return transient === 'failed' ? 'failed' : 'granted'
    return transient === 'dismissed' ? 'dismissed' : 'default'
  }

  let status = compute()

  /** Re-read the permission and tell subscribers if the status changed. */
  const update = () => {
    if (disposed) return
    const next = compute()
    if (next === status) return
    status = next
    listeners.forEach((l) => l())
  }

  const setTransient = (next: typeof transient) => {
    transient = next
    update()
  }

  const stopListening = env.supported ? env.onPermissionChange(update) : () => {}

  return {
    getStatus: () => status,

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /**
     * Turn notifications on. Asks for permission if it hasn't been given (call this from the
     * tap itself). Resolves true when they're on; on a refusal or a dismissed prompt the setting
     * stays off and the status explains why.
     */
    async enable(): Promise<boolean> {
      if (disposed || !env.supported || transient === 'requesting') return false
      const current = permission()
      if (current === 'granted') {
        setTransient(null)
        setEnabled(true)
        return true
      }
      if (current === 'denied') {
        update()
        return false
      }

      setTransient('requesting')
      let answer: PermissionState
      try {
        answer = await env.requestPermission()
      } catch {
        answer = permission()
      }
      if (disposed) return false
      // Trust what the browser reports now over the answer (some browsers resolve oddly).
      const settled = permission() === 'default' ? answer : permission()
      setTransient(settled === 'default' ? 'dismissed' : null)
      if (settled !== 'granted') return false
      setEnabled(true)
      return true
    },

    /** Turn notifications off. The browser keeps its permission; Koa just stops using it. */
    disable() {
      if (disposed) return
      setEnabled(false)
      if (transient !== 'requesting') setTransient(null)
    },

    /** Show a notification if they're on, allowed, and the user isn't looking at Koa. */
    notify(notification: SessionNotification | null) {
      if (disposed || !notification || !env.supported || !enabled()) return
      if (permission() !== 'granted') {
        update()
        return
      }
      let attentive: boolean
      try {
        attentive = env.isAttentive()
      } catch {
        attentive = false
      }
      if (attentive) return

      let shown: Promise<void>
      try {
        shown = env.show(notification)
      } catch (error) {
        shown = Promise.reject(error)
      }
      shown.then(
        () => {
          if (transient === 'failed') setTransient(null)
        },
        () => setTransient('failed'),
      )
    },

    /** Re-read the permission (also done automatically when the app regains focus). */
    update,

    /** Stop listening. A pending permission request is ignored when it resolves. */
    dispose() {
      if (disposed) return
      disposed = true
      stopListening()
      listeners.clear()
    },
  }
}

/** iPhone, or an iPad (which reports itself as a Mac with a touch screen). */
function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

/** Android: Chrome there only shows notifications through a service worker. */
function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

/** The real browser environment. Unsupported outside a secure context or without the API. */
export function browserNotificationEnv(): NotificationEnv {
  const supported = typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window
  return {
    supported,
    appleMobile: isAppleMobile(),
    permission: () => (supported ? Notification.permission : 'default'),

    requestPermission: () =>
      new Promise<PermissionState>((resolve, reject) => {
        // Older Safari only supports the callback form; newer browsers return a promise.
        const result: Promise<PermissionState> | undefined = Notification.requestPermission(resolve)
        result?.then(resolve, reject)
      }),

    // Phase 9 Step 7: the active service worker when there is one (Android and iPhone need it);
    // the constructor only on desktop. See showNotification.ts.
    show: createShowNotification({
      serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
      constructorAllowed: !isAppleMobile() && !isAndroid(),
      construct(title, options) {
        const notification = new Notification(title, options)
        notification.onclick = () => {
          window.focus()
          notification.close()
        }
      },
      timeoutMs: notificationWorkerTimeoutMs,
    }),

    isAttentive: () => document.visibilityState === 'visible' && document.hasFocus(),

    onPermissionChange(listener) {
      let stopped = false
      let permissionStatus: PermissionStatus | null = null
      document.addEventListener('visibilitychange', listener)
      window.addEventListener('focus', listener)
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'notifications' }).then(
          (s) => {
            if (stopped) return
            permissionStatus = s
            s.addEventListener('change', listener)
          },
          () => {
            // Not queryable here; focus and visibility still cover it.
          },
        )
      }
      return () => {
        stopped = true
        document.removeEventListener('visibilitychange', listener)
        window.removeEventListener('focus', listener)
        permissionStatus?.removeEventListener('change', listener)
      }
    },
  }
}
