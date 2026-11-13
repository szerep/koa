import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Koala } from './Koala'

/** The `src` of every image in the figure, in document (= paint) order. */
function imageSources(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1])
}

const render = (props: Partial<Parameters<typeof Koala>[0]> = {}) =>
  renderToStaticMarkup(<Koala width="200px" figureSizes="200px" {...props} />)

describe('Koala accessory layering (Phase 11)', () => {
  it('draws the beanie above the base and the blink frame', () => {
    expect(imageSources(render({ wearing: ['beanie'] }))).toEqual([
      '/characters/koa_idle_neutral.webp',
      '/characters/koa_idle_blink.webp',
      '/characters/accessories/beanie@idle.webp',
    ])
  })

  it('keeps the beanie on top while the eyes are closed (blink frame shown)', () => {
    const html = render({ wearing: ['beanie'], eyesClosed: true })
    expect(imageSources(html)).toEqual([
      '/characters/koa_idle_neutral.webp',
      '/characters/koa_idle_blink.webp',
      '/characters/accessories/beanie@idle.webp',
    ])
    expect(html).toMatch(/<img class="koala__img koala__img--blink is-soft"[^>]*style="opacity:1"/)
  })

  it('offers both beanie sizes and keeps it decorative', () => {
    const beanie = render({ wearing: ['beanie'] }).match(/<img\b[^>]*beanie@idle\.webp"[^>]*>/)?.[0]
    expect(beanie).toContain(
      'srcSet="/characters/accessories/beanie@idle-512.webp 512w, /characters/accessories/beanie@idle.webp 1024w"',
    )
    expect(beanie).toContain('alt=""')
  })

  it('draws nothing for items without artwork', () => {
    expect(imageSources(render({ wearing: ['round-glasses', 'cap'] }))).toEqual([
      '/characters/koa_idle_neutral.webp',
      '/characters/koa_idle_blink.webp',
    ])
  })
})
