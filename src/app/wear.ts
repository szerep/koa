import { isEquipped, type ShopItem } from '../core/shop/shop'
import type { WardrobeStore } from '../features/shop/wardrobeStore'

export interface ToggleWearDeps {
  wardrobe: Pick<WardrobeStore, 'getState' | 'equip' | 'unequip'>
  /** Koa's reaction to something new (`koalaStore.showOff`). */
  koala: { showOff: () => void }
}

/** What a wear toggle did, and the sentence that tells the user. */
export interface WearChange {
  change: 'on' | 'off'
  message: string
}

/**
 * The one path for putting an owned item on or taking it off (Shop and Wardrobe, Phase 12).
 * It lives in the app layer because it joins two features: the wardrobe and Koa's brain.
 *
 * - Worn: takes it off. Koa doesn't react.
 * - Not worn: puts it on (replacing whatever is in its slot) and Koa shows it off.
 * - Not owned: nothing changes (`null`).
 */
export function createToggleWear({ wardrobe, koala }: ToggleWearDeps) {
  return function toggleWear(item: ShopItem): WearChange | null {
    const name = item.name.toLowerCase()
    if (isEquipped(wardrobe.getState(), item)) {
      wardrobe.unequip(item.slot)
      return { change: 'off', message: `Took off the ${name}.` }
    }
    if (!wardrobe.equip(item).ok) return null
    koala.showOff()
    return { change: 'on', message: `Koa is wearing the ${name}.` }
  }
}
