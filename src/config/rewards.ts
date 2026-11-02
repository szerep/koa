import type { RewardRules } from '../core/rewards/wallet'

/** Reward values. Tune here; nothing else hard-codes amounts. */
export const rewardRules: RewardRules = {
  coinsPerFocusMinute: 1,
  cycleBonus: 30,
  /** A cycle with 100 focus minutes (4 × 25) earns the full 30; shorter cycles earn a share. */
  cycleBonusFullMinutes: 100,
  dailyGoalBonus: 50,
  /**
   * Default daily goal: 100 focus minutes (four 25-minute sessions). The app uses the goal from
   * Settings (src/config/settings.ts takes its default from here).
   */
  dailyGoalMinutes: 100,
}
