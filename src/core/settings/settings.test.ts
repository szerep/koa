import { describe, expect, it } from 'vitest'
import { settingsSpec as spec } from '../../config/settings'
import {
  commitInput,
  createSettings,
  isValidValue,
  restoreSettings,
  sameSettings,
  sessionsForGoal,
  setFlag,
  setNumber,
  stepValue,
  timerConfigFrom,
  type NumericSetting,
} from './settings'

const goal = spec.ranges.dailyGoalMinutes
const focus = spec.ranges.focus

describe('settings defaults', () => {
  it('a fresh install gets 25 / 5 / 20, a long break every 4, a 100-minute goal and everything off', () => {
    expect(createSettings(spec)).toEqual({
      durations: { focus: 25, shortBreak: 5, longBreak: 20 },
      longBreakEvery: 4,
      dailyGoalMinutes: 100,
      notifications: false,
      keepScreenOn: false,
      sounds: false,
    })
  })

  it('has the approved bounds', () => {
    expect(spec.ranges).toEqual({
      focus: { min: 1, max: 120, step: 1 },
      shortBreak: { min: 1, max: 30, step: 1 },
      longBreak: { min: 1, max: 60, step: 1 },
      longBreakEvery: { min: 2, max: 8, step: 1 },
      dailyGoalMinutes: { min: 25, max: 480, step: 25 },
    })
  })

  it('every default is valid for its own range', () => {
    const d = spec.defaults
    const values: Record<NumericSetting, number> = { ...d.durations, longBreakEvery: d.longBreakEvery, dailyGoalMinutes: d.dailyGoalMinutes }
    for (const [key, value] of Object.entries(values)) {
      expect(isValidValue(value, spec.ranges[key as NumericSetting]), key).toBe(true)
    }
  })

  it('returns a copy, so editing it never changes the defaults', () => {
    const s = createSettings(spec)
    s.durations.focus = 50
    expect(spec.defaults.durations.focus).toBe(25)
  })
})

describe('isValidValue', () => {
  it('accepts whole numbers within the bounds', () => {
    expect(isValidValue(1, focus)).toBe(true)
    expect(isValidValue(120, focus)).toBe(true)
  })

  it.each([0, 121, -5, 25.5, NaN, Infinity, '25', null, undefined, true])('rejects %j for focus', (value) => {
    expect(isValidValue(value, focus)).toBe(false)
  })

  it('daily goal: only 25-minute steps, plus the 480 bound', () => {
    expect(isValidValue(25, goal)).toBe(true)
    expect(isValidValue(100, goal)).toBe(true)
    expect(isValidValue(475, goal)).toBe(true)
    expect(isValidValue(480, goal)).toBe(true)
    expect(isValidValue(110, goal)).toBe(false)
    expect(isValidValue(0, goal)).toBe(false)
    expect(isValidValue(500, goal)).toBe(false)
  })
})

describe('stepValue', () => {
  it('moves by one step and stops at the bounds', () => {
    expect(stepValue(25, 1, focus)).toBe(26)
    expect(stepValue(25, -1, focus)).toBe(24)
    expect(stepValue(120, 1, focus)).toBe(120)
    expect(stepValue(1, -1, focus)).toBe(1)
  })

  it('daily goal moves in 25s and reaches the 480 bound both ways', () => {
    expect(stepValue(100, 1, goal)).toBe(125)
    expect(stepValue(100, -1, goal)).toBe(75)
    expect(stepValue(475, 1, goal)).toBe(480)
    expect(stepValue(480, 1, goal)).toBe(480)
    expect(stepValue(480, -1, goal)).toBe(475)
    expect(stepValue(25, -1, goal)).toBe(25)
  })

  it('from an off-grid or out-of-range value, moves to the next grid value', () => {
    expect(stepValue(110, 1, goal)).toBe(125)
    expect(stepValue(110, -1, goal)).toBe(100)
    expect(stepValue(999, -1, focus)).toBe(119)
    expect(stepValue(NaN, 1, focus)).toBe(2)
  })
})

describe('commitInput (typed value, on blur)', () => {
  it('keeps a valid whole number', () => {
    expect(commitInput('45', 25, focus)).toBe(45)
    expect(commitInput(' 45 ', 25, focus)).toBe(45)
  })

  it('clamps to the bounds', () => {
    expect(commitInput('500', 25, focus)).toBe(120)
    expect(commitInput('0', 25, focus)).toBe(1)
  })

  it('rounds decimals to whole minutes (dot or comma)', () => {
    expect(commitInput('24.4', 25, focus)).toBe(24)
    expect(commitInput('24,5', 25, focus)).toBe(25)
  })

  it.each(['', '   ', 'abc', '25min', '-5', '1e2', '+3', '.5'])('reverts %j to the last valid value', (text) => {
    expect(commitInput(text, 25, focus)).toBe(25)
  })

  it('snaps the daily goal to its grid, with 480 as the top', () => {
    expect(commitInput('110', 100, goal)).toBe(100)
    expect(commitInput('113', 100, goal)).toBe(125)
    expect(commitInput('470', 100, goal)).toBe(475)
    expect(commitInput('479', 100, goal)).toBe(480)
    expect(commitInput('9999', 100, goal)).toBe(480)
    expect(commitInput('10', 100, goal)).toBe(25)
  })
})

describe('setNumber and setFlag', () => {
  it('changes a duration without touching the others', () => {
    const s = createSettings(spec)
    const next = setNumber(s, 'focus', 50, spec)
    expect(next.durations).toEqual({ focus: 50, shortBreak: 5, longBreak: 20 })
    expect(s.durations.focus).toBe(25) // not mutated
  })

  it('changes the long break interval and the daily goal', () => {
    const s = createSettings(spec)
    expect(setNumber(s, 'longBreakEvery', 6, spec).longBreakEvery).toBe(6)
    expect(setNumber(s, 'dailyGoalMinutes', 150, spec).dailyGoalMinutes).toBe(150)
  })

  it('refuses invalid values: they can never be saved', () => {
    const s = createSettings(spec)
    expect(setNumber(s, 'focus', 0, spec)).toBe(s)
    expect(setNumber(s, 'focus', 121, spec)).toBe(s)
    expect(setNumber(s, 'focus', 25.5, spec)).toBe(s)
    expect(setNumber(s, 'shortBreak', 31, spec)).toBe(s)
    expect(setNumber(s, 'longBreak', 61, spec)).toBe(s)
    expect(setNumber(s, 'longBreakEvery', 1, spec)).toBe(s)
    expect(setNumber(s, 'longBreakEvery', 9, spec)).toBe(s)
    expect(setNumber(s, 'dailyGoalMinutes', 110, spec)).toBe(s)
  })

  it('returns the same object when nothing changes', () => {
    const s = createSettings(spec)
    expect(setNumber(s, 'focus', 25, spec)).toBe(s)
    expect(setFlag(s, 'sounds', false)).toBe(s)
  })

  it('toggles a flag', () => {
    const s = createSettings(spec)
    expect(setFlag(s, 'notifications', true)).toEqual({ ...s, notifications: true })
  })
})

describe('sessionsForGoal', () => {
  it('counts the focus sessions needed to reach the goal, rounded up', () => {
    expect(sessionsForGoal(100, 25)).toBe(4)
    expect(sessionsForGoal(100, 45)).toBe(3) // 2 × 45 = 90 isn't enough
    expect(sessionsForGoal(100, 50)).toBe(2)
    expect(sessionsForGoal(480, 50)).toBe(10)
    expect(sessionsForGoal(480, 1)).toBe(480)
  })

  it('is at least 1, even when one session is longer than the goal', () => {
    expect(sessionsForGoal(25, 120)).toBe(1)
    expect(sessionsForGoal(0, 25)).toBe(1)
    expect(sessionsForGoal(100, 0)).toBe(1)
  })
})

describe('timerConfigFrom', () => {
  it('maps durations and the long break interval, as a copy', () => {
    const s = setNumber(setNumber(createSettings(spec), 'focus', 45, spec), 'longBreakEvery', 3, spec)
    const config = timerConfigFrom(s)
    expect(config).toEqual({ durations: { focus: 45, shortBreak: 5, longBreak: 20 }, sessionsPerCycle: 3 })
    config.durations.focus = 1
    expect(s.durations.focus).toBe(45)
  })
})

describe('sameSettings', () => {
  it('compares every value, not identity', () => {
    const s = createSettings(spec)
    expect(sameSettings(s, createSettings(spec))).toBe(true)
    expect(sameSettings(s, setNumber(s, 'longBreak', 30, spec))).toBe(false)
    expect(sameSettings(s, setNumber(s, 'longBreakEvery', 5, spec))).toBe(false)
    expect(sameSettings(s, setNumber(s, 'dailyGoalMinutes', 125, spec))).toBe(false)
    expect(sameSettings(s, setFlag(s, 'keepScreenOn', true))).toBe(false)
  })
})

describe('restoreSettings', () => {
  it.each([undefined, null, 42, 'settings', [], {}])('falls back to the defaults for %j', (raw) => {
    expect(restoreSettings(raw, spec)).toEqual(createSettings(spec))
  })

  it('round-trips valid saved settings', () => {
    const saved = {
      durations: { focus: 50, shortBreak: 10, longBreak: 30 },
      longBreakEvery: 3,
      dailyGoalMinutes: 480,
      notifications: true,
      keepScreenOn: true,
      sounds: true,
    }
    expect(restoreSettings(JSON.parse(JSON.stringify(saved)), spec)).toEqual(saved)
  })

  it('replaces each invalid field with its default and keeps the valid ones', () => {
    const restored = restoreSettings(
      {
        durations: { focus: 0, shortBreak: 10, longBreak: 'long' },
        longBreakEvery: 12,
        dailyGoalMinutes: 110,
        notifications: 'yes',
        keepScreenOn: true,
        sounds: 1,
      },
      spec,
    )
    expect(restoreSettings(restored, spec)).toEqual(restored)
    expect(restored).toEqual({
      durations: { focus: 25, shortBreak: 10, longBreak: 20 },
      longBreakEvery: 4,
      dailyGoalMinutes: 100,
      notifications: false,
      keepScreenOn: true,
      sounds: false,
    })
  })

  it('handles missing or broken durations', () => {
    expect(restoreSettings({ durations: null, sounds: true }, spec)).toEqual({ ...createSettings(spec), sounds: true })
    expect(restoreSettings({ durations: { focus: 45 } }, spec).durations).toEqual({ focus: 45, shortBreak: 5, longBreak: 20 })
  })

  it('ignores unknown fields', () => {
    expect(restoreSettings({ theme: 'evening', sounds: true }, spec)).toEqual({ ...createSettings(spec), sounds: true })
  })
})
