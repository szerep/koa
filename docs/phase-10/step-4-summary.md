# Phase 10, Step 4: copy pass (summary)

## 1. Status

- Phase 10 Step 4: copy pass.
- Implementation complete; **ready for documentation and commit review**.
- **Not committed.** Step 3 is committed as `d57d683`; this step's changes are only in the working tree.
- Phase 10 stays open; the bug bash comes after Step 4.
- The roadmap, `CLAUDE.md` and `docs/phase-10/e2e-suite.md` are not updated yet, by request.

## 2. Audit result

The user-facing copy was audited across Home and the timer, rewards and announcements, Koa's lines, the shop (including the visually hidden text from Step 2), Stats and its empty state, every Settings hint, the reset confirmation and its result messages, notifications, the install card, the update prompt, the navigation, page titles, and the error and fallback messages (including `public/404.html`). Most of it was already clear, warm, concise and consistent, so only three concrete fixes were made.

| Where | Before | After | Why |
|---|---|---|---|
| Koa's cycle lines (`koalaLines.cycle`) | "Four in a row! Amazing." | "All the way to a long break! Amazing." | Factually wrong: the long-break setting allows 2–8 sessions, so "Four in a row!" was only true at the default. Same tone. |
| Shop toast, not enough coins | "You need 1 more coins for the daisy." | "You need 1 more coin for the daisy." (other amounts unchanged: "You need 5 more coins …") | Grammar bug for exactly 1 missing coin. The toast only appears if another tab spent the coins first. |
| Browser tab title while a session runs | "24:59 Focus \| Koa" | "24:59 Focus · Koa" | The page titles from Step 2 ("Shop · Koa") and the 404 page ("Page not found · Koa") use `·`. |

**Reviewed and deliberately left unchanged:**

- **Straight vs curly apostrophes:** the interface uses straight ones; Koa's lines and one shop description use curly ones. Making them match would touch dozens of strings for a barely visible difference.
- **"Focus session done"** (notification) vs **"Focus session complete"** (screen-reader announcement): both are natural in their own place.
- **"Took off the daisy."** has no subject, but it's clear next to the outfit list.
- **"+30 Cycle bonus"** capitalizes the word after the number; it reads fine as a label.
- **The 404 page's "We couldn't find…"** vs the app's "Koa couldn't…": the obvious rewrite repeats "Koa" twice in two sentences.
- **Koa's "Hi again!"** can greet a first-ever visit, and **"proud"** appears in two celebration lines: both are in character, and the brain avoids repeating recent lines.
- **"Home screen" vs "Home Screen":** each matches the platform's own menu label (Android Chrome vs iOS).

## 3. Files changed

- `src/config/koalaLines.ts`: the cycle line
- `src/app/screens/ShopScreen.tsx`: singular "coin" in the not-enough-coins toast
- `src/app/useTimerAmbience.ts`: `·` instead of `|` in the running-session title

## 4. Validation

| Check | Result |
|---|---|
| `pnpm test` | **633 / 633** (no tests changed) |
| `pnpm lint` | passes |
| `pnpm build` | passes, `check-build: OK` |
| `git diff --check` | clean |

E2E was not run: a search of the specs found that none use the changed strings or accessible names.

## 5. Bug-bash candidate (NOT FIXED, NOT VERIFIED)

- `useTimerAmbience` may reset `document.title` to plain "Koa" when a timer stops, even when the user is on another tab such as Shop, where the title should stay "Shop · Koa" (the per-tab titles from Step 2, set in `App.tsx`).
- Found by reading the code; **not reproduced**.
- To be investigated in the Phase 10 bug bash, not folded into the copy pass.

## 6. Intentional scope

- No new features or new copy.
- No behavior changed beyond the wording and the title separator.
- No changes to animations, timer logic, storage, routing, PWA, dependencies or configuration.
- No broad copy rewrite.
