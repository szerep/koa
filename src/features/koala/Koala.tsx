import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useAnimate, useReducedMotion } from 'motion/react'
import type { KoalaMotion, KoalaTempo } from '../../core/koala/brain'
import { accessoryArt, HOUSE_GRID, koalaPoses, type KoalaFrame, type KoalaPoseName } from './manifest'
import { koalaMotion } from './motions'
import './koala.css'

interface KoalaProps {
  pose?: KoalaPoseName
  /** Rendered width of the visible figure, as a CSS length (e.g. `clamp(...)`). */
  width: string
  /**
   * Approximate rendered width of the visible figure for image selection,
   * as a `sizes` value (e.g. `(min-width: 960px) 300px, 60vw`).
   */
  figureSizes: string
  /** Breathing + blinking. */
  alive?: boolean
  /** Makes Koa a button; the reaction comes back through `motion`. */
  onTap?: () => void
  /** Draw the soft contact shadow under the feet. */
  shadow?: boolean
  /** The latest motion to play (a new `seq` plays it again). Transforms of the art only. */
  motion?: KoalaMotion | null
  /** Hold the approved blink frame (napping). */
  eyesClosed?: boolean
  /** Breathing and blink pace. */
  tempo?: KoalaTempo
  /** Ids of equipped items. Items without artwork for this pose are not drawn. */
  wearing?: readonly string[]
  className?: string
  /** Drawn over the figure, unaffected by its motion (speech bubble, sleep glyphs). */
  children?: ReactNode
}

const BLINK_MS = 140
const SLOW_BLINK_MS = 520

/** Seconds between blinks: calmer while focusing or resting. */
const BLINK_GAP: Record<KoalaTempo, { min: number; spread: number }> = {
  normal: { min: 3000, spread: 4000 },
  calm: { min: 5000, spread: 4000 },
  sleepy: { min: 5000, spread: 4000 },
}

function useBlink(enabled: boolean, tempo: KoalaTempo) {
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let timer: number | undefined

    const schedule = () => {
      const wait = BLINK_GAP[tempo].min + Math.random() * BLINK_GAP[tempo].spread
      timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          const double = Math.random() < 0.2
          setClosed(true)
          window.setTimeout(() => setClosed(false), BLINK_MS)
          if (double) {
            window.setTimeout(() => setClosed(true), BLINK_MS * 2)
            window.setTimeout(() => setClosed(false), BLINK_MS * 3)
          }
        }
        schedule()
      }, wait)
    }

    schedule()
    return () => window.clearTimeout(timer)
  }, [enabled, tempo])

  return closed
}

/** A slow, contented blink, cued by the `slowBlink` motion. */
function useSlowBlink(motion: KoalaMotion | null | undefined) {
  const [closedFor, setClosedFor] = useState<number | null>(null)
  const cue = motion?.name === 'slowBlink' ? motion.seq : null

  useEffect(() => {
    if (cue === null) return
    const close = window.setTimeout(() => setClosedFor(cue), 0)
    const open = window.setTimeout(() => setClosedFor(null), SLOW_BLINK_MS)
    return () => {
      window.clearTimeout(close)
      window.clearTimeout(open)
    }
  }, [cue])

  return closedFor !== null
}

function srcSet(frame: KoalaFrame) {
  return `${frame.srcSmall} 512w, ${frame.src} 1024w`
}

export function Koala({
  pose = 'idle',
  width,
  figureSizes,
  alive = true,
  onTap,
  shadow = true,
  motion,
  eyesClosed = false,
  tempo = 'normal',
  wearing = [],
  className,
  children,
}: KoalaProps) {
  const { figure, frames: poseFrames } = koalaPoses[pose]

  // An outfit (hoodie recolor) replaces the pose frames; overlays stack around them.
  const outfit = wearing
    .map((id) => accessoryArt[id])
    .find((art) => art?.kind === 'outfit' && art.poses[pose])
  const outfitFrames = outfit?.kind === 'outfit' ? outfit.poses[pose] : undefined
  const frames = outfitFrames ?? poseFrames
  const blinkFrame = 'blink' in frames ? frames.blink : undefined
  const overlays = wearing.flatMap((id) => {
    const art = accessoryArt[id]
    const frame = art?.kind === 'overlay' ? art.frames[pose] : undefined
    return art?.kind === 'overlay' && frame ? [{ id, layer: art.layer, frame }] : []
  })
  const back = overlays.filter((o) => o.layer === 'back')
  const front = overlays.filter((o) => o.layer === 'front')
  const reduceMotion = useReducedMotion()
  const blinking = useBlink(alive && Boolean(blinkFrame) && !eyesClosed, tempo)
  const slowBlinking = useSlowBlink(alive ? motion : null)
  const eyesShut = Boolean(blinkFrame) && (eyesClosed || slowBlinking)
  const [scope, animate] = useAnimate()

  const { canvas } = HOUSE_GRID
  // The image is wider than the visible figure (it includes the empty canvas).
  const imageScale = canvas.width / figure.width
  const sizes = figureSizes
    .split(',')
    .map((part) => part.trim().replace(/([\d.]+)(px|vw)$/, (_, n: string, unit: string) => `${Math.round(Number(n) * imageScale)}${unit}`))
    .join(', ')

  const style = {
    '--figure-w': width,
    '--figure-aspect': `${figure.width} / ${figure.height}`,
    '--img-w': `${(canvas.width / figure.width) * 100}%`,
    '--img-left': `${(-figure.x / figure.width) * 100}%`,
    '--img-top': `${(-figure.y / figure.height) * 100}%`,
  } as CSSProperties

  // Play each new motion once. Reduced motion: no movement at all (eyes and bubbles still work).
  const motionSeq = motion?.seq ?? 0
  useEffect(() => {
    if (!motion || !scope.current || reduceMotion) return
    const spec = koalaMotion(motion.name, motion.dir)
    if (spec) animate(scope.current, spec.keyframes, spec.options)
    // Only a new seq should replay; the motion object is otherwise stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionSeq, animate, scope, reduceMotion])

  const figureContent = (
    <div className={`koala__breath${alive && !reduceMotion ? ' is-breathing' : ''}`} data-tempo={tempo}>
      {back.map((o) => (
        <img
          key={o.id}
          className="koala__img"
          src={o.frame.src}
          srcSet={srcSet(o.frame)}
          sizes={sizes}
          alt=""
          draggable={false}
          decoding="async"
        />
      ))}
      <img
        className="koala__img"
        src={frames.base.src}
        srcSet={srcSet(frames.base)}
        sizes={sizes}
        alt=""
        draggable={false}
        decoding="async"
      />
      {blinkFrame && (
        <img
          className={`koala__img koala__img--blink${eyesShut ? ' is-soft' : ''}`}
          src={blinkFrame.src}
          srcSet={srcSet(blinkFrame)}
          sizes={sizes}
          alt=""
          draggable={false}
          decoding="async"
          style={{ opacity: blinking || eyesShut ? 1 : 0 }}
        />
      )}
      {front.map((o) => (
        <img
          key={o.id}
          className="koala__img"
          src={o.frame.src}
          srcSet={srcSet(o.frame)}
          sizes={sizes}
          alt=""
          draggable={false}
          decoding="async"
        />
      ))}
    </div>
  )

  return (
    <div className={`koala${className ? ` ${className}` : ''}`} style={style}>
      {shadow && <div className="koala__shadow" aria-hidden="true" />}
      {onTap ? (
        <button
          ref={scope}
          type="button"
          className="koala__figure koala__figure--button"
          aria-label="Koa the koala. Tap to say hi."
          onClick={onTap}
        >
          {figureContent}
        </button>
      ) : (
        <div ref={scope} className="koala__figure" role="img" aria-label="Koa the koala">
          {figureContent}
        </div>
      )}
      {children}
    </div>
  )
}
