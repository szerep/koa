import { describe, expect, it } from 'vitest'
import type { RewardRules } from '../core/rewards/wallet'
import { wornItemIds, type ShopItem } from '../core/shop/shop'
import type { SessionCompleted } from '../core/timer/engine'
import { createWalletStore } from '../features/rewards/walletStore'
import { createWardrobeStore } from '../features/shop/wardrobeStore'
import { createMemoryAdapter } from '../storage/adapter'
import { createToggleWear } from './wear'

const MIN = 60_000
const rules: RewardRules = { coinsPerFocusMinute: 1, cycleBonus: 30, cycleBonusFullMinutes: 100, dailyGoalBonus: 50, dailyGoalMinutes: 100 }
const T = new Date(2026, 10, 2, 9).getTime()
const beanie: ShopItem = { id: 'beanie', name: 'Sage beanie', category: 'hats', slot: 'head', price: 120, description: '', swatch: '#000' }
const cap: ShopItem = { id: 'cap', name: 'Sand cap', category: 'hats', slot: 'head', price: 150, description: '', swatch: '#000' }
const glasses: ShopItem = { id: 'round-glasses', name: 'Round glasses', category: 'glasses', slot: 'face', price: 180, description: '', swatch: '#000' }
const catalog = [beanie, cap, glasses]

let n = 0
const session = (): SessionCompleted => ({
  type: 'sessionCompleted',
  sessionId: `s${++n}`,
  mode: 'focus',
  durationMs: 25 * MIN,
  startedAt: T,
  completedAt: T + n * MIN,
  endsCycle: false,
  cycleFocusMs: 25 * MIN,
})

/** Real wallet and wardrobe stores on memory storage, with a Koa that counts show-offs. */
function setup(owned: ShopItem[] = []) {
  const storage = createMemoryAdapter()
  const wallet = createWalletStore({ rules, storage, now: () => T })
  for (let i = 0; i < 20; i++) wallet.award(session()) // 550 coins
  for (const item of owned) expect(wallet.purchase(item).ok).toBe(true)
  const wardrobe = createWardrobeStore({ storage, catalog, getWallet: wallet.getState })
  const koala = { showOffs: 0, showOff: () => koala.showOffs++ }
  return { storage, wardrobe, koala, toggleWear: createToggleWear({ wardrobe, koala }) }
}

describe('toggleWear', () => {
  it('puts an owned item on, and Koa shows it off once', () => {
    const { wardrobe, koala, toggleWear } = setup([beanie])
    expect(toggleWear(beanie)).toEqual({ change: 'on', message: 'Koa is wearing the sage beanie.' })
    expect(wardrobe.getState().head).toBe('beanie')
    expect(koala.showOffs).toBe(1)
  })

  it('takes a worn item off, without a reaction from Koa', () => {
    const { wardrobe, koala, toggleWear } = setup([beanie])
    toggleWear(beanie)
    expect(toggleWear(beanie)).toEqual({ change: 'off', message: 'Took off the sage beanie.' })
    expect(wardrobe.getState().head).toBeNull()
    expect(koala.showOffs).toBe(1) // only from putting it on
  })

  it('does nothing for an item that was never bought', () => {
    const { wardrobe, koala, toggleWear } = setup()
    const before = wardrobe.getState()
    expect(toggleWear(beanie)).toBeNull()
    expect(wardrobe.getState()).toBe(before)
    expect(koala.showOffs).toBe(0)
  })

  it('swaps out whatever is in the same slot', () => {
    const { wardrobe, toggleWear } = setup([beanie, cap])
    toggleWear(beanie)
    expect(toggleWear(cap)?.change).toBe('on')
    expect(wardrobe.getState().head).toBe('cap')
  })

  it('leaves other slots alone, and the worn list stays in slot order', () => {
    const { wardrobe, toggleWear } = setup([beanie, glasses])
    toggleWear(glasses)
    toggleWear(beanie)
    expect(wornItemIds(wardrobe.getState())).toEqual(['beanie', 'round-glasses'])
    toggleWear(beanie)
    expect(wornItemIds(wardrobe.getState())).toEqual(['round-glasses'])
  })

  it('reads the latest wardrobe, so a change from another tab is respected', () => {
    const { storage, wardrobe, toggleWear } = setup([beanie])
    // Another tab puts the beanie on and saves; this tab refreshes on the storage event.
    const other = createWardrobeStore({ storage, catalog, getWallet: createWalletStore({ rules, storage, now: () => T }).getState })
    other.equip(beanie)
    wardrobe.refresh()
    expect(toggleWear(beanie)?.change).toBe('off')
  })

  it('saves the outfit through the wardrobe store', () => {
    const { storage, toggleWear } = setup([glasses])
    toggleWear(glasses)
    const reloaded = createWardrobeStore({ storage, catalog, getWallet: createWalletStore({ rules, storage, now: () => T }).getState })
    expect(reloaded.getState().face).toBe('round-glasses')
  })
})
