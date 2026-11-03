import { describe, expect, it } from 'vitest'
import { notificationCopy, notificationMaxLateMs } from '../../config/notifications'
import { settingsSpec as spec } from '../../config/settings'
import { timerConfigFrom } from '../../core/settings/settings'
import type { SessionNotification } from '../../core/timer/notification'
import { createMemoryAdapter } from '../../storage/adapter'
import { createSettingsStore } from '../settings/settingsStore'
import { createTimerStore } from '../timer/timerStore'
import { bindNotifications } from './bindNotifications'
import { browserNotificationEnv, type NotificationEnv, type PermissionState } from './notifications'

const MIN = 60_000
const T0 = 1_700_000_000_000

/** Let pending promise callbacks run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

interface FakeOptions {
  supported?: boolean
  permission?: PermissionState
  /** What the user answers in the prompt ('default' = closed it). */
  answer?: PermissionState | 'throw'
  /** Is the user looking at Koa? */
  attentive?: boolean
  showFails?: 'reject' | 'throw' | false
}

/** A mock Notification API, permission prompt and page attention. */
function fakeEnv(options: FakeOptions = {}) {
  const page = {
    permission: options.permission ?? ('default' as PermissionState),
    answer: options.answer ?? ('granted' as PermissionState | 'throw'),
    attentive: options.attentive ?? false,
    showFails: options.showFails ?? (false as FakeOptions['showFails']),
    requests: 0,
  }
  const shown: SessionNotification[] = []
  const listeners = new Set<() => void>()
  let pendingAnswer: (() => void) | null = null

  const env: NotificationEnv = {
    supported: options.supported ?? true,
    appleMobile: false,
    permission: () => page.permission,
    requestPermission() {
      page.requests += 1
      return new Promise((resolve, reject) => {
        pendingAnswer = () => {
          if (page.answer === 'throw') return reject(new TypeError('Not allowed'))
          page.permission = page.answer
          resolve(page.answer)
        }
      })
    },
    show(notification) {
      if (page.showFails === 'throw') throw new TypeError('Illegal constructor')
      if (page.showFails === 'reject') return Promise.reject(new Error('No service worker'))
      shown.push(notification)
      return Promise.resolve()
    },
    isAttentive: () => page.attentive,
    onPermissionChange(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }

  return {
    env,
    page,
    shown,
    listenerCount: () => listeners.size,
    /** The user answers the open prompt. */
    answer() {
      pendingAnswer?.()
      pendingAnswer = null
    },
    /** The user changed the permission in the browser's site settings and came back. */
    changePermission(next: PermissionState) {
      page.permission = next
      listeners.forEach((l) => l())
    },
  }
}

/** The real timer and settings stores, wired to a mock Notification API. */
function setup(options: FakeOptions & { notifications?: boolean } = {}) {
  const fake = fakeEnv(options)
  const clock = { now: T0 }
  const storage = createMemoryAdapter()
  const settings = createSettingsStore({ spec, storage })
  if (options.notifications) settings.setFlag('notifications', true)
  let n = 0
  const timer = createTimerStore({
    config: timerConfigFrom(settings.getState()),
    storage,
    now: () => clock.now,
    newId: () => `id-${++n}`,
  })
  const notes = bindNotifications({ timer, settings, env: fake.env, now: () => clock.now })
  /** Run the current session to its end and let the timer notice. */
  const finish = async () => {
    timer.toggle()
    clock.now += timer.getState().durationMs
    timer.sync()
    await flush()
  }
  return { fake, clock, settings, timer, notes, finish }
}

/** Turn notifications on through the switch, answering the prompt. */
async function enable(s: ReturnType<typeof setup>) {
  const result = s.notes.enable()
  s.fake.answer()
  return result
}

describe('notifications: support', () => {
  it('reports unsupported browsers, never asks, listens or shows', async () => {
    const { fake, notes, settings, finish } = setup({ supported: false })
    expect(notes.getStatus()).toBe('unsupported')
    expect(await notes.enable()).toBe(false)
    expect(settings.getState().notifications).toBe(false)
    await finish()
    expect(fake.page.requests).toBe(0)
    expect(fake.shown).toHaveLength(0)
    expect(fake.listenerCount()).toBe(0)
  })

  it('a saved "on" from elsewhere shows nothing where unsupported', async () => {
    const { fake, notes, finish } = setup({ supported: false, notifications: true })
    await finish()
    expect(notes.getStatus()).toBe('unsupported')
    expect(fake.shown).toHaveLength(0)
  })

  it('the browser environment is unsupported without window.Notification', () => {
    // Vitest runs without a DOM here, so there is no window or Notification.
    expect(browserNotificationEnv().supported).toBe(false)
  })

  it('reports each permission the browser already has', () => {
    expect(setup({ permission: 'default' }).notes.getStatus()).toBe('default')
    expect(setup({ permission: 'granted' }).notes.getStatus()).toBe('granted')
    expect(setup({ permission: 'denied' }).notes.getStatus()).toBe('denied')
  })
})

describe('notifications: never asks on its own', () => {
  it('starting up never requests permission, even with the setting saved as on', async () => {
    const { fake, finish } = setup({ notifications: true })
    await finish()
    await finish()
    expect(fake.page.requests).toBe(0)
    expect(fake.shown).toHaveLength(0) // not granted, so nothing is shown either
  })

  it('off by default', () => {
    const { settings } = setup()
    expect(settings.getState().notifications).toBe(false)
  })
})

describe('notifications: enabling and disabling', () => {
  it('asks when turned on; granted turns the setting on', async () => {
    const s = setup()
    const pending = s.notes.enable()
    expect(s.notes.getStatus()).toBe('requesting')
    expect(s.settings.getState().notifications).toBe(false)
    s.fake.answer()
    expect(await pending).toBe(true)
    expect(s.fake.page.requests).toBe(1)
    expect(s.settings.getState().notifications).toBe(true)
    expect(s.notes.getStatus()).toBe('granted')
  })

  it('denied leaves the setting off and explains it', async () => {
    const s = setup({ answer: 'denied' })
    expect(await enable(s)).toBe(false)
    expect(s.settings.getState().notifications).toBe(false)
    expect(s.notes.getStatus()).toBe('denied')
  })

  it("a dismissed prompt leaves the setting off, and turning it on again asks again", async () => {
    const s = setup({ answer: 'default' })
    expect(await enable(s)).toBe(false)
    expect(s.settings.getState().notifications).toBe(false)
    expect(s.notes.getStatus()).toBe('dismissed')

    s.fake.page.answer = 'granted'
    expect(await enable(s)).toBe(true)
    expect(s.fake.page.requests).toBe(2)
    expect(s.notes.getStatus()).toBe('granted')
  })

  it("doesn't ask again when the permission is already granted", async () => {
    const s = setup({ permission: 'granted' })
    expect(await s.notes.enable()).toBe(true)
    expect(s.fake.page.requests).toBe(0)
    expect(s.settings.getState().notifications).toBe(true)
  })

  it("can't be turned on while blocked, and doesn't prompt", async () => {
    const s = setup({ permission: 'denied' })
    expect(await s.notes.enable()).toBe(false)
    expect(s.fake.page.requests).toBe(0)
    expect(s.settings.getState().notifications).toBe(false)
  })

  it('a request that throws is handled like a dismissed prompt', async () => {
    const s = setup({ answer: 'throw' })
    expect(await enable(s)).toBe(false)
    expect(s.notes.getStatus()).toBe('dismissed')
    expect(s.settings.getState().notifications).toBe(false)
  })

  it('opens one prompt at a time', async () => {
    const s = setup()
    const first = s.notes.enable()
    expect(await s.notes.enable()).toBe(false)
    s.fake.answer()
    expect(await first).toBe(true)
    expect(s.fake.page.requests).toBe(1)
  })

  it('turning it off keeps the permission and stops notifications', async () => {
    const s = setup({ permission: 'granted', notifications: true })
    s.notes.disable()
    expect(s.settings.getState().notifications).toBe(false)
    expect(s.notes.getStatus()).toBe('granted')
    await s.finish()
    expect(s.fake.shown).toHaveLength(0)
  })

  it('notices a permission changed in the browser while away', async () => {
    const s = setup({ permission: 'granted', notifications: true })
    const seen: string[] = []
    s.notes.subscribe(() => seen.push(s.notes.getStatus()))
    s.fake.changePermission('denied')
    expect(s.notes.getStatus()).toBe('denied')
    s.fake.changePermission('granted')
    expect(seen).toEqual(['denied', 'granted'])
  })
})

describe('notifications: timer states', () => {
  it('announces a finished focus session while Koa is in the background', async () => {
    const { fake, finish } = setup({ permission: 'granted', notifications: true })
    await finish()
    expect(fake.shown).toEqual([{ ...notificationCopy.focusDone, tag: 'id-1' }])
  })

  it('announces finished breaks', async () => {
    const { fake, finish, timer } = setup({ permission: 'granted', notifications: true })
    await finish() // focus
    expect(timer.getState().mode).toBe('shortBreak')
    await finish() // short break
    expect(fake.shown[1]).toMatchObject(notificationCopy.breakDone)
  })

  it('announces the long break when the cycle completes', async () => {
    const { fake, finish, settings, timer } = setup({ permission: 'granted', notifications: true })
    settings.setNumber('longBreakEvery', 2)
    timer.setConfig(timerConfigFrom(settings.getState())) // src/app/connect.ts does this in the app
    await finish() // focus 1
    await finish() // short break
    await finish() // focus 2 completes the cycle
    expect(timer.getState().mode).toBe('longBreak')
    expect(fake.shown[2]).toMatchObject(notificationCopy.cycleDone)
  })

  it('stays quiet while the user is looking at Koa', async () => {
    const { fake, finish } = setup({ permission: 'granted', notifications: true, attentive: true })
    await finish()
    expect(fake.shown).toHaveLength(0)
  })

  it('stays quiet with the setting off, even when allowed', async () => {
    const { fake, finish } = setup({ permission: 'granted' })
    await finish()
    expect(fake.shown).toHaveLength(0)
  })

  it('never announces start, pause, resume, skip or reset', async () => {
    const { fake, timer, clock } = setup({ permission: 'granted', notifications: true })
    timer.toggle() // start
    clock.now += MIN
    timer.toggle() // pause
    timer.toggle() // resume
    timer.reset()
    timer.toggle() // start again
    clock.now += MIN
    timer.skip()
    await flush()
    expect(fake.shown).toHaveLength(0)
  })

  it('announces a completion noticed a little late, but not one caught up long after', async () => {
    const late = setup({ permission: 'granted', notifications: true })
    late.timer.toggle()
    late.clock.now += late.timer.getState().durationMs + MIN // throttled background tab
    late.timer.sync()
    await flush()
    expect(late.fake.shown).toHaveLength(1)

    const stale = setup({ permission: 'granted', notifications: true })
    stale.timer.toggle()
    stale.clock.now += stale.timer.getState().durationMs + notificationMaxLateMs + MIN // reopened later
    stale.timer.sync()
    await flush()
    expect(stale.fake.shown).toHaveLength(0)
  })

  it('stops announcing when the permission is revoked, and says so', async () => {
    const { fake, finish, notes } = setup({ permission: 'granted', notifications: true })
    fake.page.permission = 'denied' // revoked without a change event
    await finish()
    expect(fake.shown).toHaveLength(0)
    expect(notes.getStatus()).toBe('denied')
  })
})

describe('notifications: failures and cleanup', () => {
  it('a notification that fails reports failed; the timer and coins carry on', async () => {
    const { fake, finish, notes, timer } = setup({ permission: 'granted', notifications: true, showFails: 'reject' })
    await finish()
    expect(notes.getStatus()).toBe('failed')
    expect(timer.getState().mode).toBe('shortBreak')

    fake.page.showFails = false
    await finish()
    expect(notes.getStatus()).toBe('granted')
    expect(fake.shown).toHaveLength(1)
  })

  it('a show that throws synchronously is handled the same way', async () => {
    const { finish, notes, timer } = setup({ permission: 'granted', notifications: true, showFails: 'throw' })
    await finish()
    expect(notes.getStatus()).toBe('failed')
    expect(timer.getState().mode).toBe('shortBreak')
  })

  it('turning it off clears a failure', async () => {
    const { finish, notes } = setup({ permission: 'granted', notifications: true, showFails: 'reject' })
    await finish()
    notes.disable()
    expect(notes.getStatus()).toBe('granted')
  })

  it('dispose removes every listener and stops announcing', async () => {
    const { fake, finish, notes, settings } = setup({ permission: 'granted', notifications: true })
    let calls = 0
    notes.subscribe(() => calls++)
    expect(fake.listenerCount()).toBe(1)
    notes.dispose()
    expect(fake.listenerCount()).toBe(0)
    await finish()
    settings.setFlag('notifications', false)
    fake.changePermission('denied')
    expect(fake.shown).toHaveLength(0)
    expect(calls).toBe(0)
  })

  it('a prompt answered after dispose changes nothing', async () => {
    const s = setup()
    const pending = s.notes.enable()
    s.notes.dispose()
    s.fake.answer()
    expect(await pending).toBe(false)
    expect(s.settings.getState().notifications).toBe(false)
  })
})
