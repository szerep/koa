# Phase 10, Step 1: the Playwright end-to-end suite

Status: implemented 2026-11-04 and committed as `edee6ae` (21 tests). Phase 10 Step 2 (the accessibility pass, approved; summary in `docs/phase-10/step-2-summary.md`) added `accessibility.e2e.ts` and updated `shop.e2e.ts`: now 25 tests.

A committed `@playwright/test` suite that drives Koa's real user journeys in a browser. It complements the Vitest unit tests (633 since Step 2, `src/**/*.test.ts`): the unit tests own the rules and edge cases; the e2e tests check that the screens, stores, wiring (`src/app/connect.ts`) and LocalStorage work together the way a user meets them.

## Running it

| Command | What it does |
|---|---|
| `pnpm exec playwright install chromium webkit` | One-time: download the browser builds that match `@playwright/test` (from Playwright's CDN) |
| `pnpm test:e2e` | Build (`pnpm build`, including the build check), serve `dist/` with `vite preview` on port 4317, run every test in all three projects |
| `pnpm test:e2e --project=iphone-chromium` | One project only (`iphone-chromium`, `iphone-webkit`, `desktop-chromium`) |
| `pnpm test:e2e e2e/shop.e2e.ts` | One file |
| `pnpm test:e2e --ui` / `--headed` / `--debug` | Playwright's UI mode, a visible browser, or the inspector |
| `pnpm exec playwright show-trace test-results/<test>/trace.zip` | Open the trace a failed test leaves behind |

Faster local loop: start `pnpm build && pnpm exec vite preview --port 4317 --strictPort` in another terminal. Locally the config reuses a server already on 4317 instead of building again, so **rebuild after changing app code** or the tests run the old bundle. With `CI` set, the server is always started fresh, retries are 1, `test.only` fails the run, and an HTML report is written to `playwright-report/`.

A cold run of the whole suite (then 63 runs, parallel) took 48 s on the development laptop, including the build.

## Setup

- `playwright.config.ts`: `testDir: e2e`, files named `*.e2e.ts`. Vitest picks up `*.test.ts` **and** `*.spec.ts`, so the e2e files use their own suffix and never run under Vitest (no Vitest config change).
- **Projects:** `iphone-chromium` (390×844, touch, mobile), `iphone-webkit` (Playwright's iPhone 13 descriptor: Safari's engine at 390×844) and `desktop-chromium` (1440×900, the left-rail layout).
- **Against the production build**, the same bundle users get (no React dev-mode differences). The webServer command runs the full `pnpm build`.
- **Isolation:** every test gets a fresh browser context, so LocalStorage starts empty; tests seed nothing and create their progress through the UI. Locale `en-US`, time zone `UTC`.
- **Service workers are blocked** (`serviceWorkers: 'block'`). Offline, updates and install were verified in Phase 9 (manually, against `pnpm preview`); a worker here would only add cache state between runs.
- **No network** beyond `localhost:4317`. No paid services.
- **Type checked:** `tsconfig.e2e.json` (referenced from `tsconfig.json`), so `tsc -b` in `pnpm build` checks the tests too. ESLint covers them through the existing `**/*.{ts,tsx}` rule.
- Failures keep a trace and a screenshot in `test-results/` (git-ignored, like `playwright-report/` and `blob-report/`).
- New dev dependency: `@playwright/test` 1.64.1 (pinned, so the browser builds match).

## Time control (decision)

Koa computes everything from `Date.now()`: the timer's `endsAt`, the local day for rewards, goal and stats. `e2e/support/koa.ts` pins `Date` in every document of the page through an init script, and `advance(page, ms)` moves it forward ("the user waited 25 minutes"). The time travels in a cookie (`koa-e2e-now`; the app never reads cookies), so it survives reloads and `about:blank`. **Real timers, `requestAnimationFrame` and `performance.now()` are untouched**, so the 250 ms tick, React and Motion behave exactly as for a user. Each test starts at 2026-06-15 09:00 UTC.

Why not `page.clock`: it patches `performance.now()` too and continues it across reloads, while the reloaded document's animation timeline starts again at 0. Motion then schedules its animations in the future, so after a reload every tab cross-fade waited roughly as long as the test had been running (measured: about 2 s instead of 0.3 s, growing over the test). That made the longer journeys slow and flaky. Pinning only `Date` removed the delay. The final stable result (189 of 189 runs passed with `--repeat-each=3`) came after that change together with two others: the reset test was simplified (one full check of the fresh state instead of two) and the timeouts were raised for WebKit on Windows (60 s per test, 10 s per assertion).

No test sleeps. Every wait is a web-first assertion (`expect(locator)…`), which retries until the UI catches up.

## Selectors

Roles and accessible names only (`getByRole`, `getByText` for visible copy), the same things a screen reader user meets: the `Main` navigation links, the `Timer mode` radio group, the `Pause`/`Resume`/`Start break` buttons, the steppers' spinbuttons (`Focus`, `Long break after`), the `Focus presets` group, item cards (`article` + heading), the `Koa is wearing` list, the shop's `Wear the daisy` / `Wearing the daisy` buttons (named after their item since Step 2), the `Reset your progress?` group, Stats regions (`Today`, `Current streak`, `All-time focus`). The coin balance is read from the pill's screen-reader text ("90 coins"), which is the actual balance rather than the animated number. There are no test IDs and no CSS class selectors. The one structural selector is `main time` for the clock.

Direct storage reads are limited to two places where the UI makes a promise it can't show: the export file's content, and the existence of the `koa:backup:reset` backup the reset message mentions.

## Coverage (25 tests × 3 projects = 75 runs)

| File | Tests | Journeys |
|---|---|---|
| `app.e2e.ts` | 4 | Loads on Home (25:00, Session 1 of 4, 0 coins, Koa's frame decoded, no console errors); every tab through the nav, the tab kept in the address across a reload and Back, the Stats empty state's "Start focusing"; an unknown address falls back to Home; keyboard: arrow keys in the mode radio group, Enter on a nav link |
| `timer.e2e.ts` | 6 | Start, count down, pause (time doesn't run while paused), resume; a paused session survives a reload; a running session survives a reload and completes once while the app is closed, with no double payout on the next reload; Reset returns to the full length and keeps the cycle; skipping a started focus session asks first (Keep going has focus; Enter keeps the session) and never pays; skipping an unstarted session needs no confirmation |
| `rewards.e2e.ts` | 3 | A completed focus session pays 25 coins, announces it, moves to a waiting short break and shows in Stats (today, streak, all-time); a break pays nothing and leads to Session 2 without auto-starting; a full cycle: 4 × 25 min pays 100 + cycle bonus 30 + daily goal 50 = 180, then the long break ("Cycle complete") starts a new cycle; nothing is paid twice after a reload |
| `settings.e2e.ts` | 3 | Preset, stepper buttons and typing change focus, short break, long break, interval and daily goal; all persist after a reload and apply on Home (50:00, Session 1 of 3, 06:00, 30:00); typed values are clamped ("Adjusted to 120 minutes"), nonsense and Escape revert; a running session keeps its length after a change (the note shows), still pays for its 25 minutes, and the next one uses the new length |
| `shop.e2e.ts` | 2 | Unaffordable items show "N to go" and no buy button; earning 170 coins through a real 120-minute session, buying the daisy takes two taps (the first spends nothing), equips it, updates the balance and other prices; ownership and outfit survive reloads; taking it off keeps it owned (also after a reload); wearing again is free |
| `data.e2e.ts` | 3 | Coins, outfit, stats, settings and a paused break all survive a reload; Export downloads `koa-data-2026-06-15.json` with the documented envelope; Reset asks with a summary of the user's actual data (90 to spend, 170 earned, 1 item, 2 h), Escape cancels and returns focus to the button, confirming clears coins, cycle, shop and stats, keeps every setting, writes the backup, and stays reset after a reload |
| `accessibility.e2e.ts` | 4 | (Step 2) Every screen has exactly one level-1 heading (Home's is the visually hidden "Timer") and its own page title ("Shop · Koa", "Stats · Koa", "Settings · Koa"; Home stays "Koa"); shop buttons name their item (two owned hats: "Wear the sage beanie", "Wearing the sand cap") and a locked price reads with its unit ("120 coins,"); buying keeps keyboard focus on the card's button (Step 3: "Buy for N?", then "Wearing the …"); no sideways scroll on any tab at 320×568 (small phone), 320×256 (a 1280×1024 desktop at 400% zoom, WCAG 1.4.10) and 568×320 (an old 568-px phone in landscape, which gets the single-column layout); a 667×375 phone in landscape keeps the side rail with no sideways scroll |

Every test also fails on any uncaught page error or console error.

After Step 2 the full 75-run suite has not been run as a whole yet: `accessibility.e2e.ts` passed 12 / 12 after the final CSS change, and `accessibility`, `shop`, `app` and `rewards` passed 37 / 37 before it (details in `docs/phase-10/step-2-summary.md` §5).

### Accessibility coverage (Step 2)

`accessibility.e2e.ts` covers only what needs a real browser: headings and page titles per tab, the shop's item-specific button names and price wording, and reflow. The rules behind them (`pageTitle()`, `coinText()`) are unit-tested, and the static ARIA checks were done by the Step 2 audit (a throwaway script, not committed) and Lighthouse. The reflow viewports pin the phone-landscape layout's `(min-width: 600px)` condition from both sides: 568×320 must get the single-column layout without sideways scroll, and 667×375 must keep the side rail. 195 px wide (a phone at 200% page zoom) stays a known limitation and isn't tested.

**Step 3 (motion tuning, `docs/phase-10/step-3-summary.md`):** the existing `buy()` helper now buys with the keyboard (Enter on the price button, then Enter on "Buy for N?") and checks that focus stays on the card's button through both steps. This guards the fix for the purchase pop, which used to rebuild the card and drop focus; the assertion was confirmed to fail on the old code. No test was added: the suite is still 25 tests × 3 projects = 75 runs. For Step 3 only the `accessibility`, `shop`, `app` and `rewards` specs were run (39 / 39, all three projects); the full 75-run suite was not re-run.

### Requested journeys → tests

1. Loads: `app` (first test). 2. Start and pause: `timer` (first two). 3. Session state in the UI: `timer`, `rewards` (mode, clock, button labels, cycle label, locked chips). 4. Completion pays and updates progress: `rewards`, `timer` (completed while away). 5. Breaks and the next session: `rewards`. 6. Settings persist: `settings`. 7. Shop persists: `shop`. 8. Data intact after reload: `data` (first test), plus reload checks throughout. 9. Reset is safe and keeps settings: `data`. 10. Navigation and dialogs with accessible interactions: `app` (nav, keyboard), `timer` (skip confirmation), `data` (reset confirmation, Escape, focus return).

## Not covered (limitations)

- **Not an iPhone.** `iphone-webkit` is Playwright's WebKit build on Windows at iPhone size: no iOS Safari quirks, no Home Screen app, no real safe areas or share sheet. The Phase 9 iPhone checks stay manual and required.
- **Service worker features** (offline, update prompt, install card) are blocked here; they were checked manually in Phase 9. A separate project that allows the worker could cover them later.
- **Browser permission features:** notifications, Keep screen on and Sounds aren't driven here. They depend on permission prompts and device APIs; their rules are unit-tested with injected environments.
- **Share-sheet export** (installed app only) isn't covered; the browser-tab download is.
- **Visuals and motion** aren't asserted: no screenshot comparisons, the coin fly-up and Koa's behaviors aren't checked (only the accessible balance and announcements). Layout checks at the three viewports stay a manual Playwright pass for layout work; only the Step 2 reflow checks (no sideways scroll, the landscape side rail) are automated.
- **Cross-tab sync** (the `storage` event) isn't covered.
- **Real-time UI timeouts** (the shop's 3.5 s buy confirmation and toasts) run on real timers, since only `Date` is pinned; the tests act well within them and don't test the expiry.
- WebKit on Windows is slower (the longest journeys take ~15 s there), hence the 60 s test and 10 s assertion timeouts.
