import { expect, test } from '@playwright/test'
import {
  advance,
  button,
  expectCoins,
  expectNoErrors,
  expectTimer,
  MINUTE,
  mode,
  openKoa,
  reload,
  startSession,
} from './support/koa.ts'

test.afterEach(({ page }) => expectNoErrors(page))

test.describe('focus timer', () => {
  test('starts, counts down, pauses and resumes', async ({ page }) => {
    await openKoa(page)

    await startSession(page)
    // While a session is in progress the mode chips are locked and Reset is available.
    await expect(mode(page, 'Short break')).toBeDisabled()
    await expect(button(page, 'Reset timer')).toBeEnabled()

    await advance(page, 90_000)
    await expectTimer(page, '23:30')

    await button(page, 'Pause').click()
    await expect(button(page, 'Resume')).toBeVisible()
    // A paused session doesn't lose time, however long the user is away.
    await advance(page, 10 * MINUTE)
    await expectTimer(page, '23:30')

    await button(page, 'Resume').click()
    await expect(button(page, 'Pause')).toBeVisible()
    await advance(page, 30_000)
    await expectTimer(page, '23:00')
  })

  test('a paused session survives a reload', async ({ page }) => {
    await openKoa(page)
    await startSession(page)
    await advance(page, 5 * MINUTE)
    await button(page, 'Pause').click()

    await reload(page)
    await expectTimer(page, '20:00')
    await expect(button(page, 'Resume')).toBeVisible()
    await expect(mode(page, 'Focus')).toHaveAttribute('aria-checked', 'true')
    await expect(mode(page, 'Short break')).toBeDisabled()
  })

  test('a running session keeps running across a reload and finishes while the app is away', async ({ page }) => {
    await openKoa(page)
    await startSession(page)
    await advance(page, 10 * MINUTE)

    await reload(page)
    await expectTimer(page, '15:00')
    await expect(button(page, 'Pause')).toBeVisible()

    // The app is closed past the end of the session; the next launch completes it once.
    await page.goto('about:blank')
    await advance(page, 40 * MINUTE)
    await page.goto('/')
    await expect(button(page, 'Start break')).toBeVisible()
    await expect(mode(page, 'Short break')).toHaveAttribute('aria-checked', 'true')
    await expectCoins(page, 25)

    // Reloading again never pays twice.
    await reload(page)
    await expectCoins(page, 25)
    await expect(page.getByText('1 of 4 sessions done', { exact: true })).toBeVisible()
  })

  test('reset returns to the full session and keeps the cycle', async ({ page }) => {
    await openKoa(page)
    await startSession(page)
    await advance(page, 3 * MINUTE)
    await expectTimer(page, '22:00')

    await button(page, 'Reset timer').click()
    await expectTimer(page, '25:00')
    await expect(button(page, 'Start')).toBeVisible()
    await expect(button(page, 'Reset timer')).toBeDisabled()
    await expect(mode(page, 'Short break')).toBeEnabled()
    await expect(page.getByText('Session 1 of 4', { exact: true })).toBeVisible()
    await expectCoins(page, 0)
  })

  test('skipping a started focus session asks first and never pays', async ({ page }) => {
    await openKoa(page)
    await startSession(page)
    await advance(page, 2 * MINUTE)

    await button(page, 'Skip to break').click()
    const confirm = page.getByRole('group', { name: /Skip this focus session/ })
    await expect(confirm).toBeVisible()
    // The safe choice has focus, so a stray Enter keeps the session.
    await expect(confirm.getByRole('button', { name: 'Keep going' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(confirm).toBeHidden()
    await expect(button(page, 'Pause')).toBeVisible()
    await expectTimer(page, '23:00')

    await button(page, 'Skip to break').click()
    await confirm.getByRole('button', { name: 'Skip session' }).click()
    await expect(mode(page, 'Short break')).toHaveAttribute('aria-checked', 'true')
    await expectTimer(page, '05:00')
    await expect(button(page, 'Start break')).toBeVisible()
    await expect(page.getByText('0 of 4 sessions done', { exact: true })).toBeVisible()
    await expectCoins(page, 0)
  })

  test('skipping a session that has not started needs no confirmation', async ({ page }) => {
    await openKoa(page)
    await button(page, 'Skip to break').click()
    await expect(mode(page, 'Short break')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('group', { name: /Skip this focus session/ })).toHaveCount(0)

    await button(page, 'Skip to focus').click()
    await expect(mode(page, 'Focus')).toHaveAttribute('aria-checked', 'true')
    await expectTimer(page, '25:00')
  })
})
