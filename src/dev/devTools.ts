/**
 * Dev Tools (local development only): seed and reset the wallet and the wardrobe while testing
 * the Shop, the Wardrobe and accessories by hand. Mounted from `main.tsx` behind
 * `import.meta.env.DEV`, so none of this is in a production build (the build check enforces it).
 *
 * Everything goes through the real stores and the app's own persistence (`koa:v1` via
 * `saveSlice`), never a second state: the app shows each change at once, and a reload keeps it.
 * Purchases use the normal `walletStore.purchase()`; nothing here bypasses ownership rules.
 */
import { restoreWallet, createWallet, type LedgerEntry, type Wallet } from '../core/rewards/wallet'
import { SLOTS, closetBySlot, isOwned, type ShopItem } from '../core/shop/shop'
import { dayKey } from '../core/time'
import type { WalletStore } from '../features/rewards/walletStore'
import type { WardrobeStore } from '../features/shop/wardrobeStore'
import type { StorageAdapter } from '../storage/adapter'
import { loadState, saveSlice } from '../storage/persistence'

/** What "Give coins" adds. */
export const DEV_COINS = 10_000

/** The DOM marker of the panel. `scripts/check-build.mjs` fails a build that contains it. */
export const DEV_TOOLS_MARKER = 'koa-dev-tools'

/**
 * Ledger keys of dev grants. They use the `cycle` kind, which only ever adds coins: Stats and the
 * daily goal read `focus` and `dailyGoal` entries, so a grant never shows up as study time. The
 * saved wallet's format is unchanged (`restoreWallet` accepts them like any reward).
 */
export const DEV_GRANT_PREFIX = 'dev:coins:'

export interface DevToolsDeps {
  storage: StorageAdapter
  catalog: readonly ShopItem[]
  wallet: Pick<WalletStore, 'getState' | 'purchase' | 'refresh'>
  wardrobe: Pick<WardrobeStore, 'getState' | 'equip' | 'unequip' | 'refresh'>
  now?: () => number
}

export type DevTools = ReturnType<typeof createDevTools>

export function createDevTools({ storage, catalog, wallet, wardrobe, now = Date.now }: DevToolsDeps) {
  const saveWallet = (next: Wallet) => {
    saveSlice(storage, 'wallet', next)
    wallet.refresh()
  }

  /** Adds coins as a dev grant to the latest saved wallet (like the store's own writes). */
  const grant = (amount: number) => {
    if (amount <= 0) return
    const latest = restoreWallet(loadState(storage).wallet)
    let at = now()
    while (`${DEV_GRANT_PREFIX}${at}` in latest.ledger) at++
    const entry: LedgerEntry = { kind: 'cycle', amount, at, day: dayKey(at), sessionId: `dev-${at}` }
    // restoreWallet recomputes the totals from the entries, as on every load.
    saveWallet(restoreWallet({ ...latest, ledger: { ...latest.ledger, [`${DEV_GRANT_PREFIX}${at}`]: entry } }))
  }

  const takeEverythingOff = () => {
    for (const slot of SLOTS) wardrobe.unequip(slot)
  }

  return {
    /** Adds DEV_COINS coins. */
    giveCoins() {
      grant(DEV_COINS)
    },

    /**
     * Owns every catalog item: grants exactly what the missing items cost, then buys each one
     * with the normal purchase, so the balance ends where it started. Nothing is put on.
     */
    unlockAll() {
      wallet.refresh()
      const missing = catalog.filter((item) => !isOwned(wallet.getState(), item.id))
      grant(missing.reduce((total, item) => total + item.price, 0))
      for (const item of missing) wallet.purchase(item)
    },

    /** An empty wallet: no coins, no purchases, and so nothing worn (Stats starts over too). */
    resetWallet() {
      saveWallet(createWallet())
      takeEverythingOff()
    },

    /** Koa wears nothing. Ownership is kept (it lives in the wallet). */
    resetWardrobe() {
      takeEverythingOff()
    },

    /** Puts on one owned item per slot: the first in catalog order. */
    equipAll() {
      for (const { items } of closetBySlot(catalog, wallet.getState())) wardrobe.equip(items[0])
    },
  }
}
