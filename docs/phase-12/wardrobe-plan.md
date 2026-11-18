# Phase 12: Wardrobe

**Status (2026-11-18): ✅ complete; the completion review passed and was approved by the owner (§7).** The plan, Step 0 and Steps 1–2 were approved on 2026-11-18 (Steps 1–2 with one required fix: the Home button moved to the stage's bottom-right), then Step 3 (E2E, budget, offline, documentation, completion review) and the owner-requested development-only Dev Tools. Not deployed: production stays `c4daa76` until the next approved push.

*Earlier status (2026-11-18), kept as history:* every step implemented and validated, awaiting the owner's review.

*Earlier status (2026-11-18), kept as history:* Steps 1 and 2 implemented in one pass, awaiting the owner's review.

*Earlier status (2026-11-18), kept as history:* Step 0 implemented, awaiting the owner's review.

## 1. Concept

**Koa's closet:** a screen just for Koa where you dress Koa in what you've earned. Koa is large and alive (breathing, blinking, tap reactions, speech), your owned items are grouped by where they go on Koa, and Koa reacts to every change. **The Shop is where you get things; the Wardrobe is where you enjoy and manage them.**

- Reached from Home and from the Shop, at `#/wardrobe`. **Not a fifth bottom-nav tab.**
- Built entirely from what exists: the wallet (ownership), the wardrobe slice (what Koa wears), `<KoaCompanion>`, the existing idle and blink frames, the approved beanie and round-glasses overlays, `AccessoryThumb` crops and `koalaStore.showOff()`.
- **Kept separate from the future "room" / room-theming idea** (design brief §5–6): no illustrated room, furniture, hooks, shelves, room themes or Rooms category.

## 2. Owner decisions (2026-11-18)

1. A dedicated `#/wardrobe` route reached from Home and the Shop; **no fifth bottom-nav tab**.
2. Owned items **without artwork appear** in the Wardrobe, with an honest state consistent with the Shop (color swatch, "Artwork coming soon"); they can be worn, as in the Shop.
3. Koa speaks and reacts in the Wardrobe, **reusing `koalaStore.showOff()`**; no Wardrobe-specific reaction or animation system.
4. Strictly separate from the room / room-theming concept (see above).
5. **No new artwork.** Existing Koa frames and accessory art/crops only.
6. **Not generalized** for the companion koala, friends or other characters.
7. **The Shop's behavior stays intact.** The Shop acquires; the Wardrobe enjoys and manages.
8. **The existing data model stays.** No new persistence or schema unless a concrete requirement can't be met with the wallet and wardrobe slices.
9. **Done** returns to the screen the user came from, as a new history entry (like a tab tap). Loaded directly, or with an unknown return target: Home.
10. **No bottom-nav item is highlighted** on `#/wardrobe` (Home isn't highlighted either).
11. The Shop shows **"Open wardrobe" only when the user owns at least one item**. The Home button also shows when the wardrobe is empty, so the empty state can lead to the Shop.
12. Items are listed in **catalog order** within each slot.
13. **Step 0 includes the behavior-preserving refactor:** `wornItemIds()`, `closetBySlot()` and the shared `toggleWear()` come first, and Home and the Shop are migrated to them, with existing behavior unchanged.

## 3. Technical contracts

| Topic | Contract |
|---|---|
| **Layer order** | `wornItemIds(wardrobe)` (`src/core/shop/shop.ts`) returns the worn ids in `SLOTS` order: head, face, neck, ear, body. It's the **single source of accessory layer order**: Home, Shop and Wardrobe pass it to `<Koala wearing>`, which draws overlays in the order given (later = on top, so the glasses go over the beanie). It never depends on the wardrobe object's key order. `Koala.tsx` is unchanged apart from its prop comment, which states the contract. |
| **Slot grouping** | `closetBySlot(catalog, wallet)` returns `{ slot, items }[]`: only slots with at least one owned item, in `SLOTS` order; items in catalog order. Ownership comes from `isOwned` alone; owned ids missing from the catalog are ignored. Labels: `slotLabels` in `src/config/catalog.ts` (Head, Face, Neck, Ear, Body; the copy can change in Step 2). |
| **Shared wear path** | `createToggleWear({ wardrobe, koala })` (`src/app/wear.ts`) returns `toggleWear(item)`, which gives back `{ change: 'on' \| 'off', message }` or `null`. Worn → takes it off ("Took off the …", no reaction). Not worn → puts it on, replacing its slot, then `koala.showOff()` ("Koa is wearing the …"). Not owned → `null`, nothing changes. It reads the store's latest state. The wired instance is `src/app/toggleWear.ts`. It lives in the app layer because it joins two features (wardrobe and Koa's brain), and features don't import each other. The Shop's buy flow (buy → wear → `showOff`) is unchanged. |
| **Routing** (Step 1; as built) | `src/app/navigation.ts`: `TABS`, `ROUTES = [...TABS, 'wardrobe']`, `isTab`, `returnTarget`, and `wardrobeNav` (from `createWardrobeNavigation`): `wardrobeNav.open(from)` opens the Wardrobe and remembers the opener, `wardrobeNav.close()` is Done (decision 9: a new history entry to the opener, Home if unknown), `wardrobeNav.visit(tab)` leaves without a way back (the empty state's "Visit the Shop"), `arrived(route)` is called by `App.tsx` on every route change, and `takeFocus(screen)` hands keyboard focus over on mount. Route titles live in `App.tsx` (`routeTitles` = the 4 nav items + "Wardrobe"), passed to `pageTitle()`: "Wardrobe · Koa", with the countdown still winning while a session runs. `useHashTab(ROUTES, 'home')` is already generic. `navItems` stays at 4. `BottomNav` accepts `current: T \| null`; on `#/wardrobe` it's `null`. *Not to be confused with the E2E helper `openWardrobe(page, 'Home' \| 'Shop')` in `e2e/support/koa.ts`, which taps a Wardrobe button like a user. The plan's working names `openWardrobe(from)` / `closeWardrobe()` became `wardrobeNav.open` / `wardrobeNav.close`.* |
| **Home entry** (Step 1) | A 44 px round icon button (Lucide `Shirt`, "Open the wardrobe") in the empty top-right corner of the square Home stage (**moved to the bottom-right** at the owner's review, §7, so Koa's bubble can't cover it), absolutely positioned (no layout shift). **Not rendered** while `mode === 'focus' && isInProgress(state)` (running or paused focus); shown during breaks, when idle and when the wardrobe is empty. |
| **Shop entry** (Step 1) | "Open wardrobe" (secondary button) in the Shop's preview card, when at least one item is owned. |
| **Rendering** | `<KoaCompanion speaks interactive wearing={wornItemIds(…)}>`: the idle and blink frames plus existing overlays only. No new motions, lines or poses. |
| **showOff** | Reused unchanged. Its existing wiggle when an item is worn during a focus session (speech is already silent then) is kept as is. |
| **Precache** | Unchanged: no new images, and new JS lands in `assets/*.js`, which the precache includes by pattern. `PRECACHE_FIXED`, `vite.config.ts` and the 22 entries don't change; the precache grows only by the new code's bytes. |
| **Persistence** | None: the existing `wallet` and `wardrobe` slices, no schema or version change. Reset progress, cross-tab refresh and restore validation cover the Wardrobe automatically. |

## 4. Steps

Each step is documented here, reviewed, and approved before the next one starts. Unit tests go next to the code in every step. No commit, push or deploy unless asked (a push to `main` deploys production).

### Step 0: Plan and contracts (no visible change)

- **Scope:** this document; the roadmap (Phase 12 row, Future/Deferred item 2, decisions log) and `CLAUDE.md` status; `wornItemIds()` and `closetBySlot()` in `src/core/shop/shop.ts`; `slotLabels` in `src/config/catalog.ts`; `src/app/wear.ts` and `src/app/toggleWear.ts`; Home and the Shop migrated to `wornItemIds` and the shared `toggleWear`; the `Koala` `wearing` prop comment.
- **Acceptance:** no user-visible or behavioral change (Shop toggles, toast text, chips, focus, Koa's reactions); the same overlay order on Home and in the Shop for every combination.
- **Tests:** `wornItemIds` (slot order regardless of key order, empty slots skipped, matches equip/unequip); `closetBySlot` (nothing owned, only owned, grouped by slot not category, catalog order within a slot, only non-empty slots in slot order, ids missing from the catalog ignored); `toggleWear` (on + one show-off, off without reaction, not owned → `null`, swap within a slot, other slots untouched, latest state after another tab's change, saved through the store). Existing unit and E2E suites unchanged.
- **Out of scope:** routes, the Wardrobe screen, entry buttons, any visual change.

### Step 1: The Wardrobe screen and its entries

- **Scope:** `src/app/navigation.ts` (+ test); `App.tsx` (the route, labels, `current = null` on the Wardrobe); `BottomNav` (`current: T | null`); `WardrobeScreen.tsx` + `wardrobe.css`:
  - a header: an `h1` "Wardrobe" and a "Done" button;
  - the Koa stage;
  - one section per `closetBySlot` group, each with an `h2` slot label and item tiles. A tile is a toggle button with `aria-pressed`, named like the Shop's ("Wear the …" / "Wearing the …"), showing the `AccessoryThumb` crop or the swatch with "Artwork coming soon";
  - the Shop's note about items without art;
  - a visually hidden status region;
  - an empty state with Koa and "Visit the Shop".

  Plus the Home and Shop entry buttons, in a basic single-column phone layout.
- **Acceptance** (Playwright, 390×844):
  - Entries appear per the rules above.
  - Wear, take off and swap work, with `showOff` on putting something on.
  - Items without art are listed and wearable.
  - Done returns to where you came from (Home after a reload or direct link), and the back gesture works.
  - No nav item is current; the title is "Wardrobe · Koa".
  - The Home button is absent during running or paused focus.
- **Tests:** `pageTitle` for a non-nav route; `navigation.ts` return-target fallback; `BottomNav` with no current item; the existing E2E suite.
- **Out of scope:** iPad, desktop and landscape layouts, the sticky stage, polish, new E2E journeys.

### Step 2: Responsive layout, accessibility and polish

- **Scope:**
  - **Phone portrait:** a sticky, height-capped Koa stage.
  - **Two columns** at `min-width: 960px` and in the landscape rail layout.
  - **Narrow screens:** 12 px gutters below 360 px; no sideways scroll at 320 px.
  - **Home button placement:** verified at the 200 px minimum stage (ring, leaf cap, lifted bubble).
  - **Accessibility:** focus stays on a toggled tile, focus order, announcements, reduced motion, the focus-dimmed chrome.
  - **Copy pass** on the new text.
- **Acceptance:**
  - Screenshots without overlap or clipping at 390×844, 375×667, 820×1180, 1440×900, 844×390 and 320 px wide, with nothing owned, 2 items and all 9.
  - Koa stays visible while toggling at 390×844; a documented fallback is acceptable at 375×667 if needed.
  - Keyboard-only use works.
- **Out of scope:** new lines or motions, "Take everything off", Shop category deep links, room or decor visuals.

### Step 3: E2E, budget and completion review

- **Scope:**
  - **`e2e/wardrobe.e2e.ts`** (about 5 journeys):
    1. the empty state leads to the Shop;
    2. buy → open → take off → reload → Done → Home layers;
    3. the Home entry is hidden during focus and shown during a break;
    4. an item without art is listed, wearable and saved;
    5. a direct load: Done goes Home, back works, no current nav item, the title is correct.
  - **The accessibility spec** gets the Wardrobe heading/title and the 320 px check.
  - **An `openWardrobe` helper.**
  - **Budget:** entry JS, 152.1 of 160 kB gzip after Step 0. If it's exceeded: stop and propose `React.lazy`, which needs approval.
  - **A throwaway offline check** against `pnpm preview`.
  - **Docs:** `architecture.md`, `design-brief.md` §6, `e2e-suite.md`, the roadmap, `CLAUDE.md`, the completion review here.
- **Acceptance:** `pnpm test`, `pnpm lint`, `pnpm build` (`check-build: OK`, budget met) and `pnpm test:e2e` pass; the precache list is unchanged; offline works; the docs match the build.

### Out of scope for the whole phase

Illustrated rooms, furniture, hooks or shelves; room themes or a Rooms category; new artwork, poses, motions or Koa lines; hoodie recolors; saved outfits; "new item" badges; storage or schema changes; a fifth tab; generalizing for the companion, friends or other characters; changes to the Shop's purchase flow.

## 5. Step 0 implementation (2026-11-18, approved)

**Files changed:**
- `src/core/shop/shop.ts`: `wornItemIds()`, `ClosetGroup`, `closetBySlot()`.
- `src/core/shop/shop.test.ts`: 4 `wornItemIds` tests and 6 `closetBySlot` tests.
- `src/config/catalog.ts`: `slotLabels` (unused until Step 1).
- `src/app/wear.ts` (new): `createToggleWear`, `ToggleWearDeps`, `WearChange`.
- `src/app/toggleWear.ts` (new): the instance wired to `wardrobeStore` and `koalaStore`.
- `src/app/wear.test.ts` (new): 7 tests, with real wallet and wardrobe stores on memory storage and a counting fake Koa.
- `src/app/screens/HomeScreen.tsx`: `wearing={wornItemIds(wardrobe)}` (was `Object.values(wardrobe)` filtered).
- `src/app/screens/ShopScreen.tsx`: the worn list from `wornItemIds` (was `SLOTS.flatMap`); `toggleWear` calls the shared path and shows its message (was inline equip/unequip/showOff).
- `src/features/koala/Koala.tsx`: the `wearing` prop comment only.
- Docs: this file, `docs/roadmap.md`, `CLAUDE.md`.

**Not changed:**
- `buy()`, `ItemCard`, the double-tap guard and the toasts' styling.
- `Koala` rendering.
- `src/core/data/data.ts`: it counts worn items with `Object.values`; the order doesn't matter for a count.

**Validation:**
- `pnpm test`: **678 / 678** (44 files; 661 before plus 17 new).
- `pnpm lint`: clean.
- `pnpm build`: `check-build: OK`. Entry JS 152.1 kB gzip (was 152.0) of 160; CSS 7.9 kB; precache 22 entries, 1025.6 kB (was 1025.4).
- `pnpm test:e2e`: **81 / 81** on the second full run. The first full run had **one failure**, described below.

**Behavior unchanged, checked directly:** a throwaway Playwright probe (scratchpad, not committed) ran the same script against a production build of the **baseline** (`c4daa76`, changes stashed) and of **Step 0**, in Chromium (390×844) and WebKit (iPhone 13). It seeds a save that owns the beanie, the round glasses and the daisy, with the wardrobe keys in reverse slot order. It recorded:
- the layer order on Home and in the Shop preview;
- the chip order;
- the keyboard Wear toggle off and on (toast text, `aria-pressed`, focus kept on the button);
- Koa's show-off line on Home after wearing;
- a chip take-off;
- wearing the daisy (no art) and the art note;
- wearing during a running focus session (the toast; no line on Home);
- the saved wardrobe after a reload;
- console errors.

All 42 observations were **identical** for the baseline and Step 0, with no errors.

**Issue found (not caused by Step 0, as far as can be determined; not fixed):** `shop.e2e.ts` "the round glasses show their own artwork…" failed intermittently on `iphone-webkit`.
- **Symptom:** after "Buy Round glasses for 180 coins" → "Buy for 180?", the purchase didn't happen. The card was back at "180", there was no toast, and the coins stayed at 290.
- **Counts:**
  - With Step 0: 2 failures in 57 runs (once in the first full suite run, 1 in 8 repeats right after it; then 0 in 16 and 0 in 32).
  - Baseline: 0 in 32.
- **Why it's attributed to the old flow:** the code path to the failure is unchanged by Step 0 (`buy()` and `ItemCard` are untouched, `toggleWear` isn't reached, and the worn list is empty either way).
- **Likely cause (not proven):** the "Buy for 180?" confirmation reverts after `CONFIRM_MS` (3.5 s) on the same button element. If slow WebKit on Windows, under load, takes longer than that before the second click, the click lands on the reverted price button and only re-opens the confirmation, which matches the snapshot exactly.
- **Ruled out:** a probe found that WebKit reports `detail` 1 for both clicks (40 of 40), so the double-tap guard (`detail > 1`) isn't the cause.
- **No trace was kept** of a failing run, because later runs cleared `test-results/`.
- **Watch it in Step 3.** If it recurs, a test-side fix (asserting "Buy for 180?" is visible and clicking without delay, or a longer window in tests) is a separate decision.

## 6. Steps 1 and 2 implementation (2026-11-18, approved with the Home button fix in §7)

The owner asked for Steps 1 and 2 in one continuous pass, stopping before Step 3.

### Files

- **New:**
  - `src/app/navigation.ts`: `TABS`, `ROUTES`, `isTab`, `returnTarget`, `createWardrobeNavigation` and the `wardrobeNav` instance.
  - `src/app/navigation.test.ts`: 11 tests.
  - `src/app/screens/WardrobeScreen.tsx` and `src/app/screens/wardrobe.css`.
  - `src/ui/BottomNav.test.tsx`: 2 tests.
- **Changed:**
  - `src/app/App.tsx`: routes, the screen map, route titles, `wardrobeNav.arrived(route)`, no current nav item on the Wardrobe.
  - `src/ui/BottomNav.tsx`: `current: T | null`.
  - `src/ui/Button.tsx`: `IconButton` accepts a `ref`.
  - `src/app/pageTitle.test.ts`: 1 test.
  - `src/app/screens/HomeScreen.tsx` and `home.css`: the entry button.
  - `src/app/screens/ShopScreen.tsx` and `shop.css`: "Open wardrobe".
  - These docs.

### Step 1: the screen and its entries

- **Route:** `#/wardrobe` is in `ROUTES` but not in `navItems` (still 4 tabs). On it, `BottomNav` gets `current = null` (no `aria-current`, no highlight, Home included), and the title is "Wardrobe · Koa" (the countdown while a session runs).
- **Done:**
  - `wardrobeNav.open(from)` remembers the opener in memory; `close()` sets the hash to it as a new history entry, never `history.back()`.
  - The origin is unknown after a direct load or reload, after leaving the Wardrobe any other way (a nav tab, the back gesture), or after a previous Done. In all of those, Done goes Home (`arrived()` forgets it).
  - "Visit the Shop" (the empty state) goes to the Shop without coming back.
- **Home entry:** `IconButton` (Lucide `Shirt`, 44 px, "Open the wardrobe") in the stage's top-right corner.
  - It's positioned on the stage's diagonal, 8 px outside the ring's outer edge at every stage size (measured: 7.7 px at 200–500 px stages), and absolutely positioned, so Home's layout is unchanged.
  - On the smallest stages it reaches a few pixels past the stage corner, never onto the chips (closest: 4.2 px at 320×568).
  - It's placed before Koa in the document, so Koa's bubble draws over it.
  - **Not rendered** while `mode === 'focus' && isInProgress(state)`. Shown when idle, during breaks, and with an empty wardrobe.
- **Shop entry:** "Open wardrobe" (`Button`, secondary, with the `Shirt` icon), only when a catalog item is owned. It sits on its own row across the bottom of the preview card, aligned to the end: the outfit column is about 124 px wide at 320 px, too narrow for it. It uses the "wearing" chips' tint.
- **Screen:**
  - A header with `h1` "Wardrobe" and "Done".
  - Koa: `KoaCompanion` with `interactive` and `speaks`, `wearing={wornItemIds(wardrobe)}`, idle and blink frames and existing overlays only. Koa sits in a round pool of light (the empty states' disc), sized like Home's halo: Koa is 0.7 × stage, feet just over the edge.
  - The closet: one `section` per `closetBySlot` group (`h2` from `slotLabels`), tiles in catalog order. Each tile is a toggle button (`aria-pressed`), named like the Shop's Wear buttons ("Wear the sage beanie" / "Wearing the sage beanie", which contains the visible name). It shows the `AccessoryThumb` crop, or the item's swatch plus "Artwork coming soon" (also the tile's `aria-describedby`).
  - A tap goes through the shared `toggleWear()`: `showOff()` on putting something on, so Koa wiggles and says a show-off line. As in the Shop, only the first click of a double-tap counts.
  - The result message goes to a visually hidden `role="status"` region.
  - The empty state: "Nothing to try on yet", "Things you buy in the Shop end up here, ready for Koa to wear.", "Visit the Shop".
- **Persistence, storage, the Shop's purchase flow, artwork and the precache list:** unchanged.

### Step 2: responsive layout, accessibility and polish

- **Phones (portrait):**
  - The header and Koa are pinned in a cream band (`position: sticky`, `top: var(--safe-top)`) that the closet scrolls under, so every change is seen on Koa and Done is always reachable.
  - Stage `clamp(150px, min(62vw, 30dvh), 300px)`: 242 px at 390×844, 200 px at 375×667, 170 px at 320×568.
  - `html:has(.wardrobe)` sets `scroll-padding-top` so a keyboard-focused tile is scrolled clear of the band. Checked: all 9 tiles visible when focused, in Chromium and WebKit.
  - With nothing owned, the band isn't pinned.
- **Tablets (portrait):** the same column, stage up to 340 px.
- **Wide screens (≥ 960 px) and landscape phones** (the existing `(orientation: landscape) and (max-height: 500px) and (min-width: 600px)` condition): two columns, Koa pinned on the left; the header (title, Done) pinned at the top of the right column, slightly wider than the column so the tiles' rings pass under it.
- **Tiles:** `repeat(auto-fill, minmax(100px, 1fr))`: 2 columns at 320 px, 3 at 375–390, 6 at 820, 4 at 1440 (two-column), 3 at 844×390. The worn state is the green ring (as on the Shop's equipped card) plus a small check disc in the tile's corner. A text badge was tried first and covered the beanie's pom-pom.
- **Focus:**
  - Opening the Wardrobe from Home or the Shop moves keyboard focus to its heading (`tabIndex={-1}`, no outline: it isn't a control). A direct load doesn't move focus.
  - Done returns focus to the button that opened it ("Open the wardrobe" or "Open wardrobe").
  - A toggled tile keeps focus.
  - Requests are claimed once and lapse if the user goes elsewhere (`takeFocus`).
- **Reduced motion:** Koa doesn't move (checked: no animation on a show-off), and the line still fades in. The tiles have only a 0.97 press scale, which the global rule makes instant.
- **Chrome:** the existing focus-session dimming applies (app level). The Wardrobe's own chrome is quiet: a secondary Done, muted hint text; Koa is the only strong element.
- **Copy:**
  - Hint: "Tap an item to put it on or take it off."
  - Art note: "Artwork for some items is still being made. Koa can wear them, but can't show them off yet."
  - Empty state as above.

### Deviations from the plan (presentation details)

- **The art note** shows while any item without art is **owned**, not only while one is worn (the Shop's rule), with its own wording. Toggling a daisy would otherwise insert a line above the tiles and push them under the user's finger.
- **The worn mark** is a check disc instead of a "Wearing" label (see above).
- **"Open wardrobe"** is on its own row of the Shop's preview card with the chips' tint, not inside the outfit column.
- **Additions not named in the plan:**
  - the pinned header in the two-column layout (Done stayed out of reach after scrolling);
  - the double-tap guard on tiles (the Shop's Bug Bash rule);
  - `IconButton`'s `ref` (for returning focus).

### Validation (2026-11-18)

- `pnpm test` **692 / 692** (46 files; 678 + 14 new), `pnpm lint` clean, `git diff --check` clean.
- `pnpm build` `check-build: OK`: entry JS **153.3 kB** gzip of 160 (152.1 after Step 0); CSS 8.6 kB of 12; precache **22 entries** (unchanged list), 1035.4 kB of 1200.
- `pnpm test:e2e` **81 / 81** on the first full run (no Wardrobe E2E yet: Step 3).
- **Throwaway probes** (scratchpad, not committed) against `pnpm build` + `vite preview`:
  - **Layout,** Chromium at 390×844, 375×667, 820×1180, 1440×900, 844×390 and 320×568, with nothing owned, 2 items and all 9:
    - no horizontal overflow on Home, Shop or Wardrobe;
    - no clipped text;
    - the stage and Done fully on screen, also scrolled to the bottom;
    - no tile under the stage;
    - the last tile clears the bottom nav;
    - the Home button clears the ring, chips, bar, nav, Koa and timer;
    - the Shop entry follows the ownership rule;
    - no console errors.
  - **Flows,** Chromium and WebKit, service workers blocked as in the E2E suite: **all checks pass.** Covered:
    - focus moves to the heading, then back to each opener;
    - title; no current nav item;
    - empty state → Shop; Shop entry hidden when nothing is owned;
    - slot order; tile names and pressed state; "Artwork coming soon" description;
    - wear: status, show-off line, layer order; take off;
    - double tap; keyboard toggle keeps focus;
    - Done to Home and to the Shop; the back gesture; history entries; a direct load;
    - the Home entry hidden in running and paused focus, shown after a reset and during a break;
    - reduced motion; persistence after a reload;
    - every focused tile visible;
    - no console errors.
  - **WebKit 390×844, scrolled:** the band stays pinned.

### Found during validation (for the owner's review)

- **Koa's bubble can cover the Home wardrobe button.** On short screens (seen at 375×667, 320×568 and 844×390) with the beanie worn, the lifted greeting or idle line reaches the button's position for as long as it shows (about 3.5 s). It depends on the line's length. At 375×667 it touches the edge; at 320×568 it covers about half the button.
  - The bubble draws on top, so its text stays readable, and it ignores pointer events, so the button can still be tapped.
  - This is the same family as the accepted bubble/leaf-marker overlap (`docs/phase-11/step-1-beanie.md` §6).
  - Not changed: moving the button or hiding it while Koa speaks would be a new product decision.
- **WebKit logs "…/sw.js due to access control checks"** in some runs with service workers allowed. This **predates Phase 12**: the baseline build (`c4daa76`, changes stashed) showed it in **7 of 10** runs of a Home-only scenario, and Phase 12 doesn't touch the service worker. With workers blocked (as in the E2E suite) there are no console errors.
- **The Step 0 intermittent WebKit round-glasses purchase failure** didn't recur (81 / 81).

## 7. Owner review of Steps 1–2, Step 3, Dev Tools and the completion review (2026-11-18, approved)

The owner approved Steps 1 and 2 with one required change (the Home button), then asked for Step 3 and afterwards a small development-only Dev Tools feature, all in one pass, stopping for review before any commit.

### Home button: moved to the stage's bottom-right (owner's fix)

- **Why:** on short screens Koa's lifted speech bubble (beanie worn) covered the top-right button for a few seconds. The owner chose neither accepting the overlap nor hiding the button while Koa speaks: the button moves to the **bottom-right** of the stage.
- **Change (CSS plus document order):**
  - `.home__wardrobe` gets `top: calc(var(--stage) * 0.8441 - 1px)`, the mirror of the old position on the same diagonal. Its edge stays 8 px clear of the ring's outer edge at every stage size, and its position never depends on Koa's speech.
  - In `HomeScreen.tsx` the button now comes after Koa in the document. It reads after Koa, and paints above the corner of Koa's picture box, which reaches the button's top-left corner on small stages.
  - The 44 px size, the label "Open the wardrobe", the `Shirt` icon and the visibility rule (hidden only in running or paused focus) are unchanged.
- **Checked** (throwaway probe; Chromium and WebKit; nothing owned and beanie plus glasses worn) at 390×844, 375×667, 320×568, 844×390, 820×1180 and 1440×900:
  - 44 × 44 px and fully on screen;
  - 7.7 px from the ring;
  - no overlap with the chips, the bar, the nav (or rail), the timer, the cycle leaves or the controls;
  - the gap to the timer digits' box: 4.2 px at 320×568, 8.4 px at 375×667, 25 px at 390×844, 59 px at 820×1180 (the two-column layouts have the timer beside the stage);
  - a hit test at the center and 6 px inside each edge lands on the button;
  - Koa's bubble met it in **0** of about 15 samples per case over 4 s;
  - the button never moved, a tap opens the Wardrobe, there's no horizontal overflow, and there are no console errors.
- The Step 1 notes in §3 and §6 ("top-right") describe the earlier position.

### Step 3: E2E, budget, offline, documentation

- **`e2e/support/koa.ts`:**
  - `openWardrobe(page, 'Home' | 'Shop')` taps the shirt button or "Open wardrobe", then waits for the heading and the `#/wardrobe` address;
  - `wardrobeHeading(page)`;
  - `closetTile(page, slot, item)`, a tile in its slot's region, matched whether it's worn or not.
- **`e2e/wardrobe.e2e.ts` (6 tests):**
  1. **Empty:** the Shop has no "Open wardrobe"; Home's button opens the Wardrobe (title "Wardrobe · Koa", no current nav item, "Nothing to try on yet", Koa shown, no slot headings); "Visit the Shop" goes to the Shop (current tab, title).
  2. **Beanie:**
     - earn 170 the real way, buy the beanie, and open the Wardrobe from the Shop;
     - its tile is "Wearing the sage beanie", pressed, with its own artwork, and there's no art note;
     - Koa wears the frame;
     - take it off: status "Took off the sage beanie.", unpressed, the frame gone, coins unchanged;
     - reload: still on the Wardrobe and still off;
     - wear it again: status, pressed, frame shown, coins unchanged;
     - Done (opener unknown after the reload) goes Home, where Koa wears it.
  3. **Focus rule:** the Home button is shown when idle, hidden while running and while paused, and shown after Reset, while a break waits and while a break runs. Opened during a break, the title is the break countdown.
  4. **Daisy (no artwork):**
     - listed under "Ear" only, worn after buying;
     - "Artwork coming soon" is visible and is its accessible description; there's no picture, and the art note is shown;
     - nothing is drawn on Koa;
     - take it off: the note stays;
     - reload and wear it again, then reload: worn, coins 90;
     - the Shop's "Koa is wearing" agrees.
  5. **Direct load, Done, back, nav, titles:**
     - `#/wardrobe` loaded directly has the title, no current tab, and the heading isn't focused;
     - Done goes to `#/home` as a new entry, and back returns to the Wardrobe;
     - a nav tab leaves it (Stats title);
     - opened from Home, the back gesture returns Home;
     - Done goes Home, and back shows the Wardrobe again.
  6. **From the Shop:** Done goes back to the Shop (current tab, title), and so does the back gesture.
- **`e2e/accessibility.e2e.ts` (1 test added; the existing four unchanged):**
  - opening from the Shop with Enter focuses the Wardrobe's heading; there's one `h1`, the title, and no current tab;
  - Space and Enter toggle a tile, and focus stays on it (with the status);
  - Done with Enter returns focus to "Open wardrobe"; the same from Home returns it to "Open the wardrobe";
  - no sideways scroll at 320×568, 320×256 and 568×320, with Done in view.
- **Test notes:**
  - The Wardrobe tests buy with the keyboard, like the accessibility spec. A pointer click first waits for the changed button to stop moving, and in a loaded WebKit run that wait plus the first click outlasted the Shop's 3.5 s confirmation window (see "Flaky failures" below).
  - The journeys are marked `test.slow()` on WebKit only: they take 30–55 s there in a full parallel run, against the 60 s limit.
- **Budget:** `check-build: OK`. Entry JS **153.3 kB** of 160 gzip (unchanged by the Home fix and the Dev Tools: the same entry file hash). CSS 8.6 kB of 12. Precache **22 entries** (the list is unchanged), 1035.4 kB of 1200.
- **Offline** (throwaway probe against `pnpm preview` with the service worker on; Chromium 390×844 and 1440×900, WebKit 390×844, plus Chromium and WebKit at 3× pixel density):
  - The cache holds 22 entries, including all 8 character files: the idle and blink frames and both accessory overlays, at 1024 and 512 px.
  - Offline, `#/wardrobe` loads with Koa wearing the beanie and glasses. Every image decoded: the base, the blink frame and both overlays, the 512 px files at 1× and the 1024 px files at 3×, plus the tiles' pictures. All 3 tiles were present.
  - Toggling the glasses works offline, and Done goes Home with every frame decoded.
  - No console errors.

### Dev Tools (local development only)

- **What:** a small "Dev tools" pill at the top center of the screen, only in `pnpm dev`. It opens five actions and a live line ("N coins · X of 9 items owned · wearing Y"):
  1. **Give 10,000 coins.**
  2. **Unlock all items:** grants exactly what the missing items cost, then buys each one with the normal `walletStore.purchase()`. The balance ends where it started, and nothing is put on.
  3. **Equip all:** one owned item per slot, the first in catalog order.
  4. **Reset wardrobe (take everything off):** this is also "Unequip all". The wardrobe slice only records what's worn, so a separate button would do the same thing.
  5. **Reset wallet (coins, purchases, Stats):** an empty wallet, as "Reset progress" makes it, and everything taken off. Stats starts over too, because it's derived from the earned ledger. Settings and the timer are kept.
- **Files:**
  - `src/dev/devTools.ts`: the actions, built on the real stores;
  - `src/dev/devTools.test.ts`: 8 tests;
  - `src/dev/DevToolsPanel.tsx` and `src/dev/dev-tools.css`;
  - `src/dev/mountDevTools.tsx`: its own React root, outside the app;
  - `src/main.tsx`: 4 lines;
  - `scripts/check-build.mjs`: `checkNoDevTools`;
  - `scripts/check-build.test.ts`: 3 tests;
  - `e2e/devtools.e2e.ts`: 1 test.
- **State:** everything goes through the real stores and the app's own persistence (`saveSlice` into `koa:v1`, then the store's `refresh()`, or the stores' `purchase`, `equip` and `unequip`). There's no `localStorage` access, no second state and no schema change, so the app shows each change at once and a reload keeps it.
  - A grant is a ledger entry `dev:coins:<time>` of the existing `cycle` kind. It only ever adds coins: Stats and the daily goal read `focus` and `dailyGoal` entries, so a grant never counts as study time. `restoreWallet` accepts it unchanged.
  - Production purchase and ownership rules are untouched.
- **Gate (three layers):**
  1. `main.tsx` imports the module only inside `if (import.meta.env.DEV)`. Vite makes that `if (false)` in production, so the module isn't emitted at all: no chunk, no precache entry, the same entry hash.
  2. `scripts/check-build.mjs` fails a build whose HTML, JS or CSS contains the panel's marker `koa-dev-tools`. Unit tested, including that the marker matches the panel's.
  3. `e2e/devtools.e2e.ts` checks the production build on every project: no "Dev tools" button on any tab or the Wardrobe, no `[data-koa-dev-tools]` element, and no script whose path mentions "dev".
- **Checked in `pnpm dev`** (throwaway probe, Chromium at 390×844, 320×568 and 1440×900; all pass):
  - it starts empty;
  - give: the coin pill shows 10,000;
  - unlock all: the balance stays at 10,000, 9 of 9 owned, every Shop card "Owned", 9 Wardrobe tiles;
  - equip all: 5 tiles worn, Koa wears the beanie and glasses frames;
  - reset wardrobe: none worn, still 9 owned;
  - a reload keeps the outfit and the coins;
  - reset wallet: 0 coins, the Wardrobe empty, and it stays so after a reload;
  - no sideways scroll and no console errors.
  - The open panel covers part of the screen; tap "Dev tools" again to close it.

### Validation (2026-11-18)

- `pnpm test`: **703 / 703** (47 files; 692 + 8 Dev Tools + 3 build-check tests).
- `pnpm lint`: clean. `git diff --check`: clean.
- `pnpm build`: `check-build: OK` (figures above).
- `pnpm test:e2e`: 35 tests × 3 projects = **105 runs**. The final code passed **105 / 105** in three consecutive full runs (runs 4–6). The earlier runs and their failures are listed below.

### Flaky failures (iPhone WebKit only; no app regression found)

- **Run 1** (before the keyboard buy and `test.slow`): 4 failures.
  - The existing `shop.e2e.ts` purchase test failed, along with 3 new Wardrobe journeys.
  - The trace of one: the "Buy for 80?" click took **4.0 s**, 2.7 s of it waiting for the button to stop moving. Together with a 1.8 s first click, that outlasted the Shop's 3.5 s confirmation window, so the card was back at "Buy Daisy for 80 coins".
  - This is the Step 0 flake, now with a concrete cause: a pointer click's wait for the button to stop moving plus a slow WebKit, not the app.
- **Run 2:** 2 new Wardrobe journeys failed the same way.
- **Run 3** (keyboard buy in the Wardrobe tests):
  - the existing `data.e2e.ts` reset test failed, at `buildProgress()`'s pointer-click purchase (the same cause);
  - 2 Wardrobe journeys hit the 60 s test limit.
- **Load:** in full parallel runs (8 workers), WebKit journeys take 29–55 s, existing ones included (`shop` 47 s, `rewards` 38 s), against the e2e-suite doc's "~15 s". The same tests pass alone.
- **Runs 4–6** (`test.slow` on WebKit for the Wardrobe journeys): 105 / 105 each.
- **Existing tests not changed** (owner's rule). Remaining risk: `shop.e2e.ts` (double-tap purchase) and `data.e2e.ts` (`buildProgress`) can still fail this way under load. Options for the owner, not decided here:
  - buy with the keyboard in `data.e2e.ts`'s helper (the double-tap test needs pointer clicks);
  - cap local Playwright workers (for example 4);
  - accept it as a known flake.

### Completion review (Phase 12)

| Plan item | Result |
|---|---|
| Decision 1: a `#/wardrobe` route from Home and the Shop, no fifth tab | Met: 4 nav items; E2E covers both entries |
| 2: items without art appear honestly | Met: the daisy journey (swatch, "Artwork coming soon" as its description, wearable, saved) |
| 3: Koa reacts through `showOff()` | Met: the shared `toggleWear()`; no new reaction code |
| 4: separate from rooms and theming | Met: no room, furniture or theme code |
| 5: no new artwork | Met: precache list unchanged (22) |
| 6: not generalized | Met |
| 7: Shop behavior intact | Met: purchase flow unchanged; Shop E2E unchanged and passing |
| 8: existing data model | Met: no storage or schema change (the Dev Tools write existing entry kinds) |
| 9–13: Done, no highlight, Shop entry rule, catalog order, Step 0 refactor | Met: unit-tested (`navigation`, `closetBySlot`) and covered by E2E |
| Acceptance: test, lint, build with budget, E2E | Met (above); flaky WebKit failures documented |
| Offline | Met (above) |
| Docs match the build | `architecture.md`, `design-brief.md` §6, `docs/phase-10/e2e-suite.md`, the roadmap, `CLAUDE.md` and this file are updated |

**Not done in Phase 12 (by scope):** illustrated rooms, room themes, saved outfits, new art, poses, lines or motions, the companion, friends. **Not tested:** a real iPhone, as for every phase since 9.

**Status:** all Phase 12 steps are implemented and validated. The owner approved the completion review (2026-11-18) after a final read-only review of the whole diff.

### Closeout (2026-11-18)

- **The final review** found no debug code, stray files or unrelated changes. It confirmed that the Dev Tools are development-only, use no direct `localStorage` and change no schema; that the routing, the Home button and the shared `wornItemIds()` / `closetBySlot()` / `toggleWear()` contracts match the approved decisions; and that the budget is met. It found four documentation issues, now fixed:
  1. **The production reference:** the docs named `d8a40b4`, but the docs-only Phase 11 closeout `c4daa76` had since been pushed and deployed. A read-only check of the live site found `0.0.0 (c4daa76)`. Production is now `c4daa76`; the last code change deployed was `d8a40b4`.
  2. **`README.md`** didn't mention Phase 12. It now has the roadmap row, the Wardrobe in the feature list, and the Dev Tools in `pnpm dev`.
  3. **The routing contract** in §3 named the planned API. It now describes `wardrobeNav.open` / `close` / `visit` and the route titles in `App.tsx`, and tells it apart from the E2E helper `openWardrobe`.
  4. **Status:** the Phase 12 references now say complete.
- **WebKit timing flake:** kept as a known E2E infrastructure and timing limitation ("Flaky failures" above). `shop.e2e.ts` and `data.e2e.ts` are unchanged (owner's decision).
- Not deployed: production stays `c4daa76` until the next approved push.
