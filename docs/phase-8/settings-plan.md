# Phase 8 — Settings plan

**Status:** requirements recorded. Not implemented yet.

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
