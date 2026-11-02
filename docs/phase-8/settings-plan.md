# Phase 8 — Settings plan

**Status:** requirements and decisions approved (2026-11-02). Steps 1–8 are implemented and approved (2026-11-03); Steps 9–12 remain. See "Implementation sequence" below.

## R1. Custom timer durations (added 2026-11-02, product requirement)

Users can customize all three Pomodoro durations:

| Setting | Default |
|---|---|
| Focus | 25 minutes |
| Short break | 5 minutes |
| Long break | 20 minutes |

### Requirements
1. **Simple, intuitive controls.** One row per mode with a −/+ stepper around a large value that's easy to tap (Fredoka numerals). Also offer a few quick presets for focus (15 · 25 · 45 · 50).
2. **Show the current value clearly**, with its unit ("25 min"), on the row itself.
3. **Validate and prevent invalid values.** Whole minutes only, within these bounds:
   - Focus: 1–120 min
   - Short break: 1–30 min
   - Long break: 1–60 min

   The stepper can't go past a bound, and typed input is clamped on blur. Non-numbers and empty input revert to the last valid value.
4. **Persist** the preferences in the versioned save (`koa:v1`, a new `settings` slice). Stored values are validated on load, and invalid ones fall back to the defaults.
5. **New sessions use the configured durations.** The timer store takes its config from the settings store.
6. **Sessions already running or paused are never altered.** New durations apply to the next session. An idle session that hasn't started yet updates right away, so the home screen shows the new length.
7. **Defaults unchanged for new users:** 25 / 5 / 20, with a long break after 4 sessions.

### Existing support (Phase 4)
- `applyConfig(state, config)` in `src/core/timer/engine.ts` already does R1.6: it updates only an idle session and leaves running and paused sessions untouched. This is covered by the unit tests.
- `restoreTimer` uses the current config for idle sessions on load.

### Acceptance tests to add in Phase 8
- Changing the focus length while a focus session runs keeps the running end time. The next focus session uses the new length.
- Values outside the bounds can't be saved, and corrupt saved settings fall back to the defaults.
- A fresh install shows 25 / 5 / 20.
- Rewards stay proportional to the actual completed duration (1 coin per focus minute; see Phase 5).

## R2. Adjustable daily goal

- The daily goal is the number of **focus minutes per local day** that earns the +50 daily-goal bonus (Phase 5).
- **Default:** 100 minutes, which is four 25-minute sessions. It stays the default for new users.
- **Control:** a stepper in 25-minute steps from 25 to 480 minutes, showing the value as "100 min (about 4 sessions)".
- **Saved** in the same `settings` slice. Invalid saved values fall back to 100.
- **Changes apply going forward.** If the goal changes mid-day, today's bonus is paid when the new goal is reached. A bonus already paid for today is never taken back or paid twice (the `goal:<day>` ledger key).
- **Wiring:** `dailyGoalMinutes` in `RewardRules` (`src/config/rewards.ts`) becomes a value the settings store provides.

## Other settings already planned for Phase 8
- **Long break interval:** sessions per cycle, default 4.
- **Session-complete notifications:** off by default. The permission is only requested when the user turns this on.
- **Keep screen on during focus** (Screen Wake Lock), where supported.
- **Sounds.**
- **Data:** export, and reset progress (with confirmation).

## Implementation findings (Phase 8 review, 2026-11-02)

*Findings from the code review before implementation, approved 2026-11-02. The requirements above are unchanged.*

### Code that needs to change
- **Timer config is fixed at startup.** `createTimerStore` captures `config` once (`src/features/timer/store.ts` passes `timerDefaults`). The store needs a `setConfig(config)` action that keeps the new config for later transitions and calls `applyConfig` (idle sessions only, as R1.6 requires). The settings store must be loaded **before** the timer store, so `restoreTimer` sizes an idle session with the saved durations on launch.
- **Reward rules are fixed at startup.** `createWalletStore` captures `rules` once. It needs a `getRules()` source so `award()` reads the current daily goal. `rewardSession` already pays `goal:<day>` at most once, so changing the goal can never pay twice or take a bonus back.
- **The Home cycle leaves** read `timerDefaults.sessionsPerCycle` directly. They need to read the configured long break interval.
- **Cross-tab:** the `storage` event in `src/app/connect.ts` refreshes the wallet and wardrobe. It also needs to refresh settings, which then pushes the config to the timer.

### Persistence
- `settings` is a new optional slice in `koa:v1`. Older saves don't have it and load with the defaults, so **no schema version bump or migration** is needed.
- Each field is validated separately: an invalid value falls back to its own default, and the other fields are kept.

### Stats data (what already exists)
- Every completed focus session already has a permanent ledger entry `focus:<sessionId>` with `at` (completion time), `day` (local `YYYY-MM-DD`), `minutes` and `sessionId`. The ledger is append-only and never pruned. `goal:<day>` entries record the days the daily goal was reached.
- **Can be derived reliably:** focus minutes and sessions for today, any day or the last 7 days; all-time totals; the days the goal was reached; current and best streak (consecutive local days with focus).
- **Not recorded:** completed or skipped breaks, skipped focus sessions, pauses, start times in the ledger, and the goal value in effect on a past day. Stats about these need new tracking from now on, and can't cover the past.
- A session that crosses midnight counts entirely on the day it finished (`day` is set at completion).

### Browser limitations
- **Notifications:** iPhone Safari has no Web Notifications API outside an installed Home Screen app (iOS 16.4+). Even when installed, iOS suspends the page in the background, and Koa has no push server, so a session that ends while the phone is locked can't notify. On desktop, background tabs throttle timers, so a notification can arrive up to about a minute late. Permission is requested only when the toggle is turned on. If the API is missing or the permission is denied, the setting explains why.
- **Wake Lock:** supported in Safari 16.4+ (installed web apps only from iOS 18.4), Chrome and Edge. It needs a secure context, and the browser releases it whenever the page is hidden, so it has to be requested again when the page becomes visible. Held only while a focus session is running.
- **Sounds:** no audio assets exist. iOS only plays Web Audio after a user gesture, and nothing plays while the page is suspended.
- **Export:** a JSON download built from a Blob. iOS saves it to Files; installed web apps may need the Web Share API instead.

## Decisions (approved 2026-11-02)

1. **Cycle bonus scales with the cycle's focus time.** Bonus = `round(30 × cycleFocusMinutes / 100)`, capped at 30 coins. A default cycle (4 × 25 min) still pays exactly 30. The timer state gets a backward-compatible field for the cycle's focus minutes. A saved timer without it still loads.
2. **Lowering the goal below today's minutes** doesn't pay from Settings. The +50 is paid when the next focus session completes. Still at most once per day (`goal:<day>`).
3. **Long break interval:** 2–8 focus sessions, default 4.
4. **Streak:** consecutive local calendar days with at least one completed focus session. Reaching the daily goal isn't required.
5. **Sounds:** one soft session-complete chime generated with the Web Audio API. No audio files and no dependency. Off by default. It plays only when the user has turned it on and the browser allows playback. The app makes no promise about the iPhone silent switch.
6. **Reset progress** keeps Settings. It resets coins, purchases, the outfit, statistics, the timer and cycle progress. It writes an automatic backup first and needs explicit confirmation.
7. **Stats come from the existing focus ledger entries**, past sessions included. There's no separate `history` slice and no migration. Data import is out of scope; JSON export is enough.

## Implementation details

- **Settings model** (`src/core/settings/settings.ts`, defaults and bounds in `src/config/settings.ts`): `durations` (focus, shortBreak, longBreak), `longBreakEvery`, `dailyGoalMinutes`, and the flags `notifications`, `keepScreenOn` and `sounds` (all off by default). Defaults are taken from `timerDefaults` and `rewardRules`, so they can't drift apart.
- **Valid values:** whole numbers within the range, on the step grid counted from the minimum. Both bounds are always valid.
- **Daily goal top bound (approved):** 480 isn't a multiple of 25, so the goal steps 25, 50, … 475, then 480. Stepping down from 480 goes to 475. A typed value snaps to the nearest valid value. 480 is kept because a full 8-hour day is a useful upper limit.
- **Typed input on blur:** rounded to whole minutes, clamped and snapped. Empty or non-numeric input (signs, exponents, units) reverts to the last valid value. A comma is accepted as the decimal separator.
- **Invalid values can't be saved:** `setNumber` returns the settings unchanged.
- **Settings store** (`src/features/settings/settingsStore.ts`, singleton in `store.ts`): `getState`, `subscribe`, `setNumber` (returns false for an invalid value), `setFlag` and `refresh`. It's loaded and validated once and saved on every real change, and subscribers are notified only when a value changes. Changes apply to the in-memory settings, so a failed write (private mode, full storage) never loses an earlier change. Other tabs' changes arrive through `refresh()`, called from the `storage` listener in `src/app/connect.ts`. It notifies only if a value actually differs. The store doesn't know about the timer or rewards; they'll read it (Steps 3 and 4).
- **Timer integration (Step 3):**
  - `timerStore` is created from the saved settings (`timerConfigFrom(settingsStore.getState())`). Importing the settings store guarantees it's loaded first, so `restoreTimer` sizes a waiting session with the user's durations on launch.
  - `setConfig(config)` stores the new config for every later transition and calls `applyConfig`. `src/app/connect.ts` calls it whenever settings change, including changes from other tabs.
  - Running and paused sessions keep their length, end time and remaining time. The `sessionCompleted` event carries the session's own length, so coins follow the time actually studied.
  - **A waiting (not started) session is refitted right away** (`fitIdleSession`, also used by `restoreTimer` on reload): its length follows the settings, and the cycle count is capped at the long break interval.
  - **Lowering the interval** to or below the focus sessions already done completes the cycle. A waiting focus session or short break then becomes the long break the cycle has earned, so that break isn't lost. This happens only when the interval is actually lowered, so a short break picked by hand after a full cycle stays a short break when other settings change or the app reloads. A waiting long break is kept when the interval is raised.
  - **The interval in effect when a running focus session ends** decides whether it completes the cycle. The session itself is never changed.
  - The Home cycle leaves show the configured interval.
- **Rewards integration (Step 4):**
  - **Daily goal:** `createWalletStore` takes `dailyGoalMinutes: () => number`. The app passes the settings value. It's read inside `award()`, so the goal is only checked when a focus session completes. Saving Settings never pays, and `goal:<day>` is still paid at most once per day. A bonus already paid is never paid again or taken back.
  - **Cycle bonus:** `cycleBonusFor(cycleFocusMs, rules)` is `min(30, round(30 × minutes / 100))`, using `cycleBonusFullMinutes: 100` in `src/config/rewards.ts`. A bonus that rounds to 0 isn't recorded. The ledger key `cycle:<sessionId>` is unchanged.
  - **Tracking:** `TimerState.cycleFocusMs` adds up each completed focus session's own length, and the `sessionCompleted` event carries the total. Skipped sessions add nothing. It starts over with the cycle: after the long break, or when the long break is skipped or abandoned. Reset, mode changes and settings refits keep it.
  - **Compatibility:** a saved timer without `cycleFocusMs` (or with an invalid one) gets `completedInCycle × 25 min`. That's exact for saves from before Phase 8, when every focus session was 25 minutes, so a cycle in progress still earns the full 30.
  - **Lowering the interval** so that a waiting session becomes the long break (Step 3) pays no cycle bonus (approved). The cycle bonus, like the daily goal bonus, is only ever paid when a focus session completes, never from a Settings change.
- **Settings screen, part 1 (Step 5)** (`src/app/screens/SettingsScreen.tsx`):
  - Two grouped cream cards (design brief §6). **Timer:** Focus with the 15 · 25 · 45 · 50 presets, Short break, Long break, and Long break after (sessions). **Daily goal:** the goal, with "About N sessions of X min" (`sessionsForGoal`, rounded up) and the 50-coin bonus it earns.
  - Each row shows its range under the label. When a session is running or paused, the Timer card says the current session keeps its length.
  - **`<Stepper>`** (`src/ui/Stepper.tsx`): 48px round −/+ buttons (above the 44pt minimum), disabled at the bounds. Holding a button repeats (after 420ms, every 80ms) and stops at a bound.
  - The number is a 32px Fredoka text field (`role="spinbutton"`, numeric keyboard; 16px or more, so iOS doesn't zoom). Enter or blur commits through `commitInput`. Escape cancels, and Arrow Up/Down step. A typed value that had to change shows "Adjusted to …" in a polite live region.
  - **Daily goal boundary:** 475 → + → 480 (+ disabled), 480 → − → 475; a typed 479 becomes 480.
  - Coins stay at 1 per minute of each session's own length.
- **Stats logic (Step 6)** (`src/core/stats/stats.ts`, calendar helpers in `src/core/time.ts`):
  - **Pure and read-only.** `computeStats(ledger, now, { coinsPerFocusMinute, windowDays })` returns `today` (minutes, sessions, goal reached), `window` (the rolling 7 days, oldest first, ending today), `allTime` (minutes, sessions, active days), `streak` (`current`, `best`, `activeToday`) and `goalDays`. The building blocks `focusSessions`, `goalDays`, `totalsByDay` and `streaks` are exported and tested on their own. Nothing is stored: no `history` slice, no migration, and the ledger format is unchanged.
  - **Which day a session counts on:** the `day` recorded in its `focus:` entry at completion. That's the same day the daily goal check uses, and it stays put if the user later changes timezone. Only when `day` is missing or not a real date does it fall back to `dayKey(at)` (local day of the completion time). An entry with neither is skipped.
  - **Calendar arithmetic:** `addDays(key, n)` steps the `YYYY-MM-DD` components with `Date.UTC`, so it never depends on timezone or daylight saving. Stepping local midnight by 24 hours would land on the same day when the clocks go back; the tests pin `Europe/Budapest` and check both 2026 DST changes. `isDayKey` rejects malformed keys and impossible dates (2026-02-30).
  - **Streaks:** the current streak counts back from today if today has a session, otherwise from yesterday, so it stays alive until a whole day passes without focus (`activeToday` tells the UI which case it is). Days after today (a clock that was set ahead) never extend the current streak but can count toward the best.
  - **Goal days** come from `dailyGoal` entries: their `day`, else the date in the `goal:<day>` key, else `dayKey(at)`. Supported for all past data, because the goal entry has always been written.
  - **Legacy entries without `minutes`:** every shipped version has written `minutes`, but a missing, negative or non-numeric value is handled: the session still counts (sessions, streaks), and its minutes are estimated as `amount / coinsPerFocusMinute` when the caller passes the rate (the app will pass `rewardRules.coinsPerFocusMinute`, which has always been 1). Without a rate they count as 0. Note that the wallet's own `focusMinutesOn` (used for the daily goal) counts such entries as 0, so for these entries only, Stats minutes can be higher than the goal check's. Malformed entries (`null`, strings) are ignored.
  - Minutes are returned unrounded; the Stats screen rounds for display.
  - **Tests:** 28 in `src/core/stats/stats.test.ts`, including a cross-check against real `rewardSession` payouts. They pass with the machine set to other timezones (checked with `TZ=America/Los_Angeles` and `TZ=Asia/Tokyo`).
- **Stats screen (Step 7)** (`src/app/screens/StatsScreen.tsx`, helpers in `src/features/stats/`):
  - Reads `computeStats(wallet.ledger, now, { coinsPerFocusMinute })` from the existing stats logic; nothing is stored. The goal is the current Settings value.
  - **Today card:** the existing `<ProgressRing>` (track in the sunken tone so it shows on the cream card) with today's minutes against the goal, the session count and a status line: minutes to go, "Daily goal reached" when today has a `goal:` entry, or "Goal met. The bonus comes with your next focus session." when a lowered goal is already met but not yet paid (decision 2).
  - **Figures:** current streak (with "Focus today to keep it going" while it's still counting from yesterday) and best streak; all-time focus time, sessions and active days.
  - **Last 7 days:** CSS bars only, scaled to the larger of the goal and the best day, with a dashed goal line, minutes above each bar, a leaf on goal days, today in a darker eucalyptus and a small nub for days without focus. The bars grow in once (transform only) and don't animate with reduced motion.
  - **Accessibility:** the chart is an ordered list. Each day carries hidden full text ("Monday, November 2 (today): 50 minutes, 2 focus sessions, goal reached."), and the visual bars are `aria-hidden`. Compact durations ("3 h 5 min") have spoken equivalents.
  - **"Today" rolls over:** `useNow` refreshes at the next local midnight and when the app becomes visible again, so the window moves without a reload.
  - **Empty state** (no completed focus sessions yet): Koa's resting state (`ComingSoonScreen`, now with an optional action) with a "Start focusing" button that goes to Home.
  - Layout: one column (max 600px) on phones and tablets; on wide screens the today card sits beside the stacked figures, with the week underneath.
- **Keep screen on (Step 8)** (`src/features/wakeLock/`, rule in `src/core/timer/wakeLock.ts`):
  - **When:** `shouldKeepScreenOn(timer, keepScreenOn, now)` is true only for a running focus session whose end time hasn't passed, with the setting on. Breaks, waiting and paused sessions never hold a lock. The end-time check also covers coming back after a session ended while the app was away, before the timer has caught up.
  - **How:** `createWakeLockController` takes the browser API through `WakeLockEnv` (`browserWakeLockEnv()` in the app, mocks in tests). It holds a lock only while the page is visible and the rule says so. `bindWakeLock` re-checks on every timer and settings change and on `visibilitychange`, so start, pause, resume, completion, skip, reset, the setting and other tabs' setting changes are all covered without changes to the timer. The singleton is in `store.ts`; `connect.ts` checks it once on launch for a restored running session.
  - **Hidden page:** the browser releases the lock itself; the controller also releases its reference, and requests a new lock when the page is visible again (if still wanted).
  - **Failures:** a refused or throwing request is caught and reported as `failed` (the timer is never affected). It's tried again on the next timer or setting change or when the page becomes visible. One request at a time; a lock that arrives after it stopped being wanted is released right away. `dispose()` releases the lock and removes every listener.
  - **Unsupported** (no `navigator.wakeLock`, or not a secure context): the switch is disabled and the row says the device's own screen timeout applies. A saved `true` is kept but shown as off.
  - **UI:** a "While you focus" card with a `<Switch>` (`src/ui/Switch.tsx`, `role="switch"`, 44px hit area). The hint under the label reflects the status (off, staying on, refused, unsupported). Step 9 notifications will join this card.
  - **Tests:** 4 for the rule and 20 for the controller and binding with a mock API and visibility (supported/unsupported, acquire and release on pause, completion, skip, reset and the setting, reacquire on visible, breaks and paused never hold, refused and throwing requests, late locks, cleanup). Checked in Chromium with the real API.
  - **Limitations:** iPhone Safari supports it from 16.4, but an installed Home Screen app only from iOS 18.4. Low power modes and browser policies can refuse a request; the screen then follows the device's timeout.

## Implementation sequence

1. ✅ Settings logic and the `settings` slice (approved 2026-11-02)
2. ✅ Settings store (approved 2026-11-02)
3. ✅ Timer integration (approved 2026-11-02, including the lowered-interval rule)
4. ✅ Rewards integration: daily goal and scaled cycle bonus (approved 2026-11-02)
5. ✅ Settings screen: durations, interval, daily goal (approved 2026-11-02)
6. ✅ Stats logic (approved 2026-11-02, including the legacy-minutes limitation)
7. ✅ Stats screen (approved 2026-11-02)
8. ✅ Keep screen on (approved 2026-11-03)

**Remaining:**

9. Notifications (next)
10. Sounds
11. Export and reset
12. Docs and full verification
