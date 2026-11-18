import { expect, test, type Page } from '@playwright/test'
import {
  button,
  closetTile,
  expectCoins,
  expectNoErrors,
  goTo,
  mainNav,
  openKoa,
  openWardrobe,
  reload,
  runSession,
  startSession,
  typeSetting,
  wardrobeHeading,
} from './support/koa.ts'

/**
 * Phase 12: the Wardrobe (`#/wardrobe`), where Koa is dressed in what you own. Reached from Home
 * and the Shop, not a tab. Details: docs/phase-12/wardrobe-plan.md.
 */

test.afterEach(({ page }) => expectNoErrors(page))

const koa = (page: Page) => page.getByRole('button', { name: 'Koa the koala. Tap to say hi.' })
/** The overlay frames of one accessory that Koa is wearing (idle and blink). */
const wornArt = (page: Page, id: string) => koa(page).locator(`img[src^="/characters/accessories/${id}@"]`)
const status = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text })
const itemCard = (page: Page, name: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })

async function expectNoCurrentTab(page: Page) {
  await expect(mainNav(page).locator('[aria-current]')).toHaveCount(0)
}

async function expectCurrentTab(page: Page, tab: string) {
  await expect(mainNav(page).getByRole('link', { name: tab, exact: true })).toHaveAttribute('aria-current', 'page')
}

/** Earns 170 coins the way a user would: one 120-minute focus session (120) that also meets the daily goal (+50). */
async function earn170(page: Page) {
  await goTo(page, 'Settings')
  await typeSetting(page, 'Focus', 120)
  await goTo(page, 'Home')
  await runSession(page, 120)
  await expectCoins(page, 170)
}

/**
 * Buys an item in the Shop with the two-step flow (it's worn right away), using the keyboard like
 * the accessibility spec: a pointer click first waits for the changed button to stop moving, and
 * in a loaded WebKit run that wait plus the first click can outlast the Shop's 3.5 s confirmation
 * window (the Step 0 flake; see docs/phase-12/wardrobe-plan.md §7).
 */
async function buy(page: Page, category: string, name: string, price: number) {
  await goTo(page, 'Shop')
  const option = page.getByRole('radiogroup', { name: 'Item category' }).getByRole('radio', { name: category })
  await option.click()
  await expect(option).toHaveAttribute('aria-checked', 'true')
  const card = itemCard(page, name)
  await card.getByRole('button', { name: `Buy ${name} for ${price} coins` }).press('Enter')
  await expect(card.getByRole('button', { name: `Buy for ${price}?` })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(status(page, `${name} is yours. Koa is wearing it now.`)).toBeVisible()
}

test.describe('wardrobe', () => {
  // These journeys earn and spend coins the real way first. In a full parallel run WebKit takes
  // 30–55 s for them (the whole WebKit project slows down, existing journeys included), close to
  // the 60 s limit, so they get the slow-test allowance there. Nothing in them waits on a timer.
  test.slow(({ browserName }) => browserName === 'webkit', 'WebKit is slow in a full parallel run')

  test('with nothing owned, the Wardrobe is empty and leads to the Shop', async ({ page }) => {
    await openKoa(page)
    // The Shop offers the Wardrobe only once something is owned; Home always does.
    await goTo(page, 'Shop')
    await expect(page.getByRole('heading', { level: 1, name: 'Shop' })).toBeVisible()
    await expect(button(page, 'Open wardrobe')).toHaveCount(0)

    await goTo(page, 'Home')
    await openWardrobe(page, 'Home')
    await expect(page).toHaveTitle('Wardrobe · Koa')
    await expectNoCurrentTab(page)
    await expect(page.getByText('Nothing to try on yet', { exact: true })).toBeVisible()
    await expect(page.getByText('Things you buy in the Shop end up here, ready for Koa to wear.')).toBeVisible()
    await expect(koa(page)).toBeVisible()
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0)

    await button(page, 'Visit the Shop').click()
    await expect(page.getByRole('heading', { level: 1, name: 'Shop' })).toBeVisible()
    await expectCurrentTab(page, 'Shop')
    await expect(page).toHaveTitle('Shop · Koa')
  })

  test('buy the beanie, open the Wardrobe, take it off, reload, wear it again, and Done shows it on Home', async ({ page }) => {
    await openKoa(page)
    await earn170(page)
    await buy(page, 'Hats', 'Sage beanie', 120)

    await openWardrobe(page, 'Shop')
    const beanie = closetTile(page, 'Head', 'Sage beanie')
    await expect(beanie).toHaveAccessibleName('Wearing the sage beanie')
    await expect(beanie).toHaveAttribute('aria-pressed', 'true')
    // Its own artwork (a crop of the frame Koa wears), not the swatch, and no "coming soon".
    await expect(beanie.locator('img[src="/characters/accessories/beanie@idle.webp"]')).toHaveJSProperty('complete', true)
    await expect(beanie).not.toContainText('Artwork coming soon')
    await expect(page.getByText('Artwork for some items is still being made.', { exact: false })).toHaveCount(0)
    await expect(wornArt(page, 'beanie').first()).toBeVisible()

    // Take it off: no coins change, it stays owned, and Koa no longer wears it.
    await beanie.click()
    await expect(status(page, 'Took off the sage beanie.')).toBeAttached()
    await expect(beanie).toHaveAccessibleName('Wear the sage beanie')
    await expect(beanie).toHaveAttribute('aria-pressed', 'false')
    await expect(wornArt(page, 'beanie')).toHaveCount(0)
    await expectCoins(page, 50)

    // A reload stays on the Wardrobe, with the beanie still owned and still off.
    await reload(page)
    await expect(wardrobeHeading(page)).toBeVisible()
    await expect(beanie).toHaveAttribute('aria-pressed', 'false')
    await expect(wornArt(page, 'beanie')).toHaveCount(0)

    // Wear it again (Koa shows it off).
    await beanie.click()
    await expect(status(page, 'Koa is wearing the sage beanie.')).toBeAttached()
    await expect(beanie).toHaveAttribute('aria-pressed', 'true')
    await expect(wornArt(page, 'beanie').first()).toBeVisible()
    await expectCoins(page, 50)

    // After a reload the opener is unknown, so Done goes Home, where Koa wears the beanie.
    await button(page, 'Done').click()
    await expect(page.getByRole('heading', { level: 1, name: 'Timer' })).toBeAttached()
    await expectCurrentTab(page, 'Home')
    await expect(wornArt(page, 'beanie').first()).toBeVisible()
  })

  test('the Home entry is hidden while a focus session runs or is paused, and shown otherwise', async ({ page }) => {
    await openKoa(page)
    const entry = button(page, 'Open the wardrobe')
    await expect(entry).toBeVisible()

    await startSession(page)
    await expect(entry).toHaveCount(0)
    await button(page, 'Pause').click()
    await expect(button(page, 'Resume')).toBeVisible()
    await expect(entry).toHaveCount(0)
    await button(page, 'Reset timer').click()
    await expect(button(page, 'Start')).toBeVisible()
    await expect(entry).toBeVisible()

    // A finished focus session leads to a break: waiting or running, the entry is there.
    await runSession(page, 25)
    await expect(button(page, 'Start break')).toBeVisible()
    await expect(entry).toBeVisible()
    await startSession(page)
    await expect(entry).toBeVisible()
    await openWardrobe(page, 'Home')
    await expect(page).toHaveTitle(/^\d+:\d\d Short break · Koa$/)
  })

  test('an item without artwork is listed honestly, can be worn and taken off, and that is saved', async ({ page }) => {
    await openKoa(page)
    await earn170(page)
    await buy(page, 'Extras', 'Daisy', 80)

    await openWardrobe(page, 'Shop')
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Ear'])
    const daisy = closetTile(page, 'Ear', 'Daisy')
    await expect(daisy).toHaveAttribute('aria-pressed', 'true')
    await expect(daisy).toContainText('Artwork coming soon')
    await expect(daisy).toHaveAccessibleDescription('Artwork coming soon')
    await expect(daisy.locator('img')).toHaveCount(0)
    await expect(page.getByText("Artwork for some items is still being made. Koa can wear them, but can't show them off yet.")).toBeVisible()
    // Nothing is drawn on Koa for it: there is no art yet.
    await expect(wornArt(page, 'daisy')).toHaveCount(0)

    await daisy.click()
    await expect(status(page, 'Took off the daisy.')).toBeAttached()
    await expect(daisy).toHaveAttribute('aria-pressed', 'false')
    // The note stays while the daisy is owned, so the tiles never jump.
    await expect(page.getByText('Artwork for some items is still being made.', { exact: false })).toBeVisible()

    await reload(page)
    await expect(daisy).toHaveAttribute('aria-pressed', 'false')
    await daisy.click()
    await expect(status(page, 'Koa is wearing the daisy.')).toBeAttached()
    await reload(page)
    await expect(daisy).toHaveAttribute('aria-pressed', 'true')
    await expectCoins(page, 90)

    // The Shop agrees.
    await goTo(page, 'Shop')
    await expect(page.getByRole('list', { name: 'Koa is wearing' }).getByRole('button', { name: 'Take off the daisy' })).toBeVisible()
  })

  test('a direct load, Done, the back gesture, nav tabs and titles', async ({ page }) => {
    await openKoa(page)

    // Loaded directly: the title is the Wardrobe's, no tab is current, and focus isn't moved.
    await page.goto('/#/wardrobe')
    await expect(wardrobeHeading(page)).toBeVisible()
    await expect(page).toHaveTitle('Wardrobe · Koa')
    await expectNoCurrentTab(page)
    await expect(wardrobeHeading(page)).not.toBeFocused()

    // Done (opener unknown) goes Home as a new history entry: back returns to the Wardrobe.
    await button(page, 'Done').click()
    await expect(page).toHaveURL(/#\/home$/)
    await expectCurrentTab(page, 'Home')
    await expect(page).toHaveTitle('Koa')
    await page.goBack()
    await expect(wardrobeHeading(page)).toBeVisible()
    await expectNoCurrentTab(page)

    // A nav tab leaves the Wardrobe like any tab.
    await goTo(page, 'Stats')
    await expect(page).toHaveTitle('Stats · Koa')

    // Opened from Home, the back gesture returns there; opened again, Done does too.
    await goTo(page, 'Home')
    await openWardrobe(page, 'Home')
    await page.goBack()
    await expect(page).toHaveURL(/#\/home$/)
    await expectCurrentTab(page, 'Home')
    await openWardrobe(page, 'Home')
    await button(page, 'Done').click()
    await expect(page).toHaveURL(/#\/home$/)
    // Done adds an entry instead of going back: back from Home shows the Wardrobe again.
    await page.goBack()
    await expect(wardrobeHeading(page)).toBeVisible()
  })

  test('opened from the Shop, Done goes back to the Shop', async ({ page }) => {
    await openKoa(page)
    await earn170(page)
    await buy(page, 'Hats', 'Sage beanie', 120)

    await openWardrobe(page, 'Shop')
    await expectNoCurrentTab(page)
    await button(page, 'Done').click()
    await expect(page).toHaveURL(/#\/shop$/)
    await expectCurrentTab(page, 'Shop')
    await expect(page).toHaveTitle('Shop · Koa')

    // The back gesture from a Shop-opened Wardrobe returns to the Shop too.
    await openWardrobe(page, 'Shop')
    await page.goBack()
    await expect(page).toHaveURL(/#\/shop$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Shop' })).toBeVisible()
  })
})
