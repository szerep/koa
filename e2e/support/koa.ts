import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Shared helpers for Koa's end-to-end tests.
 *
 * Time: Koa computes everything from `Date.now()` (the timer's `endsAt`, the local day for
 * rewards and stats). The tests pin `Date` to a time they control and move it forward only when
 * they say so ("the user waited 25 minutes"). Real timers, `requestAnimationFrame` and
 * `performance.now()` are left alone, so the timer's 250 ms tick, React and Motion run normally.
 *
 * Why not `page.clock`: it also patches `performance.now()` and carries it across reloads, while
 * the reloaded document's animation timeline starts again at 0. Motion then schedules its
 * animations in the future, and after a reload every tab switch waits about as long as the test
 * has been running. The pinned `Date` below avoids that.
 */

/** A fixed morning, so a whole day of sessions stays on one local day (the tests run in UTC). */
export const START = new Date('2026-06-15T09:00:00Z')
export const TODAY = '2026-06-15'

export const MINUTE = 60_000

/** Carries the pinned time into every document (reloads too); the app never reads cookies. */
const TIME_COOKIE = 'koa-e2e-now'

const clocks = new WeakMap<Page, { now: number }>()
const errors = new WeakMap<Page, string[]>()

/** Replaces `Date` in every document of this page with one whose "now" is the pinned time. */
async function pinDate(page: Page) {
  await page.addInitScript((cookie: string) => {
    const RealDate = Date
    const pattern = new RegExp(`(?:^|; )${cookie}=(\\d+)`)
    const now = () => {
      const match = pattern.exec(document.cookie)
      return match ? Number(match[1]) : RealDate.now()
    }
    const PinnedDate = function (this: unknown, ...args: unknown[]) {
      if (!new.target) return new RealDate(now()).toString()
      return args.length === 0 ? new RealDate(now()) : (Reflect.construct(RealDate, args) as Date)
    } as unknown as DateConstructor
    Object.setPrototypeOf(PinnedDate, RealDate) // Date.parse, Date.UTC
    Object.defineProperty(PinnedDate, 'prototype', { value: RealDate.prototype }) // instanceof Date
    Object.defineProperty(PinnedDate, 'now', { value: now })
    globalThis.Date = PinnedDate
  }, TIME_COOKIE)
}

async function setTime(page: Page, ms: number) {
  await page.context().addCookies([{ name: TIME_COOKIE, value: String(ms), domain: 'localhost', path: '/' }])
}

/** Opens Koa on Home at `START` in a fresh context (no saved data), and starts tracking errors. */
export async function openKoa(page: Page, at: Date = START) {
  const list: string[] = []
  errors.set(page, list)
  page.on('pageerror', (error) => list.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') list.push(`console: ${message.text()}`)
  })

  clocks.set(page, { now: at.getTime() })
  await pinDate(page)
  await setTime(page, at.getTime())
  await page.goto('/')
  await expect(mainNav(page)).toBeVisible()
}

/** Moves Koa's time forward, as if the user waited `ms` milliseconds. */
export async function advance(page: Page, ms: number) {
  const clock = clocks.get(page)
  if (!clock) throw new Error('Call openKoa(page) first')
  clock.now += ms
  await setTime(page, clock.now)
}

/** No uncaught exception or console error happened on this page. */
export function expectNoErrors(page: Page) {
  expect(errors.get(page) ?? []).toEqual([])
}

export async function reload(page: Page) {
  await page.reload()
  await expect(mainNav(page)).toBeVisible()
}

export const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' })

export type TabName = 'Home' | 'Shop' | 'Stats' | 'Settings'

/**
 * Goes to a tab through the bottom nav (the left rail on wide screens). The screens cross-fade,
 * so callers then wait for something on the new screen (assertions retry until it's there).
 */
export async function goTo(page: Page, tab: TabName) {
  const link = mainNav(page).getByRole('link', { name: tab, exact: true })
  await link.click()
  await expect(link).toHaveAttribute('aria-current', 'page')
}

/** The balance in the coin pill, as read by screen readers ("25 coins"). */
export async function expectCoins(page: Page, coins: number) {
  const text = `${new Intl.NumberFormat('en-US').format(coins)} coins`
  await expect(page.getByRole('banner').getByText(text, { exact: true })).toBeAttached()
}

/* Home */

export const timerDisplay = (page: Page) => page.getByRole('main').locator('time')
export const modeGroup = (page: Page) => page.getByRole('radiogroup', { name: 'Timer mode' })
export const mode = (page: Page, name: 'Focus' | 'Short break' | 'Long break') =>
  modeGroup(page).getByRole('radio', { name, exact: true })

export const button = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true })

export async function expectTimer(page: Page, clock: string) {
  await expect(timerDisplay(page)).toHaveText(clock)
}

/** Starts the waiting session from Home ("Start" or "Start break"). */
export async function startSession(page: Page) {
  const start = page.getByRole('button', { name: /^Start( break)?$/ })
  await start.click()
  await expect(button(page, 'Pause')).toBeVisible()
}

/**
 * Starts the waiting session and lets it run to the end. The session completes on the next
 * timer tick, and Home moves on to the next session without starting it.
 */
export async function runSession(page: Page, minutes: number) {
  await startSession(page)
  await advance(page, minutes * MINUTE)
  await expect(page.getByRole('button', { name: /^Start( break)?$/ })).toBeVisible()
}

/* Settings */

/** Types a value into a settings stepper and commits it with Enter, like a user would. */
export async function typeSetting(page: Page, label: string, value: number) {
  const input = page.getByRole('spinbutton', { name: label, exact: true })
  await input.fill(String(value))
  await input.press('Enter')
}

export const settingValue = (page: Page, label: string) => page.getByRole('spinbutton', { name: label, exact: true })
