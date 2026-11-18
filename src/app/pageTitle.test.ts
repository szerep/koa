import { describe, expect, it } from 'vitest'
import { pageTitle } from './pageTitle'

const tabs = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
  { id: 'settings', label: 'Settings' },
] as const

describe('pageTitle', () => {
  it('is just the app name on the first tab', () => {
    expect(pageTitle('home', tabs)).toBe('Koa')
  })

  it('names the screen first on the other tabs', () => {
    expect(pageTitle('shop', tabs)).toBe('Shop · Koa')
    expect(pageTitle('settings', tabs)).toBe('Settings · Koa')
  })

  it('shows the countdown while a session runs, on any tab', () => {
    expect(pageTitle('home', tabs, '24:59 Focus')).toBe('24:59 Focus · Koa')
    expect(pageTitle('shop', tabs, '04:10 Short break')).toBe('04:10 Short break · Koa')
  })

  it('goes back to the tab title when no session runs', () => {
    expect(pageTitle('shop', tabs, null)).toBe('Shop · Koa')
  })

  it('names a screen outside the nav (the Wardrobe) the same way', () => {
    const routes = [...tabs, { id: 'wardrobe', label: 'Wardrobe' }] as const
    expect(pageTitle('wardrobe', routes)).toBe('Wardrobe · Koa')
    expect(pageTitle('wardrobe', routes, '24:59 Focus')).toBe('24:59 Focus · Koa')
  })

  it('falls back to the app name for an unknown tab', () => {
    expect(pageTitle('nowhere' as 'home', tabs)).toBe('Koa')
  })
})
