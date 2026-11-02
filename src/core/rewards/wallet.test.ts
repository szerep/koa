import { describe, expect, it } from 'vitest'
import type { SessionCompleted } from '../timer/engine'
import { dayKey } from '../time'
import {
  createWallet,
  cycleBonusFor,
  focusMinutesOn,
  hasDailyGoal,
  restoreWallet,
  rewardSession,
  type RewardRules,
  type Wallet,
} from './wallet'

const MIN = 60_000
const rules: RewardRules = { coinsPerFocusMinute: 1, cycleBonus: 30, cycleBonusFullMinutes: 100, dailyGoalBonus: 50, dailyGoalMinutes: 100 }
// 09:00 local time, so a few sessions never cross midnight.
const MORNING = new Date(2026, 10, 2, 9, 0, 0).getTime()
const DAY = dayKey(MORNING)

let n = 0
/** A completed focus session. Its cycle defaults to four sessions of this length (4 × 25 = 100 min). */
function focus(minutes: number, opts: Partial<SessionCompleted> = {}): SessionCompleted {
  const completedAt = opts.completedAt ?? MORNING + ++n * MIN
  return {
    type: 'sessionCompleted',
    sessionId: opts.sessionId ?? `s${n}-${Math.random()}`,
    mode: 'focus',
    durationMs: minutes * MIN,
    startedAt: completedAt - minutes * MIN,
    completedAt,
    endsCycle: false,
    cycleFocusMs: 4 * minutes * MIN,
    ...opts,
  }
}

function earn(wallet: Wallet, event: SessionCompleted) {
  return rewardSession(wallet, event, rules)
}

describe('rewardSession', () => {
  it('pays 1 coin per focus minute: 25 min = 25 coins, 50 min = 50 coins', () => {
    expect(earn(createWallet(), focus(25)).wallet.balance).toBe(25)
    expect(earn(createWallet(), focus(50)).wallet.balance).toBe(50)
  })

  it('pays nothing for breaks', () => {
    const shortBreak = { ...focus(5), mode: 'shortBreak' as const }
    const longBreak = { ...focus(20), mode: 'longBreak' as const }
    expect(earn(createWallet(), shortBreak).grants).toEqual([])
    expect(earn(createWallet(), longBreak).wallet).toEqual(createWallet())
  })

  it('never pays the same session twice', () => {
    const event = focus(25, { sessionId: 'same' })
    const once = earn(createWallet(), event)
    const twice = earn(once.wallet, event)
    expect(twice.grants).toEqual([])
    expect(twice.wallet).toBe(once.wallet)
    expect(twice.wallet.balance).toBe(25)
  })

  it('adds the cycle bonus when a session completes the cycle', () => {
    const r = earn(createWallet(), focus(25, { sessionId: 'fourth', endsCycle: true }))
    expect(r.grants).toEqual([
      { key: 'focus:fourth', kind: 'focus', amount: 25 },
      { key: 'cycle:fourth', kind: 'cycle', amount: 30 },
    ])
    expect(r.wallet.balance).toBe(55)
  })

  it('a full cycle of four 25-minute sessions earns 100 + 30 + daily goal 50 = 180', () => {
    let w = createWallet()
    const kinds: string[] = []
    for (let i = 1; i <= 4; i++) {
      const r = earn(w, focus(25, { endsCycle: i === 4 }))
      kinds.push(...r.grants.map((g) => g.kind))
      w = r.wallet
    }
    expect(kinds).toEqual(['focus', 'focus', 'focus', 'focus', 'cycle', 'dailyGoal'])
    expect(w.balance).toBe(180)
    expect(w.totalEarned).toBe(180)
  })

  it('pays the daily goal once per day, even with more sessions', () => {
    let w = createWallet()
    for (let i = 0; i < 6; i++) w = earn(w, focus(25)).wallet
    const goalEntries = Object.values(w.ledger).filter((e) => e.kind === 'dailyGoal')
    expect(goalEntries).toHaveLength(1)
    expect(w.balance).toBe(6 * 25 + 50)
  })

  it('pays the daily goal again on a new day', () => {
    let w = createWallet()
    for (let i = 0; i < 4; i++) w = earn(w, focus(25)).wallet
    const tomorrow = MORNING + 24 * 60 * MIN
    for (let i = 0; i < 4; i++) w = earn(w, focus(25, { completedAt: tomorrow + i * 30 * MIN })).wallet
    expect(Object.keys(w.ledger).filter((k) => k.startsWith('goal:'))).toEqual([
      `goal:${dayKey(MORNING)}`,
      `goal:${dayKey(tomorrow)}`,
    ])
  })

  it('counts a session toward the day it was completed in (local time)', () => {
    const lateNight = new Date(2026, 10, 2, 23, 50).getTime()
    const r = earn(createWallet(), focus(25, { completedAt: lateNight + 15 * MIN })) // ends 00:05
    expect(focusMinutesOn(r.wallet, dayKey(lateNight))).toBe(0)
    expect(focusMinutesOn(r.wallet, dayKey(lateNight + 15 * MIN))).toBe(25)
  })

  it('reaches the goal with longer custom sessions too (two 50-minute sessions)', () => {
    let w = earn(createWallet(), focus(50)).wallet
    const r = earn(w, focus(50))
    expect(r.grants.map((g) => g.kind)).toEqual(['focus', 'dailyGoal'])
    w = r.wallet
    expect(w.balance).toBe(150)
  })

  it('reward values are configurable', () => {
    const generous: RewardRules = { coinsPerFocusMinute: 2, cycleBonus: 0, cycleBonusFullMinutes: 100, dailyGoalBonus: 0, dailyGoalMinutes: 1 }
    const r = rewardSession(createWallet(), focus(25, { endsCycle: true }), generous)
    expect(r.grants).toEqual([expect.objectContaining({ kind: 'focus', amount: 50 })])
  })
})

describe('cycleBonusFor (approved Phase 8 rule)', () => {
  const at = (minutes: number) => cycleBonusFor(minutes * MIN, rules)

  it('a default cycle (4 × 25 = 100 min) earns exactly 30', () => {
    expect(at(100)).toBe(30)
  })

  it('scales with the focus minutes in the cycle and rounds to whole coins', () => {
    expect(at(50)).toBe(15) // 2 × 25, or 4 × 12.5
    expect(at(60)).toBe(18) // 4 × 15
    expect(at(83)).toBe(25) // 24.9
    expect(at(5)).toBe(2) // 1.5 rounds up
    expect(at(4)).toBe(1) // 4 × 1 min: 1.2
    expect(at(2)).toBe(1) // 2 × 1 min: 0.6
    expect(at(1)).toBe(0) // 0.3
  })

  it('is capped at 30 for longer cycles', () => {
    expect(at(101)).toBe(30)
    expect(at(180)).toBe(30) // 4 × 45
    expect(at(8 * 120)).toBe(30) // the longest possible cycle
  })

  it.each([0, -25, NaN, Infinity])('pays nothing for %j minutes', (minutes) => {
    expect(cycleBonusFor(minutes * MIN, rules)).toBe(0)
  })

  it('pays nothing when the bonus is switched off or misconfigured', () => {
    expect(cycleBonusFor(100 * MIN, { ...rules, cycleBonus: 0 })).toBe(0)
    expect(cycleBonusFor(100 * MIN, { ...rules, cycleBonusFullMinutes: 0 })).toBe(0)
  })
})

describe('rewardSession: proportional cycle bonus', () => {
  it('four 1-minute sessions earn 4 coins plus a 1-coin cycle bonus, not 30', () => {
    const r = earn(createWallet(), focus(1, { endsCycle: true, cycleFocusMs: 4 * MIN }))
    expect(r.grants).toEqual([
      expect.objectContaining({ kind: 'focus', amount: 1 }),
      expect.objectContaining({ kind: 'cycle', amount: 1 }),
    ])
  })

  it('a cycle bonus that rounds to 0 is not recorded at all', () => {
    const r = earn(createWallet(), focus(1, { sessionId: 'tiny', endsCycle: true, cycleFocusMs: MIN }))
    expect(r.grants.map((g) => g.kind)).toEqual(['focus'])
    expect('cycle:tiny' in r.wallet.ledger).toBe(false)
  })

  it('two 50-minute sessions (interval 2) earn the full 30', () => {
    const r = earn(createWallet(), focus(50, { endsCycle: true, cycleFocusMs: 100 * MIN }))
    expect(r.grants).toContainEqual(expect.objectContaining({ kind: 'cycle', amount: 30 }))
  })

  it('a long cycle is capped at 30', () => {
    const r = earn(createWallet(), focus(45, { endsCycle: true, cycleFocusMs: 180 * MIN }))
    expect(r.grants).toContainEqual(expect.objectContaining({ kind: 'cycle', amount: 30 }))
  })

  it('cycleFocusMs is ignored unless the session ends the cycle', () => {
    const r = earn(createWallet(), focus(25, { endsCycle: false, cycleFocusMs: 100 * MIN }))
    expect(r.grants.map((g) => g.kind)).toEqual(['focus'])
  })

  it('a scaled bonus is still paid only once', () => {
    const event = focus(15, { sessionId: 'fourth', endsCycle: true, cycleFocusMs: 60 * MIN })
    const first = earn(createWallet(), event)
    expect(first.wallet.ledger['cycle:fourth']).toMatchObject({ kind: 'cycle', amount: 18 })
    const again = earn(first.wallet, event)
    expect(again.grants).toEqual([])
    expect(again.wallet).toBe(first.wallet)
  })
})

describe('rewardSession: coins follow the actual focus duration', () => {
  it.each([1, 7, 37, 120])('%i minutes earn %i coins', (minutes) => {
    const r = earn(createWallet(), focus(minutes))
    expect(r.grants[0]).toMatchObject({ kind: 'focus', amount: minutes })
    expect(r.wallet.ledger[r.grants[0].key]).toMatchObject({ minutes })
  })
})

describe('rewardSession: adjustable daily goal', () => {
  const withGoal = (dailyGoalMinutes: number): RewardRules => ({ ...rules, dailyGoalMinutes })
  const pay = (w: Wallet, event: SessionCompleted, goal: number) => rewardSession(w, event, withGoal(goal))
  const kinds = (r: { grants: { kind: string }[] }) => r.grants.map((g) => g.kind)

  it('a higher goal is paid when it is reached, not before', () => {
    let w = createWallet()
    for (let i = 0; i < 5; i++) {
      const r = pay(w, focus(25), 150)
      expect(kinds(r)).toEqual(['focus'])
      w = r.wallet
    }
    expect(kinds(pay(w, focus(25), 150))).toEqual(['focus', 'dailyGoal']) // 150 min
  })

  it('the 480-minute goal is paid at 480 minutes', () => {
    let w = createWallet()
    for (let i = 0; i < 3; i++) w = pay(w, focus(120), 480).wallet
    expect(hasDailyGoal(w, DAY)).toBe(false)
    expect(kinds(pay(w, focus(120), 480))).toContain('dailyGoal')
  })

  it('lowering the goal below today\'s minutes pays on the next completed focus session', () => {
    // 75 minutes done with the 100-minute goal: no bonus yet.
    let w = createWallet()
    for (let i = 0; i < 3; i++) w = pay(w, focus(25), 100).wallet
    expect(hasDailyGoal(w, DAY)).toBe(false)
    // The goal is lowered to 50 in Settings. Nothing is paid until a focus session completes,
    // and a break doesn't count.
    const breakDone = pay(w, { ...focus(5), mode: 'shortBreak' }, 50)
    expect(breakDone.grants).toEqual([])
    const next = pay(w, focus(25), 50)
    expect(kinds(next)).toEqual(['focus', 'dailyGoal'])
    expect(next.wallet.ledger[`goal:${DAY}`]).toMatchObject({ amount: 50 })
  })

  it('a bonus already paid today is never paid again, whatever the goal does', () => {
    let w = createWallet()
    for (let i = 0; i < 4; i++) w = pay(w, focus(25), 100).wallet // goal paid at 100
    expect(w.totalEarned).toBe(150)
    for (const goal of [25, 125, 480, 50]) {
      const r = pay(w, focus(25), goal)
      expect(kinds(r)).toEqual(['focus'])
      w = r.wallet
    }
    expect(Object.keys(w.ledger).filter((k) => k.startsWith('goal:'))).toEqual([`goal:${DAY}`])
  })

  it('raising the goal after the bonus was paid never takes it back', () => {
    let w = createWallet()
    for (let i = 0; i < 4; i++) w = pay(w, focus(25), 100).wallet
    const r = pay(w, focus(25), 480)
    expect(r.wallet.ledger[`goal:${DAY}`]).toEqual(w.ledger[`goal:${DAY}`])
    expect(r.wallet.totalEarned).toBe(w.totalEarned + 25)
  })

  it('the goal in effect on the next day applies to that day', () => {
    const tomorrow = new Date(2026, 10, 3, 9).getTime()
    let w = createWallet()
    for (let i = 0; i < 4; i++) w = pay(w, focus(25), 100).wallet
    const r = pay(w, focus(25, { completedAt: tomorrow }), 25)
    expect(kinds(r)).toEqual(['focus', 'dailyGoal'])
    expect(r.wallet.ledger[`goal:${dayKey(tomorrow)}`]).toBeDefined()
  })
})

describe('restoreWallet', () => {
  it.each([undefined, null, 'coins', 7])('falls back to an empty wallet for %j', (raw) => {
    expect(restoreWallet(raw)).toEqual(createWallet())
  })

  it('round-trips through JSON', () => {
    let w = createWallet()
    for (let i = 0; i < 4; i++) w = earn(w, focus(25, { endsCycle: i === 3 })).wallet
    expect(restoreWallet(JSON.parse(JSON.stringify(w)))).toEqual(w)
  })

  it('drops malformed ledger entries and never trusts a balance above what was earned', () => {
    const w = earn(createWallet(), focus(25, { sessionId: 'ok' })).wallet
    const tampered = {
      balance: 99999,
      ledger: {
        ...w.ledger,
        'focus:bad': { kind: 'focus', amount: -10, at: 1, day: 'x', sessionId: 'bad' },
        'focus:junk': 'nope',
      },
    }
    const restored = restoreWallet(tampered)
    expect(Object.keys(restored.ledger)).toEqual(['focus:ok'])
    expect(restored.balance).toBe(25)
    expect(restored.totalEarned).toBe(25)
  })
})
