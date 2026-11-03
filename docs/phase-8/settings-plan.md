# Phase 8 — Settings plan

**Status:** complete. Requirements and decisions approved (2026-11-02). Steps 1–11 are implemented and approved (2026-11-03). Step 12 (documentation and final checks) is done. Phase 8 approved and complete (2026-11-03). See "Implementation sequence" below.

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
- **Notifications (Step 9, approved 2026-11-03, including quiet-while-looking and the 5-minute staleness limit)** (`src/features/notifications/`, rule in `src/core/timer/notification.ts`, copy and timing in `src/config/notifications.ts`):
  - **When:** `sessionNotification(event, now, rules)` returns a notification only for a `sessionCompleted` event (focus, short or long break), never for skips, and only when the completion is fresh (noticed at most `notificationMaxLateMs`, 5 minutes, after `completedAt`). A session caught up on launch long after it ended isn't announced. The copy says which session comes next ("short break" / "long break" for a finished focus session, "Ready for another focus session?" after a break) and never implies it started on its own. The tag is the session id, so two tabs announcing the same session show one notification.
  - **Only in the background:** shown only if the setting is on, the permission is `granted` and the user isn't looking at Koa (page hidden or window not focused). In front of the user, Koa's own celebration is enough.
  - **Permission:** asked only by `enable()`, which the Settings switch calls straight from the tap (Safari needs the gesture). Creating the store, launching and completing sessions never ask. Granted turns the setting on; denied or a dismissed prompt leave it off and the row explains why. A dismissed prompt can be retried; a denied one only from the browser's site settings (the switch is disabled). One prompt at a time. Turning it off keeps the browser's permission and just stops using it.
  - **How:** `createNotifier` takes the browser API through `NotificationEnv` (`browserNotificationEnv()` in the app, mocks in tests). `bindNotifications` listens to the timer's events, so the timer itself is unchanged. The status (`unsupported`, `default`, `requesting`, `dismissed`, `denied`, `granted`, `failed`) is re-read when the app regains focus or becomes visible and on the Permissions API's `change` event, so a permission changed in site settings shows up without a reload. `show` uses the service worker registration when there is one (ready for Phase 9; Android and iOS need it) and otherwise `new Notification`, which focuses Koa when clicked.
  - **Saved "on" without permission** (revoked in the browser, or never granted): nothing is shown, the switch shows off and the hint explains the current permission. The saved value is kept, as for Keep screen on.
  - **Failures:** a refused, rejected or throwing `show` is caught and reported as `failed` ("didn't show the last notification"); the next successful one clears it, as does turning the setting off. The timer and rewards are never affected: everything is caught inside the timer event listener, so it can't stop the wallet's listener or the save.
  - **Unsupported** (no `Notification`, or not a secure context): the switch is disabled. On iPhone and iPad the hint says notifications need the Home Screen app (iOS 16.4 or later); elsewhere it says the browser can't show them.
  - **UI:** a "Session notifications" row with a `<Switch>` under Keep screen on in the "While you focus" card. The hint is a polite live region, so the permission result is announced. When on, it says background tabs can delay it and a locked phone may not get it.
  - **Tests:** 6 for the rule and 28 for the notifier and binding with a mock API (supported/unsupported, existing permissions, never asking on launch, granted/denied/dismissed/throwing requests, one prompt at a time, off, permission changed while away, focus/break/cycle completions, quiet while looking or off, no notification for start/pause/resume/skip/reset, late vs stale completions, revoked permission, failing shows, cleanup). Checked in Chromium with a real-time completion and the real API.
  - **Limitations:** iPhone Safari has no notifications outside the installed Home Screen app (iOS 16.4+), and even there nothing arrives while the page is suspended (locked phone, app in the background) because Koa has no push server. Desktop background tabs can be throttled, so a notification can arrive up to about a minute late. Android Chrome only shows page notifications through a service worker, so until Phase 9 a notification there reports `failed`.
- **Sounds (Step 10)** (`src/features/sounds/`, rule in `src/core/timer/chime.ts`, chime and timing in `src/config/sounds.ts`):
  - **The chime:** two soft bell notes a fifth apart (E5, then B5 0.16 s later), each a sine with a quiet octave on top, a 12 ms attack from silence and a 1.4–1.8 s exponential fade, at a low peak level (0.14). Synthesized with Web Audio (`scheduleChime`); no audio files, no dependency. Every node is disconnected when the last note ends.
  - **When:** `shouldChime(event, now, maxLateMs)` is true only for a `sessionCompleted` event (focus or break) noticed at most 5 minutes after it ended, like notifications. Skips, pauses, resumes, resets, mode changes, settings changes and ticks never chime. The chime plays whether or not the user is looking at Koa (it's the in-app cue), and in a background tab when the browser allows it.
  - **Turning it on** (`enable()`, from the switch tap) saves the setting, sets up audio inside that tap and plays the chime once as a preview, so the user hears it and its volume. Turning it off (here or in another tab) closes the audio context.
  - **Autoplay rules:** the `AudioContext` is created or woken only inside a user gesture (`pointerup`, `touchend`, `keydown`, `click`, listened to on `window`) and only while Sounds is on, so no audio is set up for users who keep it off. After a reload, the row says a tap is needed first; until then completions are silent. If the browser suspends audio (iOS in the background), a chime first asks it to resume; if playback isn't allowed within 1 second it's dropped, never played late. The next tap wakes it again.
  - **Duplicates:** one chime per session id, and chimes less than 1.5 s apart are dropped (two sessions caught up at once). Two open tabs can each chime for the same session (limitation; the second is in a background tab).
  - **Failures:** creating the context, resuming and playing are all caught and reported as `failed` ("didn't play the last chime"); the next successful chime clears it, as does turning the setting off. The timer event listener catches everything, so audio can't stop the wallet's listener, the save or notifications.
  - **Unsupported** (no `AudioContext` or `webkitAudioContext`): the switch is disabled with an explanation.
  - **Reduced motion** doesn't affect sound (it's not motion); the device's volume and silent mode apply.
  - **UI:** a "Sounds" row with a `<Switch>` after Session notifications in the "While you focus" card. Hints: off, ready, needs a tap, failed, unsupported.
  - **Tests:** 3 for the rule and 24 for the controller, binding and synthesis with a mock Web Audio (off by default, unsupported, enable with preview, disable and other-tab disable closing the context, focus and break completions once each, nothing for start/pause/resume/reset/skip/mode/settings/ticks, stale completions, waiting for a tap after reload, iOS-style interrupted audio, late resume dropped, duplicate sessions and same-moment completions, throwing play/create and rejecting resume with the session still paid and saved, cleanup, and the chime's envelope and node cleanup). Checked in Chromium with the real Web Audio API.
  - **Limitations:** iOS plays Web Audio only after a tap and nothing while the page is suspended (locked phone, app in the background); the silent switch may mute it (decision 5: no promise). Desktop background tabs can delay the chime by up to about a minute, like notifications. With notifications on in the background, the system notification may make its own sound as well.
- **Export and reset (Step 11)** (`src/features/data/`, rules in `src/core/data/data.ts`, UI in `src/app/screens/DataCard.tsx`):
  - **Export format:** a pretty-printed JSON file `koa-data-YYYY-MM-DD.json` (local day): `{ format: "koa-export", exportVersion: 1, exportedAt (ISO, UTC), storageKey: "koa:v1", data }`. `data` is exactly the `koa:v1` structure, `{ version: 1, timer, wallet, wardrobe, settings }`: the full earned ledger (focus, cycle and goal entries, so stats can be rebuilt), the spending entries (purchases), the outfit, the timer with its cycle progress, and the settings. It's built from the stores' current state, so it's complete even if an earlier save failed (private mode). Exporting never changes data. **Import is out of scope.**
  - **Download:** a Blob behind a temporary `<a download>` link (iOS Safari saves to Files). A failure to build or start the download is reported in the row ("Koa couldn't create the file…"). A browser can still block a download silently, so success says "Your download should start now".
  - **Two steps:** `requestReset()` shows the confirmation with the user's own numbers (coins to spend and earned, items bought and the outfit, focus sessions and time, the session in progress or the cycle). Only `confirmReset()` while the confirmation is showing deletes anything; `cancelReset()` (Keep my progress, or Escape) changes nothing. Focus starts on Keep my progress and returns to the Reset button afterwards. The confirmation also lists what stays: all settings and the browser's notification permission.
  - **Order:** (1) the export of the current data is written to `koa:backup:reset` and read back; (2) `koa:v1` is replaced in one write with `{ version: 1, settings }` and read back; (3) every store reloads from the save. If (1) fails (full or blocked storage, or a throwing write), nothing is deleted ("couldn't save a backup"); if (2) fails, nothing is deleted either ("couldn't save the reset"). The storage adapter swallows errors, so the read-back is how a failed write is detected. Only the latest reset's backup is kept; `koa:backup` (unreadable saves) is untouched. There's no restore button (import is out of scope); the backup can be recovered from the browser's storage.
  - **What resets:** coins and purchases (the wallet's earned ledger and spending), the outfit, stats (derived from the ledger, so they're empty too), the timer (a fresh waiting focus session with the user's durations) and the cycle (`completedInCycle` and `cycleFocusMs` are 0). **Settings are kept**, in memory and in the save. A running or paused session stops without paying.
  - **No stale state:** `reloadProgress()` (`src/features/data/store.ts`) calls:
    - `timerStore.reload()`: re-reads the saved timer and drops the old session **without events**, so it can't complete, pay, notify or chime later.
    - `walletStore.refresh()`: its change check now also compares the ledger size.
    - `wardrobeStore.refresh()`.
    - `sounds.cancelPending()`: drops a chime still waiting for the browser to resume audio. The audio context and the setting stay.
    - `wakeLock.update()`: the idle timer releases the lock.
    - `koalaStore.reset()`: no pending celebration about old coins.

    Notifications need nothing: they only react to timer events. **The permission is never requested or changed** (the notifier isn't called).
  - **Other tabs:** the `storage` listener in `connect.ts` detects a reset with `isProgressReset(oldValue, newValue)` (the old save had a timer, wallet or wardrobe slice and the new one has none; ordinary saves never drop a slice). It runs `reloadProgress()` before the usual refreshes, so another tab's running session is dropped instead of paying or being saved back.
  - **UI:** a "Your data" card at the end of Settings with Export and Reset… rows. The confirmation opens in place of the reset row (like the skip confirmation on Home), in a blush panel. Reset progress is the danger-edged button. Results and failures appear in the row's hint (a polite live region).
  - **Tests:** 13 for the rules (export envelope, every slice and ledger kind included, file name, reset state, summary, reset detection) and 21 for the controller wired to real stores with mock wake lock, notification and audio APIs: export content and failure, export from memory after failed saves, confirmation, cancel, no confirm without a request, backup and settings-only save, every category cleared, Settings unchanged, reload, wake lock released, no payout, notification or chime for the old session, a new session still works, notification permission never requested or changed, pending chime dropped, backup failure, throwing storage, save failure, retry, and another tab's session dropped. Checked in Chromium at 390×844 and 1440×900 (real download, confirmation, cancel, reset, blocked backup, two tabs).
  - **Limitations:** installed Home Screen apps on iOS may not handle `<a download>`; Phase 9 can add the Web Share API for that. A download the browser blocks silently can't be detected. The backup lives in the same LocalStorage as the save, so it doesn't survive clearing site data (Export covers that).
- **Documentation and final checks (Step 12):**
  - README, `CLAUDE.md`, `docs/architecture.md`, `docs/roadmap.md` and this plan updated to match the implementation.
  - **Review** of the whole Phase 8 change set (Steps 1–11: the `208c09a` commit and the uncommitted Steps 9–11), covering type safety, browser API failures, listeners and cleanup, timer and reward persistence, reset cleanup, cross-tab behavior, accessibility and layout. No bugs found and no code changed. The only type assertions are in storage validation, after a runtime check. Every window and document listener is either app-lifetime (registered once in `connect.ts` or a singleton) or removed in its cleanup.
  - **Automated:** `pnpm test` (440 tests in 25 files), `pnpm lint` and `pnpm build` pass.
  - **Browser checks** (Chromium through Playwright, fresh contexts, real time, 390×844 and 1440×900):
    - Timer: start, pause, resume, reset; a seeded focus session completing in real time paid 25 (focus) + 15 (cycle bonus for 50 cycle minutes) + 50 (goal), with no repeat after a reload; long break and short break completions paid nothing; skip moved to the short break.
    - Settings: the 45 min preset, interval 2 and a typed goal of 30 (snapped to 25) saved, and Home showed 45:00 and "Session 1 of 2".
    - Shop: two-step buy, auto-equip, outfit kept after a reload.
    - Stats: today ring, a 3-day streak, all-time totals and the 7-day chart text from a seeded ledger; no horizontal scroll at either width.
    - Keep screen on with the real Wake Lock API: active while running, released on pause, reacquired for a session restored on reload.
    - Notifications with the permission granted: one notification with the right copy and the session id as tag, only while the window wasn't focused.
    - Sounds with real Web Audio: preview chime on enable, "needs a tap" after a reload, ready after a tap, one chime at completion.
    - Export: a real download `koa-data-2026-11-03.json` with the envelope and all five slices.
    - Reset: the confirmation with the user's numbers, Escape and Keep my progress returning focus, then reset: Settings unchanged in the save and the UI, the backup written, coins at 0. A second tab with a running session dropped it, never paid it, and could start a new one.
  - **Known limitations** (unchanged): see the limitations of Steps 8–11 above, the legacy-minutes note in Step 6, and the open items in the roadmap (accessory art, PWA, committed Playwright suite). The evening theme stretch goal is deferred.

## Implementation sequence

1. ✅ Settings logic and the `settings` slice (approved 2026-11-02)
2. ✅ Settings store (approved 2026-11-02)
3. ✅ Timer integration (approved 2026-11-02, including the lowered-interval rule)
4. ✅ Rewards integration: daily goal and scaled cycle bonus (approved 2026-11-02)
5. ✅ Settings screen: durations, interval, daily goal (approved 2026-11-02)
6. ✅ Stats logic (approved 2026-11-02, including the legacy-minutes limitation)
7. ✅ Stats screen (approved 2026-11-02)
8. ✅ Keep screen on (approved 2026-11-03)
9. ✅ Notifications (approved 2026-11-03, including quiet-while-looking and the 5-minute staleness limit)
10. ✅ Sounds (approved 2026-11-03, including the 5-minute staleness limit and the preview chime)
11. ✅ Export and reset (approved 2026-11-03)
12. ✅ Docs and full verification (approved 2026-11-03)
