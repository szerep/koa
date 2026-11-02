import { describe, expect, it } from 'vitest'
import type { SessionCompleted } from '../timer/engine'
import { dayKey } from '../time'
import { createWallet, focusMinutesOn, restoreWallet, rewardSession, type RewardRules, type Wallet } from './wallet'

const MIN = 60_000
const rules: RewardRules = { coinsPerFocusMinute: 1, cycleBonus: 30, dailyGoalBonus: 50, dailyGoalMinutes: 100 }
// 09:00 local time, so a few sessions never cross midnight.
const MORNING = new Date(2026, 10, 2, 9, 0, 0).getTime()

let n = 0
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
    const generous: RewardRules = { coinsPerFocusMinute: 2, cycleBonus: 0, dailyGoalBonus: 0, dailyGoalMinutes: 1 }
    const r = rewardSession(createWallet(), focus(25, { endsCycle: true }), generous)
    expect(r.grants).toEqual([expect.objectContaining({ kind: 'focus', amount: 50 })])
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
