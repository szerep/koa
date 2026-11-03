/**
 * Update flow tuning (Phase 9, Step 4). See docs/phase-9/pwa-plan.md, Step 4.
 */
export const pwaUpdateConfig = {
  /** Koa looks for a new version on launch and when it becomes visible, at most this often. */
  checkIntervalMs: 60 * 60 * 1000,
  /**
   * After Update is tapped, the waiting version must take over within this time, or the prompt
   * comes back (the update failed, nothing was reloaded).
   */
  activateTimeoutMs: 10_000,
} as const
