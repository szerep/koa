import { describe, expect, it } from 'vitest'
import type { RewardRules } from '../../core/rewards/wallet'
import type { ShopItem } from '../../core/shop/shop'
import type { SessionCompleted } from '../../core/timer/engine'
import { createMemoryAdapter } from '../../storage/adapter'
import { STORAGE_KEY } from '../../storage/persistence'
import { createWalletStore } from '../rewards/walletStore'
import { createWardrobeStore } from './wardrobeStore'

const MIN = 60_000
const rules: RewardRules = { coinsPerFocusMinute: 1, cycleBonus: 30, dailyGoalBonus: 50, dailyGoalMinutes: 100 }
const T = new Date(2026, 10, 2, 9).getTime()
const beanie: ShopItem = { id: 'beanie', name: 'Beanie', category: 'hats', slot: 'head', price: 120, description: '', swatch: '#000' }
const glasses: ShopItem = { id: 'glasses', name: 'Glasses', category: 'glasses', slot: 'face', price: 180, description: '', swatch: '#000' }
const catalog = [beanie, glasses]

let n = 0
const session = (): SessionCompleted => ({
  type: 'sessionCompleted',
  sessionId: `s${++n}`,
  mode: 'focus',
  durationMs: 25 * MIN,
  startedAt: T,
  completedAt: T + n * MIN,
  endsCycle: false,
})

function app(storage = createMemoryAdapter()) {
  const wallet = createWalletStore({ rules, storage, now: () => T })
  const wardrobe = createWardrobeStore({ storage, catalog, getWallet: wallet.getState })
  return { storage, wallet, wardrobe }
}

describe('shop stores', () => {
  it('purchases and outfit persist across a refresh', () => {
    const a = app()
    for (let i = 0; i < 6; i++) a.wallet.award(session()) // 200 coins
    expect(a.wallet.purchase(beanie).ok).toBe(true)
    expect(a.wardrobe.equip(beanie).ok).toBe(true)

    const b = app(a.storage)
    expect(b.wallet.getState()).toMatchObject({ totalEarned: 200, totalSpent: 120, balance: 80 })
    expect(b.wardrobe.getState().head).toBe('beanie')
  })

  it('insufficient funds: nothing is saved', () => {
    const a = app()
    a.wallet.award(session()) // 25 coins
    const before = a.storage.data[STORAGE_KEY]
    const r = a.wallet.purchase(beanie)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toBe('insufficientFunds')
    expect(a.storage.data[STORAGE_KEY]).toBe(before)
  })

  it('cannot equip what was never bought', () => {
    const a = app()
    expect(a.wardrobe.equip(glasses)).toMatchObject({ ok: false, reason: 'notOwned' })
    expect(a.wardrobe.getState().face).toBeNull()
  })

  it('two tabs cannot buy the same item twice', () => {
    const storage = createMemoryAdapter()
    const tabA = app(storage)
    for (let i = 0; i < 12; i++) tabA.wallet.award(session())
    const tabB = app(storage)
    expect(tabA.wallet.purchase(beanie).ok).toBe(true)
    const second = tabB.wallet.purchase(beanie) // tab B's memory is stale; storage is checked
    expect(!second.ok && second.reason).toBe('alreadySpent')
    expect(app(storage).wallet.getState().totalSpent).toBe(120)
  })

  it('two tabs cannot overspend the same coins', () => {
    const storage = createMemoryAdapter()
    const tabA = app(storage)
    for (let i = 0; i < 6; i++) tabA.wallet.award(session()) // 200 coins
    const tabB = app(storage)
    expect(tabA.wallet.purchase(glasses).ok).toBe(true) // 20 left
    const r = tabB.wallet.purchase(beanie)
    expect(!r.ok && r.reason).toBe('insufficientFunds')
    expect(tabB.wallet.getState().balance).toBe(20) // tab B caught up
  })

  it('spending never changes the earned ledger', () => {
    const a = app()
    for (let i = 0; i < 6; i++) a.wallet.award(session())
    const ledgerBefore = JSON.stringify(a.wallet.getState().ledger)
    a.wallet.purchase(beanie)
    expect(JSON.stringify(a.wallet.getState().ledger)).toBe(ledgerBefore)
    expect(JSON.stringify(JSON.parse(a.storage.data[STORAGE_KEY]).wallet.ledger)).toBe(ledgerBefore)
  })

  it('corrupted saves fall back safely', () => {
    const storage = createMemoryAdapter({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        wallet: { ledger: 'oops', spending: { 'item:beanie': { kind: 'purchase', itemId: 'beanie', amount: 'x', at: 1 } } },
        wardrobe: { head: 'beanie', face: { nested: true } },
      }),
    })
    const a = app(storage)
    expect(a.wallet.getState()).toMatchObject({ totalEarned: 0, totalSpent: 0, balance: 0 })
    expect(a.wardrobe.getState().head).toBeNull() // beanie isn't validly owned
  })

  it('an unreadable save is backed up and the shop starts empty', () => {
    const storage = createMemoryAdapter({ [STORAGE_KEY]: '{"version":1,"wallet":' })
    const a = app(storage)
    expect(a.wallet.getState().balance).toBe(0)
    expect(storage.data['koa:backup']).toBe('{"version":1,"wallet":')
  })
})
