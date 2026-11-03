import { describe, expect, it } from 'vitest'
import { catalog } from '../../config/catalog'
import { rewardRules } from '../../config/rewards'
import { settingsSpec as spec } from '../../config/settings'
import { EXPORT_FORMAT, isProgressReset } from '../../core/data/data'
import { koalaContextFor } from '../../core/koala/context'
import { createWallet } from '../../core/rewards/wallet'
import { timerConfigFrom } from '../../core/settings/settings'
import { createWardrobe } from '../../core/shop/shop'
import { computeStats } from '../../core/stats/stats'
import { createTimer } from '../../core/timer/engine'
import type { SessionNotification } from '../../core/timer/notification'
import { createMemoryAdapter, type StorageAdapter } from '../../storage/adapter'
import { RESET_BACKUP_KEY, SCHEMA_VERSION, STORAGE_KEY } from '../../storage/persistence'
import { createKoalaStore } from '../koala/koalaStore'
import { bindNotifications } from '../notifications/bindNotifications'
import type { NotificationEnv, PermissionState } from '../notifications/notifications'
import { createWalletStore } from '../rewards/walletStore'
import { createSettingsStore } from '../settings/settingsStore'
import { createWardrobeStore } from '../shop/wardrobeStore'
import { bindSounds } from '../sounds/bindSounds'
import type { SoundContextLike, SoundEnv } from '../sounds/sounds'
import { createTimerStore } from '../timer/timerStore'
import { bindWakeLock } from '../wakeLock/bindWakeLock'
import type { WakeLockEnv, WakeLockSentinelLike } from '../wakeLock/wakeLock'
import { createProgressData, type Download } from './progressData'

const MIN = 60_000
const T0 = new Date(2026, 10, 3, 9, 0).getTime()

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Storage whose writes can be made to fail per key, like a full or blocked LocalStorage. */
function flakyStorage() {
  const inner = createMemoryAdapter()
  const failing = new Set<string>()
  let throwing = false
  const storage: StorageAdapter = {
    read: (key) => inner.read(key),
    write(key, value) {
      if (throwing) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      if (failing.has(key)) return // the real adapter swallows the error: the write just doesn't happen
      inner.write(key, value)
    },
    remove: (key) => inner.remove(key),
  }
  return {
    storage,
    data: inner.data,
    fail: (key: string) => failing.add(key),
    heal: () => {
      failing.clear()
      throwing = false
    },
    throwOnWrite: () => {
      throwing = true
    },
  }
}

class FakeLock implements WakeLockSentinelLike {
  released = false
  private listeners = new Set<() => void>()
  addEventListener(_type: 'release', l: () => void) {
    this.listeners.add(l)
  }
  removeEventListener(_type: 'release', l: () => void) {
    this.listeners.delete(l)
  }
  release() {
    this.released = true
    this.listeners.forEach((l) => l())
    return Promise.resolve()
  }
}

function fakeWakeLock() {
  const locks: FakeLock[] = []
  const env: WakeLockEnv = {
    request: () => {
      const lock = new FakeLock()
      locks.push(lock)
      return Promise.resolve(lock)
    },
    isVisible: () => true,
    onVisibilityChange: () => () => {},
  }
  return { env, held: () => locks.filter((l) => !l.released).length }
}

function fakeNotifications(permission: PermissionState = 'granted') {
  const page = { permission, requests: 0 }
  const shown: SessionNotification[] = []
  const env: NotificationEnv = {
    supported: true,
    appleMobile: false,
    permission: () => page.permission,
    requestPermission() {
      page.requests += 1
      return Promise.resolve(page.permission)
    },
    show(n) {
      shown.push(n)
      return Promise.resolve()
    },
    isAttentive: () => false,
    onPermissionChange: () => () => {},
  }
  return { env, page, shown }
}

class FakeAudio implements SoundContextLike {
  state = 'running'
  /** When set, resume() waits for `finishResume()` (a browser slow to allow audio). */
  holdResume = false
  private pending: (() => void) | null = null
  resume() {
    if (!this.holdResume) {
      this.state = 'running'
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      this.pending = () => {
        this.state = 'running'
        resolve()
      }
    })
  }
  finishResume() {
    this.pending?.()
    this.pending = null
  }
  close() {
    this.state = 'closed'
    return Promise.resolve()
  }
  addEventListener() {}
  removeEventListener() {}
}

function fakeSounds() {
  const contexts: FakeAudio[] = []
  let plays = 0
  let gesture: (() => void) | null = null
  const env: SoundEnv<FakeAudio> = {
    createContext: () => {
      const ctx = new FakeAudio()
      contexts.push(ctx)
      return ctx
    },
    play: () => {
      plays += 1
    },
    onUserGesture(listener) {
      gesture = listener
      return () => {
        gesture = null
      }
    },
  }
  return { env, contexts, plays: () => plays, tap: () => gesture?.() }
}

/** One open Koa tab: every store and controller the app wires together, on shared storage. */
function openTab(storage: StorageAdapter, clock: { now: number }, extras = { wake: fakeWakeLock(), notes: fakeNotifications(), audio: fakeSounds() }) {
  let ids = 0
  const now = () => clock.now
  const settings = createSettingsStore({ spec, storage })
  const timer = createTimerStore({ config: timerConfigFrom(settings.getState()), storage, now, newId: () => `s${(ids += 1)}-${clock.now}` })
  const wallet = createWalletStore({ rules: rewardRules, dailyGoalMinutes: () => settings.getState().dailyGoalMinutes, storage, now })
  const wardrobe = createWardrobeStore({ storage, catalog, getWallet: wallet.getState })
  const koala = createKoalaStore({ context: koalaContextFor(timer.getState()), getTickInput: () => ({ canAffordSomething: false }), now, random: () => 0.5, hour: () => 9 })
  timer.onEvent((e) => {
    if (e.type === 'sessionCompleted') wallet.award(e)
  })
  settings.subscribe(() => timer.setConfig(timerConfigFrom(settings.getState())))
  wallet.onGrant(() => koala.celebrate('session'))
  const wakeLock = bindWakeLock({ timer, settings, env: extras.wake.env, now })
  const notifications = bindNotifications({ timer, settings, env: extras.notes.env, now })
  const sounds = bindSounds({ timer, settings, env: extras.audio.env, now })

  const reload = () => {
    timer.reload()
    wallet.refresh()
    wardrobe.refresh()
    sounds.cancelPending()
    wakeLock.update()
    koala.reset(koalaContextFor(timer.getState()))
  }
  const downloads: { fileName: string; text: string; mimeType: string }[] = []
  let downloadFails = false
  const download: Download = (fileName, text, mimeType) => {
    if (downloadFails) throw new TypeError('Blob URLs are blocked')
    downloads.push({ fileName, text, mimeType })
  }
  const data = createProgressData({
    storage,
    snapshot: () => ({ timer: timer.getState(), wallet: wallet.getState(), wardrobe: wardrobe.getState(), settings: settings.getState() }),
    reload,
    download,
    now,
  })
  return {
    settings,
    timer,
    wallet,
    wardrobe,
    koala,
    wakeLock,
    notifications,
    sounds,
    data,
    downloads,
    reload,
    ...extras,
    failDownloads: () => {
      downloadFails = true
    },
  }
}

type Tab = ReturnType<typeof openTab>

/** Earn coins, buy and wear an item, customize settings, then leave a focus session running. */
async function makeProgress(tab: Tab, clock: { now: number }) {
  tab.settings.setNumber('dailyGoalMinutes', 50)
  tab.settings.setFlag('keepScreenOn', true)
  await tab.notifications.enable()
  tab.audio.tap()
  tab.sounds.enable()
  for (let i = 0; i < 2; i += 1) {
    tab.timer.toggle() // start focus
    clock.now += 25 * MIN
    tab.timer.sync() // completes: coins (+ goal bonus on the second)
    tab.timer.toggle() // start the short break
    clock.now += 5 * MIN
    tab.timer.sync()
  }
  const item = catalog.find((i) => i.price <= tab.wallet.getState().balance)
  if (!item) throw new Error('nothing affordable')
  expect(tab.wallet.purchase(item).ok).toBe(true)
  expect(tab.wardrobe.equip(item).ok).toBe(true)
  tab.timer.toggle() // a third focus session, now running
  clock.now += 10 * MIN
  await flush()
  return item
}

function setup() {
  const clock = { now: T0 }
  const flaky = flakyStorage()
  const tab = openTab(flaky.storage, clock)
  return { clock, flaky, tab }
}

describe('export', () => {
  it('downloads the koa:v1 data as versioned JSON, without changing anything', async () => {
    const { clock, flaky, tab } = setup()
    const item = await makeProgress(tab, clock)
    const before = flaky.data[STORAGE_KEY]

    expect(tab.data.exportData()).toBe(true)
    expect(tab.downloads).toHaveLength(1)
    const [file] = tab.downloads
    expect(file.fileName).toBe('koa-data-2026-11-03.json')
    expect(file.mimeType).toBe('application/json')

    const parsed = JSON.parse(file.text)
    expect(parsed.format).toBe(EXPORT_FORMAT)
    expect(parsed.exportVersion).toBe(1)
    expect(parsed.storageKey).toBe(STORAGE_KEY)
    expect(parsed.exportedAt).toBe(new Date(clock.now).toISOString())
    expect(parsed.data.version).toBe(SCHEMA_VERSION)
    expect(Object.keys(parsed.data).sort()).toEqual(['settings', 'timer', 'version', 'wallet', 'wardrobe'])
    expect(parsed.data.wallet).toEqual(tab.wallet.getState())
    expect(parsed.data.wallet.ledger).toHaveProperty('goal:2026-11-03')
    expect(parsed.data.wallet.spending).toHaveProperty(`item:${item.id}`)
    expect(parsed.data.wardrobe).toEqual(tab.wardrobe.getState())
    expect(parsed.data.timer).toEqual(tab.timer.getState())
    expect(parsed.data.timer.status).toBe('running')
    expect(parsed.data.settings).toEqual(tab.settings.getState())
    // The same structure as the save itself.
    expect(parsed.data).toEqual(JSON.parse(before))

    expect(flaky.data[STORAGE_KEY]).toBe(before)
    expect(flaky.data[RESET_BACKUP_KEY]).toBeUndefined()
    expect(tab.data.getState().export).toEqual({ kind: 'exported', fileName: 'koa-data-2026-11-03.json' })
  })

  it('exports a new user too', () => {
    const { tab } = setup()
    expect(tab.data.exportData()).toBe(true)
    const parsed = JSON.parse(tab.downloads[0].text)
    expect(parsed.data.wallet).toEqual(createWallet())
    expect(parsed.data.wardrobe).toEqual(createWardrobe())
    expect(parsed.data.timer).toEqual(createTimer(timerConfigFrom(tab.settings.getState())))
  })

  it('reports a download that fails, and changes nothing', async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    const before = flaky.data[STORAGE_KEY]
    tab.failDownloads()
    expect(tab.data.exportData()).toBe(false)
    expect(tab.data.getState().export).toEqual({ kind: 'failed' })
    expect(flaky.data[STORAGE_KEY]).toBe(before)
    expect(tab.timer.getState().status).toBe('running')
  })

  it('exports from memory when saving has been failing (private mode)', async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    flaky.fail(STORAGE_KEY)
    tab.settings.setNumber('focus', 45) // kept in memory, not saved
    tab.data.exportData()
    const parsed = JSON.parse(tab.downloads[0].text)
    expect(parsed.data.settings.durations.focus).toBe(45)
    expect(JSON.parse(flaky.data[STORAGE_KEY]).settings.durations.focus).toBe(25)
  })
})

describe('reset confirmation', () => {
  it('asks first, showing what would be deleted, and changes nothing yet', async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    const before = flaky.data[STORAGE_KEY]
    tab.data.requestReset()
    const reset = tab.data.getState().reset
    expect(reset.kind).toBe('confirming')
    if (reset.kind !== 'confirming') return
    expect(reset.summary).toMatchObject({
      balance: tab.wallet.getState().balance,
      itemsOwned: 1,
      itemsWorn: 1,
      focusSessions: 2,
      focusMinutes: 50,
      sessionInProgress: true,
    })
    expect(flaky.data[STORAGE_KEY]).toBe(before)
    expect(flaky.data[RESET_BACKUP_KEY]).toBeUndefined()
  })

  it('cancelling keeps everything, and a later confirm does nothing', async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    const before = flaky.data[STORAGE_KEY]
    const balance = tab.wallet.getState().balance
    tab.data.requestReset()
    tab.data.cancelReset()
    expect(tab.data.getState().reset).toEqual({ kind: 'idle' })
    expect(tab.data.confirmReset()).toBe(false)
    expect(flaky.data[STORAGE_KEY]).toBe(before)
    expect(flaky.data[RESET_BACKUP_KEY]).toBeUndefined()
    expect(tab.wallet.getState().balance).toBe(balance)
    expect(tab.timer.getState().status).toBe('running')
  })

  it('never resets without the confirmation step', async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    const before = flaky.data[STORAGE_KEY]
    expect(tab.data.confirmReset()).toBe(false)
    expect(flaky.data[STORAGE_KEY]).toBe(before)
    expect(tab.data.getState().reset).toEqual({ kind: 'idle' })
  })

  it('confirms only once', async () => {
    const { clock, tab } = setup()
    await makeProgress(tab, clock)
    tab.data.requestReset()
    expect(tab.data.confirmReset()).toBe(true)
    expect(tab.data.confirmReset()).toBe(false)
  })
})

describe('reset progress', () => {
  it('writes a backup of everything first', async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    const before = JSON.parse(flaky.data[STORAGE_KEY])
    tab.data.requestReset()
    tab.data.confirmReset()
    const backup = JSON.parse(flaky.data[RESET_BACKUP_KEY])
    expect(backup.format).toBe(EXPORT_FORMAT)
    expect(backup.data).toEqual(before)
    expect(Object.keys(backup.data.wallet.ledger).length).toBeGreaterThan(0)
  })

  it('clears coins, purchases, the outfit, stats, the timer and the cycle, and keeps Settings', async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    const settingsBefore = tab.settings.getState()
    expect(tab.timer.getState().completedInCycle).toBe(2)

    tab.data.requestReset()
    expect(tab.data.confirmReset()).toBe(true)
    expect(tab.data.getState().reset).toEqual({ kind: 'done' })

    // Saved: Settings only.
    expect(JSON.parse(flaky.data[STORAGE_KEY])).toEqual({ version: SCHEMA_VERSION, settings: settingsBefore })

    // Coins and purchases.
    expect(tab.wallet.getState()).toEqual(createWallet())
    // Outfit.
    expect(tab.wardrobe.getState()).toEqual(createWardrobe())
    // Stats (derived from the ledger).
    const stats = computeStats(tab.wallet.getState().ledger, clock.now, { coinsPerFocusMinute: 1 })
    expect(stats.allTime).toMatchObject({ minutes: 0, sessions: 0 })
    expect(stats.today.minutes).toBe(0)
    expect(stats.streak.current).toBe(0)
    // Timer and cycle: a fresh, waiting focus session with the user's own durations.
    expect(tab.timer.getState()).toEqual(createTimer(timerConfigFrom(settingsBefore)))
    expect(tab.timer.getState()).toMatchObject({ completedInCycle: 0, cycleFocusMs: 0, sessionId: null, endsAt: null })
    // Settings untouched, in memory and on disk.
    expect(tab.settings.getState()).toBe(settingsBefore)
    expect(tab.settings.getState()).toMatchObject({ dailyGoalMinutes: 50, keepScreenOn: true, notifications: true, sounds: true })
  })

  it('stays reset after a reload', async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    tab.data.requestReset()
    tab.data.confirmReset()
    const reopened = openTab(flaky.storage, clock)
    expect(reopened.wallet.getState()).toEqual(createWallet())
    expect(reopened.wardrobe.getState()).toEqual(createWardrobe())
    expect(reopened.timer.getState().status).toBe('idle')
    expect(reopened.settings.getState()).toEqual(tab.settings.getState())
  })

  it('leaves no wake lock, payout, notification or chime behind for the old session', async () => {
    const { clock, tab } = setup()
    await makeProgress(tab, clock)
    expect(tab.wake.held()).toBe(1)
    const shown = tab.notes.shown.length
    const plays = tab.audio.plays()

    tab.data.requestReset()
    tab.data.confirmReset()
    await flush()
    expect(tab.wake.held()).toBe(0)
    expect(tab.wakeLock.getStatus()).toBe('off')

    // The old session's end time passes: nothing completes.
    clock.now += 30 * MIN
    tab.timer.sync()
    await flush()
    expect(tab.wallet.getState().balance).toBe(0)
    expect(tab.notes.shown).toHaveLength(shown)
    expect(tab.audio.plays()).toBe(plays)
    expect(tab.koala.getState().celebrationLevel).toBeNull()

    // A new session works normally afterwards (and is paid, announced and chimed).
    tab.timer.toggle()
    await flush()
    expect(tab.wake.held()).toBe(1)
    clock.now += 25 * MIN
    tab.timer.sync()
    await flush()
    expect(tab.wallet.getState().balance).toBe(25)
    expect(tab.notes.shown).toHaveLength(shown + 1)
    expect(tab.audio.plays()).toBe(plays + 1)
  })

  it("doesn't touch the browser's notification permission", async () => {
    const { clock, tab } = setup()
    await makeProgress(tab, clock)
    const requests = tab.notes.page.requests
    expect(tab.notifications.getStatus()).toBe('granted')
    tab.data.requestReset()
    tab.data.confirmReset()
    await flush()
    expect(tab.notes.page.requests).toBe(requests)
    expect(tab.notes.page.permission).toBe('granted')
    expect(tab.notifications.getStatus()).toBe('granted')
    expect(tab.settings.getState().notifications).toBe(true)
  })

  it('never asks for a permission that was not given', async () => {
    const clock = { now: T0 }
    const storage = createMemoryAdapter()
    const notes = fakeNotifications('default')
    const tab = openTab(storage, clock, { wake: fakeWakeLock(), notes, audio: fakeSounds() })
    tab.timer.toggle()
    tab.data.requestReset()
    tab.data.confirmReset()
    await flush()
    expect(notes.page.requests).toBe(0)
    expect(notes.page.permission).toBe('default')
  })

  it('drops a chime still waiting for the browser to allow audio', async () => {
    const { clock, tab } = setup()
    await makeProgress(tab, clock)
    const ctx = tab.audio.contexts[0]
    const plays = tab.audio.plays()
    // iOS paused audio in the background; the session ends and the chime waits for resume().
    ctx.state = 'suspended'
    ctx.holdResume = true
    clock.now += 15 * MIN
    tab.timer.sync()
    tab.data.requestReset()
    tab.data.confirmReset()
    ctx.finishResume()
    await flush()
    expect(tab.audio.plays()).toBe(plays)
    // Sounds itself stays on.
    expect(tab.settings.getState().sounds).toBe(true)
    expect(ctx.state).toBe('running')
  })

  it('resets a user with no progress without trouble', () => {
    const { tab } = setup()
    tab.data.requestReset()
    expect(tab.data.confirmReset()).toBe(true)
    expect(tab.wallet.getState()).toEqual(createWallet())
  })
})

describe('reset failures', () => {
  it("deletes nothing when the backup can't be saved", async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    const before = flaky.data[STORAGE_KEY]
    const wallet = tab.wallet.getState()
    flaky.fail(RESET_BACKUP_KEY)
    tab.data.requestReset()
    expect(tab.data.confirmReset()).toBe(false)
    expect(tab.data.getState().reset).toEqual({ kind: 'backupFailed' })
    expect(flaky.data[STORAGE_KEY]).toBe(before)
    expect(tab.wallet.getState()).toBe(wallet)
    expect(tab.timer.getState().status).toBe('running')
    expect(tab.wake.held()).toBe(1)
  })

  it('deletes nothing when storage throws', async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    const before = flaky.data[STORAGE_KEY]
    flaky.throwOnWrite()
    tab.data.requestReset()
    expect(tab.data.confirmReset()).toBe(false)
    expect(tab.data.getState().reset).toEqual({ kind: 'backupFailed' })
    expect(flaky.data[STORAGE_KEY]).toBe(before)
    expect(tab.wardrobe.getState()).not.toEqual(createWardrobe())
  })

  it("deletes nothing when the reset itself can't be saved", async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    const before = flaky.data[STORAGE_KEY]
    flaky.fail(STORAGE_KEY)
    tab.data.requestReset()
    expect(tab.data.confirmReset()).toBe(false)
    expect(tab.data.getState().reset).toEqual({ kind: 'saveFailed' })
    expect(flaky.data[STORAGE_KEY]).toBe(before)
    expect(tab.wallet.getState().balance).toBeGreaterThan(0)
    expect(tab.timer.getState().status).toBe('running')
  })

  it('can try again after a failure', async () => {
    const { clock, flaky, tab } = setup()
    await makeProgress(tab, clock)
    flaky.fail(RESET_BACKUP_KEY)
    tab.data.requestReset()
    tab.data.confirmReset()
    flaky.heal()
    tab.data.requestReset()
    expect(tab.data.confirmReset()).toBe(true)
    expect(tab.wallet.getState()).toEqual(createWallet())
  })
})

describe('reset in another tab', () => {
  it("drops the other tab's session, so it can't pay or be saved back", async () => {
    const clock = { now: T0 }
    const storage = createMemoryAdapter()
    const a = openTab(storage, clock)
    const b = openTab(storage, clock)
    await makeProgress(a, clock)
    b.wallet.refresh()
    b.wardrobe.refresh()
    b.settings.refresh()
    b.timer.toggle() // b runs its own focus session
    await flush()
    expect(b.wake.held()).toBe(1)

    const oldValue = storage.data[STORAGE_KEY]
    a.data.requestReset()
    a.data.confirmReset()
    const newValue = storage.data[STORAGE_KEY]

    // What src/app/connect.ts does with the storage event.
    expect(isProgressReset(oldValue, newValue)).toBe(true)
    b.reload()
    b.settings.refresh()
    await flush()

    expect(b.timer.getState().status).toBe('idle')
    expect(b.wallet.getState()).toEqual(createWallet())
    expect(b.wardrobe.getState()).toEqual(createWardrobe())
    expect(b.wake.held()).toBe(0)

    clock.now += 30 * MIN
    b.timer.sync()
    expect(b.wallet.getState().balance).toBe(0)
    expect(JSON.parse(storage.data[STORAGE_KEY]).wallet).toBeUndefined()
    expect(JSON.parse(storage.data[STORAGE_KEY]).timer).toBeUndefined()
  })
})
