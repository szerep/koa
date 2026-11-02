import { useEffect, useState, type CSSProperties } from 'react'
import { useAnimate, useReducedMotion } from 'motion/react'
import { accessoryArt, HOUSE_GRID, koalaPoses, type KoalaFrame, type KoalaPoseName } from './manifest'
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
  /** Tap to squish. */
  interactive?: boolean
  /** Draw the soft contact shadow under the feet. */
  shadow?: boolean
  /** Increment to make Koa do a happy little hop (e.g. when coins are earned). */
  hop?: number
  /** Ids of equipped items. Items without artwork for this pose are not drawn. */
  wearing?: readonly string[]
  className?: string
}

const BLINK_MS = 140

function useBlink(enabled: boolean) {
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let timer: number | undefined

    const schedule = () => {
      const wait = 3000 + Math.random() * 4000
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
  }, [enabled])

  return closed
}

function srcSet(frame: KoalaFrame) {
  return `${frame.srcSmall} 512w, ${frame.src} 1024w`
}

export function Koala({
  pose = 'idle',
  width,
  figureSizes,
  alive = true,
  interactive = false,
  shadow = true,
  hop = 0,
  wearing = [],
  className,
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
  const blinking = useBlink(alive && Boolean(blinkFrame))
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

  useEffect(() => {
    if (hop === 0 || !scope.current || reduceMotion) return
    animate(
      scope.current,
      { y: [0, -22, 0, -6, 0], scaleY: [1, 1.04, 0.94, 1.01, 1], scaleX: [1, 0.97, 1.05, 1, 1] },
      { duration: 0.75, ease: 'easeOut', delay: 0.1 },
    )
  }, [hop, animate, scope, reduceMotion])

  const squish = () => {
    if (!scope.current) return
    if (reduceMotion) return
    animate(
      scope.current,
      { scaleX: [1, 1.06, 0.98, 1], scaleY: [1, 0.92, 1.03, 1] },
      { duration: 0.5, ease: 'easeOut' },
    )
  }

  const figureContent = (
    <div className={`koala__breath${alive && !reduceMotion ? ' is-breathing' : ''}`}>
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
          className="koala__img koala__img--blink"
          src={blinkFrame.src}
          srcSet={srcSet(blinkFrame)}
          sizes={sizes}
          alt=""
          draggable={false}
          decoding="async"
          style={{ opacity: blinking ? 1 : 0 }}
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
      {interactive ? (
        <button
          ref={scope}
          type="button"
          className="koala__figure koala__figure--button"
          aria-label="Koa the koala. Tap to say hi."
          onClick={squish}
        >
          {figureContent}
        </button>
      ) : (
        <div ref={scope} className="koala__figure" role="img" aria-label="Koa the koala">
          {figureContent}
        </div>
      )}
    </div>
  )
}
