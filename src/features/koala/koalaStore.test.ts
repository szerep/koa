import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { koalaBehavior } from '../../config/koalaBehavior'
import { createKoalaStore } from './koalaStore'

describe('koalaStore', () => {
  let clock = 0
  const make = () =>
    createKoalaStore({
      context: 'idle',
      getTickInput: () => ({ canAffordSomething: false }),
      now: () => clock,
      random: () => 0.3,
      hour: () => 9,
    })

  beforeEach(() => {
    vi.useFakeTimers()
    clock = 1_000_000
  })
  afterEach(() => vi.useRealTimers())

  it('does not re-render for input that changes nothing visible', () => {
    const store = make()
    const listener = vi.fn()
    store.subscribe(listener)
    store.activity()
    expect(listener).not.toHaveBeenCalled()
    store.tap()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ticks only while subscribed', () => {
    const store = make()
    const before = store.getState()
    clock += koalaBehavior.napAfter.idle + 1000
    vi.advanceTimersByTime(2000)
    expect(store.getState()).toBe(before) // nobody watching: no ticking

    const unsubscribe = store.subscribe(() => {})
    vi.advanceTimersByTime(1000)
    expect(store.getState().napping).toBe(true)
    unsubscribe()
  })

  it('celebrates, then follows the timer back into focus quietly', () => {
    const store = make()
    store.celebrate('cycle')
    expect(store.getState().bubble?.topic).toBe('cycle')
    store.setContext('focus')
    expect(store.getState().bubble).toBeNull()
    store.greet()
    expect(store.getState().bubble).toBeNull()
  })
})
