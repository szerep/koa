/**
 * Statistics, derived purely from the earned reward ledger (Phase 8, decision 7).
 *
 * There is no separate history: every completed focus session already has a permanent
 * `focus:<sessionId>` ledger entry, and every day the goal was reached has a `goal:<day>` entry.
 * Nothing here writes anything. All functions are pure; "today" comes from the `now` argument.
 *
 * - A session counts on the local calendar day it was completed (the entry's `day`).
 * - A streak is consecutive local calendar days with at least one completed focus session.
 *   Reaching the daily goal isn't required (decision 4).
 * - Days are stepped with calendar arithmetic (`addDays`), never fixed 24-hour durations, so
 *   daylight saving changes can't skip or repeat a day.
 */
import type { LedgerEntry } from '../rewards/wallet'
import { addDays, dayKey, isDayKey } from '../time'

/** The ledger shape stats read. Entries are re-checked here, so legacy or odd data never throws. */
export type StatsLedger = Readonly<Record<string, LedgerEntry>>

export interface StatsOptions {
  /**
   * Used only to estimate minutes for a legacy focus entry without a valid `minutes` field
   * (minutes ≈ amount / coinsPerFocusMinute). Without a positive rate, such entries count as a
   * session with 0 minutes.
   */
  coinsPerFocusMinute?: number
  /** Length of the rolling activity window, today included. Default 7. */
  windowDays?: number
}

export interface FocusSession {
  sessionId: string
  /** Local calendar day the session was completed. */
  day: string
  minutes: number
}

export interface DayStats {
  day: string
  minutes: number
  sessions: number
  goalReached: boolean
}

export interface Streaks {
  /** Consecutive active days ending today, or ending yesterday if today has no session yet. */
  current: number
  /** The longest run of consecutive active days ever. */
  best: number
  /** Whether today already has a completed focus session (the current streak includes today). */
  activeToday: boolean
}

export interface Stats {
  today: DayStats
  /** The rolling window (default 7 days), oldest first, ending with today. */
  window: DayStats[]
  allTime: {
    minutes: number
    sessions: number
    /** Days with at least one completed focus session. */
    activeDays: number
  }
  streak: Streaks
  /** Days the daily goal was reached, sorted oldest first. */
  goalDays: string[]
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * The completed focus sessions in the ledger. Entries without a usable completion day are
 * skipped. A missing or invalid `day` falls back to the local day of `at`. A missing or invalid
 * `minutes` is estimated from the coins (see `StatsOptions`).
 */
export function focusSessions(ledger: StatsLedger, options: StatsOptions = {}): FocusSession[] {
  const rate = options.coinsPerFocusMinute
  const sessions: FocusSession[] = []
  for (const [key, entry] of Object.entries(ledger)) {
    if (typeof entry !== 'object' || entry === null || entry.kind !== 'focus') continue
    const day = isDayKey(entry.day) ? entry.day : isFiniteNumber(entry.at) ? dayKey(entry.at) : null
    if (day === null) continue

    let minutes = 0
    if (isFiniteNumber(entry.minutes) && entry.minutes >= 0) minutes = entry.minutes
    else if (isFiniteNumber(rate) && rate > 0 && isFiniteNumber(entry.amount) && entry.amount >= 0) {
      minutes = entry.amount / rate
    }

    sessions.push({
      sessionId: typeof entry.sessionId === 'string' ? entry.sessionId : key.replace(/^focus:/, ''),
      day,
      minutes,
    })
  }
  return sessions
}

/** Days the daily goal was reached, sorted and unique: from the entry's `day`, its `goal:<day>` key, or its `at`. */
export function goalDays(ledger: StatsLedger): string[] {
  const days = new Set<string>()
  for (const [key, entry] of Object.entries(ledger)) {
    if (typeof entry !== 'object' || entry === null || entry.kind !== 'dailyGoal') continue
    const fromKey = key.startsWith('goal:') ? key.slice('goal:'.length) : ''
    const day = isDayKey(entry.day)
      ? entry.day
      : isDayKey(fromKey)
        ? fromKey
        : isFiniteNumber(entry.at)
          ? dayKey(entry.at)
          : null
    if (day !== null) days.add(day)
  }
  return [...days].sort()
}

/** Minutes and session count per local day. */
export function totalsByDay(sessions: readonly FocusSession[]): Map<string, { minutes: number; sessions: number }> {
  const byDay = new Map<string, { minutes: number; sessions: number }>()
  for (const s of sessions) {
    const total = byDay.get(s.day) ?? { minutes: 0, sessions: 0 }
    total.minutes += s.minutes
    total.sessions += 1
    byDay.set(s.day, total)
  }
  return byDay
}

/**
 * Current and best streak from the set of active days. The current streak stays alive through
 * today until the day ends: with no session yet today, it counts back from yesterday. Days after
 * `today` (a clock that was set ahead) never extend the current streak.
 */
export function streaks(activeDays: Iterable<string>, today: string): Streaks {
  const days = new Set<string>()
  for (const day of activeDays) if (isDayKey(day)) days.add(day)

  let best = 0
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue // not the start of a run
    let length = 1
    while (days.has(addDays(day, length))) length += 1
    best = Math.max(best, length)
  }

  const activeToday = days.has(today)
  let current = 0
  let cursor = activeToday ? today : addDays(today, -1)
  while (days.has(cursor)) {
    current += 1
    cursor = addDays(cursor, -1)
  }

  return { current, best, activeToday }
}

/** Every statistic the Stats screen needs, as of `now`. */
export function computeStats(ledger: StatsLedger, now: number, options: StatsOptions = {}): Stats {
  const today = dayKey(now)
  const windowDays = Math.max(1, Math.floor(options.windowDays ?? 7))
  const sessions = focusSessions(ledger, options)
  const byDay = totalsByDay(sessions)
  const goals = goalDays(ledger)
  const goalSet = new Set(goals)

  const statsFor = (day: string): DayStats => {
    const total = byDay.get(day)
    return { day, minutes: total?.minutes ?? 0, sessions: total?.sessions ?? 0, goalReached: goalSet.has(day) }
  }

  const window: DayStats[] = []
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) window.push(statsFor(addDays(today, -offset)))

  let minutes = 0
  for (const s of sessions) minutes += s.minutes

  return {
    today: statsFor(today),
    window,
    allTime: { minutes, sessions: sessions.length, activeDays: byDay.size },
    streak: streaks(byDay.keys(), today),
    goalDays: goals,
  }
}
