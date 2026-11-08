import { expect, test, type Page } from '@playwright/test'
import { expectCoins, expectNoErrors, goTo, openKoa, reload, runSession, typeSetting } from './support/koa.ts'

test.afterEach(({ page }) => expectNoErrors(page))

const itemCard = (page: Page, name: string) =>
  page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })

async function openCategory(page: Page, category: string) {
  const option = page.getByRole('radiogroup', { name: 'Item category' }).getByRole('radio', { name: category })
  await option.click()
  await expect(option).toHaveAttribute('aria-checked', 'true')
}

/** Earns 170 coins the way a user would: one 120-minute focus session (120) that also meets the daily goal (+50). */
async function earn170(page: Page) {
  await goTo(page, 'Settings')
  await typeSetting(page, 'Focus', 120)
  await goTo(page, 'Home')
  await runSession(page, 120)
  await expectCoins(page, 170)
}

test.describe('shop', () => {
  test('items you can’t afford show how many coins are missing', async ({ page }) => {
    await openKoa(page)
    await goTo(page, 'Shop')
    await expect(page.getByText("Koa isn't wearing anything special yet.", { exact: false })).toBeVisible()

    const beanie = itemCard(page, 'Sage beanie')
    await expect(beanie).toContainText('120 to go')
    await expect(beanie.getByRole('button')).toHaveCount(0)

    await openCategory(page, 'Extras')
    await expect(itemCard(page, 'Daisy')).toContainText('80 to go')
  })

  test('buying takes two taps, puts the item on Koa, and ownership and outfit survive reloads', async ({ page }) => {
    await openKoa(page)
    await earn170(page)

    await goTo(page, 'Shop')
    await openCategory(page, 'Extras')
    const daisy = itemCard(page, 'Daisy')

    await daisy.getByRole('button', { name: 'Buy Daisy for 80 coins' }).click()
    // The first tap only asks; nothing is spent yet.
    await expectCoins(page, 170)
    await daisy.getByRole('button', { name: 'Buy for 80?' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Daisy is yours. Koa is wearing it now.' })).toBeVisible()
    await expectCoins(page, 90)
    await expect(daisy).toContainText('Owned')
    await expect(daisy.getByRole('button', { name: 'Wearing the daisy', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const wearing = page.getByRole('list', { name: 'Koa is wearing' })
    await expect(wearing.getByRole('button', { name: 'Take off the daisy' })).toBeVisible()

    // Other prices now count from the new balance.
    await openCategory(page, 'Hats')
    await expect(itemCard(page, 'Sage beanie')).toContainText('30 to go')

    await reload(page)
    await expectCoins(page, 90)
    await openCategory(page, 'Extras')
    await expect(daisy.getByRole('button', { name: 'Wearing the daisy', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(wearing.getByRole('button', { name: 'Take off the daisy' })).toBeVisible()

    // Taking it off keeps it owned, and that survives a reload too.
    await wearing.getByRole('button', { name: 'Take off the daisy' }).click()
    await expect(daisy.getByRole('button', { name: 'Wear the daisy', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await expect(wearing).toHaveCount(0)

    await reload(page)
    await openCategory(page, 'Extras')
    await expect(daisy).toContainText('Owned')
    await expect(daisy.getByRole('button', { name: 'Wear the daisy', exact: true })).toBeVisible()
    await expectCoins(page, 90)

    await daisy.getByRole('button', { name: 'Wear the daisy', exact: true }).click()
    await expect(daisy.getByRole('button', { name: 'Wearing the daisy', exact: true })).toHaveAttribute('aria-pressed', 'true')
    // Wearing again is free.
    await expectCoins(page, 90)
  })
})
