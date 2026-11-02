import type { AnimationOptions, DOMKeyframesDefinition } from 'motion/react'
import type { KoalaMotionName } from '../../core/koala/brain'

/**
 * How each of Koa's motions moves the figure. Transforms only (from the feet), applied to the
 * approved frames: nothing here draws or replaces character art. Eye-only motions return
 * null and are handled by the blink layer.
 */
export function koalaMotion(
  name: KoalaMotionName,
  dir: 1 | -1,
): { keyframes: DOMKeyframesDefinition; options: AnimationOptions } | null {
  const d = dir
  switch (name) {
    case 'squish':
      return {
        keyframes: { scaleX: [1, 1.06, 0.98, 1], scaleY: [1, 0.92, 1.03, 1] },
        options: { duration: 0.5, ease: 'easeOut' },
      }
    case 'softSquish':
      return {
        keyframes: { scaleX: [1, 1.025, 1], scaleY: [1, 0.965, 1] },
        options: { duration: 0.4, ease: 'easeOut' },
      }
    case 'wiggle':
      return {
        keyframes: { rotate: [0, -3 * d, 3 * d, -2 * d, 1 * d, 0] },
        options: { duration: 0.8, ease: 'easeInOut' },
      }
    case 'bounce':
      return {
        keyframes: { y: [0, -14, 0, -3, 0], scaleY: [1, 1.03, 0.96, 1, 1], scaleX: [1, 0.98, 1.03, 1, 1] },
        options: { duration: 0.6, ease: 'easeOut' },
      }
    case 'giggle':
      return {
        keyframes: { rotate: [0, -1.5, 1.5, -1.5, 1.5, -1, 0], scaleY: [1, 0.97, 0.97, 0.97, 0.97, 0.98, 1] },
        options: { duration: 0.6, ease: 'easeInOut' },
      }
    case 'surprised':
      return {
        keyframes: { y: [0, -20, 0, 0], scaleY: [1, 1.06, 0.95, 1], scaleX: [1, 0.96, 1.04, 1] },
        options: { duration: 0.5, ease: 'easeOut' },
      }
    case 'sway':
      return {
        keyframes: { rotate: [0, 2 * d, 0, -2 * d, 0] },
        options: { duration: 3.2, ease: 'easeInOut' },
      }
    case 'tilt':
      return {
        keyframes: { rotate: [0, 3.5 * d, 3.5 * d, 0] },
        options: { duration: 2.4, ease: 'easeInOut', times: [0, 0.25, 0.7, 1] },
      }
    case 'stretch':
      return {
        keyframes: { scaleY: [1, 1.045, 1.045, 0.98, 1], scaleX: [1, 0.975, 0.975, 1.015, 1] },
        options: { duration: 1.8, ease: 'easeInOut', times: [0, 0.35, 0.6, 0.85, 1] },
      }
    case 'settle':
      return {
        keyframes: { scaleY: [1, 0.975, 1], scaleX: [1, 1.012, 1] },
        options: { duration: 0.7, ease: 'easeInOut' },
      }
    case 'hop':
      return {
        keyframes: { y: [0, -22, 0, -6, 0], scaleY: [1, 1.04, 0.94, 1.01, 1], scaleX: [1, 0.97, 1.05, 1, 1] },
        options: { duration: 0.75, ease: 'easeOut', delay: 0.1 },
      }
    case 'bigHop':
      return {
        keyframes: {
          y: [0, -22, 0, -28, 0, -5, 0],
          scaleY: [1, 1.04, 0.94, 1.05, 0.93, 1.01, 1],
          scaleX: [1, 0.97, 1.05, 0.96, 1.06, 1, 1],
        },
        options: { duration: 1.3, ease: 'easeOut', delay: 0.1 },
      }
    case 'wake':
      return {
        keyframes: { rotate: [0, -1.5, 1.5, 0], scaleY: [0.985, 1.03, 1, 1] },
        options: { duration: 0.9, ease: 'easeInOut' },
      }
    case 'slowBlink':
      return null
  }
}
