import { describe, expect, it } from 'vitest'
import { chartMax, dateLong, formatDuration, msUntilNextDay, spokenDuration, weekdayShort } from './format'

describe('formatDuration', () => {
  it('shows minutes under an hour and hours with minutes above', () => {
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(185)).toBe('3 h 5 min')
  })

  it('rounds unrounded minutes and never goes negative', () => {
    expect(formatDuration(24.6)).toBe('25 min')
    expect(formatDuration(59.6)).toBe('1 h')
    expect(formatDuration(-3)).toBe('0 min')
  })
})

describe('spokenDuration', () => {
  it('uses words and singular forms', () => {
    expect(spokenDuration(1)).toBe('1 minute')
    expect(spokenDuration(0)).toBe('0 minutes')
    expect(spokenDuration(120)).toBe('2 hours')
    expect(spokenDuration(61)).toBe('1 hour 1 minute')
  })
})

describe('day labels', () => {
  it('names the local weekday of a day key', () => {
    expect(weekdayShort('2026-11-02')).toBe('Mon')
    expect(dateLong('2026-11-02')).toBe('Monday, November 2')
  })
})

describe('msUntilNextDay', () => {
  it('counts to the next local midnight', () => {
    const now = new Date(2026, 10, 2, 23, 59, 0).getTime()
    expect(msUntilNextDay(now)).toBe(60_000)
    expect(msUntilNextDay(new Date(2026, 10, 2).getTime())).toBeGreaterThan(0)
  })
})

describe('chartMax', () => {
  it('fits both the goal and the best day', () => {
    expect(chartMax([10, 40], 100)).toBe(100)
    expect(chartMax([10, 140], 100)).toBe(140)
    expect(chartMax([], 0)).toBe(1)
  })
})
