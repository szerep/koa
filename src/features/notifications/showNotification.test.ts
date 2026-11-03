import { afterEach, describe, expect, it, vi } from 'vitest'
import { notificationAssets } from '../../config/notifications'
import { createNotifier, type NotificationEnv } from './notifications'
import { createShowNotification, notificationOptions, type RegistrationLike, type ShowNotificationDeps } from './showNotification'

const note = { title: 'Focus session done', body: 'Nice work.', tag: 'session-1' }

function registration() {
  const shown: { title: string; options: NotificationOptions }[] = []
  const reg: RegistrationLike & { shown: typeof shown; fails: boolean } = {
    shown,
    fails: false,
    showNotification(title, options) {
      if (reg.fails) return Promise.reject(new Error('blocked'))
      shown.push({ title, options })
      return Promise.resolve()
    },
  }
  return reg
}

/** A worker container: `ready` settles only when `activate()` is called (like the real one). */
function container(registered: RegistrationLike | undefined) {
  let activate: (r: RegistrationLike) => void = () => {}
  const ready = new Promise<RegistrationLike>((resolve) => {
    activate = resolve
  })
  return {
    sw: { getRegistration: () => Promise.resolve(registered), ready },
    activate: (r: RegistrationLike) => activate(r),
  }
}

function deps(overrides: Partial<ShowNotificationDeps> = {}) {
  const constructed: { title: string; options: NotificationOptions }[] = []
  const d: ShowNotificationDeps = {
    constructorAllowed: true,
    construct: (title, options) => {
      constructed.push({ title, options })
    },
    timeoutMs: 3000,
    ...overrides,
  }
  return { d, constructed }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('notification options', () => {
  it('carry the icon, badge, tag, language and the page to open', () => {
    expect(notificationOptions(note)).toEqual({
      body: 'Nice work.',
      tag: 'session-1',
      lang: 'en',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: '/' },
    })
    expect(notificationAssets.url).toBe('/')
  })
})

describe('showing through the service worker', () => {
  it('uses the active registration from ready, never the constructor', async () => {
    const active = registration()
    const c = container(registration())
    c.activate(active)
    const { d, constructed } = deps({ serviceWorker: c.sw })
    await createShowNotification(d)(note)
    expect(active.shown).toEqual([{ title: 'Focus session done', options: notificationOptions(note) }])
    expect(constructed).toEqual([])
  })

  it('waits for a worker that is still activating', async () => {
    vi.useFakeTimers()
    const active = registration()
    const c = container(registration())
    const { d, constructed } = deps({ serviceWorker: c.sw })
    const shown = createShowNotification(d)(note)
    await vi.advanceTimersByTimeAsync(1000)
    c.activate(active)
    await shown
    expect(active.shown).toHaveLength(1)
    expect(constructed).toEqual([])
  })

  it('a worker that never activates times out cleanly, then uses the constructor on desktop', async () => {
    vi.useFakeTimers()
    const c = container(registration())
    const { d, constructed } = deps({ serviceWorker: c.sw })
    const shown = createShowNotification(d)(note)
    await vi.advanceTimersByTimeAsync(2999)
    expect(constructed).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    await shown
    expect(constructed).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears its timeout once the worker answers', async () => {
    vi.useFakeTimers()
    const c = container(registration())
    c.activate(registration())
    const { d } = deps({ serviceWorker: c.sw })
    await createShowNotification(d)(note)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a timeout where the constructor is not allowed (Android, iPhone) rejects', async () => {
    vi.useFakeTimers()
    const c = container(registration())
    const { d, constructed } = deps({ serviceWorker: c.sw, constructorAllowed: false })
    const shown = createShowNotification(d)(note)
    const failed = expect(shown).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(3000)
    await failed
    expect(constructed).toEqual([])
  })

  it('a registration that refuses to show rejects (no constructor fallback)', async () => {
    const active = registration()
    active.fails = true
    const c = container(active)
    c.activate(active)
    const { d, constructed } = deps({ serviceWorker: c.sw })
    await expect(createShowNotification(d)(note)).rejects.toThrow('blocked')
    expect(constructed).toEqual([])
  })
})

describe('showing without a service worker', () => {
  it('no registration: does not wait for ready, uses the constructor on desktop', async () => {
    vi.useFakeTimers()
    const c = container(undefined)
    const { d, constructed } = deps({ serviceWorker: c.sw })
    await createShowNotification(d)(note)
    expect(constructed).toEqual([{ title: 'Focus session done', options: notificationOptions(note) }])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('no service worker API: uses the constructor on desktop', async () => {
    const { d, constructed } = deps()
    await createShowNotification(d)(note)
    expect(constructed).toHaveLength(1)
  })

  it('a failing getRegistration counts as no worker', async () => {
    const { d, constructed } = deps({
      serviceWorker: { getRegistration: () => Promise.reject(new Error('insecure')), ready: new Promise(() => {}) },
    })
    await createShowNotification(d)(note)
    expect(constructed).toHaveLength(1)
  })

  it('rejects where the constructor is not allowed', async () => {
    const { d, constructed } = deps({ constructorAllowed: false })
    await expect(createShowNotification(d)(note)).rejects.toThrow()
    expect(constructed).toEqual([])
  })

  it('a constructor that throws rejects', async () => {
    const { d } = deps({
      construct: () => {
        throw new TypeError('Illegal constructor')
      },
    })
    await expect(createShowNotification(d)(note)).rejects.toThrow('Illegal constructor')
  })
})

describe('the notifier with the real show paths', () => {
  function env(show: NotificationEnv['show']): NotificationEnv {
    return {
      supported: true,
      appleMobile: false,
      permission: () => 'granted',
      requestPermission: () => Promise.resolve('granted'),
      show,
      isAttentive: () => false,
      onPermissionChange: () => () => {},
    }
  }

  it('reports failed when nothing can show it, and granted again once the worker works', async () => {
    const active = registration()
    let worker: ShowNotificationDeps['serviceWorker'] = undefined
    const show = (n: typeof note) => createShowNotification({ ...deps({ constructorAllowed: false, serviceWorker: worker }).d })(n)
    const notifier = createNotifier({ env: env(show), enabled: () => true, setEnabled: () => {} })

    notifier.notify(note)
    await vi.waitFor(() => expect(notifier.getStatus()).toBe('failed'))

    const c = container(active)
    c.activate(active)
    worker = c.sw
    notifier.notify({ ...note, tag: 'session-2' })
    await vi.waitFor(() => expect(notifier.getStatus()).toBe('granted'))
    expect(active.shown.map((s) => s.options.tag)).toEqual(['session-2'])
  })
})
