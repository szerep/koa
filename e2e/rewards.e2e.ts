import { expect, test } from '@playwright/test'
import {
  button,
  expectCoins,
  expectNoErrors,
  expectTimer,
  goTo,
  mode,
  openKoa,
  reload,
  runSession,
} from './support/koa.ts'

test.afterEach(({ page }) => expectNoErrors(page))

test.describe('coins, breaks and progress', () => {
  test('a completed focus session pays coins, moves to a break and shows up in Stats', async ({ page }) => {
    await openKoa(page)

    await runSession(page, 25)
    await expectCoins(page, 25)
    await expect(page.getByRole('status').filter({ hasText: 'You earned 25 coins.' })).toBeAttached()

    // The break waits for the user; it never starts by itself.
    await expect(mode(page, 'Short break')).toHaveAttribute('aria-checked', 'true')
    await expectTimer(page, '05:00')
    await expect(button(page, 'Start break')).toBeVisible()
    await expect(page.getByText('1 of 4 sessions done', { exact: true })).toBeVisible()

    await goTo(page, 'Stats')
    const today = page.getByRole('region', { name: 'Today' })
    await expect(today).toContainText('25 minutes of your 100-minute daily goal.')
    await expect(today).toContainText('1 focus session')
    await expect(today).toContainText('1 h 15 min to go.')
    const streak = page.getByRole('region', { name: 'Current streak' })
    await expect(streak).toContainText('1 day')
    await expect(streak).toContainText('You focused today.')
    await expect(page.getByRole('region', { name: 'All-time focus' })).toContainText('25 minutes')
  })

  test('a break pays nothing and leads to the next focus session', async ({ page }) => {
    await openKoa(page)
    await runSession(page, 25)
    await expectCoins(page, 25)

    await runSession(page, 5)
    await expect(mode(page, 'Focus')).toHaveAttribute('aria-checked', 'true')
    await expectTimer(page, '25:00')
    await expect(button(page, 'Start')).toBeVisible()
    await expect(page.getByText('Session 2 of 4', { exact: true })).toBeVisible()
    await expectCoins(page, 25)
  })

  test('a full cycle pays the cycle bonus and the daily goal, then a long break starts a new cycle', async ({ page }) => {
    await openKoa(page)

    for (let session = 1; session <= 3; session++) {
      await expect(page.getByText(`Session ${session} of 4`, { exact: true })).toBeVisible()
      await runSession(page, 25)
      await expectCoins(page, 25 * session)
      await runSession(page, 5)
    }

    // The 4th session: 25 coins, the cycle bonus (30 for 4 × 25 min) and the daily goal (100 min, +50).
    await expect(page.getByText('Session 4 of 4', { exact: true })).toBeVisible()
    await runSession(page, 25)
    await expectCoins(page, 100 + 30 + 50)
    await expect(page.getByRole('status').filter({ hasText: 'You earned 105 coins.' })).toBeAttached()

    await expect(mode(page, 'Long break')).toHaveAttribute('aria-checked', 'true')
    await expectTimer(page, '20:00')
    await expect(page.getByText('Cycle complete', { exact: true })).toBeVisible()

    await runSession(page, 20)
    await expect(mode(page, 'Focus')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('Session 1 of 4', { exact: true })).toBeVisible()
    await expectCoins(page, 180)

    await goTo(page, 'Stats')
    const today = page.getByRole('region', { name: 'Today' })
    await expect(today).toContainText('4 focus sessions')
    await expect(today).toContainText('Daily goal reached. You earned 50 bonus coins.')

    // Nothing is paid twice after a reload.
    await reload(page)
    await expectCoins(page, 180)
  })
})
