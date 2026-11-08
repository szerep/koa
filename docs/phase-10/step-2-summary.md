# Phase 10, Step 2: accessibility pass (summary)

## 1. Status

- Phase 10 Step 2: accessibility pass.
- Implementation complete; **ready for review**.
- **Not committed.** Step 1 (the Playwright suite) is committed as `edee6ae`; this step's changes are only in the working tree.
- The roadmap, `CLAUDE.md` and `docs/phase-10/e2e-suite.md` are not updated yet, by request.

## 2. Problems found and fixed

The design and behavior are unchanged; every fix is screen-reader-only text, a page title or a media-query condition.

1. **Home had no heading.** Every other screen has an `h1`, so heading navigation found nothing on the main screen. Fix: a visually hidden `<h1>Timer</h1>` in `HomeScreen.tsx`.
2. **One page title for every tab.** Each tab is its own history entry (`#/shop`, …), but the title was always "Koa" (WCAG 2.4.2). Fix: `pageTitle()` (`src/app/pageTitle.ts`) sets "Shop · Koa", "Stats · Koa" and "Settings · Koa"; Home stays "Koa". It's set from `App.tsx` when the tab changes.
3. **"1 coins".** The coin pill's screen-reader text and the reward announcement said "1 coins" and "You earned 1 coins." (reachable with a 1-minute focus session or a small cycle bonus). Fix: a shared `coinText()` helper (`src/ui/coinText.ts`: "1 coin", "1,250 coins"), used by `CoinPill.tsx` and `RewardLayer.tsx`.
4. **Shop buttons with identical names.** Every owned item's button was named just "Wear" or "Wearing", so a screen reader's button list showed several identical buttons. Fix: visually hidden item text after the visible word ("Wear the daisy", "Wearing the daisy"). The visible word stays at the start of the name, so speech control still works.
5. **Locked price wording.** A locked item was read as "120 119 to go". Fix: visually hidden " coins," after the price, so it reads "120 coins, 119 to go". The visible text is unchanged.
6. **Sideways scrolling on narrow, zoomed screens** (WCAG 1.4.10). At 320×256 (a 1280×1024 desktop at 400% zoom), Home, Shop and Settings scrolled sideways: any short, wide window got the phone-landscape layout (side rail and two columns), which doesn't fit in 320 px. The audit also found an existing 20 px overflow on Home on old 568-px phones in landscape (the 4-inch iPhone SE and 5s): the right column was too wide. Fix: the phone-landscape condition `(orientation: landscape) and (max-height: 500px)` now also needs `and (min-width: 600px)`. That's 9 occurrences in `app.css`, `home.css`, `shop.css` and `bottom-nav.css`, with the reason explained in a comment in `app.css`. Current phones are at least 640 px wide in landscape (667 for the iPhone SE, 2nd and 3rd generation), so they keep the approved side-rail layout unchanged. Zoomed desktop windows and old 568-px phones get the existing single-column layout. A screenshot check at 568×320 and 320×256 showed it works there.

## 3. Files changed

Modified:

- `src/app/App.tsx`: sets the page title per tab
- `src/app/app.css`: landscape condition and comment
- `src/app/screens/HomeScreen.tsx`: hidden `h1`
- `src/app/screens/ShopScreen.tsx`: hidden item name on Wear/Wearing, hidden " coins," on locked prices
- `src/app/screens/home.css`: landscape condition
- `src/app/screens/shop.css`: landscape condition
- `src/ui/bottom-nav.css`: landscape condition
- `src/ui/CoinPill.tsx`: uses `coinText()`
- `src/ui/CoinPill.test.tsx`: single-coin case
- `src/features/rewards/RewardLayer.tsx`: announcement uses `coinText()`
- `e2e/shop.e2e.ts`: new button names ("Wear the daisy", "Wearing the daisy")

New:

- `src/app/pageTitle.ts`, `src/app/pageTitle.test.ts`
- `src/ui/coinText.ts`, `src/ui/coinText.test.ts`
- `e2e/accessibility.e2e.ts`
- `docs/phase-10/step-2-summary.md` (this file)

No storage, schema, PWA, dependency or configuration changes.

## 4. Accessibility coverage

**Scripted audit** (a throwaway Playwright script in the session scratchpad, not committed, no new dependency) against `pnpm build` + `vite preview`, at **390×844** and **1440×900**. States audited:

- Home: idle, running, paused, skip confirmation, after a completed session
- Settings, and the reset confirmation
- Shop
- Stats, empty and with data

Checks per state:

- the accessibility tree (roles and names)
- heading structure and landmarks (banner, main, the `Main` navigation)
- text contrast computed against the actual backgrounds
- touch targets (all at least 44×44 px)
- tab order, and whether the focus ring is visible and uncovered at each stop
- ARIA misuse: `aria-label` on role-less elements, focusable elements inside `aria-hidden`, broken `aria-labelledby`/`aria-describedby` references
- duplicate IDs
- image `alt` text

Also checked in the code:

- live regions (timer announcement, reward announcement, shop toast, Koa's speech bubble)
- steppers (spinbutton with value text, range description, "Adjusted to …" status)
- switches
- the mode chips (radio group with arrow keys, locked during a session)
- nav links with `aria-current`
- reduced motion: global CSS, `MotionConfig reducedMotion="user"`, and Koa's motions, breathing and the coin fly-up all check it

Lighthouse 13.6.0 accessibility (mobile) on all four tabs (`#/home`, `#/shop`, `#/stats`, `#/settings`): **100** each, before the fixes. That is supporting evidence only; the fixed issues are ones axe doesn't detect.

**Reflow:**

- 320×568: no sideways scroll on any tab, before and after the fix.
- 320×256: scrolled sideways before the fix; fixed.
- 568×320: scrolled sideways before the fix; fixed.
- 667×375: regression check that a current phone in landscape keeps the side rail with no sideways scroll.

## 5. Validation

| Check | Result |
|---|---|
| Focused unit tests (`coinText`, `CoinPill`, `pageTitle`) | 10 / 10 |
| `pnpm test` | **633 / 633** in 40 files (was 627 in 38) |
| `pnpm lint` | passes |
| e2e type check (`tsc -p tsconfig.e2e.json`) | passes |
| `pnpm build` | passes, `check-build: OK` (CSS 7.8 kB gzip, within budget) |
| `git diff --check` | clean |
| E2E: `accessibility`, `shop`, `app`, `rewards` specs, all three projects | 37 / 37 (before the 560 → 600 px threshold change) |
| E2E: `accessibility.e2e.ts` after the final CSS change, all three projects | **12 / 12** |

The full 63-run suite was **intentionally not re-run**. `timer`, `settings` and `data` don't touch the changed screens' names, titles, coin wording or the landscape layout. Before the final threshold change, the 37-run check passed except 2 failures in the new landscape test; those failures exposed the 568-px overflow and led to the 600 px threshold. The shop/app/rewards specs use no viewport affected by that last CSS change.

New `e2e/accessibility.e2e.ts` (4 tests × 3 projects):

1. Every screen has one `h1` and its own page title.
2. Shop buttons name their item (two owned hats: "Wear the sage beanie" and "Wearing the sand cap"), and locked prices include "coins,".
3. No sideways scroll on any tab at 320×568, 320×256 and 568×320.
4. A 667×375 phone keeps the side rail with no sideways scroll.

The suite is now 25 tests × 3 projects = 75 runs (was 21 × 3 = 63).

## 6. Intentionally unchanged / known deviations

- **Dimmed nav and coin pill during focus** (opacity 0.4, about 1.9:1 contrast, below WCAG 4.5:1). This is the approved "chrome dims during focus" design. It returns to full strength on hover and keyboard focus (`:focus-within`), and raising it enough to pass would undo the effect. Open for the owner's decision.
- **Disabled mode chips during a session** (about 1.9:1). WCAG 1.4.3 exempts disabled controls.
- **Flying "+N" coin labels.** They're decorative, hidden from screen readers and short-lived; the low readings were measured mid-fade (the resting colors are dark ink on cream). The live announcement ("You earned 25 coins.") carries the information.
- **The shop's second-tap confirmation "Buy for 80?" doesn't name the item.** It isn't a dialog: the same button relabels in place and keeps focus, so the context ("Buy Daisy for 80 coins", activated a moment earlier) is clear.
- **195 px wide (a phone at 200% page zoom) still scrolls sideways.** WCAG 1.4.10 requires 320 px, which now passes everywhere; 195 px would need a separate narrow layout. This is the existing known limitation from Phase 9.

## 7. Next step

1. The owner reviews this implementation.
2. If approved, update `docs/phase-10/e2e-suite.md` with the new accessibility spec and the counts (25 tests, 75 runs).
3. Then update the roadmap (Phase 10 row and decisions log), `CLAUDE.md` (status, the landscape `min-width: 600px` condition, Next steps, known limitations) and commit.
4. No push or deploy until explicitly approved.
