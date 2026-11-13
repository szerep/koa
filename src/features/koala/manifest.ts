/**
 * Character manifest: maps koala poses and frames to exported image files.
 *
 * All frames share the house grid (docs/character-bible.md §3): a 1024×1536 canvas,
 * head width 500px, vertical axis x = 512, ground line y = 1400.
 * Images are produced by scripts/art/normalize_export.py, never drawn in code.
 */

export const HOUSE_GRID = {
  canvas: { width: 1024, height: 1536 },
  axisX: 512,
  groundY: 1400,
} as const

/** The visible figure inside the canvas (in canvas pixels). Varies per pose. */
export interface FigureBox {
  x: number
  y: number
  width: number
  height: number
}

export interface KoalaFrame {
  /** 1024px-wide export. */
  src: string
  /** 512px-wide export. */
  srcSmall: string
}

export interface KoalaPose {
  figure: FigureBox
  frames: {
    base: KoalaFrame
    blink?: KoalaFrame
  }
}

const frame = (name: string): KoalaFrame => ({
  src: `/characters/${name}.webp`,
  srcSmall: `/characters/${name}-512.webp`,
})

/**
 * Only poses whose art exists are listed. Missing poses are not substituted:
 * consumers fall back to `idle` until real art is added here.
 */
export const koalaPoses = {
  idle: {
    // Measured from koa_idle_neutral.normalized.png (provisional Master v02).
    figure: { x: 105, y: 557, width: 814, height: 843 },
    frames: {
      base: frame('koa_idle_neutral'),
      blink: frame('koa_idle_blink'),
    },
  },
} satisfies Record<string, KoalaPose>

export type KoalaPoseName = keyof typeof koalaPoses

/* ------------------------------------------------------------------------------------------
 * Accessory artwork (Phase 6 integration; assets pending, see docs/phase-6/accessory-assets.md)
 *
 * Every accessory frame is exported on the SAME 1024×1536 house-grid canvas as the pose it
 * belongs to, already positioned for that pose. Layering is then a plain stack of
 * same-sized images, so no per-item offsets are needed in code.
 *
 *   overlay  an item drawn over (or behind) the koala: hats, glasses, scarf, flower, headphones
 *   outfit   a full re-render of the pose (hoodie recolors replace the base and blink frames)
 *
 * An item with no entry here (or no frame for the current pose) is simply not drawn.
 * Never substitute a drawing, emoji or icon for missing art.
 * ---------------------------------------------------------------------------------------- */

export type AccessoryArt =
  | {
      kind: 'overlay'
      /** `back` draws behind the koala (e.g. a headphone band behind the head). */
      layer: 'front' | 'back'
      frames: Partial<Record<KoalaPoseName, KoalaFrame>>
      /**
       * Where the item sits in its idle frame (canvas pixels, 8 px padding included), measured
       * from the exported file. The Shop card shows this crop of the same frame as the item's
       * picture (no extra asset), and Koa's speech bubble clears anything above the figure box.
       */
      bounds?: FigureBox
    }
  | {
      kind: 'outfit'
      poses: Partial<Record<KoalaPoseName, { base: KoalaFrame; blink?: KoalaFrame }>>
    }

/** File naming for future assets: `/characters/accessories/<itemId>@<pose>.webp` (+ `-512`). */
export const accessoryFrame = (itemId: string, pose: KoalaPoseName): KoalaFrame => ({
  src: `/characters/accessories/${itemId}@${pose}.webp`,
  srcSmall: `/characters/accessories/${itemId}@${pose}-512.webp`,
})

/**
 * Add an entry here when an item's artwork is delivered and approved (Phase 11).
 * Items without an entry are not drawn.
 */
export const accessoryArt: Readonly<Record<string, AccessoryArt>> = {
  // Phase 11 Step 1 (beanie_v02, approved 2026-11-13): drawn above the base and blink frames.
  beanie: {
    kind: 'overlay',
    layer: 'front',
    frames: { idle: accessoryFrame('beanie', 'idle') },
    // Measured from beanie@idle.webp (opaque x 297–723, y 464–767), plus 8 px.
    bounds: { x: 289, y: 456, width: 443, height: 320 },
  },
}

/** Where the Shop card crops an item's idle frame, or null when it has no art (or no crop). */
export const accessoryPreview = (itemId: string): { frame: KoalaFrame; box: FigureBox } | null => {
  const art = accessoryArt[itemId]
  if (art?.kind !== 'overlay' || !art.bounds || !art.frames.idle) return null
  return { frame: art.frames.idle, box: art.bounds }
}

/**
 * How far (canvas pixels) worn overlay art reaches above the pose's figure box: a hat's
 * pom-pom draws above the head, so Koa's speech bubble moves up by this much.
 */
export const headroomAbove = (wearing: readonly string[], pose: KoalaPoseName = 'idle'): number =>
  Math.max(
    0,
    ...wearing.map((id) => {
      const art = accessoryArt[id]
      return art?.kind === 'overlay' && art.frames[pose] && art.bounds ? koalaPoses[pose].figure.y - art.bounds.y : 0
    }),
  )

/** The same headroom as a share of the figure's height: Koa's speech bubble moves up by it (0 = no lift). */
export const bubbleLiftPercent = (wearing: readonly string[], pose: KoalaPoseName = 'idle'): number =>
  (headroomAbove(wearing, pose) / koalaPoses[pose].figure.height) * 100

export const hasAccessoryArt = (itemId: string, pose: KoalaPoseName = 'idle'): boolean => {
  const art = accessoryArt[itemId]
  if (!art) return false
  return art.kind === 'overlay' ? Boolean(art.frames[pose]) : Boolean(art.poses[pose])
}
