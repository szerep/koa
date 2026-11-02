# Koa — Architecture

*As built through Phase 6. Planned parts are marked **(planned)**.*

## Principles

1. **Pure core, thin UI.** Timer math, reward rules and shop rules live in `src/core/` as plain TypeScript with no React or DOM imports. They're deterministic, take `now` as a parameter, return new state plus events, and are unit tested. The koala state machine (Phase 7) follows the same pattern, and stats (Phase 8) will too.
2. **Small stores per feature.** Each feature has a tiny framework-agnostic store (`getState` / `subscribe` / actions) that React reads through `useSyncExternalStore`. There's no Redux or Zustand. Stores apply core transitions, persist the result and broadcast events.
3. **Storage behind an interface.** `StorageAdapter` (LocalStorage today) keeps IndexedDB or cloud sync possible later without touching features.
4. **Data, not code, for content.** Timer defaults, reward values, the shop catalog and the character manifest are typed config.
5. **Features talk through events.** The timer emits `sessionCompleted`, and `src/app/connect.ts` routes it to the wallet. Features don't import each other's internals.

## Folder structure

```
src/
  main.tsx                  # mounts the app; calls connectFeatures() first
  app/
    App.tsx                 # shell: top bar, tab screens, bottom nav, reward overlay
    connect.ts              # one-time wiring: timer → rewards, timer/wallet/input → Koa, cross-tab refresh
    useHashTab.ts           # tab state mirrored to location.hash (#/shop)
    useTimerAmbience.ts     # tab title countdown, focus-mode dimming, completion announcement
    screens/                # HomeScreen, ShopScreen, ComingSoonScreen (Stats, Settings)
  core/                     # pure logic, no React (unit tested)
    timer/engine.ts         # timer state machine + transitions
    timer/restore.ts        # validate/repair persisted timer state
    rewards/wallet.ts       # earned ledger, spending, derived totals, reward rules
    shop/shop.ts            # purchase, ownership, wardrobe (equip/unequip), restore
    koala/brain.ts          # Koa's behavior state machine (ambient, taps, speech, naps)
    koala/context.ts        # timer state → Koa context (idle / focus / break)
    time.ts                 # local-day keys
  features/                 # React-facing stores, hooks and components per domain
    timer/                  # timerStore, store (singleton), useTimer, TimerFace, format
    rewards/                # walletStore, store, RewardLayer (coin fly-up)
    shop/                   # wardrobeStore, store
    koala/                  # manifest.ts (poses + accessory art), Koala.tsx (rendering + motions),
                            # koalaStore/store (brain + ticking), KoaCompanion (bubble, nap glyphs)
  ui/                       # design-system primitives: Button/IconButton, SegmentedControl,
                            # ProgressRing, CoinPill, BottomNav, Card, glyphs (leaf, coin, wordmark)
  storage/
    adapter.ts              # StorageAdapter; localStorageAdapter; createMemoryAdapter (tests)
    persistence.ts          # versioned save (koa:v1), slices, migrations, backup
  config/                   # timerDefaults.ts, rewards.ts, catalog.ts, koalaBehavior.ts, koalaLines.ts
  styles/                   # tokens.css (design tokens), base.css (reset, fonts)
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
}
// Transitions: (state, now, config) => { state, events }
// Events: sessionCompleted { sessionId, mode, durationMs, startedAt, completedAt, endsCycle }
//         sessionSkipped   { sessionId, mode }
```

- **Timestamp-based.** Remaining time is always `endsAt - now`, clamped to `[0, durationMs]`. The 250ms tick only re-renders.
- **`reconcile(now)`** runs on launch, on every tick, and on `visibilitychange`, `focus` and `pageshow`. If time is up, the session completes *as of `endsAt`*. At most one session completes per reconcile, and the next session is set up idle (no auto-start).
- **Cycle:** a short break after focus sessions 1–3 and a long break after the 4th (`sessionsPerCycle`). Then the cycle resets.
- **Skip** never counts. Skipping focus goes to a short break with the cycle unchanged, and skipping the long break starts a new cycle. The UI asks for confirmation before skipping a started focus session.
- **Reset** returns to the full duration of the current mode and keeps the cycle. **Mode chips** are locked while a session is in progress.
- **`applyConfig`** only changes a session that hasn't started. This is the hook for Phase 8 custom durations; running and paused sessions are never altered.
- **Event order:** the store emits events *before* saving the timer. A crash in between causes a repeat completion (ignored by the reward ledger) rather than a lost reward.
- **iOS limitation:** a suspended web app can't run code, so completion is shown when the app is reopened. Notifications (planned, Phase 8) will only be available while the app can run, or later via push.

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
  - +30 when a focus session completes the cycle
  - +50 when the day's focus minutes reach the daily goal (default 100 min, by local day)
- **Idempotent.** Each ledger key is paid at most once, across refreshes, relaunches, two tabs, and a crash between saves. Breaks and skipped sessions never pay.
- **Spending never touches the ledger.** Totals are always recomputed from entries on load; saved totals (including Phase 5's stored `balance`) are ignored, and malformed entries are dropped.
- **Cross-tab safety.** `walletStore.award()` and `purchase()` apply to the latest *saved* wallet, not the in-memory copy.

## Shop and wardrobe (`src/core/shop/shop.ts`)

- **Ownership** = a `spending` entry `item:<id>`, so buying the same item twice is impossible by construction. Purchases fail cleanly with `insufficientFunds`, `alreadySpent` or `invalidAmount`.
- **Wardrobe** = `Record<'head' | 'face' | 'neck' | 'ear' | 'body', itemId | null>`, with one item per slot. Only owned items can be equipped. On load, an item is kept only if it exists in the catalog, is owned and is in its own slot.
- **Catalog:** 9 items in `src/config/catalog.ts` (hats, glasses, clothes, scarves, extras).
- **UI flow:** a two-step buy ("120" → "Buy for 120?"), then the item is equipped automatically.

## Persistence (`src/storage/persistence.ts`)

- A single LocalStorage key, `koa:v1`: `{ version: 1, timer, wallet, wardrobe }`. Each slice is validated by its own feature on load (`restoreTimer`, `restoreWallet`, `restoreWardrobe`), so a damaged slice resets only that feature.
- Unreadable JSON, or a save from an unknown future version, is copied to `koa:backup` before the app starts fresh. A migration table (`migrations[n]`) is in place for future schema versions.
- Saves happen on each state change; ticks are never saved.
- **Planned:** a `settings` slice (Phase 8), and an append-only session `history` from which stats are derived (Phase 8).

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
| `vite-plugin-pwa` **(planned)** | Manifest, service worker, offline support (Phase 9) |

End-to-end checks currently run through the Playwright MCP tooling during development. A committed `@playwright/test` suite is planned for Phase 10.
