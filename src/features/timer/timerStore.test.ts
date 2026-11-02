import { describe, expect, it } from 'vitest'
import type { TimerConfig, TimerEvent } from '../../core/timer/engine'
import { createMemoryAdapter } from '../../storage/adapter'
import { createTimerStore } from './timerStore'

const MIN = 60_000
const config: TimerConfig = { durations: { focus: 25, shortBreak: 5, longBreak: 20 }, sessionsPerCycle: 4 }
const T0 = 1_700_000_000_000

function setup(storage = createMemoryAdapter()) {
  const clock = { now: T0 }
  let n = 0
  const store = createTimerStore({ config, storage, now: () => clock.now, newId: () => `id-${++n}` })
  const events: TimerEvent[] = []
  store.onEvent((e) => events.push(e))
  return { store, storage, clock, events }
}

describe('timer store', () => {
  it('toggle starts, pauses and resumes', () => {
    const { store, clock } = setup()
    store.toggle()
    expect(store.getState()).toMatchObject({ status: 'running', sessionId: 'id-1', endsAt: T0 + 25 * MIN })
    clock.now += 5 * MIN
    store.toggle()
    expect(store.getState()).toMatchObject({ status: 'paused', remainingMs: 20 * MIN })
    clock.now += 60 * MIN
    store.toggle()
    expect(store.getState()).toMatchObject({ status: 'running', endsAt: clock.now + 20 * MIN })
  })

  it('notifies subscribers only when the state changes', () => {
    const { store } = setup()
    let calls = 0
    store.subscribe(() => calls++)
    store.sync()
    store.reset()
    expect(calls).toBe(0)
    store.toggle()
    expect(calls).toBe(1)
  })

  it('survives a page refresh mid-session', () => {
    const first = setup()
    first.store.toggle()
    first.clock.now += 10 * MIN

    const second = setup(first.storage) // same storage, new app instance
    second.clock.now = first.clock.now
    expect(second.store.getState()).toMatchObject({ status: 'running', sessionId: 'id-1' })
    second.store.sync()
    expect(second.store.getState().status).toBe('running')
  })

  it('completes a session that ended while the app was closed, exactly once', () => {
    const first = setup()
    first.store.toggle()

    const second = setup(first.storage)
    second.clock.now = T0 + 8 * 60 * MIN
    second.store.sync()
    second.store.sync()
    expect(second.events).toEqual([expect.objectContaining({ type: 'sessionCompleted', sessionId: 'id-1' })])
    expect(second.store.getState()).toMatchObject({ mode: 'shortBreak', status: 'idle', completedInCycle: 1 })

    // The completion was saved: a third launch does not complete it again.
    const third = setup(first.storage)
    third.clock.now = second.clock.now
    third.store.sync()
    expect(third.events).toEqual([])
    expect(third.store.getState().mode).toBe('shortBreak')
  })

  it('a late tap on Pause after the end completes the session instead of pausing it', () => {
    const { store, clock, events } = setup()
    store.toggle()
    clock.now += 26 * MIN
    store.toggle()
    expect(events.map((e) => e.type)).toEqual(['sessionCompleted'])
    expect(store.getState()).toMatchObject({ mode: 'shortBreak', status: 'idle' })
  })

  it('a late tap on Skip after the end counts the session as completed', () => {
    const { store, clock, events } = setup()
    store.toggle()
    clock.now += 30 * MIN
    store.skip()
    expect(events.map((e) => e.type)).toEqual(['sessionCompleted'])
    expect(store.getState()).toMatchObject({ mode: 'shortBreak', completedInCycle: 1 })
  })

  it('skip mid-session emits a skip and does not count', () => {
    const { store, clock, events } = setup()
    store.toggle()
    clock.now += 3 * MIN
    store.skip()
    expect(events).toEqual([{ type: 'sessionSkipped', sessionId: 'id-1', mode: 'focus' }])
    expect(store.getState()).toMatchObject({ mode: 'shortBreak', completedInCycle: 0 })
  })

  it('selectMode and reset are saved', () => {
    const first = setup()
    first.store.selectMode('longBreak')
    const second = setup(first.storage)
    expect(second.store.getState()).toMatchObject({ mode: 'longBreak', status: 'idle' })
  })
})

describe('timer store: settings (setConfig)', () => {
  const custom: TimerConfig = { durations: { focus: 50, shortBreak: 10, longBreak: 30 }, sessionsPerCycle: 4 }

  it('a fresh install uses 25 / 5 / 20', () => {
    const { store } = setup()
    expect(store.getState()).toMatchObject({ mode: 'focus', durationMs: 25 * MIN })
    expect(store.getConfig()).toEqual(config)
  })

  it('an idle session updates right away, is saved and notifies', () => {
    const { store, storage } = setup()
    let calls = 0
    store.subscribe(() => calls++)
    store.setConfig(custom)
    expect(store.getState()).toMatchObject({ status: 'idle', durationMs: 50 * MIN, remainingMs: 50 * MIN })
    expect(calls).toBe(1)
    expect(createTimerStore({ config: custom, storage }).getState()).toEqual(store.getState())
  })

  it('the same config again changes nothing and does not notify', () => {
    const { store } = setup()
    let calls = 0
    store.subscribe(() => calls++)
    store.setConfig({ ...config, durations: { ...config.durations } })
    expect(calls).toBe(0)
  })

  it('changing the focus length during a running focus session keeps its end time; the next focus uses the new length', () => {
    const { store, clock, events } = setup()
    store.toggle() // start at T0
    const endsAt = store.getState().endsAt
    clock.now = T0 + 5 * MIN
    store.setConfig(custom)
    expect(store.getState()).toMatchObject({ status: 'running', durationMs: 25 * MIN, endsAt })

    clock.now = T0 + 25 * MIN
    store.sync()
    // Rewards follow the session's own length (25 min), not the new setting.
    expect(events[0]).toMatchObject({ type: 'sessionCompleted', mode: 'focus', durationMs: 25 * MIN })
    expect(store.getState()).toMatchObject({ mode: 'shortBreak', status: 'idle', durationMs: 10 * MIN })

    store.toggle()
    clock.now += 10 * MIN
    store.sync()
    expect(store.getState()).toMatchObject({ mode: 'focus', status: 'idle', durationMs: 50 * MIN })
  })

  it('a paused session keeps its length and remaining time', () => {
    const { store, clock } = setup()
    store.toggle()
    clock.now = T0 + 10 * MIN
    store.toggle() // pause with 15 min left
    store.setConfig(custom)
    expect(store.getState()).toMatchObject({ status: 'paused', durationMs: 25 * MIN, remainingMs: 15 * MIN })

    clock.now = T0 + 60 * MIN
    store.toggle() // resume
    expect(store.getState().endsAt).toBe(T0 + 75 * MIN)
  })

  it('reset and mode changes after a settings change use the new lengths', () => {
    const { store, clock } = setup()
    store.toggle()
    store.setConfig(custom)
    clock.now = T0 + MIN
    store.reset()
    expect(store.getState()).toMatchObject({ status: 'idle', durationMs: 50 * MIN })
    store.selectMode('longBreak')
    expect(store.getState().durationMs).toBe(30 * MIN)
    store.selectMode('shortBreak')
    expect(store.getState().durationMs).toBe(10 * MIN)
  })

  it('the long break interval applies going forward', () => {
    const { store, clock, events } = setup()
    const runFocusAndBreak = () => {
      store.toggle()
      clock.now = store.getState().endsAt!
      store.sync()
      store.toggle()
      clock.now = store.getState().endsAt!
      store.sync()
    }
    runFocusAndBreak()
    runFocusAndBreak() // 2 done, focus #3 waiting
    store.toggle() // focus #3 running
    store.setConfig({ ...config, sessionsPerCycle: 6 })
    expect(store.getState()).toMatchObject({ status: 'running', completedInCycle: 2, durationMs: 25 * MIN })
    clock.now = store.getState().endsAt!
    store.sync()
    expect(events.at(-1)).toMatchObject({ endsCycle: false })
    expect(store.getState()).toMatchObject({ mode: 'shortBreak', completedInCycle: 3 })
  })

  it('on reload, a waiting session uses the latest saved settings', () => {
    const { store, storage } = setup()
    store.toggle()
    store.skip() // focus skipped; short break waiting (5 min)
    expect(store.getState()).toMatchObject({ mode: 'shortBreak', status: 'idle', durationMs: 5 * MIN })
    const reloaded = createTimerStore({ config: custom, storage })
    expect(reloaded.getState()).toMatchObject({ mode: 'shortBreak', status: 'idle', durationMs: 10 * MIN })
  })
})
