/** mm:ss for a number of seconds (rounded up, so 0.2s left still shows 00:01). */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
