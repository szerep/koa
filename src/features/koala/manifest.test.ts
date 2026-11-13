import { describe, expect, it } from 'vitest'
import { catalog } from '../../config/catalog'
import {
  accessoryArt,
  accessoryFrame,
  accessoryPreview,
  bubbleLiftPercent,
  hasAccessoryArt,
  headroomAbove,
  koalaPoses,
} from './manifest'

describe('accessory artwork (Phase 11)', () => {
  it('has artwork for the beanie, on the idle pose', () => {
    expect(hasAccessoryArt('beanie')).toBe(true)
    expect(hasAccessoryArt('beanie', 'idle')).toBe(true)
  })

  it('registers the beanie as a front overlay with the exported idle frames', () => {
    expect(accessoryArt.beanie).toEqual({
      kind: 'overlay',
      layer: 'front',
      frames: { idle: accessoryFrame('beanie', 'idle') },
      bounds: { x: 289, y: 456, width: 443, height: 320 },
    })
    expect(accessoryFrame('beanie', 'idle')).toEqual({
      src: '/characters/accessories/beanie@idle.webp',
      srcSmall: '/characters/accessories/beanie@idle-512.webp',
    })
  })

  it('has no artwork for any other item yet (missing art is never substituted)', () => {
    expect(Object.keys(accessoryArt)).toEqual(['beanie'])
    for (const item of catalog.filter((i) => i.id !== 'beanie')) {
      expect(hasAccessoryArt(item.id)).toBe(false)
    }
    expect(hasAccessoryArt('round-glasses')).toBe(false)
    expect(hasAccessoryArt('unknown-item')).toBe(false)
  })

  it('only registers art for items that exist in the catalog, in their slot', () => {
    const beanie = catalog.find((i) => i.id === 'beanie')
    expect(beanie?.slot).toBe('head')
    for (const id of Object.keys(accessoryArt)) {
      expect(catalog.some((i) => i.id === id)).toBe(true)
    }
  })
})

describe('accessory bounds (Shop picture and bubble headroom)', () => {
  it('keeps the beanie bounds inside the canvas and around the head', () => {
    const b = accessoryArt.beanie.kind === 'overlay' ? accessoryArt.beanie.bounds : undefined
    expect(b).toBeDefined()
    if (!b) return
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(1024)
    expect(b.y + b.height).toBeLessThan(koalaPoses.idle.figure.y + koalaPoses.idle.figure.height)
  })

  it('crops the Shop picture from the same idle frame Koa wears', () => {
    expect(accessoryPreview('beanie')).toEqual({
      frame: accessoryFrame('beanie', 'idle'),
      box: { x: 289, y: 456, width: 443, height: 320 },
    })
    expect(accessoryPreview('round-glasses')).toBeNull()
    expect(accessoryPreview('unknown-item')).toBeNull()
  })

  it('reports how far worn art reaches above the figure box (the pom-pom)', () => {
    expect(headroomAbove(['beanie'])).toBe(koalaPoses.idle.figure.y - 456)
    expect(headroomAbove(['beanie', 'knit-scarf'])).toBe(101)
  })

  it('needs no headroom without a hat that has art', () => {
    expect(headroomAbove([])).toBe(0)
    expect(headroomAbove(['cap', 'round-glasses', 'unknown-item'])).toBe(0)
  })

  it('lifts the speech bubble by that headroom, as a share of the figure height', () => {
    expect(bubbleLiftPercent(['beanie'])).toBeCloseTo((101 / 843) * 100, 6)
    expect(bubbleLiftPercent([])).toBe(0)
    expect(bubbleLiftPercent(['cap', 'round-glasses'])).toBe(0)
  })
})
