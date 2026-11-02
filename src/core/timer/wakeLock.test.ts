import { describe, expect, it } from 'vitest'
import { createTimer, pause, selectMode, start, type TimerConfig, type TimerMode } from './engine'
import { shouldKeepScreenOn } from './wakeLock'

const MIN = 60_000
const T0 = 1_700_000_000_000
const config: TimerConfig = { durations: { focus: 25, shortBreak: 5, longBreak: 20 }, sessionsPerCycle: 4 }

const waiting = (mode: TimerMode) => selectMode(createTimer(config), mode, config).state
const running = (mode: TimerMode) => start(waiting(mode), T0, 'id-1').state

describe('shouldKeepScreenOn', () => {
  it('is true only for a running focus session with the setting on', () => {
    expect(shouldKeepScreenOn(running('focus'), true, T0 + MIN)).toBe(true)
    expect(shouldKeepScreenOn(running('focus'), false, T0 + MIN)).toBe(false)
  })

  it('never holds for breaks', () => {
    expect(shouldKeepScreenOn(running('shortBreak'), true, T0 + MIN)).toBe(false)
    expect(shouldKeepScreenOn(running('longBreak'), true, T0 + MIN)).toBe(false)
  })

  it('never holds for a waiting or paused focus session', () => {
    expect(shouldKeepScreenOn(waiting('focus'), true, T0)).toBe(false)
    const paused = pause(running('focus'), T0 + MIN, config).state
    expect(paused.status).toBe('paused')
    expect(shouldKeepScreenOn(paused, true, T0 + MIN)).toBe(false)
  })

  it('stops at the end time, even before the timer has caught up', () => {
    const focus = running('focus')
    expect(shouldKeepScreenOn(focus, true, T0 + 25 * MIN - 1)).toBe(true)
    expect(shouldKeepScreenOn(focus, true, T0 + 25 * MIN)).toBe(false)
    expect(shouldKeepScreenOn(focus, true, T0 + 60 * MIN)).toBe(false)
  })
})
