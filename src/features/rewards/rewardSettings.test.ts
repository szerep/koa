import { describe, expect, it } from 'vitest'
import { rewardRules } from '../../config/rewards'
import { settingsSpec } from '../../config/settings'
import { dayKey } from '../../core/time'
import { timerConfigFrom } from '../../core/settings/settings'
import { createMemoryAdapter, type StorageAdapter } from '../../storage/adapter'
import { STORAGE_KEY } from '../../storage/persistence'
import { createSettingsStore } from '../settings/settingsStore'
import { createTimerStore } from '../timer/timerStore'
import { createWalletStore } from './walletStore'

const MIN = 60_000
const MORNING = new Date(2026, 10, 2, 9, 0, 0).getTime()
const DAY = dayKey(MORNING)

/** The app's real config and wiring (features/*\/store.ts and app/connect.ts), in memory. */
function launch(storage: StorageAdapter = createMemoryAdapter(), start = MORNING) {
  const clock = { now: start }
  let n = 0
  const settings = createSettingsStore({ spec: settingsSpec, storage })
  const timer = createTimerStore({
    config: timerConfigFrom(settings.getState()),
    storage,
    now: () => clock.now,
    newId: () => `id-${start}-${++n}`,
  })
  const wallet = createWalletStore({
    rules: rewardRules,
    dailyGoalMinutes: () => settings.getState().dailyGoalMinutes,
    storage,
  })
  timer.onEvent((e) => {
    if (e.type === 'sessionCompleted') wallet.award(e)
  })
  settings.subscribe(() => timer.setConfig(timerConfigFrom(settings.getState())))

  /** Start the waiting session and let it run to its end. */
  const finish = () => {
    timer.toggle()
    clock.now = timer.getState().endsAt!
    timer.sync()
  }
  /** Finish focus sessions (and the breaks between them) until `count` focus sessions are done. */
  const focusSessions = (count: number) => {
    let done = 0
    while (done < count) {
      const wasFocus = timer.getState().mode === 'focus'
      finish()
      if (wasFocus) done++
    }
  }
  const earned = (kind: string) =>
    Object.values(wallet.getState().ledger)
      .filter((e) => e.kind === kind)
      .reduce((sum, e) => sum + e.amount, 0)
  return { storage, clock, settings, timer, wallet, finish, focusSessions, earned }
}

describe('rewards with settings', () => {
  it('default settings: a full cycle still pays 4 × 25 + 30 + 50 = 180', () => {
    const app = launch()
    app.focusSessions(4)
    expect(app.earned('focus')).toBe(100)
    expect(app.earned('cycle')).toBe(30)
    expect(app.earned('dailyGoal')).toBe(50)
    expect(app.wallet.getState().balance).toBe(180)
  })

  it('1-minute focus sessions: the cycle bonus shrinks to match (4 min → 1 coin)', () => {
    const app = launch()
    app.settings.setNumber('focus', 1)
    app.settings.setNumber('shortBreak', 1)
    app.focusSessions(4)
    expect(app.earned('focus')).toBe(4)
    expect(app.earned('cycle')).toBe(1)
    expect(app.earned('dailyGoal')).toBe(0)
  })

  it('interval 2 with 50-minute sessions: 100 cycle minutes earn the full 30', () => {
    const app = launch()
    app.settings.setNumber('focus', 50)
    app.settings.setNumber('longBreakEvery', 2)
    app.focusSessions(2)
    expect(app.earned('cycle')).toBe(30)
    expect(app.timer.getState().mode).toBe('longBreak')
  })

  it('interval 8 with 45-minute sessions: capped at 30', () => {
    const app = launch()
    app.settings.setNumber('focus', 45)
    app.settings.setNumber('longBreakEvery', 8)
    app.settings.setNumber('dailyGoalMinutes', 480)
    app.focusSessions(8)
    expect(app.earned('cycle')).toBe(30)
    expect(app.earned('focus')).toBe(360)
  })

  it('changing the focus length mid-cycle: the bonus follows the real minutes (25 + 25 + 10 + 10 = 70 → 21)', () => {
    const app = launch()
    app.focusSessions(2)
    app.settings.setNumber('focus', 10)
    app.focusSessions(2) // 25 + 25 + 10 + 10 = 70 minutes
    expect(app.earned('focus')).toBe(70)
    expect(app.earned('cycle')).toBe(21)
  })

  it('every session pays its own length, even when the setting changes while it runs', () => {
    const app = launch()
    app.timer.toggle() // 25-minute focus running
    app.settings.setNumber('focus', 90)
    app.clock.now = app.timer.getState().endsAt!
    app.timer.sync()
    expect(app.earned('focus')).toBe(25)
  })

  it('a higher daily goal from Settings is used', () => {
    const app = launch()
    app.settings.setNumber('dailyGoalMinutes', 150)
    app.focusSessions(4) // 100 minutes
    expect(app.earned('dailyGoal')).toBe(0)
    app.focusSessions(2) // 150 minutes
    expect(app.earned('dailyGoal')).toBe(50)
  })

  it('lowering the goal below today\'s minutes pays nothing until the next focus session completes', () => {
    const app = launch()
    app.focusSessions(3) // 75 minutes, goal 100: not reached
    app.finish() // the short break: nothing
    const before = app.wallet.getState()
    let paid = 0
    app.wallet.onGrant(() => paid++)

    app.settings.setNumber('dailyGoalMinutes', 50)
    expect(app.wallet.getState()).toBe(before) // saving Settings pays nothing
    expect(paid).toBe(0)

    app.focusSessions(1)
    expect(app.earned('dailyGoal')).toBe(50)
    expect(app.wallet.getState().ledger[`goal:${DAY}`]).toBeDefined()
  })

  it('the daily bonus is paid once per day, however often the goal changes', () => {
    const app = launch()
    app.focusSessions(4) // paid at 100
    for (const goal of [25, 200, 50, 480, 100]) {
      app.settings.setNumber('dailyGoalMinutes', goal)
      app.focusSessions(1)
    }
    expect(app.earned('dailyGoal')).toBe(50)
  })

  it('the goal setting survives a reload and is used by the relaunched app', () => {
    const storage = createMemoryAdapter()
    const first = launch(storage)
    first.settings.setNumber('dailyGoalMinutes', 25)
    const second = launch(storage, MORNING + 60 * MIN)
    second.focusSessions(1)
    expect(second.earned('dailyGoal')).toBe(50)
  })

  it('a cycle started before Phase 8 (saved without cycle focus time) still pays the full 30', () => {
    const storage = createMemoryAdapter()
    const first = launch(storage)
    first.focusSessions(3)
    first.finish() // short break; focus #4 waiting
    const saved = JSON.parse(storage.data[STORAGE_KEY])
    delete saved.timer.cycleFocusMs // what an older version saved
    storage.data[STORAGE_KEY] = JSON.stringify(saved)

    const second = launch(storage, first.clock.now)
    second.focusSessions(1)
    expect(second.earned('cycle')).toBe(30)
  })

  it('a repeated completion (crash before the timer was saved) pays nothing twice', () => {
    const storage = createMemoryAdapter()
    const app = launch(storage)
    app.focusSessions(3)
    app.finish()
    app.timer.toggle() // focus #4 running: completes the cycle
    const runningSave = storage.data[STORAGE_KEY]
    app.clock.now = app.timer.getState().endsAt!
    app.timer.sync()
    const paid = app.wallet.getState().totalEarned
    expect(app.earned('cycle')).toBe(30)

    const crashed = JSON.parse(storage.data[STORAGE_KEY])
    crashed.timer = JSON.parse(runningSave).timer
    storage.data[STORAGE_KEY] = JSON.stringify(crashed)
    const relaunch = launch(storage, app.clock.now + MIN)
    relaunch.timer.sync()
    expect(relaunch.wallet.getState().totalEarned).toBe(paid)
  })
})
