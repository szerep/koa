import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AccessoryThumb } from './AccessoryThumb'
import { accessoryPreview } from './manifest'

describe('AccessoryThumb (Shop picture)', () => {
  const preview = accessoryPreview('beanie')
  if (!preview) throw new Error('the beanie has no preview')
  const html = renderToStaticMarkup(<AccessoryThumb frame={preview.frame} box={preview.box} sizes="(min-width: 600px) 18vw, 24vw" />)

  it('reuses the approved beanie frames (no separate thumbnail asset)', () => {
    expect(html).toContain('src="/characters/accessories/beanie@idle.webp"')
    expect(html).toContain('/characters/accessories/beanie@idle-512.webp 512w, /characters/accessories/beanie@idle.webp 1024w')
  })

  it('crops the frame to the beanie box', () => {
    expect(html).toContain('--thumb-aspect:443 / 320')
    expect(html).toContain(`--thumb-img-w:${(1024 / 443) * 100}%`)
    expect(html).toContain(`--thumb-img-left:${(-289 / 443) * 100}%`)
    expect(html).toContain(`--thumb-img-top:${(-456 / 320) * 100}%`)
  })

  it('scales the sizes hint to the whole frame', () => {
    expect(html).toContain('sizes="(min-width: 600px) 42vw, 55vw"')
  })

  it('is decorative: the card names the item', () => {
    expect(html).toMatch(/^<span class="accessory-thumb"[^>]*aria-hidden="true"/)
    expect(html).toContain('alt=""')
  })
})
