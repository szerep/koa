# Phase 10: Bug Bash (summary)

## 1. Status

- Bug Bash complete.
- Two confirmed bugs found and fixed.
- Ready for documentation and commit review.
- **Not committed.** Step 4 is committed as `ffa4ac9`; the Bug Bash changes are only in the working tree.
- Phase 10 stays open pending the final release-candidate review.
- The roadmap, `CLAUDE.md` and `docs/phase-10/e2e-suite.md` are not updated yet, by request.

Every finding was reproduced in the running app (production build, Playwright with the suite's pinned `Date`) before it was fixed. Temporary probe specs were used and deleted afterwards.

## 2. Confirmed bugs fixed

### A. The tab title fell back to "Koa" when a session ended

- **Reproduction:** start a focus session on Home, go to Shop, then let the session finish (`advance` 25 minutes). The title became **"Koa"** instead of **"Shop · Koa"**. This was the Step 4 bug-bash candidate.
  - Correction to the first bug-bash report: it also said pausing on Home and then switching tabs showed the same problem. The probe doesn't support that. Pausing on Home gave "Koa" (correct for Home), and switching to Settings afterwards gave "Settings · Koa" (correct). The confirmed case is a timer state change while the user is on another tab.
- **Cause:** two independent writers of `document.title`. `App.tsx` set the per-tab title (Step 2) when the tab changed. `useTimerAmbience` set the countdown title, or plain "Koa" when no session ran, whenever its own value changed. When a session ended on Shop, the timer's effect wrote "Koa" over "Shop · Koa".
- **Fix:**
  - `useTimerAmbience` no longer touches `document.title`; it returns the countdown text ("24:59 Focus"), or `null` when no session runs.
  - `pageTitle(tab, tabs, countdown)` composes the title.
  - `App.tsx` is the single writer, with one effect.
- **Intended behavior (unchanged in intent):**
  - While a session runs: the countdown, the mode and "· Koa" on every tab ("24:59 Focus · Koa").
  - When no session runs: the current tab's title ("Koa" on Home, "Shop · Koa", "Stats · Koa", "Settings · Koa").
  - Before the fix, with real time, the countdown already replaced the tab title as it changed every second. That is inferred from the code; only the pinned-time run was probed.
- **Files:** `src/app/useTimerAmbience.ts`, `src/app/pageTitle.ts`, `src/app/App.tsx`.
- **Regression coverage:**
  - Two new unit tests in `src/app/pageTitle.test.ts`: the countdown on any tab, and the tab title when no session runs.
  - The existing title test in `e2e/accessibility.e2e.ts` now also checks "25:00 Focus · Koa" on Home and Shop, then "Shop · Koa" after the session ends. No new E2E test.
  - The old behavior was reproduced before the fix, and the updated E2E test fails on the old code.

### B. A double-tap in the shop skipped purchase steps

- **Reproduction** (with 85 coins, the 80-coin Daisy):
  - Double-tapping the **price button** ("Buy Daisy for 80 coins") **bought the item at once**, skipping the "Buy for 80?" confirmation (coins 85 → 5, the item worn).
  - Double-tapping **"Buy for 80?"** bought the item and then immediately took it off: the card showed "Wear" and the toast said "Took off the daisy."
  - Both cases reproduced in all three projects.
- **Cause:** the same button changes its label and meaning between taps (price → "Buy for N?" → "Wearing"), so the second tap of a double-tap lands on the next step.
- **Not caused by Step 3:** both cases reproduced identically with the shop code from before Step 3 (`7146d37`), so the bug dates from Phase 6.
- **Fix:** the "Buy for N?" and Wear/Wearing buttons ignore the repeat clicks of a multi-click (`event.detail > 1`, `isRepeatClick` in `ShopScreen.tsx`). Keyboard activation (`detail` 0) and deliberate separate taps work as before.
- **No double charge:** in every run the coins were charged exactly once.
- **File:** `src/app/screens/ShopScreen.tsx`.
- **Regression coverage:** the existing purchase test in `e2e/shop.e2e.ts` now double-taps the price button (expects "Buy for 80?" and no coins spent), then double-taps "Buy for 80?" (expects one charge and the daisy worn). No new test. The old behavior was reproduced before the fix, and the updated test fails on the old code.

## 3. Other targeted checks (passed)

Checked with temporary probe specs in all three projects:

- **Reduced motion:** after a completed session there were no flying coins (the labels still showed), Koa's figure didn't move when tapped, and keyboard focus stayed on the button through a purchase.
- **Rapid navigation:** six quick tab taps ended on the last tab with one screen rendered, and `aria-current`, the title and the address all matched.
- **Reset during a running session:** the timer went back to idle (Start shown), no coins were paid 30 minutes later, and the title went from the countdown to "Settings · Koa", then "Koa" on Home.
- **Pause, resume and skip titles:** paused on another tab gives the tab title, Resume brings back the countdown, and Skip returns to "Koa" with the break waiting.
- **Double-charge protection:** a double-tap never charged twice.
- **Existing coverage:** the `timer`, `settings`, `data` and `app` specs (timer lifecycle, settings, reset, persistence and navigation) all pass (section 5).

## 4. Intentionally not retested

- **PWA update lifecycle**
- **Offline behavior**
- **The 404 page**

These were verified in Phase 9 (locally and in production), and no code related to them changed during the Bug Bash, so they were not re-tested. `pnpm build`'s check still verifies that `dist/404.html` exists and that the precache is exactly 18 entries.

## 5. Validation

| Check | Result |
|---|---|
| `pnpm test` | **635 / 635** (633 + the 2 new `pageTitle` tests) |
| `pnpm lint` | passes |
| `pnpm build` | passes, `check-build: OK` (entry JS 151.4 kB, CSS 7.8 kB gzip, precache 18 entries) |
| E2E, all three projects | **75 / 75**, covering every spec |
| `git diff --check` | clean |

The 75 E2E runs were executed on the final code in **two batches**: `timer`, `settings`, `data`, `app` and `accessibility` (60 / 60), then `rewards` and `shop` (15 / 15). Together they cover the entire suite (25 tests × 3 projects); it wasn't one 75-run invocation.

## 6. Files changed

- `e2e/accessibility.e2e.ts`
- `e2e/shop.e2e.ts`
- `src/app/App.tsx`
- `src/app/pageTitle.test.ts`
- `src/app/pageTitle.ts`
- `src/app/screens/ShopScreen.tsx`
- `src/app/useTimerAmbience.ts`

## 7. Release-candidate status

- No confirmed bugs from this Bug Bash remain unfixed.
- No new features were introduced.
- No PWA, storage or schema, dependency or configuration changes were made.
- Phase 10 is still open, pending the final documentation and commit and the release-candidate review.
