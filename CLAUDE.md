# Koa — project instructions

Koa is a cozy Pomodoro app with a koala companion. You study, earn Coins, and spend them on accessories for Koa. It should look and feel like a polished indie mobile game, not a productivity dashboard.

- **Primary target:** iPhone (Safari and, from Phase 9, an installed PWA). It must also work on iPad and desktop browsers.
- **Status:** Phases 1–7 are complete and approved. **Phase 8 (statistics and settings) is complete and approved (2026-11-03), all 12 steps.** Next is **Phase 9** (PWA and offline). See `docs/roadmap.md` and `docs/phase-8/settings-plan.md`.

## Workflow

- Work happens in **phases** (`docs/roadmap.md`). Finish one phase, verify it, present it, and **wait for approval** before starting the next. Never implement several phases in one pass.
- Large phases are split into reviewed steps (Phase 8 used 12, see `docs/phase-8/settings-plan.md`). Do one step at a time, document it, then stop for approval. Don't commit or push unless asked.
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
  timer/       engine.ts (state machine), restore.ts (validate saved state), wakeLock.ts (when to keep the screen on),
               notification.ts (what to announce), chime.ts (when to chime)
  rewards/     wallet.ts (earned ledger, spending, derived totals, reward rules)
  shop/        shop.ts (purchase, ownership, wardrobe)
  koala/       brain.ts (Koa's behavior state machine), context.ts (timer → Koa context)
  settings/    settings.ts (model, validation, stepping, timerConfigFrom)
  stats/       stats.ts (stats derived from the earned ledger)
  data/        data.ts (export envelope, reset state and summary, isProgressReset)
  time.ts      local-day keys, addDays/isDayKey (calendar arithmetic, DST-safe)
src/features/  framework-agnostic stores (getState/subscribe/actions) + React hooks/components
  timer/ rewards/ shop/ koala/ settings/ stats/ wakeLock/ notifications/ sounds/ data/
               browser APIs are injected (WakeLockEnv, NotificationEnv, SoundEnv, storage + download) and mocked in tests
src/app/       App shell, screens (SettingsScreen + DataCard), connect.ts (feature wiring), hash-based tabs
src/ui/        design-system primitives (Button, SegmentedControl, Stepper, Switch, ProgressRing, CoinPill, BottomNav, Card, glyphs)
src/storage/   StorageAdapter + versioned save (koa:v1)
src/config/    timerDefaults.ts, rewards.ts, catalog.ts, koalaBehavior.ts, koalaLines.ts, settings.ts (ranges, defaults,
               presets), notifications.ts (copy, 5-min staleness), sounds.ts (chime spec and timing)
src/styles/    tokens.css (design tokens), base.css
```

- **Pure core, thin UI.** Business rules live in `src/core/` and take `now` as a parameter. Components present state and call store actions.
- **Feature stores** are read with `useSyncExternalStore`. Features communicate through events; `src/app/connect.ts` wires the timer's `sessionCompleted` event to the wallet, and the timer, wallet grants and user input to Koa's brain. It also pushes settings changes to the timer (`setConfig`) and refreshes wallet, wardrobe and settings on the `storage` event (other tabs); if `isProgressReset` says another tab reset progress, it calls `reloadProgress()` first. It runs once in `main.tsx`, before render. Wake lock, notifications and sounds subscribe to the timer and settings themselves; the timer doesn't know about them.
- **Persistence:**
  - One LocalStorage key, `koa:v1` = `{ version, timer, wallet, wardrobe, settings }`, read and written only through `src/storage/`. **Components never touch `localStorage`.**
  - Each slice is validated on load (`restoreTimer`, `restoreWallet`, `restoreWardrobe`, and `restoreSettings` per field), so corrupt data resets only that slice or field. Unreadable or future-version saves go to `koa:backup`. Reset progress writes the pre-reset export to `koa:backup:reset` (never read by the app).
  - There's a migration table for schema bumps. `settings` is an optional slice (older saves load the defaults), so it needed no version bump. Slices are written with `saveSlice`.
  - **There is no `history` slice.** Stats are derived from the wallet's earned ledger (approved decision).
- **Config, not constants:** timer defaults, reward values and the shop catalog live in `src/config/`.

## Timer (Phase 4)

- **Timestamp-based.**
  - A running session stores `endsAt`, and remaining time = `endsAt - now`, clamped. The 250ms tick only re-renders.
  - `reconcile` runs on launch, on every tick and on `visibilitychange`, `focus` and `pageshow`. A session that ended while the app was away completes as of `endsAt`, and only once.
- **Cycle:** focus → short breaks, then a long break after every `longBreakEvery` focus sessions (setting, 2–8, default 4). The next session never auto-starts.
- **Skip and reset:**
  - Skipped sessions never count. Skipping a started focus session asks for confirmation.
  - Reset keeps the cycle.
  - Mode chips are locked while a session is in progress.
- **Event order:** the store emits events **before** saving the timer. A crash in between causes a repeat (ignored by the ledger), never a lost reward. Keep this order.
- **Durations come from Settings.** `timerStore` is created from the saved settings (the settings store loads first), and `setConfig` applies later changes. `applyConfig`/`fitIdleSession` only refit a waiting session; **a running or paused session never changes length**. Lowering the interval to or below the focus sessions already done turns a waiting focus session or short break into the earned long break (no cycle bonus is paid for that).

## Coins, wallet and shop (Phases 5–6)

- **Wallet** = `ledger` (EARNED, append-only) + `spending` (SPENT). `totalEarned`, `totalSpent` and `balance` (≥ 0) are **always derived** from the entries; saved totals are ignored on load. **Spending must never modify or erase earned ledger entries.**
- **Rewards** (`src/config/rewards.ts`):
  - 1 coin per focus minute
  - Cycle bonus when a focus session completes the cycle: `round(30 × cycle focus minutes / 100)`, capped at 30 (exactly 30 for 4 × 25 min). The timer tracks `cycleFocusMs`; saves without it count 25 min per completed session.
  - +50 daily goal (default 100 focus minutes per local day; the goal is a setting, read at payout time). Changing the goal never pays by itself.

  Ledger keys `focus:<sessionId>`, `cycle:<sessionId>` and `goal:<YYYY-MM-DD>` are each paid **at most once**. Breaks and skipped sessions pay nothing.
- **Cross-tab safety:** `award()` and `purchase()` apply to the latest *saved* wallet.
- **Shop:**
  - Ownership = a spending entry `item:<id>`, so double purchases are impossible. Purchases fail cleanly on insufficient funds.
  - Buying is two-step (price → "Buy for N?") and equips the item automatically.
  - The catalog has 9 items (`src/config/catalog.ts`).
- **Wardrobe:** one item per slot (`head`, `face`, `neck`, `ear`, `body`), and only owned items can be equipped. On load, unknown, unowned and wrong-slot items are dropped.

## Phase 8 (complete)

Full details: `docs/phase-8/settings-plan.md` ("Decisions" and "Implementation details").
- **Settings** (`src/core/settings/`, `src/config/settings.ts`, store in `src/features/settings/`): focus 1–120, short break 1–30, long break 1–60 min, long break after 2–8 sessions, daily goal 25–480 min in 25-minute steps (480 is also valid), flags `notifications`, `keepScreenOn`, `sounds` (off by default). Invalid values are never saved; typed input is rounded, clamped and snapped on blur. Changes apply from the next session.
- **Settings screen** (`SettingsScreen.tsx`): a Timer card (steppers, focus presets 15/25/45/50), a Daily goal card, a "While you focus" card (Keep screen on, Session notifications, Sounds switches) and a "Your data" card (`DataCard.tsx`: Export, Reset progress).
- **Stats** (`src/core/stats/stats.ts`, `StatsScreen.tsx`): computed from `focus:` and `goal:` ledger entries. A session counts on the `day` saved in its entry. The streak counts consecutive local days with a completed focus session; the current streak continues from yesterday until today ends, and future-dated entries never extend it. Legacy focus entries without `minutes` are estimated from coins for Stats only (documented limitation). The screen shows a today ring against the goal, streaks, all-time totals, a 7-day CSS bar chart with screen-reader text, and a Koa empty state.
- **Keep screen on** (`src/features/wakeLock/`): held only while the setting is on, the page is visible and a focus session is running before its `endsAt`. The browser API is injected (`WakeLockEnv`) and mocked in tests. It's released on pause, completion, skip, reset, setting off and hidden page, and reacquired when the page is visible again. Failures never touch the timer; unsupported browsers get a disabled switch with an explanation.
- **Notifications** (`src/features/notifications/`): off by default. Permission is requested **only** from the Settings switch tap (`enable()`), never on launch, completion or reset. Shown only for a `sessionCompleted` noticed ≤ 5 min late, with the setting on, permission `granted` and the user not looking (page hidden or window unfocused). Tag = session id. Uses a service worker registration if present (Phase 9), else `new Notification`. Unsupported/denied/dismissed states are explained in the row. iPhone: Home Screen app on iOS 16.4+ only, and nothing while suspended (no push server).
- **Sounds** (`src/features/sounds/`): off by default; one Web Audio chime (no files). The `AudioContext` is created or resumed only inside a user gesture while Sounds is on; after a reload the row says a tap is needed. Turning it on plays a preview. Fresh completions only (≤ 5 min), once per session id, ≥ 1.5 s apart; a chime that can't play within 1 s is dropped.
- **Export and reset** (`src/core/data/`, `src/features/data/`): Export downloads `koa-data-YYYY-MM-DD.json` = `{ format: "koa-export", exportVersion: 1, exportedAt, storageKey, data: <koa:v1> }`, built from in-memory store state. No import. Reset is two-step; it writes and reads back `koa:backup:reset`, then writes `{ version: 1, settings }` and reads it back (either failing ⇒ nothing deleted), then `reloadProgress()` (timer `reload()` drops the session **without events**, wallet/wardrobe refresh, `sounds.cancelPending()`, wake lock update, `koalaStore.reset()`). **Settings and the notification permission are kept.** Other tabs detect it via `isProgressReset` and reload too.
- **Event listeners in timer events catch everything**, so wake lock, notification or audio failures can never stop the wallet's payout or the save.

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

## Koa's personality (Phase 7)

- **Brain:** `src/core/koala/brain.ts`, pure and seeded-random in tests. Rules are in character bible §4 ("As built in Phase 7"). Tuning is in `src/config/koalaBehavior.ts`, lines in `src/config/koalaLines.ts`.
- **Existing art only.** Behaviors are transforms of the idle frame (`src/features/koala/motions.ts`) or use the approved blink frame (slow blink, eyes closed while napping). Missing poses are never faked.
- **Focus is sacred:** no ambient actions, speech or naps; taps get a rate-limited soft squish.
- Unprompted speech at most every 2 minutes; celebration lines wait for the coin labels to clear.
- `<KoaCompanion>` renders the brain on Home (with bubble and "z" glyphs) and in the Shop preview (no speech). The brain isn't persisted.

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

- **Phase 9:** PWA and offline support with `vite-plugin-pwa`. Keep the reference sheet out of the shipped bundle (it's currently in `public/`). The notifier already prefers a service worker registration, which Android and installed iOS apps need. Consider the Web Share API for export in installed iOS apps.
- **Phase 10:** a committed Playwright suite plus polish.
- **Deferred:** accessory artwork, hoodie recolors (need approval), the Phase 8 evening theme stretch goal.
