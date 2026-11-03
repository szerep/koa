import { describe, expect, it } from 'vitest'
import { createPwaRegistration, type PwaEnv, type PwaRegisterHandlers } from './registration'

/** A mock browser: records registrations and lets the test fire load and the outcome. */
function fakeEnv({ supported = true, loaded = false, throwOnRegister = false, throwOnLoad = false } = {}) {
  const page = { loaded, registerCalls: 0, handlers: null as PwaRegisterHandlers | null }
  const onLoad: (() => void)[] = []
  const env: PwaEnv = {
    supported,
    afterLoad(callback) {
      if (throwOnLoad) throw new Error('no window')
      if (page.loaded) callback()
      else onLoad.push(callback)
    },
    register(handlers) {
      page.registerCalls += 1
      if (throwOnRegister) throw new Error('SecurityError')
      page.handlers = handlers
    },
  }
  const fireLoad = () => {
    page.loaded = true
    onLoad.splice(0).forEach((cb) => cb())
  }
  return { env, page, fireLoad }
}

const fakeRegistration = {} as ServiceWorkerRegistration

describe('createPwaRegistration', () => {
  it('starts idle when supported and unsupported otherwise', () => {
    expect(createPwaRegistration({ env: fakeEnv().env }).getState()).toBe('idle')
    expect(createPwaRegistration({ env: fakeEnv({ supported: false }).env }).getState()).toBe('unsupported')
  })

  it('never registers without service worker support (dev server, insecure context)', () => {
    const { env, page, fireLoad } = fakeEnv({ supported: false })
    const pwa = createPwaRegistration({ env })
    pwa.register()
    fireLoad()
    expect(page.registerCalls).toBe(0)
    expect(pwa.getState()).toBe('unsupported')
  })

  it('waits for the page to load before registering', () => {
    const { env, page, fireLoad } = fakeEnv()
    const pwa = createPwaRegistration({ env })
    pwa.register()
    expect(pwa.getState()).toBe('waiting')
    expect(page.registerCalls).toBe(0)
    fireLoad()
    expect(page.registerCalls).toBe(1)
    expect(pwa.getState()).toBe('registering')
  })

  it('registers right away when the page has already loaded', () => {
    const { env, page } = fakeEnv({ loaded: true })
    const pwa = createPwaRegistration({ env })
    pwa.register()
    expect(page.registerCalls).toBe(1)
  })

  it('registers only once, however often register() is called', () => {
    const { env, page, fireLoad } = fakeEnv()
    const pwa = createPwaRegistration({ env })
    pwa.register()
    pwa.register()
    fireLoad()
    pwa.register()
    page.handlers?.onRegistered(fakeRegistration)
    pwa.register()
    expect(page.registerCalls).toBe(1)
  })

  it('reports the registration once the browser accepts the worker', () => {
    const { env, page } = fakeEnv({ loaded: true })
    const pwa = createPwaRegistration({ env })
    const seen: string[] = []
    pwa.subscribe(() => seen.push(pwa.getState()))
    pwa.register()
    page.handlers?.onRegistered(fakeRegistration)
    expect(pwa.getState()).toBe('registered')
    expect(pwa.getRegistration()).toBe(fakeRegistration)
    expect(seen).toEqual(['waiting', 'registering', 'registered'])
  })

  it('a reported error becomes failed and is never thrown', () => {
    const { env, page } = fakeEnv({ loaded: true })
    const pwa = createPwaRegistration({ env })
    pwa.register()
    expect(() => page.handlers?.onError(new TypeError('Failed to fetch sw.js'))).not.toThrow()
    expect(pwa.getState()).toBe('failed')
  })

  it('a throwing registerSW becomes failed without throwing', () => {
    const { env } = fakeEnv({ loaded: true, throwOnRegister: true })
    const pwa = createPwaRegistration({ env })
    expect(() => pwa.register()).not.toThrow()
    expect(pwa.getState()).toBe('failed')
  })

  it('a throwing load hook becomes failed without throwing', () => {
    const { env, page } = fakeEnv({ throwOnLoad: true })
    const pwa = createPwaRegistration({ env })
    expect(() => pwa.register()).not.toThrow()
    expect(pwa.getState()).toBe('failed')
    expect(page.registerCalls).toBe(0)
  })

  it('a late success after a failure does not flip the status back', () => {
    const { env, page } = fakeEnv({ loaded: true })
    const pwa = createPwaRegistration({ env })
    pwa.register()
    page.handlers?.onError(new Error('boom'))
    page.handlers?.onRegistered(fakeRegistration)
    expect(pwa.getState()).toBe('failed')
  })

  it('a throwing listener never stops registration', () => {
    const { env, page } = fakeEnv({ loaded: true })
    const pwa = createPwaRegistration({ env })
    pwa.subscribe(() => {
      throw new Error('listener bug')
    })
    expect(() => pwa.register()).not.toThrow()
    expect(page.registerCalls).toBe(1)
    page.handlers?.onRegistered(fakeRegistration)
    expect(pwa.getState()).toBe('registered')
  })

  it('reports a waiting new version to update listeners, every time', () => {
    const { env, page } = fakeEnv({ loaded: true })
    const pwa = createPwaRegistration({ env })
    let ready = 0
    pwa.onUpdateReady(() => (ready += 1))
    pwa.register()
    page.handlers?.onRegistered(fakeRegistration)
    page.handlers?.onNeedRefresh()
    page.handlers?.onNeedRefresh()
    expect(ready).toBe(2)
  })

  it('a throwing update listener is caught, and unsubscribed ones are not called', () => {
    const { env, page } = fakeEnv({ loaded: true })
    const pwa = createPwaRegistration({ env })
    let calls = 0
    pwa.onUpdateReady(() => {
      throw new Error('listener bug')
    })
    const stop = pwa.onUpdateReady(() => (calls += 1))
    stop()
    pwa.register()
    expect(() => page.handlers?.onNeedRefresh()).not.toThrow()
    expect(calls).toBe(0)
  })

  it('unsubscribed listeners are not called', () => {
    const { env } = fakeEnv({ loaded: true })
    const pwa = createPwaRegistration({ env })
    let calls = 0
    const stop = pwa.subscribe(() => (calls += 1))
    stop()
    pwa.register()
    expect(calls).toBe(0)
  })
})
