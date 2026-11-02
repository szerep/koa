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
