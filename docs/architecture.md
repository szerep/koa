# Koa — Architecture

*As built through Phase 8 (settings, stats, keep screen on, notifications, sounds, export and reset) and Phase 9 Steps 1–6 (offline service worker, update flow, app icons, iOS splash screens, install help). Planned parts are marked **(planned)**; the rest of Phase 9 is in `docs/phase-9/pwa-plan.md`.*

## Principles

1. **Pure core, thin UI.** Timer math, reward rules, shop rules, settings validation and stats live in `src/core/` as plain TypeScript with no React or DOM imports. They're deterministic, take `now` as a parameter, return new state plus events, and are unit tested. The koala state machine (Phase 7) follows the same pattern, and so do stats (Phase 8, `src/core/stats/`).
2. **Small stores per feature.** Each feature has a tiny framework-agnostic store (`getState` / `subscribe` / actions) that React reads through `useSyncExternalStore`. There's no Redux or Zustand. Stores apply core transitions, persist the result and broadcast events.
3. **Storage behind an interface.** `StorageAdapter` (LocalStorage today) keeps IndexedDB or cloud sync possible later without touching features.
4. **Data, not code, for content.** Timer defaults, reward values, the shop catalog and the character manifest are typed config.
5. **Features talk through events.** The timer emits `sessionCompleted`, and `src/app/connect.ts` routes it to the wallet. Settings changes are pushed to the timer the same way. The wake lock, notifications and sounds subscribe to the timer and settings stores on their own, so the timer knows nothing about them. Features don't import each other's internals.

## Folder structure

```
src/
  main.tsx                  # mounts the app; calls connectFeatures() first
  app/
    App.tsx                 # shell: top bar, tab screens, bottom nav, reward overlay
    connect.ts              # one-time wiring: timer → rewards, settings → timer, timer/wallet/input → Koa,
                            # wake lock / notification / sound launch checks, cross-tab refresh
                            # (wallet, wardrobe, settings) and cross-tab reset detection,
                            # service worker registration, update checks, install-help listening
    useHashTab.ts           # tab state mirrored to location.hash (#/shop)
    useTimerAmbience.ts     # tab title countdown, focus-mode dimming, completion announcement
    screens/                # HomeScreen, ShopScreen, SettingsScreen (+ InstallCard, DataCard: export, reset), StatsScreen,
                            # ComingSoonScreen (Koa resting state, used for the Stats empty state)
  core/                     # pure logic, no React (unit tested)
    timer/engine.ts         # timer state machine + transitions
    timer/restore.ts        # validate/repair persisted timer state
    timer/wakeLock.ts       # shouldKeepScreenOn: running focus session + setting on
    timer/notification.ts   # sessionNotification: what to announce for a fresh completion (or null)
    timer/chime.ts          # shouldChime: fresh completions only
    rewards/wallet.ts       # earned ledger, spending, derived totals, reward rules
    shop/shop.ts            # purchase, ownership, wardrobe (equip/unequip), restore
    koala/brain.ts          # Koa's behavior state machine (ambient, taps, speech, naps)
    koala/context.ts        # timer state → Koa context (idle / focus / break)
    settings/settings.ts    # settings model: validation, stepping, typed input, restore, timerConfigFrom
    stats/stats.ts          # stats derived from the ledger: today, 7-day window, totals, streaks, goal days
    data/data.ts            # export envelope, file name, reset state, reset summary, isProgressReset
    pwa/update.ts           # shouldOfferUpdate (never during running focus), isUpdateCheckDue (hourly, online)
    pwa/install.ts          # installHelp (what the install card shows), detectInstallBrowser
    time.ts                 # local-day keys, calendar-day arithmetic (DST-safe)
  features/                 # React-facing stores, hooks and components per domain
    timer/                  # timerStore, store (singleton), useTimer, TimerFace, format
    rewards/                # walletStore, store, RewardLayer (coin fly-up)
    shop/                   # wardrobeStore, store
    settings/               # settingsStore, store (singleton; loaded before the timer store)
    stats/                  # format (durations, day labels, chart scale), useNow (rolls over at midnight)
    wakeLock/               # Keep screen on: controller (injected browser API), bindWakeLock (timer + setting), store
    notifications/          # notifier (injected NotificationEnv), bindNotifications (timer events + setting), store
    sounds/                 # sound controller (injected SoundEnv), chime synthesis, bindSounds, store
    data/                   # progressData (export, two-step reset; storage and download injected), store + reloadProgress
    pwa/                    # registration (injected PwaEnv), updateStore + UpdatePrompt, displayMode (isStandalone),
                            # installStore (beforeinstallprompt, used once), browserPwaEnv, store (singletons)
    koala/                  # manifest.ts (poses + accessory art), Koala.tsx (rendering + motions),
                            # koalaStore/store (brain + ticking), KoaCompanion (bubble, nap glyphs)
  ui/                       # design-system primitives: Button/IconButton, SegmentedControl,
                            # Stepper, Switch, ProgressRing, CoinPill, BottomNav, Card, glyphs (leaf, coin, wordmark)
  storage/
    adapter.ts              # StorageAdapter; localStorageAdapter; createMemoryAdapter (tests)
    persistence.ts          # versioned save (koa:v1), slices, migrations, backup
  config/                   # timerDefaults.ts, rewards.ts, catalog.ts, koalaBehavior.ts, koalaLines.ts,
                            # settings.ts (ranges, defaults, focus presets), notifications.ts (copy, 5-min
                            # staleness), sounds.ts (chime spec and timing), pwa.ts (update check interval, timeout)
  styles/                   # tokens.css (design tokens), base.css (reset, fonts)
  sw.ts                     # the service worker (built to dist/sw.js by vite-plugin-pwa; own tsconfig.sw.json)
  vite-env.d.ts             # virtual:pwa-register types, __APP_VERSION__
public/
  characters/               # Koa frames (WebP 1024 + 512), precached
  icons/                    # app icons + notification badge (scripts/art/make_icons.py), not precached
  splash/                   # 30 iOS startup images (scripts/art/make_splash.py), not precached
scripts/
  check-build.mjs           # post-build check (run by pnpm build): no reference art, image limits, exact precache,
                            # splash images match index.html, kill-switch worker only with KOA_SW_KILL_SWITCH=1
  app-version.ts            # __APP_VERSION__ for Settings (Cloudflare commit, else git, else package version)
  art/                      # normalize_export.py, make_blink.py, make_icons.py, make_splash.py (Pillow)
art/reference/              # the design sheet (never shipped)
```

**Navigation:** four tabs (Home, Shop, Stats, Settings) switched in state and mirrored to `location.hash`. There's no router dependency.

## Timer (`src/core/timer/engine.ts`)

```ts
interface TimerState {
  mode: 'focus' | 'shortBreak' | 'longBreak'
  status: 'idle' | 'running' | 'paused'
  durationMs: number           // fixed when the session is set up
  endsAt: number | null        // running only
  remainingMs: number          // idle/paused
  sessionId: string | null     // set on first start (used for idempotent rewards)
  startedAt: number | null
  completedInCycle: number     // focus sessions done in this cycle
  cycleFocusMs: number         // focus time finished in this cycle (scales the cycle bonus)
}
// Config: { durations: { focus, shortBreak, longBreak } (minutes), sessionsPerCycle }, from Settings
// Transitions: (state, now, config) => { state, events }
// Events: sessionCompleted { sessionId, mode, durationMs, startedAt, completedAt, endsCycle, cycleFocusMs }
//         sessionSkipped   { sessionId, mode }
```

- **Timestamp-based.** Remaining time is always `endsAt - now`, clamped to `[0, durationMs]`. The 250ms tick only re-renders.
- **`reconcile(now)`** runs on launch, on every tick, and on `visibilitychange`, `focus` and `pageshow`. If time is up, the session completes *as of `endsAt`*. At most one session completes per reconcile, and the next session is set up idle (no auto-start).
- **Cycle:** short breaks between focus sessions and a long break after every `sessionsPerCycle` focus sessions (the Long break after setting, 2–8, default 4). Then the cycle resets.
- **Skip** never counts. Skipping focus goes to a short break with the cycle unchanged, and skipping the long break starts a new cycle. The UI asks for confirmation before skipping a started focus session.
- **Reset** returns to the full duration of the current mode and keeps the cycle. **Mode chips** are locked while a session is in progress.
- **Settings:** the timer store is created from the saved settings (`timerConfigFrom`), and `setConfig` applies later changes (`connect.ts`, including other tabs). `applyConfig` and `fitIdleSession` only refit a session that hasn't started; running and paused sessions keep their length. Lowering the interval to or below the focus sessions already done turns a waiting focus session or short break into the earned long break. Details: `docs/phase-8/settings-plan.md`.
- **Event order:** the store emits events *before* saving the timer. A crash in between causes a repeat completion (ignored by the reward ledger) rather than a lost reward.
- **iOS limitation:** a suspended web app can't run code, so completion is shown when the app is reopened. Notifications and the chime only fire while the page can run; there's no push server.

## Wallet and rewards (`src/core/rewards/wallet.ts`)

```ts
interface Wallet {
  ledger: Record<string, LedgerEntry>    // EARNED, append-only. Keys: focus:<sessionId>, cycle:<sessionId>, goal:<YYYY-MM-DD>
  spending: Record<string, SpendEntry>   // SPENT. Keys: item:<itemId>
  totalEarned: number                    // derived from ledger
  totalSpent: number                     // derived from spending
  balance: number                        // derived: max(0, earned - spent)
}
```

- **Rules** (`src/config/rewards.ts`):
  - 1 coin per focus minute
  - A cycle bonus when a focus session completes the cycle: `round(30 × cycle focus minutes / 100)`, capped at 30. A default cycle (4 × 25 min) earns exactly 30. The timer keeps `cycleFocusMs` (focus time finished in the cycle) and the completion event carries it.
  - +50 when the day's focus minutes reach the daily goal (default 100 min, by local day). The goal comes from Settings and is read when a focus session is paid, so changing it never pays by itself.
- **Idempotent.** Each ledger key is paid at most once, across refreshes, relaunches, two tabs, and a crash between saves. Breaks and skipped sessions never pay.
- **Spending never touches the ledger.** Totals are always recomputed from entries on load; saved totals (including Phase 5's stored `balance`) are ignored, and malformed entries are dropped.
- **Cross-tab safety.** `walletStore.award()` and `purchase()` apply to the latest *saved* wallet, not the in-memory copy.

## Shop and wardrobe (`src/core/shop/shop.ts`)

- **Ownership** = a `spending` entry `item:<id>`, so buying the same item twice is impossible by construction. Purchases fail cleanly with `insufficientFunds`, `alreadySpent` or `invalidAmount`.
- **Wardrobe** = `Record<'head' | 'face' | 'neck' | 'ear' | 'body', itemId | null>`, with one item per slot. Only owned items can be equipped. On load, an item is kept only if it exists in the catalog, is owned and is in its own slot.
- **Catalog:** 9 items in `src/config/catalog.ts` (hats, glasses, clothes, scarves, extras).
- **UI flow:** a two-step buy ("120" → "Buy for 120?"), then the item is equipped automatically.

## Persistence (`src/storage/persistence.ts`)

- A single LocalStorage key, `koa:v1`: `{ version: 1, timer, wallet, wardrobe, settings }`. Each slice is validated by its own feature on load (`restoreTimer`, `restoreWallet`, `restoreWardrobe`, `restoreSettings`), so a damaged slice resets only that feature.
- Unreadable JSON, or a save from an unknown future version, is copied to `koa:backup` before the app starts fresh. A migration table (`migrations[n]`) is in place for future schema versions.
- Saves happen on each state change; ticks are never saved.
- **`settings`** (Phase 8) is an optional slice: older saves without it load the defaults, with no version bump. Each field is validated on its own.
- **Stats** are derived from the wallet's earned ledger (`src/core/stats/`). There's no separate `history` slice.
- **`koa:backup:reset`** holds the export of the data from before the latest Reset progress (see below). The app never reads it.

## Settings (`src/core/settings/`, Phase 8)

- **Model:** `durations` (focus 1–120, short break 1–30, long break 1–60 min), `longBreakEvery` (2–8), `dailyGoalMinutes` (25–480 in 25-minute steps, 480 also valid) and the flags `notifications`, `keepScreenOn`, `sounds` (off by default). Ranges and defaults are in `src/config/settings.ts`; defaults come from `timerDefaults` and `rewardRules`.
- **Valid values only:** `setNumber` ignores anything off the range or step grid. Typed input is rounded, clamped and snapped on blur (`commitInput`).
- **Store** (`features/settings/settingsStore.ts`): `getState`, `subscribe`, `setNumber`, `setFlag`, `refresh` (other tabs). Saves on every real change.
- **Readers:** the timer (`setConfig`), the wallet (`dailyGoalMinutes()` read inside `award()`), the Home cycle leaves, Stats (the goal), the wake lock (`keepScreenOn`), notifications (`notifications`) and sounds (`sounds`).
- **Screen** (`SettingsScreen.tsx`): Timer, Daily goal, "While you focus" (Keep screen on, Session notifications, Sounds), "Install Koa" (`InstallCard.tsx`, Phase 9, hidden in the installed app) and "Your data" (`DataCard.tsx`: Export, Reset progress) cards, built from `<Stepper>`, `<Switch>` and `<Button>`, then the app version caption.

## Stats (`src/core/stats/`, Phase 8)

- `computeStats(ledger, now, { coinsPerFocusMinute })` returns today, the rolling 7 days, all-time totals, streaks (`current`, `best`, `activeToday`) and goal days. Pure and read-only; nothing is stored.
- A session counts on the `day` saved in its `focus:` entry. Goal days come from `goal:` entries. Days are stepped with calendar arithmetic (`addDays`), so DST never skips or repeats a day.
- **Screen** (`StatsScreen.tsx`, helpers in `features/stats/`): a today ring against the current goal, streak and all-time cards, a 7-day CSS bar chart whose list markup carries the screen-reader text, and a Koa empty state. `useNow` rolls "today" over at midnight and when the app becomes visible.

## Keep screen on (`src/features/wakeLock/`, Phase 8)

- **Rule** (`core/timer/wakeLock.ts`): the setting is on and a focus session is running before its `endsAt`. Breaks, paused and waiting sessions never hold a lock.
- **Controller** (`wakeLock.ts`): the browser API comes in as `WakeLockEnv` (real: `browserWakeLockEnv()`; tests: mocks). It holds a lock only while the page is visible, sends one request at a time, releases late or unwanted locks, and catches every failure (status `failed`), so the timer is never affected. Statuses: `unsupported`, `off`, `active`, `failed`.
- **Binding** (`bindWakeLock.ts`, singleton in `store.ts`): re-checks on every timer change, settings change and `visibilitychange`, so pause, completion, skip, reset and the setting need no timer changes.
- **Unsupported** (no `navigator.wakeLock` or not a secure context): the switch is disabled with an explanation.

## Notifications (`src/features/notifications/`, Phase 8)

- **Rule** (`core/timer/notification.ts`): only a `sessionCompleted` event noticed at most 5 minutes after `completedAt` (`config/notifications.ts`). The copy names the next session without implying it started; the tag is the session id, so two tabs show one notification.
- **Notifier** (`notifications.ts`): the browser API comes in as `NotificationEnv` (real: `browserNotificationEnv()`). It shows a notification only if the setting is on, the permission is `granted` and the user isn't looking (page hidden or window unfocused). It uses the service worker registration when there is one, else `new Notification`. Statuses: `unsupported`, `default`, `requesting`, `dismissed`, `denied`, `granted`, `failed`; re-read on focus, visibility and the Permissions API `change` event.
- **Permission** is requested only by `enable()`, called from the Settings switch tap. Launch, completions and Reset progress never ask.
- **Binding** (`bindNotifications.ts`): a timer event listener that catches everything, so a failing notification can't stop the wallet's listener or the save.
- **Since Phase 9 Step 3** production builds have a service worker, so notifications go through `registration.showNotification`. The worker has no `notificationclick` handler until Step 7, so clicking a notification doesn't focus Koa yet.

## Sounds (`src/features/sounds/`, Phase 8)

- **Rule** (`core/timer/chime.ts`): fresh `sessionCompleted` events only (5 minutes, like notifications).
- **Controller** (`sounds.ts`): the browser API comes in as `SoundEnv` (real: `browserSoundEnv()`, `AudioContext` or `webkitAudioContext`). The context is created or resumed only inside a user gesture (`pointerup`, `touchend`, `keydown`, `click` on `window`) while Sounds is on, and closed when it's turned off. One chime per session id, none closer than 1.5 s apart, and a chime the browser allows only after more than 1 s is dropped. Statuses: `unsupported`, `off`, `locked`, `ready`, `failed`.
- **Chime** (`chime.ts`, spec in `config/sounds.ts`): two sine notes, each with a quiet octave and an exponential fade; every node is disconnected when the chime ends.
- **Binding** (`bindSounds.ts`): `enable()` saves the setting and plays a preview inside the tap. The event listener catches everything.

## Export and reset (`src/features/data/`, Phase 8)

- **Rules** (`core/data/data.ts`): `buildExport` wraps the `koa:v1` structure in `{ format: "koa-export", exportVersion: 1, exportedAt, storageKey, data }`; `progressResetState(settings)` is `{ version: 1, settings }`; `progressSummary` feeds the confirmation; `isProgressReset(oldValue, newValue)` detects another tab's reset (the progress slices were dropped).
- **Controller** (`progressData.ts`): storage, a snapshot of the stores and the download are injected. Export is built from the stores' in-memory state and downloaded through a Blob link. Reset is `requestReset()` then `confirmReset()`: write and read back the backup (`koa:backup:reset`), then write and read back the settings-only save, then reload. If either write fails, nothing is deleted.
- **`reloadProgress()`** (`store.ts`): `timerStore.reload()` (drops the session without events, so it can't pay, notify or chime), `walletStore.refresh()`, `wardrobeStore.refresh()`, `sounds.cancelPending()`, `wakeLock.update()` and `koalaStore.reset()`. Settings and the notification permission are untouched.
- **Other tabs:** the `storage` listener in `connect.ts` runs `reloadProgress()` when `isProgressReset` is true, before the usual refreshes.
- **No import** (out of scope).

## Character rendering (`src/features/koala/`)

- **House grid:** every frame is 1024×1536, with the axis at x = 512 and the ground line at y = 1400. `koalaPoses` in `manifest.ts` lists each pose's visible figure box and frames, `base` and `blink`. Only `idle` exists today.
- **`<Koala>`** draws a contact shadow, then back overlays, the pose frame (or an outfit's frame), the blink frame and front overlays. It handles breathing (CSS, paced by `tempo`), random blinks, held eyes (`eyesClosed`, using the approved blink frame) and plays the `motion` it's given (Motion keyframes from `motions.ts`, transforms only). Reduced motion: no movement at all. Images use `srcset` with 512 and 1024 exports.
- **`<KoaCompanion>`** reads the koala store and renders `<Koala>` plus, on Home, the speech bubble and the sleepy "z" glyphs. The Shop preview uses it without speech.

## Koa's personality (`src/core/koala/`, Phase 7)

- **Brain** (`brain.ts`): pure transitions `(state, …, now, env) => state`, where `env` holds the tuning (`config/koalaBehavior.ts`), the line pools (`config/koalaLines.ts`) and a random source (seeded in tests). Inputs: `setContext`, `tap`, `activity`, `celebrate`, `breakOver`, `showOff`, `greet`, `tick`. Output via `present(state)`: `{ tempo, eyesClosed, motion, bubble }`.
- **Store** (`features/koala/koalaStore.ts`): not persisted; ticks once a second only while subscribed and visible; skips re-renders for input that changes nothing visible.
- **Wiring** (`app/connect.ts`): wallet grants → `celebrate` (session / cycle / daily goal); a finished break → `breakOver`; timer state → `setContext` via `koalaContextFor`; any `pointerdown`/`keydown` → `activity`; a greeting 1.2s after launch. The shop calls `showOff` on equip.
- Rules are in the character bible §4.
- **Accessories:** `accessoryArt` in `manifest.ts`, canvas-aligned frames (see character bible §5). It's **empty: no accessory artwork exists yet.**

## PWA and offline (`src/features/pwa/`, `src/sw.ts`, Phase 9 Steps 1–6)

- **Manifest and worker** (`vite.config.ts`): `vite-plugin-pwa` with `injectManifest`, `registerType: 'prompt'`, no injected register script, `devOptions` off (`pnpm dev` never has a worker). Manifest: `id`, `start_url` and `scope` `/`, `display: standalone`, cream background and theme color, icons 192, 512 and maskable 512.
- **Service worker** (`src/sw.ts`): precaches exactly 18 entries (shell, manifest, favicon, JS, CSS, 8 font files, the 4 Koa frames; about 965 kB), cache prefix `koa`, cleans outdated caches, serves the precached `index.html` for navigations, and handles only the `SKIP_WAITING` message. It never touches app data. Icons and splash images aren't precached (the OS fetches them at install).
- **Registration** (`registration.ts`, env `browserPwaEnv`): once, after `load`, production and secure context only. Failures are caught; the app works online as before.
- **Updates** (`updateStore.ts` + `UpdatePrompt.tsx`, rules in `core/pwa/update.ts`, decision D3): a new version waits. Koa checks on launch and on becoming visible, at most hourly and only online. A compact "Koa has an update" card under the top bar offers Update (one `SKIP_WAITING` hand-over, one reload of this tab only) or Later (hidden until the next launch). Never shown during a running focus session. The plugin's automatic reload of other tabs is disabled.
- **Kill switch:** building with `KOA_SW_KILL_SWITCH=1` ships the plugin's self-destroying worker (unregisters, deletes Koa's caches, reloads open pages once; LocalStorage untouched). The build check accepts that worker only in this mode.
- **App version:** `__APP_VERSION__` (`scripts/app-version.ts`) is shown as a caption in Settings.
- **Install help** (`installStore.ts`, `displayMode.ts`, rules in `core/pwa/install.ts`, card `app/screens/InstallCard.tsx`): hidden when `isStandalone()` or where installing isn't possible. Chromium: the captured `beforeinstallprompt` (banner suppressed) is opened only by the Install tap and used once. iPhone/iPad: Share → Add to Home Screen steps and the separate-data note. Other browsers: their menu command. Listening starts in `connect.ts` before render.
- **iOS:** `apple-touch-icon` and 30 `apple-touch-startup-image` links in `index.html` (exact device size, pixel ratio and orientation), `apple-mobile-web-app-capable`, status bar style `default`, `viewport-fit=cover` with the safe-area tokens (`--safe-*`). Pinch zoom stays allowed. The installed iPhone app has its own storage, separate from Safari (decision D10, no import).
- **Build check** (`scripts/check-build.mjs`): fails the build on reference art in `dist/`, oversized character frames, icons or splash images, a precache that isn't exactly the expected list, splash images that don't match their `<link>` media queries, or a kill-switch worker in a normal build.
- **Hosting (planned, Step 10):** Cloudflare Pages (Free plan) with GitHub integration, `pnpm build` → `dist`, Node 24 and pnpm 12.14.0 pinned, `public/_headers` with `no-cache` for `sw.js`, `index.html` and the manifest, and immutable `/assets/*`. Not connected yet.

## Dependencies

| Package | Why |
|---|---|
| `react`, `react-dom` 19 | UI |
| `lucide-react` | Interface icons (never for the mascot) |
| `@fontsource-variable/fredoka`, `@fontsource-variable/nunito-sans` | Self-hosted fonts, offline-ready |
| `motion` | Springs, presence transitions, coin fly-up, tab and layout animations |
| `vitest` (dev) | Unit tests |
| `@typescript/native` → TypeScript 7 (dev) | `tsc` type checking and build |
| `typescript` → `@typescript/typescript6` (dev) | TypeScript 6 API for typescript-eslint (until TS 7.1) |
| `vite-plugin-pwa` (dev) | Web App Manifest and the `injectManifest` build of `src/sw.ts` (Phase 9) |
| `workbox-core`, `workbox-precaching`, `workbox-routing` (dev) | Bundled into `sw.js`: cache names, precache, navigation fallback |
| `workbox-window` (dev) | Registration helper behind `virtual:pwa-register` (a direct entry because pnpm doesn't expose the plugin's own copy) |

End-to-end checks currently run through the Playwright MCP tooling during development. A committed `@playwright/test` suite is planned for Phase 10.
