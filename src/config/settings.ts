import type { SettingsSpec } from '../core/settings/settings'
import { rewardRules } from './rewards'
import { timerDefaults } from './timerDefaults'

/**
 * Settings defaults and bounds (docs/phase-8/settings-plan.md).
 * Defaults come from the timer and reward config, so new users get exactly the
 * pre-Phase 8 behavior: 25 / 5 / 20 minutes, a long break after 4 sessions, a 100-minute goal.
 */
export const settingsSpec: SettingsSpec = {
  defaults: {
    durations: { ...timerDefaults.durations },
    longBreakEvery: timerDefaults.sessionsPerCycle,
    dailyGoalMinutes: rewardRules.dailyGoalMinutes,
    notifications: false,
    keepScreenOn: false,
    sounds: false,
  },
  ranges: {
    focus: { min: 1, max: 120, step: 1 },
    shortBreak: { min: 1, max: 30, step: 1 },
    longBreak: { min: 1, max: 60, step: 1 },
    longBreakEvery: { min: 2, max: 8, step: 1 },
    /** 25-minute steps; the 480 max is off the grid and reachable as the bound. */
    dailyGoalMinutes: { min: 25, max: 480, step: 25 },
  },
}

/** Quick focus lengths offered next to the stepper. */
export const focusPresets = [15, 25, 45, 50] as const
