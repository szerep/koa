import { describe, expect, it } from 'vitest'
import { settingsSpec as spec } from '../../config/settings'
import { createSettings } from '../../core/settings/settings'
import { createMemoryAdapter, type StorageAdapter } from '../../storage/adapter'
import { loadState, SCHEMA_VERSION, STORAGE_KEY } from '../../storage/persistence'
import { createSettingsStore } from './settingsStore'

const make = (storage: StorageAdapter = createMemoryAdapter()) => createSettingsStore({ spec, storage })

function counting(store: ReturnType<typeof make>) {
  let calls = 0
  const unsubscribe = store.subscribe(() => calls++)
  return { calls: () => calls, unsubscribe }
}

describe('settings store', () => {
  it('a fresh install starts with the defaults and saves nothing yet', () => {
    const storage = createMemoryAdapter()
    expect(make(storage).getState()).toEqual(createSettings(spec))
    expect(storage.data[STORAGE_KEY]).toBeUndefined()
  })

  it('saves every change and loads it again after a refresh', () => {
    const storage = createMemoryAdapter()
    const a = make(storage)
    expect(a.setNumber('focus', 50)).toBe(true)
    expect(a.setNumber('dailyGoalMinutes', 480)).toBe(true)
    a.setFlag('sounds', true)

    const b = make(storage)
    expect(b.getState()).toEqual({ ...createSettings(spec), durations: { focus: 50, shortBreak: 5, longBreak: 20 }, dailyGoalMinutes: 480, sounds: true })
  })

  it('keeps the other slices of the save', () => {
    const storage = createMemoryAdapter({
      [STORAGE_KEY]: JSON.stringify({ version: SCHEMA_VERSION, timer: { t: 1 }, wallet: { w: 2 }, wardrobe: { d: 3 } }),
    })
    make(storage).setNumber('shortBreak', 10)
    expect(loadState(storage)).toMatchObject({ timer: { t: 1 }, wallet: { w: 2 }, wardrobe: { d: 3 } })
  })

  it('refuses invalid values without saving or notifying', () => {
    const storage = createMemoryAdapter()
    const store = make(storage)
    const sub = counting(store)
    expect(store.setNumber('focus', 0)).toBe(false)
    expect(store.setNumber('focus', 121)).toBe(false)
    expect(store.setNumber('focus', 25.5)).toBe(false)
    expect(store.setNumber('longBreakEvery', 9)).toBe(false)
    expect(store.setNumber('dailyGoalMinutes', 110)).toBe(false)
    expect(store.getState()).toEqual(createSettings(spec))
    expect(sub.calls()).toBe(0)
    expect(storage.data[STORAGE_KEY]).toBeUndefined()
  })

  it('notifies subscribers once per real change, and not after unsubscribing', () => {
    const store = make()
    const sub = counting(store)
    store.setNumber('longBreak', 30)
    store.setNumber('longBreak', 30) // same value
    store.setFlag('keepScreenOn', true)
    store.setFlag('keepScreenOn', true) // same value
    expect(sub.calls()).toBe(2)

    sub.unsubscribe()
    store.setNumber('longBreak', 25)
    expect(sub.calls()).toBe(2)
  })

  it('gives a new state object on change and the same one otherwise (useSyncExternalStore)', () => {
    const store = make()
    const before = store.getState()
    store.setNumber('focus', 25)
    expect(store.getState()).toBe(before)
    store.setNumber('focus', 45)
    expect(store.getState()).not.toBe(before)
    expect(before.durations.focus).toBe(25) // never mutated
  })

  it('repairs damaged saved settings field by field', () => {
    const storage = createMemoryAdapter({
      [STORAGE_KEY]: JSON.stringify({
        version: SCHEMA_VERSION,
        settings: { durations: { focus: 45, shortBreak: -1, longBreak: 15 }, longBreakEvery: 'four', dailyGoalMinutes: 150, sounds: 'on' },
      }),
    })
    expect(make(storage).getState()).toEqual({
      ...createSettings(spec),
      durations: { focus: 45, shortBreak: 5, longBreak: 15 },
      dailyGoalMinutes: 150,
    })
  })

  it('a corrupt save resets to the defaults without breaking', () => {
    expect(make(createMemoryAdapter({ [STORAGE_KEY]: '{oops' })).getState()).toEqual(createSettings(spec))
    expect(make(createMemoryAdapter({ [STORAGE_KEY]: JSON.stringify({ version: SCHEMA_VERSION, settings: 'x' }) })).getState()).toEqual(
      createSettings(spec),
    )
  })

  describe('cross-tab refresh', () => {
    it("picks up another tab's change and notifies", () => {
      const storage = createMemoryAdapter()
      const here = make(storage)
      const there = make(storage)
      const sub = counting(here)

      there.setNumber('focus', 45)
      here.refresh()
      expect(here.getState().durations.focus).toBe(45)
      expect(sub.calls()).toBe(1)
    })

    it('does not notify when nothing changed', () => {
      const storage = createMemoryAdapter()
      const here = make(storage)
      here.setNumber('focus', 45)
      const sub = counting(here)
      const before = here.getState()
      here.refresh()
      expect(sub.calls()).toBe(0)
      expect(here.getState()).toBe(before)
    })

    it('a later change here keeps what the other tab changed (after a refresh)', () => {
      const storage = createMemoryAdapter()
      const here = make(storage)
      const there = make(storage)
      there.setNumber('dailyGoalMinutes', 200)
      here.refresh()
      here.setFlag('sounds', true)
      expect(make(storage).getState()).toMatchObject({ dailyGoalMinutes: 200, sounds: true })
    })

    it('invalid data written by another tab is repaired on refresh', () => {
      const storage = createMemoryAdapter()
      const here = make(storage)
      here.setNumber('focus', 45)
      storage.write(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, settings: { durations: { focus: 999 }, sounds: true } }))
      here.refresh()
      expect(here.getState()).toEqual({ ...createSettings(spec), sounds: true })
    })
  })

  it('keeps working in memory when storage is unavailable', () => {
    const broken: StorageAdapter = {
      read: () => null,
      write: () => {},
      remove: () => {},
    }
    const store = make(broken)
    store.setNumber('focus', 50)
    store.setFlag('sounds', true)
    expect(store.getState()).toMatchObject({ durations: { focus: 50 }, sounds: true })
  })
})
