import { describe, expect, it } from 'vitest'
import { catalog } from '../config/catalog'
import type { RewardRules } from '../core/rewards/wallet'
import { SLOTS, isOwned, wornItemIds, type ShopItem } from '../core/shop/shop'
import { focusSessions, goalDays } from '../core/stats/stats'
import type { SessionCompleted } from '../core/timer/engine'
import { createWalletStore } from '../features/rewards/walletStore'
import { createWardrobeStore } from '../features/shop/wardrobeStore'
import { createMemoryAdapter } from '../storage/adapter'
import { DEV_COINS, DEV_GRANT_PREFIX, createDevTools } from './devTools'

const MIN = 60_000
const rules: RewardRules = { coinsPerFocusMinute: 1, cycleBonus: 30, cycleBonusFullMinutes: 100, dailyGoalBonus: 50, dailyGoalMinutes: 100 }
const T = new Date(2026, 10, 18, 9).getTime()
const total = catalog.reduce((sum, item) => sum + item.price, 0)
const byId = (id: string) => catalog.find((item) => item.id === id) as ShopItem

const session = (n: number): SessionCompleted => ({
  type: 'sessionCompleted',
  sessionId: `s${n}`,
  mode: 'focus',
  durationMs: 25 * MIN,
  startedAt: T,
  completedAt: T + n * MIN,
  endsCycle: false,
  cycleFocusMs: 25 * MIN,
})

/** Real wallet and wardrobe stores on memory storage, like the app's, plus the dev tools. */
function setup({ sessions = 0, owned = [] as string[] } = {}) {
  const storage = createMemoryAdapter()
  const now = () => T
  const wallet = createWalletStore({ rules, storage, now })
  for (let i = 1; i <= sessions; i++) wallet.award(session(i))
  for (const id of owned) expect(wallet.purchase(byId(id)).ok).toBe(true)
  const wardrobe = createWardrobeStore({ storage, catalog, getWallet: wallet.getState })
  const tools = createDevTools({ storage, catalog, wallet, wardrobe, now })
  /** The stores as a fresh launch would load them. */
  const reloaded = () => {
    const w = createWalletStore({ rules, storage, now })
    return { wallet: w, wardrobe: createWardrobeStore({ storage, catalog, getWallet: w.getState }) }
  }
  return { wallet, wardrobe, tools, reloaded }
}

describe('dev tools', () => {
  it('give coins adds 10,000 to the balance, notifies the store and survives a reload', () => {
    const { wallet, tools, reloaded } = setup({ sessions: 2 })
    let notified = 0
    wallet.subscribe(() => notified++)
    const before = wallet.getState()
    tools.giveCoins()
    expect(wallet.getState().balance).toBe(before.balance + DEV_COINS)
    expect(notified).toBeGreaterThan(0)
    expect(reloaded().wallet.getState().balance).toBe(before.balance + DEV_COINS)
  })

  it('a grant never counts as study time and leaves earned entries untouched', () => {
    const { wallet, tools } = setup({ sessions: 2 })
    const before = wallet.getState()
    tools.giveCoins()
    tools.giveCoins() // same millisecond: its own key
    const after = wallet.getState()
    for (const [key, entry] of Object.entries(before.ledger)) expect(after.ledger[key]).toEqual(entry)
    const grants = Object.keys(after.ledger).filter((key) => key.startsWith(DEV_GRANT_PREFIX))
    expect(grants).toHaveLength(2)
    expect(after.balance).toBe(before.balance + 2 * DEV_COINS)
    expect(focusSessions(after.ledger)).toEqual(focusSessions(before.ledger))
    expect(goalDays(after.ledger)).toEqual(goalDays(before.ledger))
  })

  it('unlock all owns every catalog item through normal purchases, keeps the balance and wears nothing new', () => {
    const { wallet, wardrobe, tools, reloaded } = setup({ sessions: 1 })
    const balance = wallet.getState().balance
    tools.unlockAll()
    for (const item of catalog) expect(isOwned(wallet.getState(), item.id)).toBe(true)
    expect(Object.keys(wallet.getState().spending)).toHaveLength(catalog.length)
    expect(wallet.getState().totalSpent).toBe(total)
    expect(wallet.getState().balance).toBe(balance)
    expect(wornItemIds(wardrobe.getState())).toEqual([])
    const fresh = reloaded().wallet.getState()
    for (const item of catalog) expect(isOwned(fresh, item.id)).toBe(true)
    expect(fresh.balance).toBe(balance)
  })

  it('unlock all only buys what is missing, and a second run changes nothing', () => {
    const { wallet, tools } = setup({ sessions: 10, owned: ['beanie'] })
    const beanieEntry = wallet.getState().spending['item:beanie']
    const balance = wallet.getState().balance
    tools.unlockAll()
    expect(wallet.getState().spending['item:beanie']).toEqual(beanieEntry)
    expect(wallet.getState().balance).toBe(balance)
    const once = wallet.getState()
    tools.unlockAll()
    expect(wallet.getState()).toEqual(once)
  })

  it('reset wallet empties coins and purchases, takes everything off, and survives a reload', () => {
    const { wallet, wardrobe, tools, reloaded } = setup({ sessions: 2 })
    tools.unlockAll()
    tools.equipAll()
    expect(wornItemIds(wardrobe.getState()).length).toBeGreaterThan(0)
    tools.resetWallet()
    expect(wallet.getState()).toMatchObject({ balance: 0, totalEarned: 0, totalSpent: 0, ledger: {}, spending: {} })
    expect(wornItemIds(wardrobe.getState())).toEqual([])
    const fresh = reloaded()
    expect(fresh.wallet.getState().balance).toBe(0)
    expect(fresh.wallet.getState().spending).toEqual({})
    expect(wornItemIds(fresh.wardrobe.getState())).toEqual([])
  })

  it('reset wardrobe takes everything off and keeps ownership and coins', () => {
    const { wallet, wardrobe, tools, reloaded } = setup({ sessions: 2 })
    tools.unlockAll()
    tools.equipAll()
    const before = wallet.getState()
    tools.resetWardrobe()
    expect(SLOTS.map((slot) => wardrobe.getState()[slot])).toEqual([null, null, null, null, null])
    expect(wallet.getState()).toEqual(before)
    expect(wornItemIds(reloaded().wardrobe.getState())).toEqual([])
  })

  it('equip all wears the first owned item of each slot, in catalog order, and only owned items', () => {
    const { wardrobe, tools, reloaded } = setup({ sessions: 20, owned: ['cap', 'daisy'] })
    tools.equipAll()
    expect(wornItemIds(wardrobe.getState())).toEqual(['cap', 'daisy'])
    tools.unlockAll()
    tools.equipAll()
    const firstPerSlot = SLOTS.flatMap((slot) => {
      const first = catalog.find((item) => item.slot === slot)
      return first ? [first.id] : []
    })
    expect(wornItemIds(wardrobe.getState())).toEqual(firstPerSlot)
    expect(wornItemIds(reloaded().wardrobe.getState())).toEqual(firstPerSlot)
  })

  it('equip all with nothing owned changes nothing', () => {
    const { wardrobe, tools } = setup()
    const before = wardrobe.getState()
    tools.equipAll()
    expect(wardrobe.getState()).toBe(before)
  })
})
