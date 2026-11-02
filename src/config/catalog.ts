import type { ItemCategory, ShopItem } from '../core/shop/shop'

/**
 * Shop catalog, v1: the accessory set from the reference sheet (character bible §3/§5),
 * plus hoodie recolors (clothing option A). Prices assume about 25 coins per focus session.
 *
 * Artwork status lives in src/features/koala/manifest.ts (`accessoryArt`). An item without
 * artwork can be bought and worn, but Koa can't show it until its asset exists.
 */
export const catalog: readonly ShopItem[] = [
  {
    id: 'beanie',
    name: 'Sage beanie',
    category: 'hats',
    slot: 'head',
    price: 120,
    description: 'A chunky knit beanie with a pom-pom, for chilly study mornings.',
    swatch: '#8da47c',
  },
  {
    id: 'cap',
    name: 'Sand cap',
    category: 'hats',
    slot: 'head',
    price: 150,
    description: 'A soft cap with a little eucalyptus leaf stitched on the front.',
    swatch: '#e8cf98',
  },
  {
    id: 'explorer-hat',
    name: 'Explorer hat',
    category: 'hats',
    slot: 'head',
    price: 300,
    description: 'A wide-brimmed hat for big adventures between chapters.',
    swatch: '#d9bf86',
  },
  {
    id: 'round-glasses',
    name: 'Round glasses',
    category: 'glasses',
    slot: 'face',
    price: 180,
    description: 'Thin round frames. Instantly 20% more scholarly.',
    swatch: '#3a2b22',
  },
  {
    id: 'knit-scarf',
    name: 'Cocoa scarf',
    category: 'scarves',
    slot: 'neck',
    price: 140,
    description: 'A long, cozy knit scarf in warm cocoa brown.',
    swatch: '#8b5e3c',
  },
  {
    id: 'headphones',
    name: 'Cream headphones',
    category: 'extras',
    slot: 'head',
    price: 260,
    description: 'Big comfy headphones for lo-fi focus sessions.',
    swatch: '#efe4cf',
  },
  {
    id: 'daisy',
    name: 'Daisy',
    category: 'extras',
    slot: 'ear',
    price: 80,
    description: 'A fresh daisy tucked behind one ear.',
    swatch: '#f7f1e3',
  },
  {
    id: 'hoodie-honey',
    name: 'Honey hoodie',
    category: 'clothes',
    slot: 'body',
    price: 400,
    description: 'Koa’s favorite hoodie, dyed a warm honey yellow.',
    swatch: '#e3a948',
  },
  {
    id: 'hoodie-blush',
    name: 'Blush hoodie',
    category: 'clothes',
    slot: 'body',
    price: 400,
    description: 'The same cozy hoodie in a soft blush pink.',
    swatch: '#e5bcb3',
  },
]

export const categories: readonly { id: ItemCategory; label: string }[] = [
  { id: 'hats', label: 'Hats' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'clothes', label: 'Clothes' },
  { id: 'scarves', label: 'Scarves' },
  { id: 'extras', label: 'Extras' },
]

export const itemById = (id: string) => catalog.find((item) => item.id === id)
