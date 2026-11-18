# Koa — project instructions

Koa is a cozy Pomodoro app with a koala companion. You study, earn Coins, and spend them on accessories for Koa. It should look and feel like a polished indie mobile game, not a productivity dashboard.

- **Primary target:** iPhone (Safari and, from Phase 9, an installed PWA). It must also work on iPad and desktop browsers.
- **Status:** Phases 1–8 are complete and approved. **Phase 9 (PWA and mobile optimization) is in progress: Steps 1–8 of 10 are approved; Step 9 (mobile optimization and the performance budget) is approved. Steps 1–6 were committed on 2026-11-03, Steps 7–9 on 2026-11-04. Step 10 is in progress: the local verification is done and reviewed (Lighthouse 92 / 96 / 100; LCP 3.1 s vs ≤ 2.5 s accepted as a documented deviation; coin pill accessibility fix done; Cloudflare configuration approved). Cloudflare Pages is connected and live at https://koa-5cl.pages.dev (first production deployment `25ab26e`; `274dd92` added the 404 fix; the last Phase 9 deployment was `a839f5e`; build log: Node.js 24.22.1, pnpm 12.14.0, `check-build: OK`). The custom 404 page (commit `274dd92`) is verified in production. Device checks (user-confirmed): Galaxy Note 10+ install, offline, notification delivery and tap-to-open, and the update lifecycle pass (leaf badge and Koa icon not verified: a plain bell icon showed); Windows laptop install, offline and the update lifecycle (browser tabs) pass. iOS/iPadOS: NOT TESTED (no device available). Phase 9 stays open: the criterion "Installs on iPhone" is unchanged and not yet met.** **Phase 10 (testing and polish) is complete (2026-11-09; release-candidate review passed and approved), done before Phase 9 closes with work that needs no iPhone: Step 1 (the committed Playwright suite, `docs/phase-10/e2e-suite.md`) is approved and committed (`edee6ae`); Step 2 (the accessibility pass, `docs/phase-10/step-2-summary.md`) is committed (`7146d37`); Step 3 (motion tuning, `docs/phase-10/step-3-summary.md`) is committed (`d57d683`); Step 4 (the copy pass, `docs/phase-10/step-4-summary.md`) is committed (`ffa4ac9`); the Bug Bash (`docs/phase-10/bug-bash-summary.md`) is complete and approved, with two confirmed bugs fixed. The Bug Bash is committed as `3ec010c`. Phase 9 stays open only for its iPhone criterion.** Phase 10 was deployed as `49e6ed7`; **production is now `c4daa76`** (the docs-only Phase 11 closeout, confirmed live 2026-11-18 from the served app version; the last code change deployed was `d8a40b4`, Phase 11 Steps 1–2). **Phase 11 (accessory artwork) is ✅ complete (2026-11-18; completion review passed and approved by the owner). Step 0 (scope and decisions, documentation only) is done (2026-11-09). Step 1 (the beanie) is complete: `beanie_v02` passed the pipeline (`scripts/art/make_accessory.py`), was approved (2026-11-13) and is wired (`accessoryArt.beanie`, precache 20 entries); follow-up fixes done: the speech bubble clears the pom-pom (lifted by the art's `bounds`) and the Shop card shows the beanie art (`AccessoryThumb`, a crop of the same frame); accepted trade-off (recorded 2026-11-18): on short screens the raised bubble overlaps the ring's leaf marker (`docs/phase-11/step-1-beanie.md` §6). Step 1 is approved and committed (`cc877cd`). Step 2 (round glasses) is complete: pipeline additions made; `round-glasses_v01` rejected (not an edit of the Master; eyes and region checks fail); `round-glasses_v02` passes every check but has visible defects (rims open at the nose, a fur patch on the nose top); `round-glasses_v03` failed the eye check; a hollow (no hole-fill) cut for outline accessories is approved, made and tested (`scripts/art/test_make_accessory.py`); `round-glasses_v04` rejected; `round-glasses_v05` (the Master + v04's frame, deterministic) passes every check; with the approved exact-difference selection for hollow items its overlay holds the complete frame; approved (2026-11-16) and wired (`accessoryArt['round-glasses']`, precache 22 entries; `docs/phase-11/step-2-round-glasses.md` §11); committed as `d8a40b4`.** Phase 9's iPhone check doesn't block it. **Phase 12 (Wardrobe) is ✅ complete (2026-11-18; completion review passed and approved by the owner; `docs/phase-12/wardrobe-plan.md`): Step 0 (contracts and a behavior-preserving refactor), Steps 1–2 (the screen, its entries, responsive layout and accessibility; the Home button moved to the stage's bottom-right at review), Step 3 (E2E, budget, offline, completion review) and the development-only Dev Tools. Not deployed: production stays `c4daa76` until the next approved push.** See `docs/roadmap.md`, `docs/phase-9/pwa-plan.md` and `docs/phase-6/accessory-assets.md`.

## Workflow

- Work happens in **phases** (`docs/roadmap.md`). Finish one phase, verify it, present it, and **wait for approval** before starting the next. Never implement several phases in one pass.
- Large phases are split into reviewed steps (Phase 8 used 12, Phase 9 uses 10; see `docs/phase-9/pwa-plan.md`). Do one step at a time, document it, then stop for approval. Don't commit or push unless asked.
- Record important decisions in the roadmap's decisions log and in the relevant doc. Update docs when the implementation changes them.
- **Before calling a phase done:**
  1. `pnpm test`, `pnpm lint` and `pnpm build` must all pass, and `pnpm test:e2e` (the Playwright suite, since Phase 10).
  2. Check key flows in the running app with Playwright at 390×844 (iPhone), plus 820×1180 (iPad) and 1440×900 (desktop) for layout work.
- **Playwright notes:**
  - The committed suite (`e2e/*.e2e.ts`, `playwright.config.ts`, details in `docs/phase-10/e2e-suite.md`) runs against the production build on port 4317, with service workers blocked. It pins `Date` and moves it with `advance()` (`e2e/support/koa.ts`) instead of `page.clock`, because `page.clock` carries `performance.now()` across reloads and delays Motion animations after every reload. Use roles and accessible names, never sleeps.
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
| `pnpm test:e2e` | Playwright suite (`e2e/*.e2e.ts`): builds, serves on port 4317, runs iPhone-size Chromium and WebKit plus desktop Chromium. First time: `pnpm exec playwright install chromium webkit` |
| `pnpm lint` | ESLint |
| `pnpm build` | Type check (`tsc -b`), production build, then `scripts/check-build.mjs` (fails on reference art, oversized images, a wrong precache, mismatched splash links or the performance budget) |
| `pnpm preview` | Serve `dist/` (the only way to run the service worker) |
| `KOA_SW_KILL_SWITCH=1 pnpm build` | Emergency build: the worker removes itself and Koa's caches (data kept). See the Phase 9 plan |
| `python -I scripts/art/normalize_export.py` | Re-export character frames to `public/characters/` |
| `python -I scripts/art/make_blink.py <master> <out>` | Rebuild the blink frame from the Master (eye-region edit only) |
| `python -I scripts/art/make_icons.py` | Rebuild the app icons and badge in `public/icons/` (checks included) |
| `python -I scripts/art/make_accessory.py extract\|export\|review <item> [candidate]` | Phase 11: cut an accessory out of an ImageGen edit of the Master, check it (eyes/blink, region, tuft, cropping), export to `public/characters/accessories/`, build the review sheet (`docs/phase-11/step-1-beanie.md`) |
| `python -I scripts/art/compose_glasses_v05.py --check` | Phase 11: rebuild the approved `round-glasses_v05` candidate (the Master + only v04's frame pixels) and confirm it matches the tracked file (`docs/phase-11/step-2-round-glasses.md` §9) |
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
- **Dev dependencies:** `vitest`; `@playwright/test` (the e2e suite, Phase 10, pinned so the browser builds match); `vite-plugin-pwa` 2 (`injectManifest`) with `workbox-core`, `workbox-precaching`, `workbox-routing` (bundled into `sw.js`) and `workbox-window` (a direct entry: pnpm doesn't expose the plugin's own copy to `virtual:pwa-register`).
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
src/app/       App shell, screens (SettingsScreen + InstallCard + DataCard, WardrobeScreen), connect.ts (feature wiring), hash-based
               routes (navigation.ts: 4 tabs + #/wardrobe), wear.ts/toggleWear.ts (the shared wear path)
src/dev/       Dev Tools for local development only (never in production builds)
src/sw.ts      the service worker (own tsconfig.sw.json; built to dist/sw.js)
src/ui/        design-system primitives (Button, SegmentedControl, Stepper, Switch, ProgressRing, CoinPill, BottomNav, Card, glyphs)
src/storage/   StorageAdapter + versioned save (koa:v1)
src/config/    timerDefaults.ts, rewards.ts, catalog.ts, koalaBehavior.ts, koalaLines.ts, settings.ts (ranges, defaults,
               presets), notifications.ts (copy, 5-min staleness), sounds.ts (chime spec and timing), pwa.ts (update timing)
src/styles/    tokens.css (design tokens), base.css
public/        characters/ (Koa frames, precached), icons/ and splash/ (generated, not precached), favicon.svg
scripts/       check-build.mjs (+ test), app-version.ts (+ test), art/ (Python art pipeline)
e2e/           Playwright journeys (*.e2e.ts, so Vitest skips them) + support/koa.ts (pinned time, helpers)
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
  - **Layer order (Phase 12):** `wornItemIds(wardrobe)` (slot order) is the only way to build the list passed to `<Koala wearing>`; later items paint on top. Never use `Object.values(wardrobe)` for it.
  - **Wearing and taking off** an owned item goes through the shared `toggleWear()` (`src/app/wear.ts`, instance in `src/app/toggleWear.ts`): equip/unequip, `showOff()` on putting on, and the message. The Shop's buy flow is separate and unchanged.

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

## Phase 9 (in progress; Steps 1–9 approved; Step 10: deployed, Android and Windows checks and the update lifecycle pass, iOS/iPadOS NOT TESTED)

Full details: `docs/phase-9/pwa-plan.md` (each step's "Implementation details", section 8 decisions D1–D13, section 9 deployment).
- **Step 1:** the design sheet lives in `art/reference/` and never ships. `scripts/check-build.mjs` (unit tested) runs after every build.
- **Step 2:** app icons (`public/icons/`, `make_icons.py`), a crop of the approved Master on cream; maskable variant; leaf badge. Approved provisionally.
- **Step 3:** `vite-plugin-pwa` `injectManifest`, `src/sw.ts`. The precache is an **exact** list: 18 entries in Phase 9 (shell, manifest, favicon, JS, CSS, fonts, the 4 Koa frames), **22 since Phase 11** (plus the beanie and round-glasses frames); icons, splash, reference files and source maps are never precached, and the build check enforces the list. No worker in `pnpm dev`. The worker never touches app data.
- **Step 4:** prompted updates only (D3): `updateStore` + `UpdatePrompt` ("Koa has an update", Update / Later), never during a running focus session, checks on launch and visibility at most hourly, one reload of the tapping tab only. App version caption (`__APP_VERSION__`). Kill switch `KOA_SW_KILL_SWITCH=1`.
- **Step 5:** 30 iOS splash JPEGs (`public/splash/`, `make_splash.py`): the idle frame at 40% of the shorter side on cream; iPhone portrait, iPad both orientations; exact `apple-touch-startup-image` links; not precached; size limits in the build check.
- **Step 6:** `isStandalone()` (`displayMode.ts`) and the "Install Koa" card in Settings (`InstallCard.tsx`, `installStore.ts`, rules in `core/pwa/install.ts`). Chromium's `beforeinstallprompt` is captured early with its banner suppressed, opened **only** from the Install tap and used **once**; iPhone/iPad get Share → Add to Home Screen steps and the separate-data note (D10); other browsers their menu command; hidden in the installed app. No iOS long-press callout on the nav tabs or Koa. Pinch zoom stays allowed.
- **Step 7 (approved):** `showNotification.ts` (active registration via `ready`, icon/badge/`data.url`, constructor only on desktop without a worker); `notificationclick` in `src/sw.ts` closes the notification and calls `focusOrOpenKoa` (`core/pwa/notificationClick.ts`: `pickClient` prefers a focused Koa window, then any Koa window; else `openWindow` inside the scope). On Android (Step 10) a real tap opened Koa; whether Koa was in the background or closed wasn't recorded.
- **Step 8 (approved):** export through the share sheet (D11). `exportMethod` (`core/data/exportMethod.ts`): share only when standalone **and** `canShare({ files: [file] })`; otherwise the Phase 8 download (browser tabs always download). `FileShare` is injected into `createProgressData` (`browserFileShare` in `features/data/store.ts`). `navigator.share` is called synchronously from the Export tap with the same filename, `application/json` and text; a second tap is ignored while the sheet is open. `AbortError` goes back to idle quietly; other failures fall back to the download, then the existing failure message. The button stays "Export".
- **Never** auto-reload, show install banners, or prompt for install or notifications without a tap. No storage or schema changes in Phase 9 (D9).
- **Hosting (connected; live at https://koa-5cl.pages.dev, first deployment `25ab26e`, last Phase 9 deployment `a839f5e`, production now `c4daa76`, the docs-only Phase 11 closeout; the last code change deployed was `d8a40b4`):** Cloudflare Pages Free, GitHub `main`, `pnpm build` → `dist`, Node 24 (`.node-version`) and pnpm 12.14.0 (`PNPM_VERSION` project variable, required: build image v3 doesn't read the lockfile; plus `packageManager`, which pnpm 12 also records at the top of `pnpm-lock.yaml`), `public/_headers` (`no-cache` for `sw.js`, `/`, `index.html`, the manifest; immutable `/assets/*`). All three files were added in Step 10 and checked with `npx wrangler pages dev dist`. Pages 308-redirects `/index.html` to `/`; the precache handles it. The production build log confirmed Node.js 24.22.1, pnpm 12.14.0 and `check-build: OK`. **404 page (commit `274dd92`, deployed and verified in production):** `public/404.html` (self-contained, never precached) turns off Pages' SPA fallback, so unknown paths and missing `/assets/*` files get a real 404 instead of `index.html` with status 200 (which the `/assets/*` rule made `immutable`); `check-build.mjs` fails without `dist/404.html`. Verified with `wrangler pages dev` and live with `curl -I` (missing assets and unknown paths 404 with `no-store`; valid assets still `immutable`). **Never deploy (or redeploy) or change Cloudflare settings without explicit approval.** Every push to `main` deploys production (`docs/phase-9/pwa-plan.md` section 9), so a push needs the same approval.
- **Step 9 (approved):** the build check enforces `BUDGET` (entry JS = `index.html`'s module scripts ≤ 160 kB gzip, now 151.2; CSS ≤ 12 kB, 7.8; precache ≤ 1.2 MB, 967.8 kB) and reports later chunks and `sw.js` separately (159.6 kB is all JS together). Measured first visit (Playwright, Lighthouse-like throttling, not Lighthouse): LCP ~2.09 s, CLS 0.0002, so no loading changes. Lighthouse was measured in Step 10 (see below); never record estimated scores. CSS-only layout fixes: the Home stage shrinks with the height (`100dvh − 440px − safe areas`), so Start clears the nav at 375×667; `(orientation: landscape) and (max-height: 500px)` puts the nav in a left rail and Home in two columns (since Phase 10 Step 2 it also needs `and (min-width: 600px)`, in all 9 places, so zoomed desktop windows like 320×256 and old 568-px phones get the single-column layout without sideways scroll; current phones keep the rail); `html { scroll-padding-bottom }` keeps focused controls (the skip confirmation) clear of the bottom nav; segmented options 44 px; below 360 px, 12 px gutters. 195 px wide (200% page zoom on a phone) isn't supported.
- **Step 10 (in progress; local part done and reviewed 2026-11-04; production and Android/Windows checks done; iOS/iPadOS NOT TESTED):** Lighthouse 13.6.0 (`npx`, mobile, against `pnpm preview`, median of 3): **Performance 92, Accessibility 96, Best Practices 100**; **LCP 3.1 s misses the ≤ 2.5 s target: accepted as a documented deviation** (cause: JS-rendered first paint + cold Chrome under Lantern simulation; `fetchpriority="high"` made it worse, deferring the blink frame did nothing; structural fixes deferred). The target stays 2.5 s; never describe it as met. **Coin pill a11y fix:** the balance is visually hidden text inside the pill ("N coins", the actual balance), never `aria-label` on a role-less `div`; covered by `src/ui/CoinPill.test.tsx`; Lighthouse accessibility 100 after it. The Cloudflare configuration (section 9) is approved, connected and deployed (first production deployment `25ab26e`, HTTP and Playwright smoke checks pass; `274dd92` added the production-verified 404 fix; `a839f5e` was the last Phase 9 deployment; production is now `c4daa76`, the docs-only Phase 11 closeout, after `d8a40b4`, the last code change deployed). The D1 checklist, offline, the A→B update flow and the headers pass locally; in production the headers, the 404 page and the update lifecycle (`274dd92` → `a839f5e`, Android and Windows) pass (details and the device checklists in the plan). Lighthouse needs `CHROME_PATH` set to the installed Chrome.

## The mascot (non-negotiable)

- **References:** `art/reference/koala-design-sheet.png` defines style and colors. The **approved provisional Koa Master** (`art/master/koa_idle_neutral.master.png`, from candidate v02) is the primary identity reference. Read `docs/character-bible.md` before any character work.
- **Never redesign Koa.** Never draw Koa or accessories with CSS/SVG, emoji, icons or placeholder art. If an illustration is missing, report it as missing and render nothing in its place.
- **The reference sheet is never displayed in the app.** The app uses individual transparent frames listed in `src/features/koala/manifest.ts`.
- **Consistency over quantity.** Produce assets one at a time through the gated pipeline (character bible §3). Expression variants are edits of the Master, not regenerations. Assets that fail the checklist are rejected, never patched in the UI.
- **Current assets:** `koa_idle_neutral` and `koa_idle_blink`, plus the approved beanie and round-glasses overlays (`public/characters/accessories/beanie@idle*.webp`, `round-glasses@idle*.webp`, Phase 11), all as WebP at 1024 and 512 in `public/characters/` (accessories in `accessories/`). App icons (`public/icons/`) and iOS splash screens (`public/splash/`) are compositions of the approved Master made by `make_icons.py` and `make_splash.py`; never edit them by hand, and re-run the scripts if the Master changes.
  - They sit on the **house grid**: a 1024×1536 canvas, head width 500px, axis x = 512, ground line y = 1400.
  - The blink frame was made by editing only the Master's eye regions (`scripts/art/make_blink.py`).
- **Known Master deviations, accepted for now:** the head is about 49% of sitting height (target ~60%), the feet are large, the tuft is spiky, and a brown iris is visible. See `docs/phase-2/gate-0-koa-master.md` §7. Art improvements were deliberately deferred so the app could be built first.
- **Accessory artwork:** Phase 11 produces it, starting with **only the beanie (approved and wired, 2026-11-13) and the round glasses (approved and wired, 2026-11-16)** (see "Phase 11" under Next steps).
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

- **Phase 9, Step 10 (in progress):** Cloudflare Pages is connected and live at https://koa-5cl.pages.dev (the last Phase 9 deployment was `a839f5e`; production is now `c4daa76`, the docs-only Phase 11 closeout; the last code change deployed was `d8a40b4`). Phase 9 stays open until the iPhone checks run: the criterion "Installs on iPhone" is unchanged. Open items:
  - Done: the LCP deviation is accepted (3.1 s vs ≤ 2.5 s, documented), the coin pill fix is made, the first deployment's headers and smoke test pass, the build log is checked, and the 404 fix is verified in production.
  - Done (user-confirmed): Galaxy Note 10+ (Android Chrome) install and normal use, offline, notification delivery and tap-to-open, the update lifecycle (`274dd92` → `a839f5e`: no prompt during focus, prompt after pausing, data and paused timer kept); Windows laptop install and normal use, offline, the update lifecycle in browser tabs (Later, a second tab, an old tab left alone, data kept, the silent update after closing every tab).
  - iOS/iPadOS: NOT TESTED (no iPhone or iPad available); the iPhone items below stay required.
  - iPhone: install, splash, offline, landscape safe areas and notch placement (only simulated so far), real file sharing (Export → share sheet → Save to Files), notifications in the Home Screen app, the update flow.
  - Android Chrome: the leaf badge and Koa icon are not verified (a plain bell icon showed); the two tap scenarios (Koa in the background vs fully closed) weren't recorded separately; the back gesture is NOT TESTED.
  - Desktop: the update flow in the installed app and Safari on macOS are NOT TESTED. Device, OS and browser versions weren't recorded.
- **Known limitations (accepted for now):** in a Safari tab on iPhone SE, Home may need a short scroll before Start; at 195 px wide (a phone at 200% page zoom) the layout scrolls sideways (kept by the Phase 10 accessibility pass: WCAG 1.4.10's 320 px passes). The accessibility pass's other accepted deviations (including the dimmed chrome during focus, ~1.9:1, accepted by the owner as an intentional design deviation when Phase 10 was completed) are listed in `docs/phase-10/step-2-summary.md` §6.
- **Phase 10 (complete, 2026-11-09; release-candidate review passed and approved):** Step 1, the committed Playwright suite, is approved and committed (`edee6ae`; `docs/phase-10/e2e-suite.md`). Step 2, the accessibility pass, is complete and approved (`docs/phase-10/step-2-summary.md`): hidden Home `h1`, a page title per tab (`src/app/pageTitle.ts`), `coinText()` (`src/ui/coinText.ts`), item-named shop buttons, the landscape `min-width: 600px` condition, and `e2e/accessibility.e2e.ts`; the suite is now 25 tests × 3 projects = 75 runs. Step 3, motion tuning, is complete and approved (`docs/phase-10/step-3-summary.md`): measured fixes only (no continuous progress-ring transition, a quick bubble fade-out, the purchase pop animated in place so focus stays, a shorter outgoing tab fade); reduced motion preserved; no new animations. Step 4, the copy pass, is complete and approved (`docs/phase-10/step-4-summary.md`): three fixes only (Koa's cycle line no longer says "Four in a row", singular "1 more coin" in the shop toast, `·` in the running-session tab title). The Bug Bash is complete and approved (`docs/phase-10/bug-bash-summary.md`), with two confirmed bugs fixed: a timer state change could overwrite the current tab's title (now `App.tsx` is the only title writer and `pageTitle()` composes the countdown or the tab title), and a shop double-tap could skip the purchase confirmation (repeat clicks of a double-tap are ignored on the buy and wear buttons). Unit tests 635; E2E 75 / 75. Committed as `3ec010c`. The dimmed nav and coin pill during focus (~1.9:1) are accepted as an intentional design deviation (closed). Phase 10 was deployed as `49e6ed7` (production is now `c4daa76`; the last code change deployed was `d8a40b4`); pushing and deploying still each need explicit approval (a push to `main` deploys).
- **Phase 11, accessory artwork (✅ complete, 2026-11-18; completion review passed and approved):** Step 0, scope (2026-11-09); Step 1, the beanie (`cc877cd`); Step 2, the round glasses (`d8a40b4`); completion review 2026-11-18. Decisions in the roadmap's decisions log.
  - **Exactly two accessories first: `beanie` and `round-glasses`.** Don't start the other seven.
  - **Keep the existing architecture:** `AccessoryArt`, `accessoryFrame()`, `hasAccessoryArt()`, the layering in `Koala.tsx`, the wardrobe state and the Shop's purchase and equip flow. No redesign.
  - **Offline (done):** the accessory frames are precached: the glob `characters/accessories/*.webp` in `vite.config.ts` and the four frames in `PRECACHE_FIXED` (`scripts/check-build.mjs`) give 22 entries, 1025.4 kB of the 1.2 MB budget. A future accessory needs its files added to `PRECACHE_FIXED` the same way (details in `docs/phase-6/accessory-assets.md`).
  - **Not in Phase 11:** the wardrobe room (a separate future phase), more accessories, hoodie/outfit variants, new poses, the companion koala, friends/shared progress, unrelated UI or features.
  - Phase 9's iPhone check doesn't block Phase 11. Phase 10 stays closed.
- **Phase 12, Wardrobe (✅ complete, 2026-11-18; completion review passed and approved; `docs/phase-12/wardrobe-plan.md`; not deployed yet):** a `#/wardrobe` screen (not a fifth tab) reached from Home and the Shop, where Koa is dressed in owned items grouped by slot. Steps: 0 contracts + behavior-preserving refactor, 1 screen and entries, 2 responsive/accessibility/polish (the Home button fix at review), 3 E2E, budget and completion review (`e2e/wardrobe.e2e.ts`, helpers `openWardrobe`/`wardrobeHeading`/`closetTile`), all approved.
  - No new artwork, no storage or schema change, no new precache entries, no fifth tab. Owned items without art are listed honestly. Koa reacts only through the existing `showOff()`.
  - **Routing:** `src/app/navigation.ts` (`ROUTES` = the 4 tabs + `wardrobe`; `wardrobeNav.open(from)` / `close()` / `visit()`, `arrived()` from `App.tsx`, `takeFocus()` on mount). Done is a new history entry to the opener, Home if unknown; never `history.back()`. `BottomNav` takes `current: null` on the Wardrobe.
  - **Home entry:** a 44 px `Shirt` button at the stage's bottom-right (clear of Koa's bubble), hidden only in running or paused focus.
  - **Dev Tools (local development only, `src/dev/`):** give coins, unlock all, equip all, reset wardrobe, reset wallet, through the real stores. Loaded only inside `if (import.meta.env.DEV)` in `main.tsx` (keep that literal guard, or the chunk ships); `check-build` fails if the marker `koa-dev-tools` reaches `dist/`; `e2e/devtools.e2e.ts` checks the production build. Never add a production route or admin panel.
  - **Known E2E flake:** under full parallel load, WebKit can let the Shop's 3.5 s "Buy for N?" window expire before a pointer click lands (`shop.e2e.ts`, `data.e2e.ts`). New purchase helpers should buy with the keyboard (`docs/phase-12/wardrobe-plan.md` §7).
  - **Not in Phase 12:** an illustrated room, furniture, hooks, shelves, room themes or a Rooms category; saved outfits; new lines, motions or poses; generalizing for the companion, friends or other characters; changes to the Shop's purchase flow.
- **Deferred (not in current scope):** accessory artwork beyond the beanie and round glasses, hoodie recolors (need approval), an illustrated wardrobe room and room theming (Phase 12 is the Koa-centered Wardrobe screen only), the evening/dark theme, revisiting the icon composition, data import, push notifications, accounts or sync.
