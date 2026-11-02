/** Local calendar day of a timestamp, as `YYYY-MM-DD` (the user's own timezone). */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Calendar date components of a `YYYY-MM-DD` key, or null if it isn't a real date (e.g. 2026-02-30). */
function parseDayKey(key: string): { y: number; m: number; d: number } | null {
  const match = DAY_KEY.exec(key)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return { y, m, d }
}

/** True for a well-formed `YYYY-MM-DD` key naming a real calendar date. */
export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && parseDayKey(value) !== null
}

/**
 * The calendar day `days` after `key` (negative goes back). Pure date arithmetic on the
 * components, so it never depends on timezones or daylight saving time: a day is always one
 * calendar step, never a fixed 24 hours. Throws on an invalid key.
 */
export function addDays(key: string, days: number): string {
  const parts = parseDayKey(key)
  if (!parts) throw new RangeError(`Invalid day key: ${key}`)
  const date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days))
  const y = String(date.getUTCFullYear()).padStart(4, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
