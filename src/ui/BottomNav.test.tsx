import { House, ShoppingBag } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BottomNav, type NavItem } from './BottomNav'

const items: readonly NavItem<'home' | 'shop'>[] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
]

const render = (current: 'home' | 'shop' | null) =>
  renderToStaticMarkup(<BottomNav items={items} current={current} onSelect={() => {}} />)

describe('BottomNav', () => {
  it('marks the current tab as the page', () => {
    const html = render('shop')
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toMatch(/<a href="#\/shop" class="nav__item is-active" aria-current="page"/)
  })

  it('marks nothing on a screen outside the nav (the Wardrobe)', () => {
    const html = render(null)
    expect(html).not.toContain('aria-current')
    expect(html).not.toContain('is-active')
    expect(html).not.toContain('nav__active')
    expect(html.match(/<a /g)).toHaveLength(2)
  })
})
