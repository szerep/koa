import type { Wallet } from '../../core/rewards/wallet'
import {
  equip,
  restoreWardrobe,
  unequip,
  type EquipResult,
  type ShopItem,
  type Slot,
  type Wardrobe,
} from '../../core/shop/shop'
import type { StorageAdapter } from '../../storage/adapter'
import { loadState, saveSlice } from '../../storage/persistence'

export interface WardrobeStoreOptions {
  storage: StorageAdapter
  catalog: readonly ShopItem[]
  /** Ownership comes from the wallet. */
  getWallet: () => Wallet
}

export type WardrobeStore = ReturnType<typeof createWardrobeStore>

/** What Koa is wearing: one item per slot, only ever owned items. */
export function createWardrobeStore({ storage, catalog, getWallet }: WardrobeStoreOptions) {
  let wardrobe: Wardrobe = restoreWardrobe(loadState(storage).wardrobe, catalog, getWallet())
  const listeners = new Set<() => void>()

  const set = (next: Wardrobe) => {
    if (next === wardrobe) return
    wardrobe = next
    saveSlice(storage, 'wardrobe', wardrobe)
    listeners.forEach((l) => l())
  }

  return {
    getState: () => wardrobe,

    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    equip(item: ShopItem): EquipResult {
      const result = equip(wardrobe, getWallet(), item)
      if (result.ok) set(result.wardrobe)
      return result
    },

    unequip: (slot: Slot) => set(unequip(wardrobe, slot)),

    /** Re-read the saved wardrobe (another tab changed it). */
    refresh() {
      const latest = restoreWardrobe(loadState(storage).wardrobe, catalog, getWallet())
      const changed = (Object.keys(latest) as Slot[]).some((slot) => latest[slot] !== wardrobe[slot])
      if (changed) {
        wardrobe = latest
        listeners.forEach((l) => l())
      }
    },
  }
}
