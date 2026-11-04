# Koa — project instructions

Koa is a cozy Pomodoro app with a koala companion. You study, earn Coins, and spend them on accessories for Koa. It should look and feel like a polished indie mobile game, not a productivity dashboard.

- **Primary target:** iPhone (Safari and, from Phase 9, an installed PWA). It must also work on iPad and desktop browsers.
- **Status:** Phases 1–8 are complete and approved. **Phase 9 (PWA and mobile optimization) is in progress: Steps 1–8 of 10 are approved; Step 9 (mobile optimization and the performance budget) is approved. Steps 1–6 were committed on 2026-11-03, Steps 7–9 on 2026-11-04. Step 10 is in progress: the local verification is done and reviewed (Lighthouse 92 / 96 / 100; LCP 3.1 s vs ≤ 2.5 s accepted as a documented deviation; coin pill accessibility fix done; Cloudflare configuration approved). Cloudflare Pages is connected and the first production deployment is live at https://koa-5cl.pages.dev (commit `25ab26e`; build log: Node.js 24.22.1, pnpm 12.14.0, `check-build: OK`). The custom 404 page (commit `274dd92`, deployed) is verified in production. Device checks (user-confirmed): Galaxy Note 10+ install, offline and notifications pass; Windows laptop install and offline pass. Pending: the update lifecycle (next deployment) and iOS/iPadOS (no device available).** See `docs/roadmap.md` and `docs/phase-9/pwa-plan.md`.

## Workflow

- Work happens in **phases** (`docs/roadmap.md`). Finish one phase, verify it, present it, and **wait for approval** before starting the next. Never implement several phases in one pass.
- Large phases are split into reviewed steps (Phase 8 used 12, Phase 9 uses 10; see `docs/phase-9/pwa-plan.md`). Do one step at a time, document it, then stop for approval. Don't commit or push unless asked.
- Record important decisions in the roadmap's decisions log and in the relevant doc. Update docs when the implementation changes them.
- **Before calling a phase done:**
  1. `pnpm test`, `pnpm lint` and `pnpm build` must all pass.
  2. Check key flows in the running app with Playwright at 390×844 (iPhone), plus 820×1180 (iPad) and 1440×900 (desktop) for layout work.
- **Playwright notes:**
  - `page.clock.install` is per **browser context** and leaks into new pages. Check real-time animations (Motion/WAAPI) in a fresh `browser.newContext()`, or they appear frozen.
  - The fake clock also stalls Motion animations, so use `clock.runFor` or a clean context when you need to see them.
  - To test session completion in real time, seed a running timer in `localStorage` (`koa:v1`) that ends a couple of seconds after load.
  - The service worker exists only in production builds: test offline, updates and install help against `pnpm build` + `pnpm preview`, in fresh contexts.
  - Chromium's CDP can't emulate `display-mode: standalone`; mock `matchMedia` with a plain object (a `MediaQueryList` getter can't be overwritten) or set iOS `navigator.standalone`. Safe areas can be simulated by overriding the `--safe-*` tokens.
- Use the `frontend-design` skill for UI work. Use Context7 for current library docs.

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Vite dev server (if port 5173 is taken, use `pnpm dev --port 5180 --strictPort`) |
| `pnpm test` | Unit tests (Vitest), `*.test.ts` next to the code |
| `pnpm lint` | ESLint |
| `pnpm build` | Type check (`tsc -b`), production build, then `scripts/check-build.mjs` (fails on reference art, oversized images, a wrong precache, mismatched splash links or the performance budget) |
| `pnpm preview` | Serve `dist/` (the only way to run the service worker) |
| `KOA_SW_KILL_SWITCH=1 pnpm build` | Emergency build: the worker removes itself and Koa's caches (data kept). See the Phase 9 plan |
| `python -I scripts/art/normalize_export.py` | Re-export character frames to `public/characters/` |
| `python -I scripts/art/make_blink.py <master> <out>` | Rebuild the blink frame from the Master (eye-region edit only) |
| `python -I scripts/art/make_icons.py` | Rebuild the app icons and badge in `public/icons/` (checks included) |
| `python -I scripts/art/make_splash.py` | Rebuild the 30 iOS splash JPEGs in `public/splash/` and verify the `index.html` links (`--links` prints them) |

## Stack and tooling

- React 19, TypeScript, Vite 8, pnpm. Do not re-scaffold the project or replace its config.
- **TypeScript aliases. Don't "fix" these:**
  - `tsc` is TypeScript 7, via the package alias `@typescript/native`. Strict mode is on (TS 7 default).
  - The `typescript` package is an alias for `@typescript/typescript6`, because typescript-eslint needs the TS 6 API until TS 7.1.
- **Runtime dependencies:**
  - `motion`: springs, presence, the coin fly-up
  - `lucide-react`: interface icons only
  - `@fontsource-variable/fredoka` and `@fontsource-variable/nunito-sans`: self-hosted fonts
- **Dev dependencies:** `vitest`; `vite-plugin-pwa` 2 (`injectManifest`) with `workbox-core`, `workbox-precaching`, `workbox-routing` (bundled into `sw.js`) and `workbox-window` (a direct entry: pnpm doesn't expose the plugin's own copy to `virtual:pwa-register`).
- **Add a dependency only when it clearly earns its place.** Nothing else is planned for Phase 9.

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
  data/        data.ts (export envelope, reset state and summary, isProgressReset), exportMethod.ts (share vs download)
  pwa/         update.ts (shouldOfferUpdate, isUpdateCheckDue), install.ts (installHelp, detectInstallBrowser),
               notificationClick.ts (pickClient, focusOrOpenKoa: what a notification tap does)
  time.ts      local-day keys, addDays/isDayKey (calendar arithmetic, DST-safe)
src/features/  framework-agnostic stores (getState/subscribe/actions) + React hooks/components
  timer/ rewards/ shop/ koala/ settings/ stats/ wakeLock/ notifications/ sounds/ data/ pwa/
               browser APIs are injected (WakeLockEnv, NotificationEnv, SoundEnv, PwaEnv, UpdateEnv, InstallEnv,
               DisplayModeEnv, storage + download) and mocked in tests
src/app/       App shell, screens (SettingsScreen + InstallCard + DataCard), connect.ts (feature wiring), hash-based tabs
src/sw.ts      the service worker (own tsconfig.sw.json; built to dist/sw.js)
src/ui/        design-system primitives (Button, SegmentedControl, Stepper, Switch, ProgressRing, CoinPill, BottomNav, Card, glyphs)
src/storage/   StorageAdapter + versioned save (koa:v1)
src/config/    timerDefaults.ts, rewards.ts, catalog.ts, koalaBehavior.ts, koalaLines.ts, settings.ts (ranges, defaults,
               presets), notifications.ts (copy, 5-min staleness), sounds.ts (chime spec and timing), pwa.ts (update timing)
src/styles/    tokens.css (design tokens), base.css
public/        characters/ (Koa frames, precached), icons/ and splash/ (generated, not precached), favicon.svg
scripts/       check-build.mjs (+ test), app-version.ts (+ test), art/ (Python art pipeline)
art/reference/ the design sheet (never shipped; the build check enforces it)
```

- **Pure core, thin UI.** Business rules live in `src/core/` and take `now` as a parameter. Components present state and call store actions.
- **Feature stores** are read with `useSyncExternalStore`. Features communicate through events; `src/app/connect.ts` wires the timer's `sessionCompleted` event to the wallet, and the timer, wallet grants and user input to Koa's brain. It also pushes settings changes to the timer (`setConfig`) and refreshes wallet, wardrobe and settings on the `storage` event (other tabs); if `isProgressReset` says another tab reset progress, it calls `reloadProgress()` first. It registers the service worker, runs update checks (launch, becoming visible) and starts the install-help listener. It runs once in `main.tsx`, before render. Wake lock, notifications and sounds subscribe to the timer and settings themselves; the timer doesn't know about them.
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
- **Notifications** (`src/features/notifications/`): off by default. Permission is requested **only** from the Settings switch tap (`enable()`), never on launch, completion or reset. Shown only for a `sessionCompleted` noticed ≤ 5 min late, with the setting on, permission `granted` and the user not looking (page hidden or window unfocused). Tag = session id. Since Phase 9 Step 7 it waits for the *active* worker registration (`ready`, 3 s timeout) and uses `new Notification` only without one and only on desktop (never Android/iOS); a tap focuses an open Koa window or opens Koa (`src/sw.ts`, `core/pwa/notificationClick.ts`). Unsupported/denied/dismissed states are explained in the row; on iPhone/iPad the row links to the install steps. iPhone: Home Screen app on iOS 16.4+ only, and nothing while suspended (no push server).
- **Sounds** (`src/features/sounds/`): off by default; one Web Audio chime (no files). The `AudioContext` is created or resumed only inside a user gesture while Sounds is on; after a reload the row says a tap is needed. Turning it on plays a preview. Fresh completions only (≤ 5 min), once per session id, ≥ 1.5 s apart; a chime that can't play within 1 s is dropped.
- **Export and reset** (`src/core/data/`, `src/features/data/`): Export downloads `koa-data-YYYY-MM-DD.json` = `{ format: "koa-export", exportVersion: 1, exportedAt, storageKey, data: <koa:v1> }`, built from in-memory store state. No import. Reset is two-step; it writes and reads back `koa:backup:reset`, then writes `{ version: 1, settings }` and reads it back (either failing ⇒ nothing deleted), then `reloadProgress()` (timer `reload()` drops the session **without events**, wallet/wardrobe refresh, `sounds.cancelPending()`, wake lock update, `koalaStore.reset()`). **Settings and the notification permission are kept.** Other tabs detect it via `isProgressReset` and reload too.
- **Event listeners in timer events catch everything**, so wake lock, notification or audio failures can never stop the wallet's payout or the save.

## Phase 9 (in progress; Steps 1–9 approved; Step 10: deployed, Android and Windows checks pass, update lifecycle and iOS pending)

Full details: `docs/phase-9/pwa-plan.md` (each step's "Implementation details", section 8 decisions D1–D13, section 9 deployment).
- **Step 1:** the design sheet lives in `art/reference/` and never ships. `scripts/check-build.mjs` (unit tested) runs after every build.
- **Step 2:** app icons (`public/icons/`, `make_icons.py`), a crop of the approved Master on cream; maskable variant; leaf badge. Approved provisionally.
- **Step 3:** `vite-plugin-pwa` `injectManifest`, `src/sw.ts`. The precache is **exactly** 18 entries (shell, manifest, favicon, JS, CSS, fonts, the 4 Koa frames); icons, splash, reference files and source maps are never precached, and the build check enforces the list. No worker in `pnpm dev`. The worker never touches app data.
- **Step 4:** prompted updates only (D3): `updateStore` + `UpdatePrompt` ("Koa has an update", Update / Later), never during a running focus session, checks on launch and visibility at most hourly, one reload of the tapping tab only. App version caption (`__APP_VERSION__`). Kill switch `KOA_SW_KILL_SWITCH=1`.
- **Step 5:** 30 iOS splash JPEGs (`public/splash/`, `make_splash.py`): the idle frame at 40% of the shorter side on cream; iPhone portrait, iPad both orientations; exact `apple-touch-startup-image` links; not precached; size limits in the build check.
- **Step 6:** `isStandalone()` (`displayMode.ts`) and the "Install Koa" card in Settings (`InstallCard.tsx`, `installStore.ts`, rules in `core/pwa/install.ts`). Chromium's `beforeinstallprompt` is captured early with its banner suppressed, opened **only** from the Install tap and used **once**; iPhone/iPad get Share → Add to Home Screen steps and the separate-data note (D10); other browsers their menu command; hidden in the installed app. No iOS long-press callout on the nav tabs or Koa. Pinch zoom stays allowed.
- **Step 7 (approved):** `showNotification.ts` (active registration via `ready`, icon/badge/`data.url`, constructor only on desktop without a worker); `notificationclick` in `src/sw.ts` closes the notification and calls `focusOrOpenKoa` (`core/pwa/notificationClick.ts`: `pickClient` prefers a focused Koa window, then any Koa window; else `openWindow` inside the scope). A real tap is verified on Android in Step 10.
- **Step 8 (approved):** export through the share sheet (D11). `exportMethod` (`core/data/exportMethod.ts`): share only when standalone **and** `canShare({ files: [file] })`; otherwise the Phase 8 download (browser tabs always download). `FileShare` is injected into `createProgressData` (`browserFileShare` in `features/data/store.ts`). `navigator.share` is called synchronously from the Export tap with the same filename, `application/json` and text; a second tap is ignored while the sheet is open. `AbortError` goes back to idle quietly; other failures fall back to the download, then the existing failure message. The button stays "Export".
- **Never** auto-reload, show install banners, or prompt for install or notifications without a tap. No storage or schema changes in Phase 9 (D9).
- **Hosting (connected; live at https://koa-5cl.pages.dev, first deployment `25ab26e`, now `274dd92`):** Cloudflare Pages Free, GitHub `main`, `pnpm build` → `dist`, Node 24 (`.node-version`) and pnpm 12.14.0 (`PNPM_VERSION` project variable, required: build image v3 doesn't read the lockfile; plus `packageManager`, which pnpm 12 also records at the top of `pnpm-lock.yaml`), `public/_headers` (`no-cache` for `sw.js`, `/`, `index.html`, the manifest; immutable `/assets/*`). All three files were added in Step 10 and checked with `npx wrangler pages dev dist`. Pages 308-redirects `/index.html` to `/`; the precache handles it. The production build log confirmed Node.js 24.22.1, pnpm 12.14.0 and `check-build: OK`. **404 page (commit `274dd92`, deployed and verified in production):** `public/404.html` (self-contained, never precached) turns off Pages' SPA fallback, so unknown paths and missing `/assets/*` files get a real 404 instead of `index.html` with status 200 (which the `/assets/*` rule made `immutable`); `check-build.mjs` fails without `dist/404.html`. Verified with `wrangler pages dev` and live with `curl -I` (missing assets and unknown paths 404 with `no-store`; valid assets still `immutable`). **Never deploy (or redeploy) or change Cloudflare settings without explicit approval.**
- **Step 9 (approved):** the build check enforces `BUDGET` (entry JS = `index.html`'s module scripts ≤ 160 kB gzip, now 151.2; CSS ≤ 12 kB, 7.8; precache ≤ 1.2 MB, 967.8 kB) and reports later chunks and `sw.js` separately (159.6 kB is all JS together). Measured first visit (Playwright, Lighthouse-like throttling, not Lighthouse): LCP ~2.09 s, CLS 0.0002, so no loading changes. Lighthouse was measured in Step 10 (see below); never record estimated scores. CSS-only layout fixes: the Home stage shrinks with the height (`100dvh − 440px − safe areas`), so Start clears the nav at 375×667; `(orientation: landscape) and (max-height: 500px)` puts the nav in a left rail and Home in two columns; `html { scroll-padding-bottom }` keeps focused controls (the skip confirmation) clear of the bottom nav; segmented options 44 px; below 360 px, 12 px gutters. 195 px wide (200% page zoom on a phone) isn't supported.
- **Step 10 (in progress; local part done and reviewed 2026-11-04):** Lighthouse 13.6.0 (`npx`, mobile, against `pnpm preview`, median of 3): **Performance 92, Accessibility 96, Best Practices 100**; **LCP 3.1 s misses the ≤ 2.5 s target: accepted as a documented deviation** (cause: JS-rendered first paint + cold Chrome under Lantern simulation; `fetchpriority="high"` made it worse, deferring the blink frame did nothing; structural fixes deferred). The target stays 2.5 s; never describe it as met. **Coin pill a11y fix:** the balance is visually hidden text inside the pill ("N coins", the actual balance), never `aria-label` on a role-less `div`; covered by `src/ui/CoinPill.test.tsx`; Lighthouse accessibility 100 after it. The Cloudflare configuration (section 9) is approved, connected and deployed (first production deployment live, commit `25ab26e`; HTTP and Playwright smoke checks pass). The D1 checklist, offline, the A→B update flow and the headers pass locally (details and the device checklists in the plan). Lighthouse needs `CHROME_PATH` set to the installed Chrome.

## The mascot (non-negotiable)

- **References:** `art/reference/koala-design-sheet.png` defines style and colors. The **approved provisional Koa Master** (`art/master/koa_idle_neutral.master.png`, from candidate v02) is the primary identity reference. Read `docs/character-bible.md` before any character work.
- **Never redesign Koa.** Never draw Koa or accessories with CSS/SVG, emoji, icons or placeholder art. If an illustration is missing, report it as missing and render nothing in its place.
- **The reference sheet is never displayed in the app.** The app uses individual transparent frames listed in `src/features/koala/manifest.ts`.
- **Consistency over quantity.** Produce assets one at a time through the gated pipeline (character bible §3). Expression variants are edits of the Master, not regenerations. Assets that fail the checklist are rejected, never patched in the UI.
- **Current assets:** only `koa_idle_neutral` and `koa_idle_blink`, as WebP at 1024 and 512 in `public/characters/`. App icons (`public/icons/`) and iOS splash screens (`public/splash/`) are compositions of the approved Master made by `make_icons.py` and `make_splash.py`; never edit them by hand, and re-run the scripts if the Master changes.
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

- **Phase 9, Step 10 (in progress):** Cloudflare Pages is connected; `274dd92` (with the 404 fix) is live at https://koa-5cl.pages.dev. Next: test the PWA update lifecycle on the Note 10+ and the Windows laptop with the next deployment (pushing needs an explicit go-ahead), then the remaining device checklists in the plan's Step 10 section. Open items:
  - Done: the LCP deviation is accepted (3.1 s vs ≤ 2.5 s, documented), the coin pill fix is made, the first deployment's headers and smoke test pass, the build log is checked, and the 404 fix is verified in production.
  - Done (user-confirmed): Galaxy Note 10+ (Android Chrome) install and normal use, offline, notifications; Windows laptop install and normal use, offline.
  - iOS/iPadOS: not tested yet (no iPhone or iPad available); the iPhone items below stay required.
  - iPhone: install, splash, offline, landscape safe areas and notch placement (only simulated so far), real file sharing (Export → share sheet → Save to Files), notifications in the Home Screen app.
  - Android Chrome: install, offline, a worker notification with the badge, and a real notification tap opening or focusing Koa.
  - Desktop install and offline smoke checks; the update flow after a second deployment.
- **Known limitations (accepted for now):** in a Safari tab on iPhone SE, Home may need a short scroll before Start; at 195 px wide (a phone at 200% page zoom) the layout scrolls sideways (Phase 10 accessibility pass).
- **Phase 10:** a committed Playwright suite plus polish.
- **Deferred (not in current scope):** accessory artwork, hoodie recolors (need approval), the evening/dark theme, revisiting the icon composition, data import, push notifications, accounts or sync.
