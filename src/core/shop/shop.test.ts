import { describe, expect, it } from 'vitest'
import { createWallet, restoreWallet, rewardSession, type Wallet } from '../rewards/wallet'
import type { SessionCompleted } from '../timer/engine'
import {
  canAffordAnything,
  createWardrobe,
  equip,
  isEquipped,
  isOwned,
  ownedItemIds,
  purchase,
  restoreWardrobe,
  shortfall,
  unequip,
  type ShopItem,
} from './shop'

const MIN = 60_000
const T = new Date(2026, 10, 2, 9).getTime()
const rules = { coinsPerFocusMinute: 1, cycleBonus: 30, dailyGoalBonus: 50, dailyGoalMinutes: 100 }

const beanie: ShopItem = { id: 'beanie', name: 'Beanie', category: 'hats', slot: 'head', price: 120, description: '', swatch: '#000' }
const cap: ShopItem = { id: 'cap', name: 'Cap', category: 'hats', slot: 'head', price: 150, description: '', swatch: '#000' }
const glasses: ShopItem = { id: 'glasses', name: 'Glasses', category: 'glasses', slot: 'face', price: 180, description: '', swatch: '#000' }
const catalog = [beanie, cap, glasses]

let n = 0
/** A wallet that has earned `sessions` × 25 coins (the daily goal adds 50 at the 4th session). */
function earned(sessions: number): Wallet {
  let w = createWallet()
  for (let i = 0; i < sessions; i++) {
    const event: SessionCompleted = {
      type: 'sessionCompleted',
      sessionId: `s${++n}`,
      mode: 'focus',
      durationMs: 25 * MIN,
      startedAt: T,
      completedAt: T + i * MIN,
      endsCycle: false,
    }
    w = rewardSession(w, event, rules).wallet
  }
  return w
}

describe('purchase', () => {
  it('spends coins, records ownership and keeps the earned ledger untouched', () => {
    const before = earned(6) // 150 + 50 goal = 200
    expect(before.balance).toBe(200)
    const r = purchase(before, beanie, T)
    expect(r.ok).toBe(true)
    expect(r.wallet).toMatchObject({ totalEarned: 200, totalSpent: 120, balance: 80 })
    expect(r.wallet.ledger).toBe(before.ledger) // same object: spending never touches it
    expect(isOwned(r.wallet, 'beanie')).toBe(true)
    expect(ownedItemIds(r.wallet)).toEqual(['beanie'])
  })

  it('refuses when there are not enough coins, without changing anything', () => {
    const poor = earned(4) // 100 + 50 = 150
    const r = purchase(poor, glasses, T)
    expect(r).toEqual({ ok: false, reason: 'insufficientFunds', wallet: poor })
    expect(shortfall(poor, glasses)).toBe(30)
  })

  it('allows spending the exact balance', () => {
    const w = earned(4) // 150
    const r = purchase(w, cap, T)
    expect(r.ok && r.wallet.balance).toBe(0)
  })

  it('never sells the same item twice', () => {
    const w = earned(8)
    const once = purchase(w, beanie, T)
    expect(once.ok).toBe(true)
    const twice = purchase(once.wallet, beanie, T + 1)
    expect(twice).toEqual({ ok: false, reason: 'alreadySpent', wallet: once.wallet })
    expect(twice.wallet.totalSpent).toBe(120)
  })

  it('earning more after spending adds to the balance; totals stay consistent', () => {
    const afterBuy = purchase(earned(6), beanie, T)
    if (!afterBuy.ok) throw new Error('expected purchase')
    const event: SessionCompleted = {
      type: 'sessionCompleted',
      sessionId: 'later',
      mode: 'focus',
      durationMs: 25 * MIN,
      startedAt: T,
      completedAt: T + 60 * MIN,
      endsCycle: false,
    }
    const w = rewardSession(afterBuy.wallet, event, rules).wallet
    expect(w).toMatchObject({ totalEarned: 225, totalSpent: 120, balance: 105 })
    expect(Object.keys(w.spending)).toEqual(['item:beanie'])
  })
})

describe('wallet persistence with spending', () => {
  it('round-trips through JSON', () => {
    const r = purchase(earned(6), beanie, T)
    const w = r.wallet
    expect(restoreWallet(JSON.parse(JSON.stringify(w)))).toEqual(w)
  })

  it('reads a Phase 5 save (no spending record; stored balance ignored)', () => {
    const phase5 = { balance: 9999, totalEarned: 9999, ledger: earned(2).ledger }
    expect(restoreWallet(phase5)).toMatchObject({ totalEarned: 50, totalSpent: 0, balance: 50, spending: {} })
  })

  it('drops malformed spending entries and recomputes every total', () => {
    const w = purchase(earned(6), beanie, T).wallet
    const tampered = {
      ...JSON.parse(JSON.stringify(w)),
      balance: 1_000_000,
      totalSpent: 0,
      spending: {
        ...w.spending,
        'item:cap': { kind: 'purchase', itemId: 'glasses', amount: 150, at: T }, // key/item mismatch
        'item:free': { kind: 'purchase', itemId: 'free', amount: -500, at: T },
        'item:junk': 42,
      },
    }
    const restored = restoreWallet(tampered)
    expect(Object.keys(restored.spending)).toEqual(['item:beanie'])
    expect(restored).toMatchObject({ totalEarned: 200, totalSpent: 120, balance: 80 })
  })

  it('a corrupt save where spending exceeds earnings keeps ownership but never shows a negative balance', () => {
    const w = purchase(earned(6), beanie, T).wallet
    const restored = restoreWallet({ ledger: {}, spending: w.spending })
    expect(restored).toMatchObject({ totalEarned: 0, totalSpent: 120, balance: 0 })
    expect(isOwned(restored, 'beanie')).toBe(true)
    expect(purchase(restored, cap, T).ok).toBe(false)
  })
})

describe('wardrobe', () => {
  const rich = () => {
    let w = earned(12)
    for (const item of [beanie, cap]) {
      const r = purchase(w, item, T)
      if (!r.ok) throw new Error('setup')
      w = r.wallet
    }
    return w
  }

  it('only owned items can be equipped', () => {
    const w = rich()
    expect(equip(createWardrobe(), w, glasses)).toEqual({ ok: false, reason: 'notOwned', wardrobe: createWardrobe() })
    const r = equip(createWardrobe(), w, beanie)
    expect(r.ok && r.wardrobe.head).toBe('beanie')
  })

  it('one item per slot: equipping a cap replaces the beanie', () => {
    const w = rich()
    let wardrobe = equip(createWardrobe(), w, beanie).wardrobe
    wardrobe = equip(wardrobe, w, cap).wardrobe
    expect(wardrobe.head).toBe('cap')
    expect(isEquipped(wardrobe, beanie)).toBe(false)
  })

  it('unequip clears the slot; unequipping an empty slot is a no-op', () => {
    const w = rich()
    const worn = equip(createWardrobe(), w, beanie).wardrobe
    expect(unequip(worn, 'head').head).toBeNull()
    const empty = createWardrobe()
    expect(unequip(empty, 'face')).toBe(empty)
  })

  it('restore keeps only owned catalog items in their own slot', () => {
    const w = rich()
    const saved = {
      head: 'beanie',
      face: 'glasses', // not owned
      neck: 'beanie', // wrong slot
      ear: 'unicorn-horn', // not in catalog
      body: 42,
    }
    expect(restoreWardrobe(saved, catalog, w)).toEqual({ ...createWardrobe(), head: 'beanie' })
  })

  it.each([undefined, null, 'beanie', []])('restore falls back to an empty wardrobe for %j', (raw) => {
    expect(restoreWardrobe(raw, catalog, rich())).toEqual(createWardrobe())
  })
})

describe('canAffordAnything', () => {
  it('is false with too few coins and true once an unowned item is affordable', () => {
    expect(canAffordAnything(createWallet(), catalog)).toBe(false)
    expect(canAffordAnything(earned(5), catalog)).toBe(true) // 175 coins
  })

  it('ignores items that are already owned', () => {
    const bought = purchase(earned(5), beanie, T)
    if (!bought.ok) throw new Error('setup')
    // 55 coins left: nothing else is affordable, and the beanie is owned.
    expect(canAffordAnything(bought.wallet, catalog)).toBe(false)
    expect(canAffordAnything(bought.wallet, [beanie])).toBe(false)
  })
})
