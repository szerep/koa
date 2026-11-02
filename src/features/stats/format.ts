/** Display helpers for the Stats screen. Pure; minutes arrive unrounded from src/core/stats. */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Compact duration for big figures and labels: "0 min", "45 min", "2 h", "3 h 5 min". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** The same duration in words, for screen readers: "1 hour 5 minutes". */
export function spokenDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return plural(total, 'minute', 'minutes')
  const h = Math.floor(total / 60)
  const m = total % 60
  const hours = plural(h, 'hour', 'hours')
  return m === 0 ? hours : `${hours} ${plural(m, 'minute', 'minutes')}`
}

export const sessionCount = (n: number) => plural(n, 'focus session', 'focus sessions')
export const dayCount = (n: number) => plural(n, 'day', 'days')

/** A `YYYY-MM-DD` key as a local Date at noon (noon keeps it on the same day across DST). */
function dateOf(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

const shortWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const longDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

/** "Mon" */
export const weekdayShort = (day: string) => shortWeekday.format(dateOf(day))
/** "Monday, November 2" */
export const dateLong = (day: string) => longDate.format(dateOf(day))

/** Milliseconds from `now` until the next local midnight (calendar-based, so DST-safe). */
export function msUntilNextDay(now: number): number {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now
}

/**
 * The top of the weekly chart: the larger of the daily goal and the best day in the window,
 * so the goal line always fits and a big day never overflows. Never below 1.
 */
export function chartMax(dayMinutes: readonly number[], goalMinutes: number): number {
  return Math.max(1, goalMinutes, ...dayMinutes)
}
