/**
 * Coins: pure, idempotent reward rules.
 *
 * Every payout is recorded in a ledger under a unique key, and a key is paid at most once:
 *   focus:<sessionId>   a completed focus session (coins per focus minute)
 *   cycle:<sessionId>   the focus session that completed a cycle (bonus)
 *   goal:<YYYY-MM-DD>   reaching the daily focus goal (bonus, once per local day)
 * Only completed focus sessions earn anything. Breaks and skipped sessions never do.
 *
 * Spending (Phase 6) lives in a separate `spending` record and never touches the earned ledger:
 *   item:<itemId>       buying a shop item (once per item)
 * Totals are always derived: balance = totalEarned - totalSpent. Stored totals are never trusted.
 */
import type { SessionCompleted } from '../timer/engine'
import { dayKey } from '../time'

export interface RewardRules {
  /** 25 min → 25 coins, 50 min → 50 coins. */
  coinsPerFocusMinute: number
  /** Paid when a focus session completes the cycle (default: every 4th session). */
  cycleBonus: number
  /** Paid once per day when the day's focus minutes reach the goal. */
  dailyGoalBonus: number
  dailyGoalMinutes: number
}

export type RewardKind = 'focus' | 'cycle' | 'dailyGoal'

export interface LedgerEntry {
  kind: RewardKind
  amount: number
  /** When the reward was earned (the session's completion time). */
  at: number
  day: string
  sessionId: string
  /** Focus entries: minutes of focus that earned it. */
  minutes?: number
}

export interface SpendEntry {
  kind: 'purchase'
  itemId: string
  amount: number
  at: number
}

export interface Wallet {
  /** Earned coins. Append-only: spending never modifies or removes these entries. */
  ledger: Record<string, LedgerEntry>
  /** Spent coins. */
  spending: Record<string, SpendEntry>
  /** Derived from `ledger`. */
  totalEarned: number
  /** Derived from `spending`. */
  totalSpent: number
  /** Derived: totalEarned - totalSpent, never below 0. */
  balance: number
}

export interface Grant {
  key: string
  kind: RewardKind
  amount: number
}

export interface RewardResult {
  wallet: Wallet
  grants: Grant[]
}

const sum = (entries: Record<string, { amount: number }>) =>
  Object.values(entries).reduce((total, e) => total + e.amount, 0)

/** Build a wallet with totals computed from its entries (the only way totals are set). */
function withTotals(ledger: Record<string, LedgerEntry>, spending: Record<string, SpendEntry>): Wallet {
  const totalEarned = sum(ledger)
  const totalSpent = sum(spending)
  return { ledger, spending, totalEarned, totalSpent, balance: Math.max(0, totalEarned - totalSpent) }
}

export function createWallet(): Wallet {
  return withTotals({}, {})
}

/** Focus minutes already rewarded on `day`. */
export function focusMinutesOn(wallet: Wallet, day: string): number {
  let total = 0
  for (const entry of Object.values(wallet.ledger)) {
    if (entry.kind === 'focus' && entry.day === day) total += entry.minutes ?? 0
  }
  return total
}

export function hasDailyGoal(wallet: Wallet, day: string): boolean {
  return `goal:${day}` in wallet.ledger
}

function credit(wallet: Wallet, key: string, entry: LedgerEntry): Wallet {
  return withTotals({ ...wallet.ledger, [key]: entry }, wallet.spending)
}

export type SpendFailure = 'alreadySpent' | 'insufficientFunds' | 'invalidAmount'

export type SpendResult = { ok: true; wallet: Wallet } | { ok: false; reason: SpendFailure; wallet: Wallet }

/**
 * Spend coins under a unique key (e.g. `item:beanie`). Fails without changing anything if the
 * key was already spent, the amount is invalid, or the balance is too low.
 */
export function spend(wallet: Wallet, key: string, entry: SpendEntry): SpendResult {
  if (key in wallet.spending) return { ok: false, reason: 'alreadySpent', wallet }
  if (!Number.isFinite(entry.amount) || entry.amount < 0) return { ok: false, reason: 'invalidAmount', wallet }
  if (entry.amount > wallet.balance) return { ok: false, reason: 'insufficientFunds', wallet }
  return { ok: true, wallet: withTotals(wallet.ledger, { ...wallet.spending, [key]: entry }) }
}

/** Apply the rewards for a completed session. Calling it again for the same session changes nothing. */
export function rewardSession(wallet: Wallet, event: SessionCompleted, rules: RewardRules): RewardResult {
  if (event.mode !== 'focus') return { wallet, grants: [] }

  const focusKey = `focus:${event.sessionId}`
  if (focusKey in wallet.ledger) return { wallet, grants: [] }

  const day = dayKey(event.completedAt)
  const minutes = event.durationMs / 60_000
  const grants: Grant[] = []
  let next = wallet

  const focusCoins = Math.max(0, Math.round(minutes * rules.coinsPerFocusMinute))
  next = credit(next, focusKey, {
    kind: 'focus',
    amount: focusCoins,
    at: event.completedAt,
    day,
    sessionId: event.sessionId,
    minutes,
  })
  grants.push({ key: focusKey, kind: 'focus', amount: focusCoins })

  const cycleKey = `cycle:${event.sessionId}`
  if (event.endsCycle && rules.cycleBonus > 0 && !(cycleKey in next.ledger)) {
    next = credit(next, cycleKey, {
      kind: 'cycle',
      amount: rules.cycleBonus,
      at: event.completedAt,
      day,
      sessionId: event.sessionId,
    })
    grants.push({ key: cycleKey, kind: 'cycle', amount: rules.cycleBonus })
  }

  const goalKey = `goal:${day}`
  if (
    rules.dailyGoalBonus > 0 &&
    !(goalKey in next.ledger) &&
    focusMinutesOn(next, day) >= rules.dailyGoalMinutes
  ) {
    next = credit(next, goalKey, {
      kind: 'dailyGoal',
      amount: rules.dailyGoalBonus,
      at: event.completedAt,
      day,
      sessionId: event.sessionId,
    })
    grants.push({ key: goalKey, kind: 'dailyGoal', amount: rules.dailyGoalBonus })
  }

  return { wallet: next, grants }
}

const KINDS: readonly RewardKind[] = ['focus', 'cycle', 'dailyGoal']
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Rebuild a wallet from persisted data. Entries are validated one by one; totals are always
 * recomputed from the entries (saved totals, including Phase 5's `balance`, are ignored).
 */
export function restoreWallet(raw: unknown): Wallet {
  if (typeof raw !== 'object' || raw === null) return createWallet()
  const { ledger, spending } = raw as Record<string, unknown>
  const earned: Record<string, LedgerEntry> = {}
  const spent: Record<string, SpendEntry> = {}

  if (typeof ledger === 'object' && ledger !== null) {
    for (const [key, value] of Object.entries(ledger as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue
      const e = value as Record<string, unknown>
      if (
        !KINDS.includes(e.kind as RewardKind) ||
        !isFiniteNumber(e.amount) ||
        e.amount < 0 ||
        !isFiniteNumber(e.at) ||
        typeof e.day !== 'string' ||
        typeof e.sessionId !== 'string'
      ) {
        continue
      }
      earned[key] = {
        kind: e.kind as RewardKind,
        amount: e.amount,
        at: e.at,
        day: e.day,
        sessionId: e.sessionId,
        ...(isFiniteNumber(e.minutes) ? { minutes: e.minutes } : {}),
      }
    }
  }

  if (typeof spending === 'object' && spending !== null) {
    for (const [key, value] of Object.entries(spending as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue
      const e = value as Record<string, unknown>
      if (
        e.kind !== 'purchase' ||
        typeof e.itemId !== 'string' ||
        key !== `item:${e.itemId}` ||
        !isFiniteNumber(e.amount) ||
        e.amount < 0 ||
        !isFiniteNumber(e.at)
      ) {
        continue
      }
      spent[key] = { kind: 'purchase', itemId: e.itemId, amount: e.amount, at: e.at }
    }
  }

  return withTotals(earned, spent)
}
