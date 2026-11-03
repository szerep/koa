import { describe, expect, it } from 'vitest'
import { notificationCopy, notificationMaxLateMs } from '../../config/notifications'
import type { SessionCompleted, TimerMode } from './engine'
import { sessionNotification, type NotificationRules } from './notification'

const MIN = 60_000
const T0 = 1_700_000_000_000
const rules: NotificationRules = { copy: notificationCopy, maxLateMs: notificationMaxLateMs }

const completed = (mode: TimerMode, endsCycle = false): SessionCompleted => ({
  type: 'sessionCompleted',
  sessionId: 'id-1',
  mode,
  durationMs: 25 * MIN,
  startedAt: T0,
  completedAt: T0 + 25 * MIN,
  endsCycle,
  cycleFocusMs: 25 * MIN,
})

describe('sessionNotification', () => {
  it('announces a finished focus session with the short break next', () => {
    expect(sessionNotification(completed('focus'), T0 + 25 * MIN, rules)).toEqual({
      ...notificationCopy.focusDone,
      tag: 'id-1',
    })
  })

  it('announces the long break when the focus session completes the cycle', () => {
    expect(sessionNotification(completed('focus', true), T0 + 25 * MIN, rules)).toMatchObject(notificationCopy.cycleDone)
  })

  it('announces the end of short and long breaks', () => {
    expect(sessionNotification(completed('shortBreak'), T0 + 25 * MIN, rules)).toMatchObject(notificationCopy.breakDone)
    expect(sessionNotification(completed('longBreak'), T0 + 25 * MIN, rules)).toMatchObject(notificationCopy.breakDone)
  })

  it('never announces a skipped session', () => {
    expect(sessionNotification({ type: 'sessionSkipped', sessionId: 'id-1', mode: 'focus' }, T0, rules)).toBeNull()
  })

  it('still announces a completion noticed a little late (a throttled background tab)', () => {
    const end = T0 + 25 * MIN
    expect(sessionNotification(completed('focus'), end + notificationMaxLateMs, rules)).not.toBeNull()
  })

  it("doesn't announce a stale completion (caught up on launch, long after it ended)", () => {
    const end = T0 + 25 * MIN
    expect(sessionNotification(completed('focus'), end + notificationMaxLateMs + 1, rules)).toBeNull()
    expect(sessionNotification(completed('focus'), end + 8 * 60 * MIN, rules)).toBeNull()
  })
})
