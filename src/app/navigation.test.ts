import { describe, expect, it } from 'vitest'
import { createWardrobeNavigation, isTab, returnTarget, ROUTES, TABS, type Route } from './navigation'

/** A navigation that records where it went, with the app reporting each arrival like App.tsx. */
function setup() {
  const visited: Route[] = []
  const nav = createWardrobeNavigation((route) => {
    visited.push(route)
    nav.arrived(route)
  })
  return { nav, visited }
}

describe('routes', () => {
  it('has the four nav tabs plus the Wardrobe, which is not a tab', () => {
    expect(TABS).toEqual(['home', 'shop', 'stats', 'settings'])
    expect(ROUTES).toEqual(['home', 'shop', 'stats', 'settings', 'wardrobe'])
    expect(isTab('shop')).toBe(true)
    expect(isTab('wardrobe')).toBe(false)
    expect(isTab(undefined)).toBe(false)
  })

  it('returns to a known tab, and Home for anything else', () => {
    expect(returnTarget('shop')).toBe('shop')
    expect(returnTarget('home')).toBe('home')
    expect(returnTarget('wardrobe')).toBe('home')
    expect(returnTarget('nowhere')).toBe('home')
    expect(returnTarget(null)).toBe('home')
  })
})

describe('wardrobe navigation', () => {
  it('Done goes back to where the Wardrobe was opened from', () => {
    const { nav, visited } = setup()
    nav.open('shop')
    nav.close()
    expect(visited).toEqual(['wardrobe', 'shop'])
    nav.open('home')
    nav.close()
    expect(visited.slice(2)).toEqual(['wardrobe', 'home'])
  })

  it('Done goes Home when the Wardrobe was loaded directly', () => {
    const { nav, visited } = setup()
    nav.arrived('wardrobe') // e.g. a reload on #/wardrobe
    nav.close()
    expect(visited).toEqual(['home'])
  })

  it('forgets the origin when the Wardrobe is left another way', () => {
    const { nav, visited } = setup()
    nav.open('shop')
    nav.arrived('stats') // a nav tab
    nav.arrived('wardrobe') // back again through history
    nav.close()
    expect(visited).toEqual(['wardrobe', 'home'])
  })

  it('remembers only one trip: a second Done (without opening again) goes Home', () => {
    const { nav, visited } = setup()
    nav.open('shop')
    nav.close()
    nav.arrived('wardrobe') // forward through history
    nav.close()
    expect(visited).toEqual(['wardrobe', 'shop', 'home'])
  })

  it('Visit the Shop goes to the Shop and does not come back', () => {
    const { nav, visited } = setup()
    nav.open('home')
    nav.visit('shop')
    expect(visited).toEqual(['wardrobe', 'shop'])
    expect(nav.takeFocus('shop')).toBe(false)
  })
})

describe('keyboard focus between the Wardrobe and its openers', () => {
  it('moves to the Wardrobe when opened, once', () => {
    const { nav } = setup()
    nav.open('home')
    expect(nav.takeFocus('home')).toBe(false)
    expect(nav.takeFocus('wardrobe')).toBe(true)
    expect(nav.takeFocus('wardrobe')).toBe(false)
  })

  it('returns to the opener after Done, once', () => {
    const { nav } = setup()
    nav.open('shop')
    nav.takeFocus('wardrobe')
    nav.close()
    expect(nav.takeFocus('wardrobe')).toBe(false)
    expect(nav.takeFocus('shop')).toBe(true)
    expect(nav.takeFocus('shop')).toBe(false)
  })

  it('lapses when the user goes somewhere else first', () => {
    const { nav } = setup()
    nav.open('home')
    nav.arrived('settings') // left before the Wardrobe took focus
    expect(nav.takeFocus('wardrobe')).toBe(false)
    nav.open('home')
    nav.takeFocus('wardrobe')
    nav.close()
    nav.arrived('stats')
    expect(nav.takeFocus('home')).toBe(false)
  })

  it('never focuses anything on a plain visit to a screen', () => {
    const { nav } = setup()
    nav.arrived('home')
    expect(nav.takeFocus('home')).toBe(false)
  })
})
