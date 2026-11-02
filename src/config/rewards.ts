import type { RewardRules } from '../core/rewards/wallet'

/** Reward values. Tune here; nothing else hard-codes amounts. */
export const rewardRules: RewardRules = {
  coinsPerFocusMinute: 1,
  cycleBonus: 30,
  dailyGoalBonus: 50,
  /** Default daily goal: 100 focus minutes (four 25-minute sessions). Adjustable in Phase 8. */
  dailyGoalMinutes: 100,
}
