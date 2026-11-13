import type { CSSProperties } from 'react'
import { HOUSE_GRID, type FigureBox, type KoalaFrame } from './manifest'
import './accessory-thumb.css'

interface AccessoryThumbProps {
  frame: KoalaFrame
  /** The item's area in the frame (canvas pixels). Only this part is shown. */
  box: FigureBox
  /** Approximate rendered width of the thumbnail, as a `sizes` value. */
  sizes: string
}

/**
 * An item's picture in the Shop: a crop of its approved overlay frame (the same file Koa
 * wears), so no separate thumbnail asset exists. Decorative: the card names the item.
 */
export function AccessoryThumb({ frame, box, sizes }: AccessoryThumbProps) {
  const { width, height } = HOUSE_GRID.canvas
  const scale = width / box.width
  const style = {
    '--thumb-aspect': `${box.width} / ${box.height}`,
    '--thumb-img-w': `${scale * 100}%`,
    '--thumb-img-left': `${(-box.x / box.width) * 100}%`,
    '--thumb-img-top': `${(-box.y / box.height) * 100}%`,
  } as CSSProperties
  // The image is wider than the crop: scale the `sizes` hint by the same factor.
  const imageSizes = sizes
    .split(',')
    .map((part) => part.trim().replace(/([\d.]+)(px|vw)$/, (_, n: string, unit: string) => `${Math.round(Number(n) * scale)}${unit}`))
    .join(', ')

  return (
    <span className="accessory-thumb" style={style} aria-hidden="true">
      <img
        className="accessory-thumb__img"
        src={frame.src}
        srcSet={`${frame.srcSmall} 512w, ${frame.src} 1024w`}
        sizes={imageSizes}
        width={width}
        height={height}
        alt=""
        draggable={false}
        decoding="async"
        loading="lazy"
      />
    </span>
  )
}
