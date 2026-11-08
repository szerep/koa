import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CoinPill } from './CoinPill'

const format = new Intl.NumberFormat()

/** What assistive technology can read: the markup without aria-hidden subtrees, as plain text. */
function exposedText(html: string): string {
  return html
    .replace(/<(\w+)\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}

describe('CoinPill accessibility', () => {
  it('names the balance with text inside the pill, not an aria-label on a plain div', () => {
    const html = renderToStaticMarkup(<CoinPill coins={1250} />)
    expect(html).not.toContain('aria-label')
    expect(html).toContain(`<span class="visually-hidden">${format.format(1250)} coins</span>`)
  })

  it('exposes only the balance: the glyph and the animated number are hidden', () => {
    const html = renderToStaticMarkup(<CoinPill coins={1250} />)
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/)
    expect(html).toMatch(/<span class="coin-pill__value" aria-hidden="true">/)
    expect(exposedText(html)).toBe(`${format.format(1250)} coins`)
  })

  it('announces the actual balance, including zero and a single coin', () => {
    expect(exposedText(renderToStaticMarkup(<CoinPill coins={0} />))).toBe('0 coins')
    expect(exposedText(renderToStaticMarkup(<CoinPill coins={1} />))).toBe('1 coin')
    expect(exposedText(renderToStaticMarkup(<CoinPill coins={25} countUpDelayMs={900} />))).toBe('25 coins')
  })

  it('keeps the flying-coin target and the visible number unchanged', () => {
    const html = renderToStaticMarkup(<CoinPill coins={1250} />)
    expect(html).toMatch(/^<div class="coin-pill" data-coin-target="true">/)
    expect(html).toContain(`aria-hidden="true">${format.format(1250)}</span>`)
  })
})
