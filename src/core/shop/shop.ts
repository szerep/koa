/**
 * Shop rules: pure, no React or storage.
 *
 * Ownership lives in the wallet's spending record (`item:<id>`), so an item is owned exactly
 * when it was paid for, and buying the same item twice is impossible by construction.
 * What Koa wears lives in a separate wardrobe: one item per slot.
 */
import { spend, type SpendFailure, type Wallet } from '../rewards/wallet'

export type ItemCategory = 'hats' | 'glasses' | 'clothes' | 'scarves' | 'extras'

/** Where an item sits on Koa. Equipping an item replaces whatever is in its slot. */
export type Slot = 'head' | 'face' | 'neck' | 'ear' | 'body'

export const SLOTS: readonly Slot[] = ['head', 'face', 'neck', 'ear', 'body']

export interface ShopItem {
  id: string
  name: string
  category: ItemCategory
  slot: Slot
  price: number
  description: string
  /** The item's main color, shown as a swatch until its artwork exists. */
  swatch: string
}

export type Wardrobe = Record<Slot, string | null>

export function createWardrobe(): Wardrobe {
  return { head: null, face: null, neck: null, ear: null, body: null }
}

export const itemKey = (id: string) => `item:${id}`

export function isOwned(wallet: Wallet, itemId: string): boolean {
  return itemKey(itemId) in wallet.spending
}

export function ownedItemIds(wallet: Wallet): string[] {
  return Object.values(wallet.spending)
    .filter((e) => e.kind === 'purchase')
    .sort((a, b) => a.at - b.at)
    .map((e) => e.itemId)
}

export type PurchaseFailure = SpendFailure

export type PurchaseResult =
  | { ok: true; wallet: Wallet }
  | { ok: false; reason: PurchaseFailure; wallet: Wallet }

/** Buy an item. Never charges twice and never goes below zero. */
export function purchase(wallet: Wallet, item: ShopItem, now: number): PurchaseResult {
  return spend(wallet, itemKey(item.id), { kind: 'purchase', itemId: item.id, amount: item.price, at: now })
}

/** True when the wallet can buy at least one catalog item it doesn't own yet. */
export function canAffordAnything(wallet: Wallet, catalog: readonly ShopItem[]): boolean {
  return catalog.some((item) => !isOwned(wallet, item.id) && item.price <= wallet.balance)
}

/** How many more coins are needed to afford `item` (0 if affordable). */
export function shortfall(wallet: Wallet, item: ShopItem): number {
  return Math.max(0, item.price - wallet.balance)
}

export type EquipResult = { ok: true; wardrobe: Wardrobe } | { ok: false; reason: 'notOwned'; wardrobe: Wardrobe }

export function equip(wardrobe: Wardrobe, wallet: Wallet, item: ShopItem): EquipResult {
  if (!isOwned(wallet, item.id)) return { ok: false, reason: 'notOwned', wardrobe }
  if (wardrobe[item.slot] === item.id) return { ok: true, wardrobe }
  return { ok: true, wardrobe: { ...wardrobe, [item.slot]: item.id } }
}

export function unequip(wardrobe: Wardrobe, slot: Slot): Wardrobe {
  if (wardrobe[slot] === null) return wardrobe
  return { ...wardrobe, [slot]: null }
}

export function isEquipped(wardrobe: Wardrobe, item: ShopItem): boolean {
  return wardrobe[item.slot] === item.id
}

/**
 * Rebuild a wardrobe from saved data. Keeps only items that exist in the catalog, are owned,
 * and are in their own slot, so corrupt or tampered data can't equip unowned items.
 */
export function restoreWardrobe(raw: unknown, catalog: readonly ShopItem[], wallet: Wallet): Wardrobe {
  const wardrobe = createWardrobe()
  if (typeof raw !== 'object' || raw === null) return wardrobe
  const byId = new Map(catalog.map((item) => [item.id, item]))
  for (const slot of SLOTS) {
    const id = (raw as Record<string, unknown>)[slot]
    if (typeof id !== 'string') continue
    const item = byId.get(id)
    if (item && item.slot === slot && isOwned(wallet, id)) wardrobe[slot] = id
  }
  return wardrobe
}
