import { describe, expect, it } from 'vitest'
import { settingsSpec as spec } from '../../config/settings'
import { timerConfigFrom } from '../../core/settings/settings'
import { createMemoryAdapter } from '../../storage/adapter'
import { createSettingsStore } from '../settings/settingsStore'
import { createTimerStore } from '../timer/timerStore'
import { bindWakeLock } from './bindWakeLock'
import { browserWakeLockEnv, createWakeLockController, type WakeLockEnv, type WakeLockSentinelLike } from './wakeLock'

const MIN = 60_000
const T0 = 1_700_000_000_000

/** Let pending promise callbacks run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

class FakeSentinel implements WakeLockSentinelLike {
  released = false
  private listeners = new Set<() => void>()
  addEventListener(_type: 'release', listener: () => void) {
    this.listeners.add(listener)
  }
  removeEventListener(_type: 'release', listener: () => void) {
    this.listeners.delete(listener)
  }
  release() {
    this.releaseBy()
    return Promise.resolve()
  }
  /** What the browser does when the page is hidden. */
  releaseBy() {
    if (this.released) return
    this.released = true
    this.listeners.forEach((l) => l())
  }
}

/** A mock Screen Wake Lock API and page visibility. */
function fakeEnv({ supported = true, refuse = false } = {}) {
  const locks: FakeSentinel[] = []
  const visibility = new Set<() => void>()
  const page = { visible: true, refuse, requests: 0 }

  const wakeLockEnv: WakeLockEnv = {
    request: supported
      ? () => {
          page.requests += 1
          if (page.refuse) return Promise.reject(new DOMException('Not allowed', 'NotAllowedError'))
          const lock = new FakeSentinel()
          locks.push(lock)
          return Promise.resolve(lock)
        }
      : null,
    isVisible: () => page.visible,
    onVisibilityChange(listener) {
      visibility.add(listener)
      return () => {
        visibility.delete(listener)
      }
    },
  }

  return {
    wakeLockEnv,
    get requests() {
      return page.requests
    },
    set refuse(value: boolean) {
      page.refuse = value
    },
    listenerCount: () => visibility.size,
    /** How many locks are held right now. */
    held: () => locks.filter((l) => !l.released).length,
    setVisible(visible: boolean) {
      page.visible = visible
      // The browser releases screen locks itself when the page is hidden.
      if (!visible) locks.forEach((l) => l.releaseBy())
      visibility.forEach((l) => l())
    },
  }
}

/** The real timer and settings stores, wired to a mock wake lock. */
function setup(options: { supported?: boolean; refuse?: boolean; keepScreenOn?: boolean } = {}) {
  const env = fakeEnv(options)
  const clock = { now: T0 }
  const storage = createMemoryAdapter()
  const settings = createSettingsStore({ spec, storage })
  if (options.keepScreenOn ?? true) settings.setFlag('keepScreenOn', true)
  let n = 0
  const timer = createTimerStore({
    config: timerConfigFrom(settings.getState()),
    storage,
    now: () => clock.now,
    newId: () => `id-${++n}`,
  })
  const lock = bindWakeLock({ timer, settings, env: env.wakeLockEnv, now: () => clock.now })
  return { env, clock, settings, timer, lock }
}

describe('wake lock: support', () => {
  it('reports unsupported browsers and never requests or listens', async () => {
    const { env, timer, lock } = setup({ supported: false })
    expect(lock.getStatus()).toBe('unsupported')
    timer.toggle()
    await flush()
    expect(lock.getStatus()).toBe('unsupported')
    expect(env.listenerCount()).toBe(0)
  })

  it('reports supported browsers as off until a focus session runs', () => {
    const { lock } = setup()
    expect(lock.getStatus()).toBe('off')
  })

  it('the browser environment is unsupported without navigator.wakeLock', () => {
    // Vitest runs without a DOM here, so there is no window or navigator.wakeLock.
    expect(browserWakeLockEnv().request).toBeNull()
  })
})

describe('wake lock: acquire and release', () => {
  it('holds the lock while a focus session runs and releases it on pause', async () => {
    const { env, timer, lock } = setup()
    timer.toggle() // start
    await flush()
    expect(env.held()).toBe(1)
    expect(lock.getStatus()).toBe('active')

    timer.toggle() // pause
    await flush()
    expect(env.held()).toBe(0)
    expect(lock.getStatus()).toBe('off')

    timer.toggle() // resume
    await flush()
    expect(env.held()).toBe(1)
  })

  it('releases when the session completes', async () => {
    const { env, clock, timer } = setup()
    timer.toggle()
    await flush()
    clock.now += 25 * MIN
    timer.sync()
    await flush()
    expect(timer.getState()).toMatchObject({ mode: 'shortBreak', status: 'idle' })
    expect(env.held()).toBe(0)
  })

  it('releases when the session is skipped', async () => {
    const { env, timer } = setup()
    timer.toggle()
    await flush()
    timer.skip()
    await flush()
    expect(env.held()).toBe(0)
  })

  it('releases when the session is reset', async () => {
    const { env, timer } = setup()
    timer.toggle()
    await flush()
    timer.reset()
    await flush()
    expect(timer.getState()).toMatchObject({ mode: 'focus', status: 'idle' })
    expect(env.held()).toBe(0)
  })

  it('releases when the setting is turned off, and acquires again when it is turned back on', async () => {
    const { env, timer, settings, lock } = setup()
    timer.toggle()
    await flush()
    settings.setFlag('keepScreenOn', false)
    await flush()
    expect(env.held()).toBe(0)
    expect(lock.getStatus()).toBe('off')

    settings.setFlag('keepScreenOn', true)
    await flush()
    expect(env.held()).toBe(1)
  })

  it('never requests a lock with the setting off', async () => {
    const { env, timer } = setup({ keepScreenOn: false })
    timer.toggle()
    await flush()
    expect(env.requests).toBe(0)
  })

  it('never holds a lock during breaks', async () => {
    const { env, timer } = setup()
    timer.selectMode('shortBreak')
    timer.toggle()
    await flush()
    expect(timer.getState()).toMatchObject({ mode: 'shortBreak', status: 'running' })
    expect(env.requests).toBe(0)

    timer.reset()
    timer.selectMode('longBreak')
    timer.toggle()
    await flush()
    expect(env.requests).toBe(0)
  })

  it('never holds a lock while a focus session is paused, even when the page becomes visible', async () => {
    const { env, timer } = setup()
    timer.toggle()
    await flush()
    timer.toggle() // pause
    env.setVisible(false)
    env.setVisible(true)
    await flush()
    expect(env.held()).toBe(0)
    expect(env.requests).toBe(1)
  })
})

describe('wake lock: visibility', () => {
  it('lets the browser release it when hidden and acquires it again when visible', async () => {
    const { env, timer, lock } = setup()
    timer.toggle()
    await flush()
    env.setVisible(false)
    await flush()
    expect(env.held()).toBe(0)
    expect(lock.getStatus()).toBe('off')
    expect(env.requests).toBe(1) // no request while hidden

    env.setVisible(true)
    await flush()
    expect(env.held()).toBe(1)
    expect(env.requests).toBe(2)
    expect(lock.getStatus()).toBe('active')
  })

  it("doesn't reacquire when the session ended while the page was hidden", async () => {
    const { env, clock, timer } = setup()
    timer.toggle()
    await flush()
    env.setVisible(false)
    clock.now += 30 * MIN
    env.setVisible(true) // the timer hasn't caught up yet: it still says "running"
    await flush()
    expect(timer.getState().status).toBe('running')
    expect(env.held()).toBe(0)
    expect(env.requests).toBe(1)
  })

  it("doesn't reacquire after the setting was turned off while hidden", async () => {
    const { env, timer, settings } = setup()
    timer.toggle()
    await flush()
    env.setVisible(false)
    settings.setFlag('keepScreenOn', false)
    env.setVisible(true)
    await flush()
    expect(env.held()).toBe(0)
  })
})

describe('wake lock: failures and cleanup', () => {
  it('a refused request reports failed and leaves the timer running', async () => {
    const { env, timer, lock } = setup({ refuse: true })
    timer.toggle()
    await flush()
    expect(lock.getStatus()).toBe('failed')
    expect(timer.getState().status).toBe('running')

    // Tried again when the page becomes visible; succeeds once the browser allows it.
    env.refuse = false
    env.setVisible(false)
    env.setVisible(true)
    await flush()
    expect(lock.getStatus()).toBe('active')
  })

  it('a request that throws synchronously is handled like a refusal', async () => {
    const controller = createWakeLockController({
      env: {
        request: () => {
          throw new TypeError('broken')
        },
        isVisible: () => true,
        onVisibilityChange: () => () => {},
      },
      wanted: () => true,
    })
    expect(() => controller.update()).not.toThrow()
    await flush()
    expect(controller.getStatus()).toBe('failed')
  })

  it('turning the setting off clears a failure', async () => {
    const { timer, settings, lock } = setup({ refuse: true })
    timer.toggle()
    await flush()
    settings.setFlag('keepScreenOn', false)
    expect(lock.getStatus()).toBe('off')
  })

  it('releases a lock that arrives after the session was paused', async () => {
    const { env, timer, lock } = setup()
    timer.toggle() // request in flight
    timer.toggle() // pause before it resolves
    await flush()
    expect(env.requests).toBe(1)
    expect(env.held()).toBe(0)
    expect(lock.getStatus()).toBe('off')
  })

  it('sends one request at a time', async () => {
    const { env, timer, settings } = setup()
    timer.toggle()
    settings.setNumber('shortBreak', 10) // another change while the request is pending
    await flush()
    expect(env.requests).toBe(1)
    expect(env.held()).toBe(1)
  })

  it('dispose releases the lock and removes every listener', async () => {
    const { env, timer, settings, lock } = setup()
    timer.toggle()
    await flush()
    expect(env.listenerCount()).toBe(1)
    lock.dispose()
    expect(env.held()).toBe(0)
    expect(env.listenerCount()).toBe(0)

    // Later changes do nothing.
    settings.setFlag('keepScreenOn', false)
    settings.setFlag('keepScreenOn', true)
    timer.toggle()
    timer.toggle()
    await flush()
    expect(env.requests).toBe(1)
  })
})
