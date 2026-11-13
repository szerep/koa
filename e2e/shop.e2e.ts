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

    // The first tap only asks; nothing is spent yet. A double-tap counts as one tap: its second
    // tap used to land on "Buy for 80?" and buy without asking.
    await daisy.getByRole('button', { name: 'Buy Daisy for 80 coins' }).dblclick()
    await expect(daisy.getByRole('button', { name: 'Buy for 80?' })).toBeVisible()
    await expectCoins(page, 170)
    // Likewise, double-tapping the confirmation buys once and leaves the daisy on.
    await daisy.getByRole('button', { name: 'Buy for 80?' }).dblclick()

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

  test('the beanie shows its own artwork in the shop and on Koa, and Koa’s speech clears the pom-pom', async ({ page }) => {
    await openKoa(page)
    await earn170(page)
    await goTo(page, 'Shop')

    // Its card shows the approved beanie art (a crop of the frame Koa wears), not the swatch.
    const beanie = itemCard(page, 'Sage beanie')
    const picture = beanie.locator('.accessory-thumb img')
    await expect(picture).toHaveAttribute('src', '/characters/accessories/beanie@idle.webp')
    await expect(picture).toHaveJSProperty('complete', true)
    await expect(beanie.locator('.item-card__swatch')).toHaveCount(0)
    await expect(beanie).not.toContainText('Artwork coming soon')
    // Items without art keep their swatch and label.
    await expect(itemCard(page, 'Sand cap').locator('.item-card__swatch')).toHaveCount(1)
    await expect(itemCard(page, 'Sand cap')).toContainText('Artwork coming soon')

    await beanie.getByRole('button', { name: 'Buy Sage beanie for 120 coins' }).click()
    await beanie.getByRole('button', { name: 'Buy for 120?' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Sage beanie is yours. Koa is wearing it now.' })).toBeVisible()
    await expect(beanie).toContainText('Owned')
    await expect(picture).toBeVisible()

    // On Home, Koa wears it, and a speech bubble sits above the pom-pom instead of over it.
    await goTo(page, 'Home')
    const koa = page.getByRole('button', { name: 'Koa the koala. Tap to say hi.' })
    const hat = koa.locator('img[src="/characters/accessories/beanie@idle.webp"]')
    await expect(hat).toHaveJSProperty('complete', true)
    const bubble = page.locator('.koa-bubble')
    await expect(async () => {
      if (!(await bubble.isVisible())) await koa.click()
      await expect(bubble).toBeVisible({ timeout: 1500 })
    }).toPass({ timeout: 15_000 })
    // Let the bubble's spring settle before measuring: no movement across two frames.
    await expect
      .poll(() =>
        bubble.evaluate(
          (el) =>
            new Promise<number>((resolve) => {
              const y = el.getBoundingClientRect().y
              requestAnimationFrame(() => requestAnimationFrame(() => resolve(Math.abs(el.getBoundingClientRect().y - y))))
            }),
        ),
      )
      .toBeLessThan(0.1)

    const box = await bubble.boundingBox()
    const frame = await hat.boundingBox()
    if (!box || !frame) throw new Error('missing bubble or beanie box')
    // beanie@idle.webp: the pom-pom's top is row 464 of 1536; the bubble's tail hangs 5 px below it.
    const pomTop = frame.y + (464 / 1536) * frame.height
    expect(box.y + box.height + 5).toBeLessThanOrEqual(pomTop + 0.5)
  })
})
