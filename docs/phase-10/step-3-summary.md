# Phase 10, Step 3: motion tuning (summary)

## 1. Status

- Phase 10 Step 3: motion tuning.
- Implementation complete; **ready for documentation and commit**.
- **Not committed.** Step 2 is committed as `7146d37`; this step's changes are only in the working tree.
- The roadmap, `CLAUDE.md` and `docs/phase-10/e2e-suite.md` are not updated yet, by request.

## 2. Issues found and fixed

A polish pass: no new animations, poses, reactions or features. Each issue below was measured in the running app (production build, Playwright at 390×844 in Chromium) on the original code and again after the change, using temporary probe specs that were deleted afterwards.

1. **The progress ring animated continuously during focus.** The arc had a `stroke-dashoffset` transition of 600 ms, but the timer updates every 250 ms, so a new transition started before the previous one ended. The ring was repainted on every frame for the whole session, for sub-pixel steps (a 25-minute session moves it 0.017% per update). The leaf at the head of the arc had no transition, so the two drifted apart. It was also the one animated property that wasn't transform or opacity.
   - Measured during a running session: **181 / 181 frames** had a running arc transition before, **0 / 181** after.
   - Fix: the transition is removed (`src/ui/progress-ring.css`, with the reason in a comment). The arc and the leaf now always move together.
   - Intended consequence: the catch-up after the app was in the background now jumps instead of gliding. On a reset the arc already disappeared instantly (its opacity snaps to 0), so nothing changes there.

2. **Celebration speech bubbles stayed up too long.** The bubble's fade-out reused the fade-in's transition, including its 2.3–3 s delay (which makes the line wait for the "+25" labels). So after its time was up, the bubble stayed fully visible for that long again.
   - Measured after a completed focus session: the bubble was gone about **3.8 s** after its time ended before, about **0.8 s** after. Both include up to 1 s before Koa's behavior store updates.
   - Fix: the fade-out has its own 0.18 s transition with no delay (`src/features/koala/KoaCompanion.tsx`).

3. **Buying an item dropped keyboard focus.** The small "pop" on the item card after a purchase was done by changing the card's `key`, which rebuilt the card and removed the focused button.
   - Fix: the card is animated in place with `useAnimate` (the same spring: stiffness 500, damping 18, scale 0.96 → 1). Focus stays on the button as it changes from "Buy for N?" to "Wearing the …" (`src/app/screens/ShopScreen.tsx`).
   - Explicitly skipped under reduced motion (`useReducedMotion`).
   - Confirmed by the updated accessibility E2E assertion, which fails on the old code (section 4).

4. **Tab switches took 400 ms.** With `AnimatePresence mode="wait"`, the outgoing screen fades out (0.2 s) before the new one fades in (0.2 s).
   - Fix: the outgoing fade is 0.12 s (`src/app/App.tsx`); the incoming fade is unchanged. A tab switch now takes about **320 ms instead of 400 ms**. That figure is the sum of the two durations, not a measurement.

**Suspected issues that were tested and reverted (not real):**

- **Koa replaying his previous motion on returning to Home.** The brain keeps its latest motion, so a remount looked likely to replay it. A frame-by-frame probe showed no replay on the original code. The guard that was added was reverted.
- **Koa snapping back to rest when tapped quickly.** Starting each motion from the current pose (`null` first keyframes) was tried. Over three rapid-tap runs, the largest frame-to-frame scale changes were the same before and after, because Motion already continues from the current value when a motion is interrupted. The change and its unit test were reverted.

## 3. Files changed

- `src/ui/progress-ring.css`: arc transition removed (comment explains why)
- `src/features/koala/KoaCompanion.tsx`: the bubble's own fade-out transition
- `src/app/screens/ShopScreen.tsx`: purchase pop animated in place, skipped under reduced motion
- `src/app/App.tsx`: shorter outgoing tab fade
- `e2e/accessibility.e2e.ts`: the `buy()` helper buys with the keyboard and checks focus

No storage, schema, timer, reward, routing, PWA, dependency or configuration changes. No new animations.

## 4. Tests and validation

| Check | Result |
|---|---|
| `pnpm test` | **633 / 633** (no unit tests added) |
| `pnpm lint` | passes |
| `pnpm build` | passes, `check-build: OK` (entry JS 151.3 kB, CSS 7.8 kB gzip) |
| E2E: `accessibility`, `shop`, `app`, `rewards` specs, all three projects | **39 / 39** |
| `git diff --check` | clean |

- The full 75-run suite was **intentionally not re-run**. The `timer`, `settings` and `data` specs check what the screens show, not animation timing.
- **Accessibility E2E assertion updated:** `buy()` in `e2e/accessibility.e2e.ts` now buys with the keyboard (Enter on the price button, then Enter again). It checks that focus is on "Buy for N?" and then on "Wearing the …". It's deterministic, has no sleeps, adds no new test (the suite is still 25 tests / 75 runs), and works in WebKit, which doesn't focus buttons on click. It was **confirmed to fail on the old card code** ("Expected: focused, Received: inactive").

## 5. Reduced motion

- The global reduced-motion CSS in `src/styles/base.css` remains (animations and transitions cut to 0.01 ms).
- `MotionConfig reducedMotion="user"` remains.
- Koa stays reduced: no movement; blinks, bubble fades and the static "z" glyphs remain.
- The purchase pop is explicitly skipped.
- The bubble's fade-out is opacity only (`MotionConfig` disables its transform).
- No new motion was introduced for reduced-motion users.

## 6. Intentionally unchanged

- **Koa's motion durations and easing, blink timing and nap glyphs:** they already fit the character bible, and Koa stays still during focus.
- **A small breathing hitch when Koa's breathing pace changes** (for example, when focus starts): changing `animation-duration` mid-loop jumps the phase, at most 1.6% of the figure's height. Fixing it would mean rebuilding the breathing animation.
- **A bubble showing again on returning to Home** waits its fade-in delay again. It's rare and only a delay.
- **The Stats bar entrance** (≤ 640 ms) replays on each visit; it is that screen's entrance.
- **Already quick and consistent:** the nav and segmented control sliders, button press feedback, toasts, the update prompt, and the coin fly-up with the pill count-up and bump.
- **The dimmed nav and coin pill during focus** (about 1.9:1): the approved design, still an open accessibility deviation for the owner's decision (Step 2 summary §6).

## 7. Next step

After review:

1. Update `docs/phase-10/e2e-suite.md` if needed to record the updated accessibility E2E assertion and coverage.
2. Update `docs/roadmap.md` for Step 3.
3. Update `CLAUDE.md` only where status or next-step information is now stale.
4. Then commit.
5. No push or deploy until explicitly approved.
