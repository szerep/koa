import { describe, expect, it } from 'vitest'
import { chimeMaxLateMs } from '../../config/sounds'
import type { SessionCompleted, TimerMode } from './engine'
import { shouldChime } from './chime'

const MIN = 60_000
const T0 = 1_700_000_000_000
const END = T0 + 25 * MIN

const completed = (mode: TimerMode): SessionCompleted => ({
  type: 'sessionCompleted',
  sessionId: 'id-1',
  mode,
  durationMs: 25 * MIN,
  startedAt: T0,
  completedAt: END,
  endsCycle: false,
  cycleFocusMs: 25 * MIN,
})

describe('shouldChime', () => {
  it('chimes when a focus session or a break completes', () => {
    expect(shouldChime(completed('focus'), END, chimeMaxLateMs)).toBe(true)
    expect(shouldChime(completed('shortBreak'), END, chimeMaxLateMs)).toBe(true)
    expect(shouldChime(completed('longBreak'), END, chimeMaxLateMs)).toBe(true)
  })

  it('never chimes for a skipped session', () => {
    expect(shouldChime({ type: 'sessionSkipped', sessionId: 'id-1', mode: 'focus' }, END, chimeMaxLateMs)).toBe(false)
  })

  it('chimes a little late, but not for a completion caught up long after', () => {
    expect(shouldChime(completed('focus'), END + chimeMaxLateMs, chimeMaxLateMs)).toBe(true)
    expect(shouldChime(completed('focus'), END + chimeMaxLateMs + 1, chimeMaxLateMs)).toBe(false)
  })
})
