import { purchase, type PurchaseResult, type ShopItem } from '../../core/shop/shop'
import type { SessionCompleted } from '../../core/timer/engine'
import { restoreWallet, rewardSession, type Grant, type RewardRules, type Wallet } from '../../core/rewards/wallet'
import type { StorageAdapter } from '../../storage/adapter'
import { loadState, saveSlice } from '../../storage/persistence'

export interface WalletStoreOptions {
  rules: RewardRules
  /** The daily goal in effect (a setting). Read on every payout; defaults to `rules.dailyGoalMinutes`. */
  dailyGoalMinutes?: () => number
  storage: StorageAdapter
  now?: () => number
}

export type WalletStore = ReturnType<typeof createWalletStore>

/**
 * Holds the coin wallet. Rewards are applied to the *latest saved* wallet, so two open
 * tabs completing the same session still pay it only once (the ledger key already exists).
 */
const sameTotals = (a: Wallet, b: Wallet) =>
  a.totalEarned === b.totalEarned &&
  a.totalSpent === b.totalSpent &&
  Object.keys(a.ledger).length === Object.keys(b.ledger).length &&
  Object.keys(a.spending).length === Object.keys(b.spending).length

export function createWalletStore({ rules, dailyGoalMinutes, storage, now = Date.now }: WalletStoreOptions) {
  let wallet: Wallet = restoreWallet(loadState(storage).wallet)
  const listeners = new Set<() => void>()
  const grantListeners = new Set<(grants: Grant[]) => void>()

  const set = (next: Wallet) => {
    wallet = next
    listeners.forEach((l) => l())
  }

  return {
    getState: () => wallet,

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /** Fires once per payout with what was just earned (for the reward animation). */
    onGrant(listener: (grants: Grant[]) => void) {
      grantListeners.add(listener)
      return () => {
        grantListeners.delete(listener)
      }
    },

    /**
     * Pay for a completed session, with the daily goal in effect right now. Safe to call more
     * than once for the same session. Changing the goal never pays by itself: the goal is only
     * checked here, when a focus session completes.
     */
    award(event: SessionCompleted) {
      const latest = restoreWallet(loadState(storage).wallet)
      const current = dailyGoalMinutes ? { ...rules, dailyGoalMinutes: dailyGoalMinutes() } : rules
      const { wallet: next, grants } = rewardSession(latest, event, current)
      if (grants.length === 0) {
        if (!sameTotals(latest, wallet)) set(latest)
        return
      }
      saveSlice(storage, 'wallet', next)
      set(next)
      grantListeners.forEach((l) => l(grants))
    },

    /**
     * Buy a shop item. Checked against the latest saved wallet, so two tabs can't buy the
     * same item twice or overspend the same coins.
     */
    purchase(item: ShopItem): PurchaseResult {
      const latest = restoreWallet(loadState(storage).wallet)
      const result = purchase(latest, item, now())
      if (result.ok) {
        saveSlice(storage, 'wallet', result.wallet)
        set(result.wallet)
      } else if (!sameTotals(latest, wallet)) {
        set(latest)
      }
      return result
    },

    /** Re-read the saved wallet (another tab changed it). */
    refresh() {
      const latest = restoreWallet(loadState(storage).wallet)
      if (!sameTotals(latest, wallet)) set(latest)
    },
  }
}
