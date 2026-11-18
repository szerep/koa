import { expect, test, type Page } from '@playwright/test'
import {
  MINUTE,
  advance,
  button,
  closetTile,
  expectNoErrors,
  goTo,
  mainNav,
  openKoa,
  runSession,
  startSession,
  typeSetting,
  wardrobeHeading,
  type TabName,
} from './support/koa.ts'

/**
 * Phase 10 Step 2 (accessibility pass): what only a real browser can show. The rules behind these
 * (titles, coin wording) are unit-tested; Lighthouse/axe covers the static ARIA checks.
 */

test.afterEach(({ page }) => expectNoErrors(page))

const TABS: readonly TabName[] = ['Home', 'Shop', 'Stats', 'Settings']

/** Buys with the keyboard: focus stays on the card's button from the price to "Wearing". */
async function buy(page: Page, name: string, price: number) {
  await page.getByRole('button', { name: `Buy ${name} for ${price} coins` }).press('Enter')
  await expect(page.getByRole('button', { name: `Buy for ${price}?` })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: `Wearing the ${name.toLowerCase()}`, exact: true })).toBeFocused()
}

async function scrollsSideways(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

test.describe('accessibility', () => {
  test('every screen has one level-1 heading and its own page title', async ({ page }) => {
    await openKoa(page)
    const screens: [TabName, string, string][] = [
      ['Shop', 'Shop · Koa', 'Shop'],
      ['Stats', 'Stats · Koa', 'Your study journal'],
      ['Settings', 'Settings · Koa', 'Settings'],
      ['Home', 'Koa', 'Timer'],
    ]
    await expect(page).toHaveTitle('Koa')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Timer')
    for (const [tab, title, heading] of screens) {
      await goTo(page, tab)
      await expect(page).toHaveTitle(title)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    }

    // A running session shows its countdown on every tab; when it ends, the tab's own title
    // comes back (it used to fall back to plain "Koa").
    await startSession(page)
    await expect(page).toHaveTitle('25:00 Focus · Koa')
    await goTo(page, 'Shop')
    await expect(page).toHaveTitle('25:00 Focus · Koa')
    await advance(page, 25 * MINUTE)
    await expect(page).toHaveTitle('Shop · Koa')
  })

  test('shop buttons say which item they act on, and prices are read with their unit', async ({ page }) => {
    await openKoa(page)
    await goTo(page, 'Shop')
    await expect(page.getByRole('article').filter({ hasText: 'Sage beanie' })).toContainText('120 coins,')

    // Own two hats, so two Wear/Wearing buttons are on screen: a 120-minute session pays
    // 120 + 50 (daily goal) for the beanie (120); the next one pays 120 more for the cap (150).
    await goTo(page, 'Settings')
    await typeSetting(page, 'Focus', 120)
    await goTo(page, 'Home')
    await runSession(page, 120)
    await goTo(page, 'Shop')
    await buy(page, 'Sage beanie', 120)

    await goTo(page, 'Home')
    await runSession(page, 5) // the short break
    await runSession(page, 120)
    await goTo(page, 'Shop')
    await buy(page, 'Sand cap', 150) // replaces the beanie: one hat at a time

    const hats = page.getByRole('list', { name: 'Hats for Koa' })
    await expect(hats.getByRole('button', { name: 'Wear the sage beanie', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await expect(hats.getByRole('button', { name: 'Wearing the sand cap', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('the layout reflows without sideways scrolling on narrow and zoomed screens', async ({ page }) => {
    await openKoa(page)
    // A small phone, a 1280×1024 desktop window at 400% zoom (WCAG 1.4.10), and an old 568-px
    // phone in landscape, which gets the single-column layout because the rail layout doesn't fit.
    for (const viewport of [{ width: 320, height: 568 }, { width: 320, height: 256 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(viewport)
      for (const tab of TABS) {
        await goTo(page, tab)
        await expect.poll(() => scrollsSideways(page), `${tab} at ${viewport.width}×${viewport.height}`).toBe(false)
      }
    }
  })

  test('the Wardrobe: its own heading and title, keyboard focus in and back, toggles that keep focus, and no sideways scroll', async ({ page }) => {
    await openKoa(page)
    await goTo(page, 'Settings')
    await typeSetting(page, 'Focus', 120)
    await goTo(page, 'Home')
    await runSession(page, 120)
    await goTo(page, 'Shop')
    await buy(page, 'Sage beanie', 120)

    // From the Shop: focus moves to the Wardrobe's heading, and Done brings it back.
    await button(page, 'Open wardrobe').press('Enter')
    await expect(wardrobeHeading(page)).toBeFocused()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wardrobe')
    await expect(page).toHaveTitle('Wardrobe · Koa')
    await expect(mainNav(page).locator('[aria-current]')).toHaveCount(0)

    // A tile is a toggle: Space takes the beanie off and focus stays on the same tile.
    const beanie = closetTile(page, 'Head', 'Sage beanie')
    await expect(beanie).toHaveAttribute('aria-pressed', 'true')
    await beanie.press('Space')
    await expect(beanie).toHaveAttribute('aria-pressed', 'false')
    await expect(beanie).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: 'Took off the sage beanie.' })).toBeAttached()
    await page.keyboard.press('Enter')
    await expect(beanie).toHaveAttribute('aria-pressed', 'true')
    await expect(beanie).toBeFocused()

    await button(page, 'Done').press('Enter')
    await expect(button(page, 'Open wardrobe')).toBeFocused()

    // From Home: the same, back to the shirt button.
    await goTo(page, 'Home')
    await button(page, 'Open the wardrobe').press('Enter')
    await expect(wardrobeHeading(page)).toBeFocused()
    await button(page, 'Done').press('Enter')
    await expect(button(page, 'Open the wardrobe')).toBeFocused()

    // Narrow and zoomed screens reflow without sideways scrolling, with items and while empty.
    await button(page, 'Open the wardrobe').click()
    for (const viewport of [{ width: 320, height: 568 }, { width: 320, height: 256 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(viewport)
      await expect(wardrobeHeading(page)).toBeVisible()
      await expect.poll(() => scrollsSideways(page), `Wardrobe at ${viewport.width}×${viewport.height}`).toBe(false)
      await expect(button(page, 'Done')).toBeInViewport()
    }
  })

  test('a phone in landscape keeps the side rail', async ({ page }) => {
    await openKoa(page)
    // The smallest current iPhone in landscape (iPhone SE, 2nd and 3rd generation).
    await page.setViewportSize({ width: 667, height: 375 })
    await expect
      .poll(async () => {
        const box = await mainNav(page).boundingBox()
        return box !== null && box.height > box.width
      })
      .toBe(true)
    expect(await scrollsSideways(page)).toBe(false)
  })
})
