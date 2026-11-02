# Koa — Implementation Roadmap

Each phase ends with a working build (`pnpm build` and `pnpm lint` pass), a Playwright check at 390×844 and on desktop, a short demo or summary, and **your approval** before the next phase starts.

## Status

**Phases 1–7 are complete and approved (2026-11-02). Phase 8 is in progress: Steps 1–8 of 12 approved (2026-11-03). Next: Step 9 (notifications).**

| Phase | Status | Goal | Key deliverables | Done when |
|---|---|---|---|---|
| **1. Analysis and product design** | ✅ Approved | Shared vision | `CLAUDE.md`, design brief, character bible, architecture, this roadmap | Approved |
| **2. Character artwork and assets** | ✅ Approved (closed at Gate 0 by decision) | One locked, unmistakable Koa. Consistency over quantity. | Gate 0 Koa Master (v02, provisional) + idle blink frame; normalization and export scripts. Gates 1–3 (expressions, poses, accessories) deferred to a later art pass. | Master approved; blink aligns pixel-perfectly |
| **3. Design system and home screen** | ✅ Approved | It looks like Koa | Tokens, fonts, UI primitives, app shell with 4 tabs and safe areas, home composition with the real koala (breathing and blink) | Matches the brief on iPhone, iPad and desktop |
| **4. Pomodoro timer** | ✅ Approved | An accurate, lovely timer | `core/timer` engine plus tests; start, pause, resume, reset, skip; cycle and long break; persistence and background reconciliation. *Custom durations and notifications moved to Phase 8.* | Tests pass; survives reload and backgrounding |
| **5. Coins and rewards** | ✅ Approved | Studying pays | Idempotent wallet ledger, cycle and daily-goal bonuses, coin fly-up animation | No double payouts (tested) |
| **6. Shop and customization** | ✅ Approved | Spend coins on Koa | Catalog, shop UI, buy, equip and unequip, wallet with separate earned and spent, wardrobe persistence, accessory-layer integration. **Accessory artwork not produced yet** (`docs/phase-6/accessory-assets.md`). | Purchases, ownership and outfit persist (tested); items appear on Koa once their art exists |
| **7. Personality and interactions** | ✅ Approved | Koa feels alive | Koala state machine, ambient actions, tap and multi-tap reactions, speech bubbles, nap on inactivity, show-off on equip. Needs Tier 2 poses from the art pipeline; until they exist it works within the idle frames. | Never interrupts focus; no repeated actions; respects reduced motion |
| **8. Statistics and settings** | In progress (Steps 1–8 of 12 approved) | Progress you can see | Totals, streak, daily goal, weekly chart. Settings (`docs/phase-8/settings-plan.md`): **custom focus, short break and long break durations (R1)**, **adjustable daily goal (R2)**, notifications, wake lock, sounds, data reset and export. Evening theme (stretch goal). | Stats derived from history (tested); custom durations validated, persisted, never altering a running session (tested) |
| **9. PWA and mobile optimization** | Planned | Installable and offline | `vite-plugin-pwa`, manifest, Apple touch icons and splash screens, offline caching of art and fonts, standalone polish, performance budget (keep the design sheet out of the shipped bundle) | Installs on iPhone; works offline; Lighthouse PWA checks pass |
| **10. Testing and polish** | Planned | Ship quality | Committed Playwright suite, accessibility pass, motion tuning, copy pass, bug bash | Release candidate |

## Decisions log

- **2026-11-02:** Phase 1 approved.
  - Sheet renamed to `koala-design-sheet.png`.
  - Crown tuft always present; pink-cream inner ears; cropped hoodie; Study pose without glasses.
  - Clothing uses hoodie recolors (option A).
  - Fonts: Fredoka + Nunito Sans. Animation library: Motion.
  - Image tool: ChatGPT ImageGen.
- **2026-11-02:** Gate 0 closed. **v02 approved as the provisional Koa Master** (known proportion deviations accepted; see `docs/phase-2/gate-0-koa-master.md` §7). Idle blink frame produced and exported. **Phase 2 stopped at Gate 0 by decision.** Gates 1–3 (expressions, poses, accessories) are deferred to a later art pass. Priority now: a working app.
- **2026-11-02:** Phase 3 implemented (design system, app shell, home screen). Tooling: TypeScript 6 installed under the `typescript` alias so typescript-eslint works; `tsc` remains TypeScript 7.
- **2026-11-02:** Phase 3 approved. Phase 4 implemented:
  - Pure engine in `src/core/timer/`, versioned storage in `src/storage/`, store and hook in `src/features/timer/`.
  - 59 unit tests (`pnpm test`, Vitest) plus a Playwright fake-clock run through a full cycle, refresh and a 2-hour suspension.
  - Decisions:
    - A finished session moves to the next one *without auto-starting*.
    - Skipped sessions never count, and skipping a focus session goes to a short break.
    - Mode chips are locked while a session is in progress.
    - Skipping a started focus session asks for confirmation.
  - System notifications and wake lock are deferred to Phase 8 settings, so the permission prompt sits behind an explicit toggle.
- **2026-11-02:** Phase 4 approved. Custom timer durations recorded for Phase 8 (`docs/phase-8/settings-plan.md`, R1).
- **2026-11-02:** Phase 5 implemented:
  - Pure, idempotent wallet in `src/core/rewards/wallet.ts`; values in `src/config/rewards.ts`; store, overlay and wiring in `src/features/rewards/` and `src/app/connect.ts`.
  - Rewards:
    - 1 coin per focus minute
    - +30 cycle bonus
    - +50 daily goal; **the goal defaults to 100 focus minutes per local day**, adjustable in Phase 8
  - Ledger keys `focus:<sessionId>`, `cycle:<sessionId>` and `goal:<day>`, each paid at most once, including across tabs, relaunches and a crash between saves.
- **2026-11-02:** Phase 5 approved. Phase 6 implemented:
  - **Wallet:** split into an append-only earned `ledger` and a separate `spending` record (`item:<id>`). Earned, spent and balance are always derived from these entries; saved totals are ignored.
  - **Shop rules:** pure functions in `src/core/shop/shop.ts`; catalog of 9 items in `src/config/catalog.ts`.
  - **Wardrobe:** a separate saved slice, one item per slot. On load it only keeps items that exist, are owned and sit in their own slot.
  - **Buying:** a two-step confirm, then the item is equipped automatically.
  - **Accessory art:** the integration (`accessoryArt` in the manifest, plus layered rendering in `<Koala>`) is ready, but **no art exists yet**. Required files are listed in `docs/phase-6/accessory-assets.md`.
  - **Hoodie recolors:** deferred. Producing them by recoloring the Master's hoodie in code needs explicit approval (character bible §5).
  - **Tests:** 108 unit tests.
- **2026-11-02:** Phase 6 approved. Documentation updated and the project prepared for GitHub. **Next: Phase 7.**
- **2026-11-02:** Phase 6 decisions confirmed: no accessory artwork yet (separate art task later); hoodie recoloring postponed until it can be done cleanly without affecting the fur; shop structure, artwork integration, catalog and prices stay as they are.
- **2026-11-02:** Phase 7 implemented:
  - Pure koala brain in `src/core/koala/` (state machine + timer-context mapping), tuning in `src/config/koalaBehavior.ts`, lines in `src/config/koalaLines.ts`; store and `<KoaCompanion>` in `src/features/koala/`; wiring in `src/app/connect.ts`. Not persisted.
  - **Existing art only:** behaviors are transforms of the idle frame or use the approved blink frame (slow blink, eyes closed while napping). No new poses, no placeholder art. The sleepy "z" glyphs are typography, as planned in character bible §6.
  - Decisions:
    - Unprompted speech at most every **2 minutes** (bible said ~90s), to keep Koa subtle. Tap replies at most every 20s; event lines (celebrations, breaks, waking) always show.
    - **Focus:** no ambient actions, speech or naps; taps get a rate-limited soft squish. Paused focus counts as idle.
    - Celebration lines wait until the coin labels have floated away (2.3–3s).
    - Napping after 5 min without input (3 min during a break), never during focus.
    - The Home hop on rewards and the Shop hop on equip are replaced by the brain's celebrate and show-off reactions.
  - **Tests:** 145 unit tests (37 new for the brain, context mapping, store and `canAffordAnything`).
- **2026-11-02:** Phase 7 approved. Decisions confirmed as implemented: 2-minute minimum between unprompted lines; a paused focus session counts as idle; nap "z" letters stay plain text; equip thank-you lines never imply that missing accessory artwork is visible. **Next: Phase 8.**
- **2026-11-02:** Phase 8 plan approved, to be implemented in 12 reviewed steps (`docs/phase-8/settings-plan.md`). Decisions:
  - The cycle bonus scales with the cycle's focus minutes: `round(30 × minutes / 100)`, capped at 30.
  - Lowering the goal pays only when the next focus session completes.
  - The long break interval is 2–8 sessions, default 4.
  - A streak counts consecutive days with a completed focus session.
  - Sounds: one Web Audio chime, off by default.
  - Reset keeps Settings and writes a backup first.
  - Stats come from the existing ledger: no `history` slice and no migration. Import is out of scope.
- **2026-11-03:** Phase 8 Steps 1–8 approved (`docs/phase-8/settings-plan.md`, "Implementation details"):
  - Settings model, store and screen: custom durations, long break interval (2–8), daily goal (25–480 min), saved in an optional `settings` slice (no version bump).
  - The timer follows Settings for new and waiting sessions only; running and paused sessions keep their length.
  - Daily goal read at payout time; cycle bonus scaled by the cycle's focus minutes (`cycleFocusMs`).
  - Stats derived from the ledger: a session counts on its entry's saved `day`, the current streak continues from yesterday until today ends, future-dated entries don't extend it, legacy entries without minutes are estimated from coins for Stats only (accepted limitation).
  - Stats screen: today ring, streaks, all-time totals, 7-day CSS bar chart with screen-reader text, Koa empty state.
  - Keep screen on: Screen Wake Lock held only during a running focus session with the page visible; disabled with an explanation where unsupported.
  - Remaining: Step 9 notifications, Step 10 sounds, Step 11 export and reset, Step 12 docs and final checks.
