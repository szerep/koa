import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import {
  advance,
  button,
  expectCoins,
  expectNoErrors,
  expectTimer,
  goTo,
  MINUTE,
  openKoa,
  reload,
  runSession,
  settingValue,
  startSession,
  TODAY,
  typeSetting,
} from './support/koa.ts'

test.afterEach(({ page }) => expectNoErrors(page))

/**
 * A realistic save: longer focus and a shorter cycle in Settings, one 120-minute session
 * (120 coins + the 50-coin daily goal), the daisy bought and worn (90 coins left).
 */
async function buildProgress(page: Page) {
  await goTo(page, 'Settings')
  await typeSetting(page, 'Focus', 120)
  await button(page, 'Fewer sessions before a long break').click()
  await expect(settingValue(page, 'Long break after')).toHaveValue('3')

  await goTo(page, 'Home')
  await runSession(page, 120)
  await expectCoins(page, 170)

  await goTo(page, 'Shop')
  await page.getByRole('radiogroup', { name: 'Item category' }).getByRole('radio', { name: 'Extras' }).click()
  await page.getByRole('button', { name: 'Buy Daisy for 80 coins' }).click()
  await page.getByRole('button', { name: 'Buy for 80?' }).click()
  await expectCoins(page, 90)
}

const resetGroup = (page: Page) => page.getByRole('group', { name: 'Reset your progress?' })

test.describe('your data', () => {
  test('everything survives a reload: coins, outfit, stats, settings and the session in progress', async ({ page }) => {
    await openKoa(page)
    await buildProgress(page)

    // Leave a paused break in progress.
    await goTo(page, 'Home')
    await startSession(page)
    await advance(page, 2 * MINUTE)
    await button(page, 'Pause').click()
    await expectTimer(page, '03:00')

    await reload(page)

    await expectCoins(page, 90)
    await expectTimer(page, '03:00')
    await expect(button(page, 'Resume')).toBeVisible()
    await expect(page.getByText('1 of 3 sessions done', { exact: true })).toBeVisible()

    await goTo(page, 'Shop')
    await expect(page.getByRole('list', { name: 'Koa is wearing' }).getByRole('button', { name: 'Take off the daisy' })).toBeVisible()

    await goTo(page, 'Stats')
    const today = page.getByRole('region', { name: 'Today' })
    await expect(today).toContainText('2 hours of your 100-minute daily goal.')
    await expect(today).toContainText('Daily goal reached.')

    await goTo(page, 'Settings')
    await expect(settingValue(page, 'Focus')).toHaveValue('120')
    await expect(settingValue(page, 'Long break after')).toHaveValue('3')
  })

  test('export downloads all of Koa’s data as a JSON file', async ({ page }) => {
    await openKoa(page)
    await runSession(page, 25)
    await goTo(page, 'Settings')

    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toBe(`koa-data-${TODAY}.json`)
    await expect(page.getByText(`Your download should start now: koa-data-${TODAY}.json.`)).toBeVisible()

    const file = JSON.parse(await readFile(await download.path(), 'utf8')) as {
      format: string
      exportVersion: number
      storageKey: string
      exportedAt: string
      data: { version: number; wallet: unknown; timer: unknown; settings: unknown }
    }
    expect(file).toMatchObject({ format: 'koa-export', exportVersion: 1, storageKey: 'koa:v1', data: { version: 1 } })
    expect(file.exportedAt).toBe('2026-06-15T09:25:00.000Z')
    expect(file.data.wallet).toBeTruthy()
    expect(file.data.timer).toBeTruthy()
    expect(file.data.settings).toBeTruthy()
  })

  test('reset asks first, can be cancelled, then clears progress and keeps settings', async ({ page }) => {
    await openKoa(page)
    await buildProgress(page)
    await goTo(page, 'Settings')

    // Ask, then back out with Escape: nothing changes and focus returns to the button.
    await page.getByRole('button', { name: 'Reset…' }).click()
    const confirm = resetGroup(page)
    await expect(confirm).toBeVisible()
    await expect(confirm).toContainText('Your coins: 90 coins to spend, 170 coins earned in total')
    await expect(confirm).toContainText("1 item you bought in the shop, and Koa's outfit")
    await expect(confirm).toContainText('Your stats: 1 focus session, 2 h of focus, streaks and goal days')
    await expect(confirm.getByRole('button', { name: 'Keep my progress' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(confirm).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Reset…' })).toBeFocused()
    await expectCoins(page, 90)

    // Now for real.
    await page.getByRole('button', { name: 'Reset…' }).click()
    await confirm.getByRole('button', { name: 'Reset progress' }).click()
    await expect(page.getByText('Progress reset. Your settings are just as they were, and a backup was saved on this device.')).toBeVisible()
    await expectCoins(page, 0)
    await expect(settingValue(page, 'Focus')).toHaveValue('120')
    await expect(settingValue(page, 'Long break after')).toHaveValue('3')

    // The backup the message promises exists, as a Koa export of the data before the reset.
    const backup = await page.evaluate(() => window.localStorage.getItem('koa:backup:reset'))
    expect(JSON.parse(backup ?? 'null')).toMatchObject({ format: 'koa-export', storageKey: 'koa:v1' })

    // Every screen starts over: a fresh cycle with the kept settings, nothing owned, an empty journal.
    await goTo(page, 'Home')
    await expectTimer(page, '120:00')
    await expect(page.getByText('Session 1 of 3', { exact: true })).toBeVisible()
    await expect(button(page, 'Start')).toBeVisible()

    await goTo(page, 'Shop')
    await expect(page.getByText("Koa isn't wearing anything special yet.", { exact: false })).toBeVisible()
    await page.getByRole('radiogroup', { name: 'Item category' }).getByRole('radio', { name: 'Extras' }).click()
    await expect(page.getByRole('article').filter({ hasText: 'Daisy' })).toContainText('80 to go')

    await goTo(page, 'Stats')
    await expect(page.getByText('Your study journal')).toBeVisible()

    // And it stays that way after a reload.
    await reload(page)
    await expectCoins(page, 0)
    await expect(page.getByText('Your study journal')).toBeVisible()
    await goTo(page, 'Settings')
    await expect(settingValue(page, 'Focus')).toHaveValue('120')
    await expect(settingValue(page, 'Long break after')).toHaveValue('3')
  })
})
