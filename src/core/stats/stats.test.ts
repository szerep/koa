import { afterAll, describe, expect, it } from 'vitest'
import { createWallet, restoreWallet, rewardSession, type LedgerEntry, type RewardRules } from '../rewards/wallet'
import type { SessionCompleted } from '../timer/engine'
import { addDays, dayKey } from '../time'
import { computeStats, focusSessions, goalDays, streaks, type StatsLedger } from './stats'

// Pin the timezone so local-day and daylight-saving cases are deterministic on every machine.
// Europe/Budapest: DST starts 2026-03-29 (02:00 → 03:00) and ends 2026-10-25 (03:00 → 02:00).
// Set at module load, because describe bodies (and their `local(...)` constants) run before hooks.
// (The app's tsconfig has no Node types, so `process` is reached through a typed globalThis.)
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const ORIGINAL_TZ = env.TZ
env.TZ = 'Europe/Budapest'
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete env.TZ
  else env.TZ = ORIGINAL_TZ
})

const MIN = 60_000
const HOUR = 60 * MIN
/** Local time in the pinned timezone. */
const local = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).getTime()

let n = 0
/** A focus ledger entry completed at `at`, with the day set the way the wallet sets it. */
function focusEntry(at: number, minutes = 25, extra: Partial<LedgerEntry> = {}): [string, LedgerEntry] {
  const sessionId = `s${++n}`
  return [`focus:${sessionId}`, { kind: 'focus', amount: Math.round(minutes), at, day: dayKey(at), sessionId, minutes, ...extra }]
}
function goalEntry(at: number): [string, LedgerEntry] {
  return [`goal:${dayKey(at)}`, { kind: 'dailyGoal', amount: 50, at, day: dayKey(at), sessionId: `g${++n}` }]
}
const ledgerOf = (...entries: [string, LedgerEntry][]): StatsLedger => Object.fromEntries(entries)

describe('timezone setup', () => {
  it('runs in Europe/Budapest with DST', () => {
    expect(new Date(2026, 9, 24, 12).getTimezoneOffset()).toBe(-120)
    expect(new Date(2026, 9, 26, 12).getTimezoneOffset()).toBe(-60)
  })
})

describe('addDays', () => {
  it('steps by calendar day across months, years and leap days', () => {
    expect(addDays('2026-11-02', 1)).toBe('2026-11-03')
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-11-02', -7)).toBe('2026-10-26')
    expect(addDays('2026-11-02', 0)).toBe('2026-11-02')
  })

  it('never skips or repeats a day across a daylight saving change', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    // The bug this avoids: local midnight + 24 h lands on the same day when the clocks go back.
    expect(dayKey(local(2026, 10, 25, 0) + 24 * HOUR)).toBe('2026-10-25')
  })

  it('rejects invalid keys', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError)
    expect(() => addDays('not a day', 1)).toThrow(RangeError)
  })
})

describe('computeStats', () => {
  const NOW = local(2026, 11, 2, 18)

  it('handles empty data', () => {
    const stats = computeStats({}, NOW)
    expect(stats.today).toEqual({ day: '2026-11-02', minutes: 0, sessions: 0, goalReached: false })
    expect(stats.window).toHaveLength(7)
    expect(stats.window.every((d) => d.minutes === 0 && d.sessions === 0 && !d.goalReached)).toBe(true)
    expect(stats.allTime).toEqual({ minutes: 0, sessions: 0, activeDays: 0 })
    expect(stats.streak).toEqual({ current: 0, best: 0, activeToday: false })
    expect(stats.goalDays).toEqual([])
  })

  it('counts a single completed session', () => {
    const stats = computeStats(ledgerOf(focusEntry(local(2026, 11, 2, 10))), NOW)
    expect(stats.today).toMatchObject({ minutes: 25, sessions: 1 })
    expect(stats.window[6]).toMatchObject({ day: '2026-11-02', minutes: 25, sessions: 1 })
    expect(stats.allTime).toEqual({ minutes: 25, sessions: 1, activeDays: 1 })
    expect(stats.streak).toEqual({ current: 1, best: 1, activeToday: true })
  })

  it('adds up several sessions on one day, of different lengths', () => {
    const ledger = ledgerOf(
      focusEntry(local(2026, 11, 2, 9), 25),
      focusEntry(local(2026, 11, 2, 10), 50),
      focusEntry(local(2026, 11, 2, 14), 15),
    )
    const stats = computeStats(ledger, NOW)
    expect(stats.today).toMatchObject({ minutes: 90, sessions: 3 })
    expect(stats.allTime).toEqual({ minutes: 90, sessions: 3, activeDays: 1 })
    expect(stats.streak.current).toBe(1)
  })

  it('ignores breaks, cycle bonuses and spending', () => {
    const ledger = ledgerOf(focusEntry(local(2026, 11, 2, 9)), [
      'cycle:x',
      { kind: 'cycle', amount: 30, at: local(2026, 11, 2, 9), day: '2026-11-02', sessionId: 'x' },
    ])
    expect(computeStats(ledger, NOW).allTime).toEqual({ minutes: 25, sessions: 1, activeDays: 1 })
  })

  it('builds the rolling 7-day window oldest first, ending today', () => {
    const ledger = ledgerOf(
      focusEntry(local(2026, 10, 26, 9), 25), // 7 days ago, outside the window
      focusEntry(local(2026, 10, 27, 9), 30), // first day of the window
      focusEntry(local(2026, 10, 30, 9), 45),
      focusEntry(local(2026, 11, 2, 9), 25),
    )
    const stats = computeStats(ledger, NOW)
    expect(stats.window.map((d) => d.day)).toEqual([
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
    expect(stats.window.map((d) => d.minutes)).toEqual([30, 0, 0, 45, 0, 0, 25])
    expect(stats.allTime.minutes).toBe(125)
  })

  it('supports another window length', () => {
    expect(computeStats({}, NOW, { windowDays: 30 }).window).toHaveLength(30)
    expect(computeStats({}, NOW, { windowDays: 0 }).window).toHaveLength(1)
  })

  it('marks the days the daily goal was reached', () => {
    const ledger = ledgerOf(
      focusEntry(local(2026, 11, 1, 9), 100),
      goalEntry(local(2026, 11, 1, 9)),
      focusEntry(local(2026, 11, 2, 9), 25),
    )
    const stats = computeStats(ledger, NOW)
    expect(stats.goalDays).toEqual(['2026-11-01'])
    expect(stats.window[5]).toMatchObject({ day: '2026-11-01', goalReached: true })
    expect(stats.today.goalReached).toBe(false)
  })

  it('handles gaps between active days', () => {
    const ledger = ledgerOf(
      focusEntry(local(2026, 10, 20, 9)),
      focusEntry(local(2026, 10, 21, 9)),
      focusEntry(local(2026, 10, 22, 9)),
      // gap: 23rd–29th
      focusEntry(local(2026, 10, 30, 9)),
      // gap: 31st
      focusEntry(local(2026, 11, 1, 9)),
      focusEntry(local(2026, 11, 2, 9)),
    )
    const stats = computeStats(ledger, NOW)
    expect(stats.streak).toEqual({ current: 2, best: 3, activeToday: true })
    expect(stats.allTime.activeDays).toBe(6)
  })

  it('keeps the current streak alive when today has no session yet', () => {
    const ledger = ledgerOf(
      focusEntry(local(2026, 10, 30, 9)),
      focusEntry(local(2026, 10, 31, 9)),
      focusEntry(local(2026, 11, 1, 23, 50)),
    )
    expect(computeStats(ledger, local(2026, 11, 2, 0, 5)).streak).toEqual({ current: 3, best: 3, activeToday: false })
    expect(computeStats(ledger, NOW).today.sessions).toBe(0)
  })

  it('breaks the current streak after a whole day without focus, but keeps the best', () => {
    const ledger = ledgerOf(focusEntry(local(2026, 10, 30, 9)), focusEntry(local(2026, 10, 31, 9)))
    expect(computeStats(ledger, NOW).streak).toEqual({ current: 0, best: 2, activeToday: false })
  })

  it('counts a streak across both daylight saving changes', () => {
    const autumn = ledgerOf(
      focusEntry(local(2026, 10, 24, 23, 30)),
      focusEntry(local(2026, 10, 25, 0, 30)), // the 25-hour day
      focusEntry(local(2026, 10, 25, 23, 30)),
      focusEntry(local(2026, 10, 26, 0, 10)),
    )
    const a = computeStats(autumn, local(2026, 10, 26, 12))
    expect(a.streak).toEqual({ current: 3, best: 3, activeToday: true })
    expect(a.window.slice(-3)).toMatchObject([
      { day: '2026-10-24', sessions: 1 },
      { day: '2026-10-25', sessions: 2 },
      { day: '2026-10-26', sessions: 1 },
    ])

    const spring = ledgerOf(
      focusEntry(local(2026, 3, 28, 23, 30)),
      focusEntry(local(2026, 3, 29, 12)), // the 23-hour day
      focusEntry(local(2026, 3, 30, 0, 30)),
    )
    const s = computeStats(spring, local(2026, 3, 31, 9))
    expect(s.streak).toEqual({ current: 3, best: 3, activeToday: false })
    expect(s.window.map((d) => d.day)).toEqual([
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
    ])
  })

  it('groups by local day, so sessions either side of midnight land on different days', () => {
    const ledger = ledgerOf(focusEntry(local(2026, 11, 1, 23, 59)), focusEntry(local(2026, 11, 2, 0, 1)))
    const stats = computeStats(ledger, NOW)
    expect(stats.window.slice(-2)).toMatchObject([
      { day: '2026-11-01', sessions: 1 },
      { day: '2026-11-02', sessions: 1 },
    ])
  })

  it('uses the day recorded at completion, even if the timezone has changed since', () => {
    // Completed at 00:30 local on Nov 2 and recorded then; dayKey(at) in another zone could differ.
    const [key, entry] = focusEntry(local(2026, 11, 2, 0, 30))
    const ledger = ledgerOf([key, { ...entry, day: '2026-11-01' }])
    expect(computeStats(ledger, NOW).window[5]).toMatchObject({ day: '2026-11-01', sessions: 1 })
  })
})

describe('legacy and invalid entries', () => {
  const NOW = local(2026, 11, 2, 18)

  it('estimates minutes from coins for focus entries without minutes', () => {
    const [key, entry] = focusEntry(local(2026, 11, 2, 9), 25)
    const legacy: Partial<LedgerEntry> = { ...entry }
    delete legacy.minutes
    const ledger = { [key]: legacy } as StatsLedger
    expect(computeStats(ledger, NOW, { coinsPerFocusMinute: 1 }).today).toMatchObject({ minutes: 25, sessions: 1 })
    expect(computeStats(ledger, NOW, { coinsPerFocusMinute: 2 }).today.minutes).toBe(12.5)
    // Without a rate, the session still counts, with 0 minutes.
    expect(computeStats(ledger, NOW).today).toMatchObject({ minutes: 0, sessions: 1 })
    expect(computeStats(ledger, NOW).streak.current).toBe(1)
  })

  it('treats negative or non-numeric minutes as missing', () => {
    const ledger = ledgerOf(
      focusEntry(local(2026, 11, 2, 9), 25, { minutes: -5 }),
      focusEntry(local(2026, 11, 2, 10), 25, { minutes: Number.NaN }),
    )
    expect(computeStats(ledger, NOW, { coinsPerFocusMinute: 1 }).today).toMatchObject({ minutes: 50, sessions: 2 })
  })

  it('falls back to the local day of the completion time when the day is missing or invalid', () => {
    // 23:30 UTC on Oct 31 is 00:30 on Nov 1 in Budapest (UTC+1 after the clocks went back).
    const at = Date.UTC(2026, 9, 31, 23, 30)
    const ledger = {
      'focus:a': { kind: 'focus', amount: 25, at, sessionId: 'a', minutes: 25 },
      'focus:b': { kind: 'focus', amount: 25, at, day: '2026-02-30', sessionId: 'b', minutes: 25 },
      'focus:c': { kind: 'focus', amount: 25, at, day: 20261101, sessionId: 'c', minutes: 25 },
    } as unknown as StatsLedger
    const sessions = focusSessions(ledger)
    expect(sessions.map((s) => s.day)).toEqual(['2026-11-01', '2026-11-01', '2026-11-01'])
  })

  it('skips entries with neither a valid day nor a completion time, and malformed values', () => {
    const ledger = {
      'focus:a': { kind: 'focus', amount: 25, sessionId: 'a', minutes: 25 },
      'focus:b': null,
      'focus:c': 'junk',
      'focus:d': { kind: 'focus', amount: 25, day: '2026-11-02', minutes: 25 },
    } as unknown as StatsLedger
    const sessions = focusSessions(ledger)
    expect(sessions).toEqual([{ sessionId: 'd', day: '2026-11-02', minutes: 25 }])
  })

  it('reads goal days from the entry, its key, or its time', () => {
    const ledger = {
      'goal:2026-10-30': { kind: 'dailyGoal', amount: 50, at: 0, day: '2026-10-30', sessionId: 'x' },
      'goal:2026-10-31': { kind: 'dailyGoal', amount: 50, sessionId: 'y' },
      'goal:legacy': { kind: 'dailyGoal', amount: 50, at: local(2026, 11, 1, 9), sessionId: 'z' },
      'goal:broken': { kind: 'dailyGoal', amount: 50, sessionId: 'w' },
    } as unknown as StatsLedger
    expect(goalDays(ledger)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })

  it('works on a wallet restored from a legacy save', () => {
    const at = local(2026, 11, 2, 9)
    const wallet = restoreWallet({
      ledger: {
        'focus:old': { kind: 'focus', amount: 25, at, day: dayKey(at), sessionId: 'old' },
        'focus:bad': { kind: 'focus', amount: 'lots', at, day: dayKey(at), sessionId: 'bad' },
      },
      balance: 9999,
    })
    expect(computeStats(wallet.ledger, NOW, { coinsPerFocusMinute: 1 }).today).toMatchObject({ minutes: 25, sessions: 1 })
  })
})

describe('streaks', () => {
  it('finds the best run among several', () => {
    const days = ['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-10']
    expect(streaks(days, '2026-01-10')).toEqual({ current: 1, best: 4, activeToday: true })
  })

  it('counts runs across month and year ends', () => {
    expect(streaks(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01')).toEqual({ current: 3, best: 3, activeToday: true })
  })

  it('ignores invalid days and duplicates', () => {
    expect(streaks(['2026-01-01', '2026-01-01', 'nope', '2026-01-02'], '2026-01-02').best).toBe(2)
  })

  it('never extends the current streak with days after today', () => {
    expect(streaks(['2026-01-01', '2026-01-02', '2026-01-03'], '2026-01-02')).toEqual({ current: 2, best: 3, activeToday: true })
  })
})

describe('with real reward payouts', () => {
  const rules: RewardRules = { coinsPerFocusMinute: 1, cycleBonus: 30, cycleBonusFullMinutes: 100, dailyGoalBonus: 50, dailyGoalMinutes: 100 }
  const complete = (id: string, completedAt: number, minutes: number): SessionCompleted => ({
    type: 'sessionCompleted',
    sessionId: id,
    mode: 'focus',
    durationMs: minutes * MIN,
    startedAt: completedAt - minutes * MIN,
    completedAt,
    endsCycle: false,
    cycleFocusMs: minutes * MIN,
  })

  it('agrees with the wallet on minutes and goal days', () => {
    let wallet = createWallet()
    for (const [i, h] of [9, 10, 11, 12].entries()) {
      wallet = rewardSession(wallet, complete(`a${i}`, local(2026, 11, 1, h), 25), rules).wallet
    }
    wallet = rewardSession(wallet, complete('b', local(2026, 11, 2, 9), 50), rules).wallet

    const stats = computeStats(wallet.ledger, local(2026, 11, 2, 18), { coinsPerFocusMinute: 1 })
    expect(stats.goalDays).toEqual(['2026-11-01'])
    expect(stats.window.slice(-2)).toEqual([
      { day: '2026-11-01', minutes: 100, sessions: 4, goalReached: true },
      { day: '2026-11-02', minutes: 50, sessions: 1, goalReached: false },
    ])
    expect(stats.allTime).toEqual({ minutes: 150, sessions: 5, activeDays: 2 })
    expect(stats.streak).toEqual({ current: 2, best: 2, activeToday: true })
  })
})
