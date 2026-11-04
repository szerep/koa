import { expect, test } from '@playwright/test'
import {
  expectCoins,
  expectNoErrors,
  expectTimer,
  goTo,
  mainNav,
  mode,
  modeGroup,
  openKoa,
  reload,
} from './support/koa.ts'

test.afterEach(({ page }) => expectNoErrors(page))

test.describe('app shell', () => {
  test('loads on Home with a fresh, ready-to-start focus session', async ({ page }) => {
    await openKoa(page)

    await expect(page).toHaveTitle(/Koa/)
    await expect(mainNav(page).getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page')
    await expectCoins(page, 0)

    await expect(mode(page, 'Focus')).toHaveAttribute('aria-checked', 'true')
    await expectTimer(page, '25:00')
    await expect(page.getByText('Session 1 of 4', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeEnabled()
    // Nothing to reset before a session starts.
    await expect(page.getByRole('button', { name: 'Reset timer' })).toBeDisabled()

    // Koa herself is a real illustration, loaded from the approved frames.
    const koa = page.getByRole('main').locator('img[src*="/characters/"]').first()
    await expect(koa).toBeVisible()
    await expect.poll(() => koa.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  })

  test('the nav reaches every tab and keeps the tab in the address for reload and back', async ({ page }) => {
    await openKoa(page)

    await goTo(page, 'Shop')
    await expect(page).toHaveURL(/#\/shop$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Shop' })).toBeVisible()
    await goTo(page, 'Stats')
    // A fresh install shows the empty journal, which leads back to Home.
    await expect(page.getByText('Your study journal')).toBeVisible()
    await goTo(page, 'Settings')
    await expect(page).toHaveURL(/#\/settings$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()

    await reload(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(/#\/stats$/)
    await page.getByRole('button', { name: 'Start focusing' }).click()
    await expect(page).toHaveURL(/#\/home$/)
    await expectTimer(page, '25:00')
  })

  test('an unknown address falls back to Home', async ({ page }) => {
    await openKoa(page)
    await page.goto('/#/nowhere')
    await expect(mainNav(page).getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page')
    await expectTimer(page, '25:00')
  })

  test('the nav and the timer mode work from the keyboard', async ({ page }) => {
    await openKoa(page)

    // Mode chips are a radio group: arrow keys move the choice, and the timer follows.
    await mode(page, 'Focus').focus()
    await page.keyboard.press('ArrowRight')
    await expect(mode(page, 'Short break')).toBeFocused()
    await expect(mode(page, 'Short break')).toHaveAttribute('aria-checked', 'true')
    await expectTimer(page, '05:00')
    await page.keyboard.press('ArrowRight')
    await expectTimer(page, '20:00')
    await page.keyboard.press('ArrowRight')
    await expect(mode(page, 'Focus')).toHaveAttribute('aria-checked', 'true')
    await expectTimer(page, '25:00')

    // A nav link opens its tab with Enter.
    const shop = mainNav(page).getByRole('link', { name: 'Shop', exact: true })
    await shop.focus()
    await page.keyboard.press('Enter')
    await expect(shop).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { level: 1, name: 'Shop' })).toBeVisible()
    await expect(modeGroup(page)).toHaveCount(0)
  })
})
