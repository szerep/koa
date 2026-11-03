import { describe, expect, it } from 'vitest'
import type { TimerMode, TimerStatus } from '../timer/engine'
import { isUpdateCheckDue, shouldOfferUpdate } from './update'

const HOUR = 60 * 60 * 1000

describe('shouldOfferUpdate', () => {
  const modes: TimerMode[] = ['focus', 'shortBreak', 'longBreak']
  const statuses: TimerStatus[] = ['idle', 'running', 'paused']

  it.each(modes.flatMap((mode) => statuses.map((status) => [mode, status] as const)))(
    '%s / %s',
    (mode, status) => {
      const expected = !(mode === 'focus' && status === 'running')
      expect(shouldOfferUpdate({ mode, status })).toBe(expected)
    },
  )

  it('never offers during a running focus session', () => {
    expect(shouldOfferUpdate({ mode: 'focus', status: 'running' })).toBe(false)
  })

  it('offers while a focus session is paused, and during running breaks', () => {
    expect(shouldOfferUpdate({ mode: 'focus', status: 'paused' })).toBe(true)
    expect(shouldOfferUpdate({ mode: 'shortBreak', status: 'running' })).toBe(true)
    expect(shouldOfferUpdate({ mode: 'longBreak', status: 'running' })).toBe(true)
  })
})

describe('isUpdateCheckDue', () => {
  const base = { now: 10 * HOUR, online: true, intervalMs: HOUR }

  it('checks the first time', () => {
    expect(isUpdateCheckDue({ ...base, lastCheckAt: null })).toBe(true)
  })

  it('waits an hour between checks', () => {
    expect(isUpdateCheckDue({ ...base, lastCheckAt: base.now })).toBe(false)
    expect(isUpdateCheckDue({ ...base, lastCheckAt: base.now - HOUR + 1 })).toBe(false)
    expect(isUpdateCheckDue({ ...base, lastCheckAt: base.now - HOUR })).toBe(true)
    expect(isUpdateCheckDue({ ...base, lastCheckAt: base.now - 5 * HOUR })).toBe(true)
  })

  it('never checks while offline', () => {
    expect(isUpdateCheckDue({ ...base, online: false, lastCheckAt: null })).toBe(false)
    expect(isUpdateCheckDue({ ...base, online: false, lastCheckAt: base.now - 5 * HOUR })).toBe(false)
  })

  it('allows a check when the clock moved backwards', () => {
    expect(isUpdateCheckDue({ ...base, lastCheckAt: base.now + 1000 })).toBe(true)
  })
})
