/**
 * Session-complete notifications (Phase 8, Step 9). Copy and timing, not UI.
 * The next session never starts on its own, so the copy only says it's ready.
 */
export const notificationCopy = {
  focusDone: { title: 'Focus session done', body: 'Nice work. Your short break is ready when you are.' },
  cycleDone: { title: 'Focus session done', body: 'Cycle complete. Your long break is ready when you are.' },
  breakDone: { title: "Break's over", body: 'Ready for another focus session?' },
} as const

/**
 * A completion noticed later than this (the app was closed, or the browser suspended the page)
 * isn't announced: the news is stale, and the user sees the result when they come back.
 * Background tabs can be throttled to about one timer run a minute, so this leaves room for that.
 */
export const notificationMaxLateMs = 5 * 60_000
