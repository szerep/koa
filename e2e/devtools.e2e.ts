import { expect, test } from '@playwright/test'
import { expectNoErrors, goTo, openKoa } from './support/koa.ts'

/**
 * The Dev Tools (src/dev/) exist only in local development (`pnpm dev`). This suite runs against
 * the production build, where they must be absent (scripts/check-build.mjs also checks the files).
 */

test.afterEach(({ page }) => expectNoErrors(page))

test('the production build has no Dev Tools', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname)
  })
  await openKoa(page)
  for (const tab of ['Shop', 'Settings', 'Home'] as const) {
    await goTo(page, tab)
    await expect(page.getByRole('button', { name: 'Dev tools' })).toHaveCount(0)
  }
  await page.goto('/#/wardrobe')
  await expect(page.getByRole('heading', { level: 1, name: 'Wardrobe' })).toBeVisible()
  await expect(page.locator('[data-koa-dev-tools]')).toHaveCount(0)
  expect(scripts.filter((path) => /dev/i.test(path))).toEqual([])
})
