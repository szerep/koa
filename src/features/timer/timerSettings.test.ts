import { describe, expect, it } from 'vitest'
import { settingsSpec } from '../../config/settings'
import { timerConfigFrom } from '../../core/settings/settings'
import { createMemoryAdapter, type StorageAdapter } from '../../storage/adapter'
import { createSettingsStore } from '../settings/settingsStore'
import { createTimerStore } from './timerStore'

const MIN = 60_000
const T0 = 1_700_000_000_000

/** The app's start-up order and wiring (features/timer/store.ts and app/connect.ts), in memory. */
function launch(storage: StorageAdapter) {
  const clock = { now: T0 }
  const settings = createSettingsStore({ spec: settingsSpec, storage })
  const timer = createTimerStore({ config: timerConfigFrom(settings.getState()), storage, now: () => clock.now })
  settings.subscribe(() => timer.setConfig(timerConfigFrom(settings.getState())))
  return { settings, timer, clock }
}

describe('settings → timer', () => {
  it('a fresh install shows 25 / 5 / 20 with a long break after 4', () => {
    const { timer } = launch(createMemoryAdapter())
    expect(timer.getConfig()).toEqual({ durations: { focus: 25, shortBreak: 5, longBreak: 20 }, sessionsPerCycle: 4 })
    expect(timer.getState().durationMs).toBe(25 * MIN)
  })

  it('a settings change reaches the waiting session at once', () => {
    const { settings, timer } = launch(createMemoryAdapter())
    settings.setNumber('focus', 45)
    expect(timer.getState()).toMatchObject({ status: 'idle', durationMs: 45 * MIN, remainingMs: 45 * MIN })
    settings.setNumber('longBreakEvery', 6)
    expect(timer.getConfig().sessionsPerCycle).toBe(6)
  })

  it('flag changes leave the timer alone', () => {
    const { settings, timer } = launch(createMemoryAdapter())
    const before = timer.getState()
    settings.setFlag('sounds', true)
    expect(timer.getState()).toBe(before)
  })

  it('a running session is not touched by a settings change', () => {
    const { settings, timer } = launch(createMemoryAdapter())
    timer.toggle()
    const running = timer.getState()
    settings.setNumber('focus', 90)
    settings.setNumber('longBreakEvery', 2)
    expect(timer.getState()).toBe(running)
  })

  it('lowering the interval to the sessions done turns the waiting short break into the long break', () => {
    const { settings, timer, clock } = launch(createMemoryAdapter())
    for (let i = 0; i < 5; i++) {
      timer.toggle()
      clock.now = timer.getState().endsAt!
      timer.sync()
    } // 3 focus done, short break waiting
    expect(timer.getState()).toMatchObject({ mode: 'shortBreak', status: 'idle', completedInCycle: 3 })
    settings.setNumber('longBreakEvery', 3)
    expect(timer.getState()).toMatchObject({ mode: 'longBreak', status: 'idle', completedInCycle: 3, durationMs: 20 * MIN })
  })

  it('a hand-picked short break after a full cycle survives other settings changes', () => {
    const { settings, timer, clock } = launch(createMemoryAdapter())
    for (let i = 0; i < 7; i++) {
      timer.toggle()
      clock.now = timer.getState().endsAt!
      timer.sync()
    } // long break waiting
    timer.selectMode('shortBreak')
    settings.setFlag('sounds', true)
    settings.setNumber('focus', 40)
    expect(timer.getState()).toMatchObject({ mode: 'shortBreak', completedInCycle: 4 })
  })

  it('after a reload, the waiting session is sized from the saved settings', () => {
    const storage = createMemoryAdapter()
    const first = launch(storage)
    first.settings.setNumber('focus', 50)
    first.timer.selectMode('shortBreak')
    first.settings.setNumber('shortBreak', 8)

    const second = launch(storage)
    expect(second.timer.getConfig().durations).toEqual({ focus: 50, shortBreak: 8, longBreak: 20 })
    expect(second.timer.getState()).toMatchObject({ mode: 'shortBreak', status: 'idle', durationMs: 8 * MIN })
  })

  it('a settings change from another tab reaches this tab', () => {
    const storage = createMemoryAdapter()
    const here = launch(storage)
    const there = launch(storage)
    there.settings.setNumber('focus', 30)
    here.settings.refresh() // what the storage event triggers
    expect(here.timer.getState().durationMs).toBe(30 * MIN)
  })
})
