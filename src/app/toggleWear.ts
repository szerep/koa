import { koalaStore } from '../features/koala/store'
import { wardrobeStore } from '../features/shop/store'
import { createToggleWear } from './wear'

/** Put an owned item on or take it off, for the Shop and the Wardrobe (rules in `wear.ts`). */
export const toggleWear = createToggleWear({ wardrobe: wardrobeStore, koala: koalaStore })
