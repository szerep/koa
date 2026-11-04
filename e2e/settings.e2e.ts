import { expect, test } from '@playwright/test'
import {
  advance,
  button,
  expectCoins,
  expectNoErrors,
  expectTimer,
  goTo,
  MINUTE,
  mode,
  openKoa,
  reload,
  settingValue,
  startSession,
  typeSetting,
} from './support/koa.ts'

test.afterEach(({ page }) => expectNoErrors(page))

test.describe('settings', () => {
  test('timer lengths and the daily goal can be changed, apply on Home and persist after a reload', async ({ page }) => {
    await openKoa(page)
    await goTo(page, 'Settings')

    // A preset, the stepper buttons and a typed value: the three ways to change a number.
    const presets = page.getByRole('group', { name: 'Focus presets' })
    await presets.getByRole('button', { name: '50 min' }).click()
    await expect(presets.getByRole('button', { name: '50 min' })).toHaveAttribute('aria-pressed', 'true')
    await expect(settingValue(page, 'Focus')).toHaveValue('50')

    await button(page, 'Longer short break').click()
    await expect(settingValue(page, 'Short break')).toHaveValue('6')

    await typeSetting(page, 'Long break', 30)
    await expect(settingValue(page, 'Long break')).toHaveValue('30')

    await button(page, 'Fewer sessions before a long break').click()
    await expect(settingValue(page, 'Long break after')).toHaveValue('3')

    await button(page, 'Higher daily goal').click()
    await expect(settingValue(page, 'Focus per day')).toHaveValue('125')

    await reload(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    await expect(settingValue(page, 'Focus')).toHaveValue('50')
    await expect(settingValue(page, 'Short break')).toHaveValue('6')
    await expect(settingValue(page, 'Long break')).toHaveValue('30')
    await expect(settingValue(page, 'Long break after')).toHaveValue('3')
    await expect(settingValue(page, 'Focus per day')).toHaveValue('125')

    await goTo(page, 'Home')
    await expectTimer(page, '50:00')
    await expect(page.getByText('Session 1 of 3', { exact: true })).toBeVisible()
    await mode(page, 'Short break').click()
    await expectTimer(page, '06:00')
    await mode(page, 'Long break').click()
    await expectTimer(page, '30:00')
  })

  test('typed values are checked: out of range is adjusted, nonsense is ignored', async ({ page }) => {
    await openKoa(page)
    await goTo(page, 'Settings')

    await typeSetting(page, 'Focus', 500)
    await expect(settingValue(page, 'Focus')).toHaveValue('120')
    await expect(page.getByRole('status').filter({ hasText: 'Adjusted to 120 minutes' })).toBeVisible()

    await typeSetting(page, 'Focus', 0)
    await expect(settingValue(page, 'Focus')).toHaveValue('1')

    const focus = settingValue(page, 'Focus')
    await focus.fill('soon')
    await focus.press('Enter')
    await expect(focus).toHaveValue('1')

    // Escape cancels typing.
    await focus.fill('45')
    await focus.press('Escape')
    await expect(focus).toHaveValue('1')

    await reload(page)
    await expect(settingValue(page, 'Focus')).toHaveValue('1')
  })

  test('a running session keeps its length; the change applies from the next session', async ({ page }) => {
    await openKoa(page)
    await startSession(page)
    await advance(page, 5 * MINUTE)

    await goTo(page, 'Settings')
    await expect(page.getByText('Your current session keeps its length. Changes start with the next one.')).toBeVisible()
    await page.getByRole('group', { name: 'Focus presets' }).getByRole('button', { name: '15 min' }).click()
    await expect(settingValue(page, 'Focus')).toHaveValue('15')

    await goTo(page, 'Home')
    await expectTimer(page, '20:00')
    await expect(button(page, 'Pause')).toBeVisible()

    // It still pays for the 25 minutes it ran.
    await advance(page, 20 * MINUTE)
    await expect(button(page, 'Start break')).toBeVisible()
    await expectCoins(page, 25)

    await button(page, 'Skip to focus').click()
    await expectTimer(page, '15:00')
  })
})
