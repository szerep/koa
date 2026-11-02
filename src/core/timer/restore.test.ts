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

  it('a waiting break follows the saved break lengths on reload', () => {
    const saved = { ...createTimer(config), mode: 'shortBreak', durationMs: 5 * MIN, remainingMs: 5 * MIN, completedInCycle: 1 }
    const custom = { ...config, durations: { focus: 25, shortBreak: 12, longBreak: 20 } }
    expect(restoreTimer(saved, custom)).toMatchObject({ mode: 'shortBreak', durationMs: 12 * MIN, completedInCycle: 1 })
  })

  it('a waiting session keeps its mode on reload and its cycle count is capped at the interval', () => {
    const saved = { ...createTimer(config), mode: 'shortBreak', durationMs: 5 * MIN, remainingMs: 5 * MIN, completedInCycle: 4 }
    expect(restoreTimer(saved, { ...config, sessionsPerCycle: 3 })).toMatchObject({
      mode: 'shortBreak',
      status: 'idle',
      durationMs: 5 * MIN,
      completedInCycle: 3,
    })
  })

  describe('cycle focus time', () => {
    it('round-trips a saved value', () => {
      const saved = { ...createTimer(config), mode: 'shortBreak', completedInCycle: 2, cycleFocusMs: 70 * MIN }
      expect(restoreTimer(JSON.parse(JSON.stringify(saved)), config).cycleFocusMs).toBe(70 * MIN)
    })

    it('a pre-Phase 8 save without it gets 25 minutes per completed session (every session was 25 then)', () => {
      const legacy: Record<string, unknown> = { ...start(createTimer(config), T0, 'a').state, completedInCycle: 3 }
      delete legacy.cycleFocusMs
      expect(restoreTimer(legacy, config)).toMatchObject({ status: 'running', completedInCycle: 3, cycleFocusMs: 75 * MIN })
      // ...so the cycle it completes still earns exactly the old 30-coin bonus (100 minutes).
      const done = reconcile(restoreTimer(legacy, config), T0 + 25 * MIN, config)
      expect(done.events[0]).toMatchObject({ endsCycle: true, cycleFocusMs: 100 * MIN })
    })

    it.each([-1, 'lots', null, NaN])('an invalid value (%j) falls back to the same estimate', (bad) => {
      const saved = { ...createTimer(config), completedInCycle: 2, cycleFocusMs: bad }
      expect(restoreTimer(saved, config).cycleFocusMs).toBe(50 * MIN)
    })

    it('is 0 when no focus session is done in the cycle', () => {
      expect(restoreTimer({ ...createTimer(config), cycleFocusMs: 90 * MIN }, config).cycleFocusMs).toBe(0)
    })
  })

  it('running and paused sessions keep their length and time on reload, whatever the settings', () => {
    const custom = { durations: { focus: 50, shortBreak: 10, longBreak: 30 }, sessionsPerCycle: 6 }
    const running = start(createTimer(config), T0, 'a').state
    expect(restoreTimer(JSON.parse(JSON.stringify(running)), custom)).toEqual(running)
    const paused = { ...running, status: 'paused' as const, endsAt: null, remainingMs: 7 * MIN }
    expect(restoreTimer(JSON.parse(JSON.stringify(paused)), custom)).toEqual(paused)
  })

  it('clamps out-of-range numbers', () => {
    const paused = { ...start(createTimer(config), T0, 'a').state, status: 'paused', endsAt: null }
    expect(restoreTimer({ ...paused, remainingMs: 99 * MIN }, config).remainingMs).toBe(25 * MIN)
    expect(restoreTimer({ ...paused, remainingMs: -5 }, config).remainingMs).toBe(0)
    expect(restoreTimer({ ...paused, completedInCycle: 17.6 }, config).completedInCycle).toBe(4)
    expect(restoreTimer({ ...paused, completedInCycle: -2 }, config).completedInCycle).toBe(0)
  })
})
