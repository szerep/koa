# Koa — project instructions

Koa is a cozy Pomodoro app with a koala companion. You study, earn Coins, and spend them on accessories for Koa. It should look and feel like a polished indie mobile game, not a productivity dashboard.

- **Primary target:** iPhone (Safari and, from Phase 9, an installed PWA). It must also work on iPad and desktop browsers.
- **Status:** Phases 1–6 are complete and approved. **Phase 7 (personality and interactions) is next and has not started.** See `docs/roadmap.md`.

## Workflow

- Work happens in **phases** (`docs/roadmap.md`). Finish one phase, verify it, present it, and **wait for approval** before starting the next. Never implement several phases in one pass.
- Record important decisions in the roadmap's decisions log and in the relevant doc. Update docs when the implementation changes them.
- **Before calling a phase done:**
  1. `pnpm test`, `pnpm lint` and `pnpm build` must all pass.
  2. Check key flows in the running app with Playwright at 390×844 (iPhone), plus 820×1180 (iPad) and 1440×900 (desktop) for layout work.
- **Playwright notes:**
  - `page.clock.install` is per **browser context** and leaks into new pages. Check real-time animations (Motion/WAAPI) in a fresh `browser.newContext()`, or they appear frozen.
  - The fake clock also stalls Motion animations, so use `clock.runFor` or a clean context when you need to see them.
  - To test session completion in real time, seed a running timer in `localStorage` (`koa:v1`) that ends a couple of seconds after load.
- Use the `frontend-design` skill for UI work. Use Context7 for current library docs.

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Vite dev server (if port 5173 is taken, use `pnpm dev --port 5180 --strictPort`) |
| `pnpm test` | Unit tests (Vitest), `*.test.ts` next to the code |
| `pnpm lint` | ESLint |
| `pnpm build` | Type check (`tsc -b`) and production build |
| `python -I scripts/art/normalize_export.py` | Re-export character frames to `public/characters/` |
| `python -I scripts/art/make_blink.py <master> <out>` | Rebuild the blink frame from the Master (eye-region edit only) |

## Stack and tooling

- React 19, TypeScript, Vite 8, pnpm. Do not re-scaffold the project or replace its config.
- **TypeScript aliases. Don't "fix" these:**
  - `tsc` is TypeScript 7, via the package alias `@typescript/native`. Strict mode is on (TS 7 default).
  - The `typescript` package is an alias for `@typescript/typescript6`, because typescript-eslint needs the TS 6 API until TS 7.1.
- **Runtime dependencies:**
  - `motion`: springs, presence, the coin fly-up
  - `lucide-react`: interface icons only
  - `@fontsource-variable/fredoka` and `@fontsource-variable/nunito-sans`: self-hosted fonts
- **Dev dependency:** `vitest`.
- **Add a dependency only when it clearly earns its place.** Planned: `vite-plugin-pwa` (Phase 9).

## Architecture (as built; details in `docs/architecture.md`)

```
src/core/      pure TypeScript logic, no React/DOM, unit tested
  timer/       engine.ts (state machine), restore.ts (validate saved state)
  rewards/     wallet.ts (earned ledger, spending, derived totals, reward rules)
  shop/        shop.ts (purchase, ownership, wardrobe)
  time.ts      local-day keys
src/features/  framework-agnostic stores (getState/subscribe/actions) + React hooks/components
  timer/ rewards/ shop/ koala/
src/app/       App shell, screens, connect.ts (feature wiring), hash-based tabs
src/ui/        design-system primitives (Button, SegmentedControl, ProgressRing, CoinPill, BottomNav, Card, glyphs)
src/storage/   StorageAdapter + versioned save (koa:v1)
src/config/    timerDefaults.ts, rewards.ts, catalog.ts
src/styles/    tokens.css (design tokens), base.css
```

- **Pure core, thin UI.** Business rules live in `src/core/` and take `now` as a parameter. Components present state and call store actions.
- **Feature stores** are read with `useSyncExternalStore`. Features communicate through events; `src/app/connect.ts` wires the timer's `sessionCompleted` event to the wallet. It runs once in `main.tsx`, before render.
- **Persistence:**
  - One LocalStorage key, `koa:v1` = `{ version, timer, wallet, wardrobe }`, read and written only through `src/storage/`. **Components never touch `localStorage`.**
  - Each slice is validated on load (`restoreTimer`, `restoreWallet`, `restoreWardrobe`), so corrupt data resets only that slice. Unreadable or future-version saves go to `koa:backup`.
  - There's a migration table for schema bumps. New slices (Phase 8 `settings`, `history`) go through `saveSlice`.
- **Config, not constants:** timer defaults, reward values and the shop catalog live in `src/config/`.

## Timer (Phase 4)

- **Timestamp-based.**
  - A running session stores `endsAt`, and remaining time = `endsAt - now`, clamped. The 250ms tick only re-renders.
  - `reconcile` runs on launch, on every tick and on `visibilitychange`, `focus` and `pageshow`. A session that ended while the app was away completes as of `endsAt`, and only once.
- **Cycle:** focus → short break ×3, then a long break after the 4th focus session. The next session never auto-starts.
- **Skip and reset:**
  - Skipped sessions never count. Skipping a started focus session asks for confirmation.
  - Reset keeps the cycle.
  - Mode chips are locked while a session is in progress.
- **Event order:** the store emits events **before** saving the timer. A crash in between causes a repeat (ignored by the ledger), never a lost reward. Keep this order.
- **Durations:** `applyConfig` only changes an idle session. Phase 8's custom durations must never alter a running or paused session.

## Coins, wallet and shop (Phases 5–6)

- **Wallet** = `ledger` (EARNED, append-only) + `spending` (SPENT). `totalEarned`, `totalSpent` and `balance` (≥ 0) are **always derived** from the entries; saved totals are ignored on load. **Spending must never modify or erase earned ledger entries.**
- **Rewards** (`src/config/rewards.ts`):
  - 1 coin per focus minute
  - +30 cycle bonus (the 4th focus session)
  - +50 daily goal (default 100 focus minutes per local day)

  Ledger keys `focus:<sessionId>`, `cycle:<sessionId>` and `goal:<YYYY-MM-DD>` are each paid **at most once**. Breaks and skipped sessions pay nothing.
- **Cross-tab safety:** `award()` and `purchase()` apply to the latest *saved* wallet.
- **Shop:**
  - Ownership = a spending entry `item:<id>`, so double purchases are impossible. Purchases fail cleanly on insufficient funds.
  - Buying is two-step (price → "Buy for N?") and equips the item automatically.
  - The catalog has 9 items (`src/config/catalog.ts`).
- **Wardrobe:** one item per slot (`head`, `face`, `neck`, `ear`, `body`), and only owned items can be equipped. On load, unknown, unowned and wrong-slot items are dropped.

## The mascot (non-negotiable)

- **References:** `public/characters/reference/koala-design-sheet.png` defines style and colors. The **approved provisional Koa Master** (`art/master/koa_idle_neutral.master.png`, from candidate v02) is the primary identity reference. Read `docs/character-bible.md` before any character work.
- **Never redesign Koa.** Never draw Koa or accessories with CSS/SVG, emoji, icons or placeholder art. If an illustration is missing, report it as missing and render nothing in its place.
- **The reference sheet is never displayed in the app.** The app uses individual transparent frames listed in `src/features/koala/manifest.ts`.
- **Consistency over quantity.** Produce assets one at a time through the gated pipeline (character bible §3). Expression variants are edits of the Master, not regenerations. Assets that fail the checklist are rejected, never patched in the UI.
- **Current assets:** only `koa_idle_neutral` and `koa_idle_blink`, as WebP at 1024 and 512 in `public/characters/`.
  - They sit on the **house grid**: a 1024×1536 canvas, head width 500px, axis x = 512, ground line y = 1400.
  - The blink frame was made by editing only the Master's eye regions (`scripts/art/make_blink.py`).
- **Known Master deviations, accepted for now:** the head is about 49% of sitting height (target ~60%), the feet are large, the tuft is spiky, and a brown iris is visible. See `docs/phase-2/gate-0-koa-master.md` §7. Art improvements were deliberately deferred so the app could be built first.
- **Accessory artwork does not exist yet.**
  - The layering system is ready: `accessoryArt` in the manifest, using canvas-aligned overlays and outfit frames.
  - Required files are listed in `docs/phase-6/accessory-assets.md`.
  - **Hoodie recolors** (approved clothing option A) are deferred. Producing them by recoloring the Master's hoodie in code needs explicit approval first.
- **Art pipeline:** ChatGPT ImageGen produces candidates into `art/master/candidates/`. The scripts in `scripts/art/` normalize them to the house grid and export WebP. Don't generate new character art unless asked.

## Visual identity

- Follow `docs/design-brief.md`. **Colors come only from tokens** in `src/styles/tokens.css`; never hard-code colors in components. Shop item swatches in the catalog are item data, not UI colors.
- **Fonts:** Fredoka for display and numerals, Nunito Sans for UI and body text.
- Rounded shapes, soft warm shadows and generous spacing. No excessive gradients, decorative borders, random ornaments or dashboard layouts.
- **Motion:** transform and opacity only. Respect `prefers-reduced-motion`: no flying coins or hops, simple fades. Character animations must never interrupt studying, and the chrome dims during focus.

## Coding conventions

- Small modular components with co-located CSS (`Component.tsx` + `component.css`). Files used by react-refresh export only components; put helpers in separate files.
- No `any`. Validate everything read from storage.
- Write unit tests for every core rule, edge cases included, next to the code.
- Keep copy in plain sentence case, from the user's point of view.

## Next steps

- **Phase 7:** koala state machine, ambient behavior, tap reactions, speech bubbles, nap on inactivity, show-off on equip. It must work with the existing idle frames until new poses are produced, and never substitute missing art.
- **Phase 8:**
  - Stats from a session history.
  - Settings (`docs/phase-8/settings-plan.md`): custom focus, short break and long break durations (R1), adjustable daily goal (R2), notifications, wake lock, sounds, data export and reset.
- **Phase 9:** PWA and offline support. Keep the reference sheet out of the shipped bundle (it's currently in `public/`).
- **Phase 10:** a committed Playwright suite plus polish.
