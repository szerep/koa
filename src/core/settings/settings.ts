/**
 * User settings (Phase 8): pure rules for the values, their bounds and how they're restored.
 *
 * - Durations and the daily goal are whole minutes. The long break interval is a session count.
 * - Every numeric setting has a range: min, max and a step. Valid values sit on the step grid
 *   counted from `min`, and both bounds are always valid, so a bound that isn't on the grid
 *   (the 480-minute goal with 25-minute steps) can still be reached.
 * - Saved settings are validated field by field: an invalid value falls back to its own default
 *   and the other fields are kept.
 */
import type { TimerConfig, TimerMode } from '../timer/engine'

export interface Settings {
  /** Minutes per mode. */
  durations: Record<TimerMode, number>
  /** A long break follows this many completed focus sessions. */
  longBreakEvery: number
  /** Focus minutes per local day that earn the daily-goal bonus. */
  dailyGoalMinutes: number
  /** Session-complete notifications (permission is only requested when turned on). */
  notifications: boolean
  /** Keep the screen on during focus, where the browser supports it. */
  keepScreenOn: boolean
  /** A soft chime when a session completes. */
  sounds: boolean
}

export type NumericSetting = TimerMode | 'longBreakEvery' | 'dailyGoalMinutes'
export type FlagSetting = 'notifications' | 'keepScreenOn' | 'sounds'

export interface NumberRange {
  min: number
  max: number
  step: number
}

export interface SettingsSpec {
  defaults: Settings
  ranges: Record<NumericSetting, NumberRange>
}

const MODES: readonly TimerMode[] = ['focus', 'shortBreak', 'longBreak']
const FLAGS: readonly FlagSetting[] = ['notifications', 'keepScreenOn', 'sounds']

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function isMode(key: NumericSetting): key is TimerMode {
  return (MODES as readonly string[]).includes(key)
}

/** A copy of the defaults (callers may keep it as their own state). */
export function createSettings(spec: SettingsSpec): Settings {
  return { ...spec.defaults, durations: { ...spec.defaults.durations } }
}

export function getNumber(settings: Settings, key: NumericSetting): number {
  return isMode(key) ? settings.durations[key] : settings[key]
}

/** A whole number within the range, on its step grid or exactly at a bound. */
export function isValidValue(value: unknown, range: NumberRange): value is number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return false
  if (value < range.min || value > range.max) return false
  return value === range.max || (value - range.min) % range.step === 0
}

/** Clamp to the range and snap to the nearest grid value (or a bound). */
function normalize(value: number, range: NumberRange): number {
  const clamped = Math.min(range.max, Math.max(range.min, value))
  const index = (clamped - range.min) / range.step
  const lower = range.min + Math.floor(index) * range.step
  // The grid value above, or the max when that would overshoot it (479 → 480, not 500).
  const upper = Math.min(range.max, range.min + Math.ceil(index) * range.step)
  return clamped - lower < upper - clamped ? lower : upper // ties round up
}

/**
 * One stepper press. Moves to the next grid value in `direction` and stops at the bounds.
 * From an off-grid value it moves to the nearest grid value in that direction.
 */
export function stepValue(value: number, direction: 1 | -1, range: NumberRange): number {
  const base = Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value)) : range.min
  const index = (base - range.min) / range.step
  const nextIndex = direction > 0 ? Math.floor(index) + 1 : Math.ceil(index) - 1
  return Math.min(range.max, Math.max(range.min, range.min + nextIndex * range.step))
}

/** Plain whole or decimal numbers, with a dot or comma. No signs, exponents or units. */
const NUMERIC_INPUT = /^\d+(?:[.,]\d+)?$/

/**
 * What a typed value becomes when the field loses focus: rounded to whole units, clamped
 * to the range and snapped to the grid. Empty or non-numeric input reverts to `last`.
 */
export function commitInput(text: string, last: number, range: NumberRange): number {
  const trimmed = text.trim()
  if (!NUMERIC_INPUT.test(trimmed)) return last
  const parsed = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(parsed)) return last
  return normalize(Math.round(parsed), range)
}

/**
 * Change one numeric setting. Invalid values are refused: the same object comes back,
 * as it does when nothing changes.
 */
export function setNumber(settings: Settings, key: NumericSetting, value: number, spec: SettingsSpec): Settings {
  if (!isValidValue(value, spec.ranges[key]) || getNumber(settings, key) === value) return settings
  if (isMode(key)) return { ...settings, durations: { ...settings.durations, [key]: value } }
  return { ...settings, [key]: value }
}

export function setFlag(settings: Settings, key: FlagSetting, value: boolean): Settings {
  if (settings[key] === value) return settings
  return { ...settings, [key]: value }
}

/**
 * How many focus sessions of `focusMinutes` reach a daily goal of `goalMinutes` (at least 1).
 * Rounded up: that's how many you actually need.
 */
export function sessionsForGoal(goalMinutes: number, focusMinutes: number): number {
  if (!(goalMinutes > 0) || !(focusMinutes > 0)) return 1
  return Math.max(1, Math.ceil(goalMinutes / focusMinutes))
}

/** The timer's part of the settings. */
export function timerConfigFrom(settings: Settings): TimerConfig {
  return { durations: { ...settings.durations }, sessionsPerCycle: settings.longBreakEvery }
}

/** Whether two settings hold the same values. */
export function sameSettings(a: Settings, b: Settings): boolean {
  return (
    MODES.every((mode) => a.durations[mode] === b.durations[mode]) &&
    a.longBreakEvery === b.longBreakEvery &&
    a.dailyGoalMinutes === b.dailyGoalMinutes &&
    FLAGS.every((flag) => a[flag] === b[flag])
  )
}

/** Rebuild settings from persisted data, one field at a time. A broken save never breaks the app. */
export function restoreSettings(raw: unknown, spec: SettingsSpec): Settings {
  const settings = createSettings(spec)
  if (!isObject(raw)) return settings

  const durations = isObject(raw.durations) ? raw.durations : {}
  for (const mode of MODES) {
    const value = durations[mode]
    if (isValidValue(value, spec.ranges[mode])) settings.durations[mode] = value
  }
  if (isValidValue(raw.longBreakEvery, spec.ranges.longBreakEvery)) settings.longBreakEvery = raw.longBreakEvery
  if (isValidValue(raw.dailyGoalMinutes, spec.ranges.dailyGoalMinutes)) {
    settings.dailyGoalMinutes = raw.dailyGoalMinutes
  }
  for (const flag of FLAGS) {
    const value = raw[flag]
    if (typeof value === 'boolean') settings[flag] = value
  }
  return settings
}
