import { describe, expect, it } from 'vitest'
import { createTimer, reconcile, start, type TimerConfig } from './engine'
import { restoreTimer } from './restore'

const MIN = 60_000
const config: TimerConfig = { durations: { focus: 25, shortBreak: 5, longBreak: 20 }, sessionsPerCycle: 4 }
const T0 = 1_700_000_000_000

describe('restoreTimer', () => {
  it.each([undefined, null, 42, 'running', [], {}])('falls back to a fresh timer for %j', (raw) => {
    expect(restoreTimer(raw, config)).toEqual(createTimer(config))
  })

  it('rejects unknown modes and statuses', () => {
    const good = { ...createTimer(config) }
    expect(restoreTimer({ ...good, mode: 'nap' }, config)).toEqual(createTimer(config))
    expect(restoreTimer({ ...good, status: 'done' }, config)).toEqual(createTimer(config))
    expect(restoreTimer({ ...good, durationMs: -1 }, config)).toEqual(createTimer(config))
    expect(restoreTimer({ ...good, remainingMs: 'x' }, config)).toEqual(createTimer(config))
  })

  it('rejects a running session without an end time or id', () => {
    const running = start(createTimer(config), T0, 'a').state
    expect(restoreTimer({ ...running, endsAt: null }, config)).toEqual(createTimer(config))
    expect(restoreTimer({ ...running, sessionId: null }, config)).toEqual(createTimer(config))
  })

  it('round-trips a running session through JSON (page refresh)', () => {
    const running = start(createTimer(config), T0, 'a').state
    const restored = restoreTimer(JSON.parse(JSON.stringify(running)), config)
    expect(restored).toEqual(running)
  })

  it('a session that ended while the app was closed completes on the next reconcile', () => {
    const running = start(createTimer(config), T0, 'a').state
    const restored = restoreTimer(JSON.parse(JSON.stringify(running)), config)
    const t = reconcile(restored, T0 + 3 * 60 * MIN, config)
    expect(t.events).toEqual([expect.objectContaining({ sessionId: 'a', completedAt: T0 + 25 * MIN })])
  })

  it('an idle session follows the current settings', () => {
    const saved = createTimer(config)
    const longer = { ...config, durations: { ...config.durations, focus: 45 } }
    expect(restoreTimer(saved, longer)).toMatchObject({ durationMs: 45 * MIN, remainingMs: 45 * MIN })
  })

  it('clamps out-of-range numbers', () => {
    const paused = { ...start(createTimer(config), T0, 'a').state, status: 'paused', endsAt: null }
    expect(restoreTimer({ ...paused, remainingMs: 99 * MIN }, config).remainingMs).toBe(25 * MIN)
    expect(restoreTimer({ ...paused, remainingMs: -5 }, config).remainingMs).toBe(0)
    expect(restoreTimer({ ...paused, completedInCycle: 17.6 }, config).completedInCycle).toBe(4)
    expect(restoreTimer({ ...paused, completedInCycle: -2 }, config).completedInCycle).toBe(0)
  })
})
