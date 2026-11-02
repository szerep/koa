import { describe, expect, it } from 'vitest'
import type { Grant, RewardRules } from '../../core/rewards/wallet'
import type { TimerConfig } from '../../core/timer/engine'
import { createMemoryAdapter } from '../../storage/adapter'
import { createTimerStore } from '../timer/timerStore'
import { createWalletStore } from './walletStore'

const MIN = 60_000
const rules: RewardRules = { coinsPerFocusMinute: 1, cycleBonus: 30, cycleBonusFullMinutes: 100, dailyGoalBonus: 50, dailyGoalMinutes: 100 }
const config: TimerConfig = { durations: { focus: 25, shortBreak: 5, longBreak: 20 }, sessionsPerCycle: 4 }
const MORNING = new Date(2026, 10, 2, 9, 0, 0).getTime()

/** One app instance: a timer and a wallet wired together like src/app/connect.ts. */
function app(storage = createMemoryAdapter(), start = MORNING) {
  const clock = { now: start }
  let n = 0
  const timer = createTimerStore({ config, storage, now: () => clock.now, newId: () => `id-${start}-${++n}` })
  const wallet = createWalletStore({ rules, storage })
  const grants: Grant[][] = []
  wallet.onGrant((g) => grants.push(g))
  timer.onEvent((e) => {
    if (e.type === 'sessionCompleted') wallet.award(e)
  })
  const finishCurrent = () => {
    timer.toggle()
    clock.now = timer.getState().endsAt!
    timer.sync()
  }
  return { storage, clock, timer, wallet, grants, finishCurrent }
}

describe('rewards wired to the timer', () => {
  it('a completed focus session pays 25 coins and saves them', () => {
    const a = app()
    a.finishCurrent()
    expect(a.wallet.getState().balance).toBe(25)
    expect(a.grants).toEqual([[{ key: 'focus:id-' + MORNING + '-1', kind: 'focus', amount: 25 }]])
    expect(createWalletStore({ rules, storage: a.storage }).getState().balance).toBe(25)
  })

  it('breaks and skipped sessions pay nothing', () => {
    const a = app()
    a.timer.toggle()
    a.clock.now += 10 * MIN
    a.timer.skip() // skip focus
    a.finishCurrent() // short break
    expect(a.wallet.getState().balance).toBe(0)
    expect(a.grants).toEqual([])
  })

  it('a full cycle pays 4 × 25 + cycle bonus 30 + daily goal 50', () => {
    const a = app()
    for (let i = 0; i < 8; i++) a.finishCurrent() // F S F S F S F L
    expect(a.wallet.getState().balance).toBe(180)
    expect(a.grants).toHaveLength(4) // breaks pay nothing
    expect(a.grants.at(-1)?.map((g) => g.kind)).toEqual(['focus', 'cycle', 'dailyGoal'])
  })

  it('a session completed while the app was closed is paid on the next launch, exactly once', () => {
    const first = app()
    first.timer.toggle()

    const second = app(first.storage, MORNING + 3 * 60 * MIN) // reopened 3 h later
    second.timer.sync()
    second.timer.sync()
    expect(second.wallet.getState().balance).toBe(25)

    const third = app(first.storage, MORNING + 4 * 60 * MIN)
    third.timer.sync()
    expect(third.wallet.getState().balance).toBe(25)
    expect(third.grants).toEqual([])
  })

  it('two tabs completing the same session pay it once', () => {
    const storage = createMemoryAdapter()
    const tabA = app(storage)
    tabA.timer.toggle()
    const tabB = app(storage) // opened while the session runs: same session restored
    const end = tabA.timer.getState().endsAt!
    tabA.clock.now = end
    tabB.clock.now = end
    tabA.timer.sync()
    tabB.timer.sync()
    expect(tabB.grants).toEqual([])
    expect(tabB.wallet.getState().balance).toBe(25)
    expect(createWalletStore({ rules, storage }).getState().balance).toBe(25)
  })

  it('refresh() picks up coins earned in another tab', () => {
    const storage = createMemoryAdapter()
    const tabA = app(storage)
    const tabB = app(storage)
    tabA.finishCurrent()
    expect(tabB.wallet.getState().balance).toBe(0)
    tabB.wallet.refresh()
    expect(tabB.wallet.getState().balance).toBe(25)
  })

  it('if the app dies after paying but before saving the timer, the repeat is not paid', () => {
    const storage = createMemoryAdapter()
    const a = app(storage)
    a.timer.toggle()
    const runningSave = storage.data['koa:v1']
    a.clock.now = a.timer.getState().endsAt!
    a.timer.sync()
    expect(a.wallet.getState().balance).toBe(25)

    // Simulate the crash: the timer slice reverts to "running", the wallet keeps its payout.
    const saved = JSON.parse(storage.data['koa:v1'])
    saved.timer = JSON.parse(runningSave).timer
    storage.data['koa:v1'] = JSON.stringify(saved)

    const relaunch = app(storage, a.clock.now + MIN)
    relaunch.timer.sync()
    expect(relaunch.wallet.getState().balance).toBe(25)
    expect(relaunch.grants).toEqual([])
  })
})
