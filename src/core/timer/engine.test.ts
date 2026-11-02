import { describe, expect, it } from 'vitest'
import {
  applyConfig,
  createTimer,
  durationFor,
  nextMode,
  pause,
  progress,
  reconcile,
  remainingMs,
  reset,
  resume,
  selectMode,
  skip,
  start,
  type TimerConfig,
  type TimerState,
} from './engine'

const MIN = 60_000
const config: TimerConfig = { durations: { focus: 25, shortBreak: 5, longBreak: 20 }, sessionsPerCycle: 4 }
const T0 = 1_700_000_000_000

let ids = 0
const id = () => `session-${++ids}`

/** Start the current session at `at` and let it run to its end; returns the state after completion. */
function runToEnd(state: TimerState, at: number): { state: TimerState; endedAt: number } {
  const started = start(state, at, id()).state
  const endedAt = started.endsAt!
  const done = reconcile(started, endedAt, config)
  expect(done.events).toHaveLength(1)
  return { state: done.state, endedAt }
}

describe('createTimer', () => {
  it('starts idle on a full focus session with an empty cycle', () => {
    const s = createTimer(config)
    expect(s).toMatchObject({ mode: 'focus', status: 'idle', durationMs: 25 * MIN, remainingMs: 25 * MIN })
    expect(s.completedInCycle).toBe(0)
    expect(s.sessionId).toBeNull()
    expect(remainingMs(s, T0)).toBe(25 * MIN)
    expect(progress(s, T0)).toBe(0)
  })
})

describe('durationFor', () => {
  it('converts minutes to ms', () => {
    expect(durationFor('shortBreak', config)).toBe(5 * MIN)
  })
  it('rejects zero, negative and non-finite durations', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => durationFor('focus', { ...config, durations: { ...config.durations, focus: bad } })).toThrow(
        RangeError,
      )
    }
  })
})

describe('start / pause / resume', () => {
  it('start schedules the end from the start time', () => {
    const s = start(createTimer(config), T0, 'a').state
    expect(s).toMatchObject({ status: 'running', endsAt: T0 + 25 * MIN, startedAt: T0, sessionId: 'a' })
    expect(remainingMs(s, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(progress(s, T0 + 5 * MIN)).toBeCloseTo(0.2)
  })

  it('start is ignored unless idle', () => {
    const running = start(createTimer(config), T0, 'a').state
    expect(start(running, T0 + 1000, 'b').state).toBe(running)
    const paused = pause(running, T0 + 1000, config).state
    expect(start(paused, T0 + 2000, 'c').state).toBe(paused)
  })

  it('time spent paused does not count', () => {
    let s = start(createTimer(config), T0, 'a').state
    s = pause(s, T0 + 10 * MIN, config).state
    expect(s).toMatchObject({ status: 'paused', endsAt: null, remainingMs: 15 * MIN })
    // An hour later the paused session still has 15 minutes left.
    expect(remainingMs(s, T0 + 70 * MIN)).toBe(15 * MIN)
    s = resume(s, T0 + 70 * MIN).state
    expect(s.endsAt).toBe(T0 + 85 * MIN)
    expect(remainingMs(s, T0 + 80 * MIN)).toBe(5 * MIN)
  })

  it('handles many pause/resume cycles without drift', () => {
    let s = start(createTimer(config), T0, 'a').state
    let t = T0
    for (let i = 0; i < 24; i++) {
      t += MIN // run one minute
      s = pause(s, t, config).state
      t += 7 * MIN + 123 // paused for a while
      s = resume(s, t).state
    }
    expect(remainingMs(s, t)).toBe(MIN)
    const done = reconcile(s, t + MIN, config)
    expect(done.events).toHaveLength(1)
  })

  it('pausing after the end completes the session instead', () => {
    const s = start(createTimer(config), T0, 'a').state
    const t = pause(s, T0 + 30 * MIN, config)
    expect(t.events).toEqual([expect.objectContaining({ type: 'sessionCompleted', sessionId: 'a' })])
    expect(t.state.mode).toBe('shortBreak')
  })

  it('pause and resume are ignored in the wrong state', () => {
    const idle = createTimer(config)
    expect(pause(idle, T0, config).state).toBe(idle)
    expect(resume(idle, T0).state).toBe(idle)
    const running = start(idle, T0, 'a').state
    expect(resume(running, T0 + 1).state).toBe(running)
  })
})

describe('remainingMs clamping', () => {
  it('never goes below zero', () => {
    const s = start(createTimer(config), T0, 'a').state
    expect(remainingMs(s, T0 + 999 * MIN)).toBe(0)
    expect(progress(s, T0 + 999 * MIN)).toBe(1)
  })

  it('never exceeds the duration if the device clock jumps backwards', () => {
    const s = start(createTimer(config), T0, 'a').state
    expect(remainingMs(s, T0 - 60 * MIN)).toBe(25 * MIN)
    expect(progress(s, T0 - 60 * MIN)).toBe(0)
  })
})

describe('reconcile (completion)', () => {
  it('does nothing before the end and returns the same state object', () => {
    const s = start(createTimer(config), T0, 'a').state
    const t = reconcile(s, T0 + 25 * MIN - 1, config)
    expect(t.state).toBe(s)
    expect(t.events).toEqual([])
  })

  it('completes exactly at endsAt', () => {
    const s = start(createTimer(config), T0, 'a').state
    const t = reconcile(s, T0 + 25 * MIN, config)
    expect(t.events).toEqual([
      {
        type: 'sessionCompleted',
        sessionId: 'a',
        mode: 'focus',
        durationMs: 25 * MIN,
        startedAt: T0,
        completedAt: T0 + 25 * MIN,
        endsCycle: false,
        cycleFocusMs: 25 * MIN,
      },
    ])
    expect(t.state).toMatchObject({ mode: 'shortBreak', status: 'idle', completedInCycle: 1, sessionId: null })
  })

  it('records the scheduled end, not the time the app noticed (tab suspended for hours)', () => {
    const s = start(createTimer(config), T0, 'a').state
    const t = reconcile(s, T0 + 6 * 60 * MIN, config)
    expect(t.events[0]).toMatchObject({ completedAt: T0 + 25 * MIN })
  })

  it('completes at most one session per reconcile: the next one waits to be started', () => {
    const s = start(createTimer(config), T0, 'a').state
    const first = reconcile(s, T0 + 24 * 60 * MIN, config)
    expect(first.events).toHaveLength(1)
    const again = reconcile(first.state, T0 + 24 * 60 * MIN, config)
    expect(again.events).toEqual([])
    expect(again.state).toBe(first.state)
  })

  it('never completes a paused or idle session', () => {
    const paused = pause(start(createTimer(config), T0, 'a').state, T0 + MIN, config).state
    expect(reconcile(paused, T0 + 999 * MIN, config).events).toEqual([])
    const idle = createTimer(config)
    expect(reconcile(idle, T0 + 999 * MIN, config).state).toBe(idle)
  })
})

describe('cycle', () => {
  it('runs focus/short break x3, then a long break after the 4th focus, then starts over', () => {
    let s = createTimer(config)
    let t = T0
    const seen: string[] = []
    for (let i = 0; i < 9; i++) {
      seen.push(`${s.mode}:${s.completedInCycle}`)
      const r = runToEnd(s, t)
      s = r.state
      t = r.endedAt + 1000
    }
    expect(seen).toEqual([
      'focus:0',
      'shortBreak:1',
      'focus:1',
      'shortBreak:2',
      'focus:2',
      'shortBreak:3',
      'focus:3',
      'longBreak:4',
      'focus:0',
    ])
    expect(s).toMatchObject({ mode: 'shortBreak', completedInCycle: 1 })
  })

  it('flags only the focus session that completes the cycle', () => {
    let s = createTimer(config)
    const flags: boolean[] = []
    for (let i = 0; i < 8; i++) {
      const started = start(s, T0, id()).state
      const done = reconcile(started, started.endsAt!, config)
      const e = done.events[0]
      if (e.type === 'sessionCompleted') flags.push(e.endsCycle)
      s = done.state
    }
    expect(flags).toEqual([false, false, false, false, false, false, true, false])
  })

  it('uses the configured break lengths', () => {
    const afterFocus = runToEnd(createTimer(config), T0).state
    expect(afterFocus.durationMs).toBe(5 * MIN)
  })

  it('respects a custom cycle length', () => {
    const two: TimerConfig = { ...config, sessionsPerCycle: 2 }
    let s = createTimer(two)
    for (let i = 0; i < 3; i++) {
      const started = start(s, T0, id()).state
      s = reconcile(started, started.endsAt!, two).state
    }
    expect(s).toMatchObject({ mode: 'longBreak', completedInCycle: 2 })
  })

  it('nextMode', () => {
    expect(nextMode('focus', 1, config)).toBe('shortBreak')
    expect(nextMode('focus', 4, config)).toBe('longBreak')
    expect(nextMode('shortBreak', 2, config)).toBe('focus')
    expect(nextMode('longBreak', 4, config)).toBe('focus')
  })
})

describe('skip', () => {
  it('skipping focus goes to a short break without counting the session', () => {
    const running = start(createTimer(config), T0, 'a').state
    const t = skip(running, config)
    expect(t.events).toEqual([{ type: 'sessionSkipped', sessionId: 'a', mode: 'focus' }])
    expect(t.state).toMatchObject({ mode: 'shortBreak', status: 'idle', completedInCycle: 0 })
  })

  it('skipping the 4th focus session never earns the long break', () => {
    let s = createTimer(config)
    for (let i = 0; i < 3; i++) s = runToEnd(runToEnd(s, T0).state, T0).state // focus + short break
    expect(s).toMatchObject({ mode: 'focus', completedInCycle: 3 })
    s = skip(s, config).state
    expect(s).toMatchObject({ mode: 'shortBreak', completedInCycle: 3 })
    s = skip(s, config).state
    expect(s).toMatchObject({ mode: 'focus', completedInCycle: 3 }) // session 4 again
  })

  it('skipping a short break goes to focus and keeps the cycle', () => {
    const shortBreak = runToEnd(createTimer(config), T0).state
    expect(skip(shortBreak, config).state).toMatchObject({ mode: 'focus', completedInCycle: 1 })
  })

  it('skipping the long break starts a new cycle', () => {
    let s = createTimer(config)
    for (let i = 0; i < 7; i++) s = runToEnd(s, T0).state
    expect(s.mode).toBe('longBreak')
    expect(skip(s, config).state).toMatchObject({ mode: 'focus', completedInCycle: 0 })
  })

  it('skipping an idle session reports no session id', () => {
    expect(skip(createTimer(config), config).events[0]).toMatchObject({ sessionId: null })
  })
})

describe('reset', () => {
  it('returns to the full duration of the same mode and keeps the cycle', () => {
    const shortBreak = runToEnd(createTimer(config), T0).state
    const running = start(shortBreak, T0, 'b').state
    const t = reset(pause(running, T0 + 2 * MIN, config).state, config)
    expect(t.events).toEqual([])
    expect(t.state).toMatchObject({
      mode: 'shortBreak',
      status: 'idle',
      remainingMs: 5 * MIN,
      sessionId: null,
      completedInCycle: 1,
    })
  })

  it('resetting an idle session is a no-op', () => {
    const s = createTimer(config)
    expect(reset(s, config).state).toBe(s)
  })

  it('a reset session gets a new id when started again', () => {
    const first = start(createTimer(config), T0, 'a').state
    const again = start(reset(first, config).state, T0 + MIN, 'b').state
    expect(again.sessionId).toBe('b')
  })
})

describe('selectMode', () => {
  it('switches mode, discards progress and keeps the cycle', () => {
    const afterOne = runToEnd(createTimer(config), T0).state
    const t = selectMode(start(afterOne, T0, 'x').state, 'longBreak', config)
    expect(t.state).toMatchObject({ mode: 'longBreak', status: 'idle', remainingMs: 20 * MIN, completedInCycle: 1 })
  })

  it('choosing the current idle mode is a no-op', () => {
    const s = createTimer(config)
    expect(selectMode(s, 'focus', config).state).toBe(s)
  })

  it('leaving a completed cycle for focus starts a new cycle', () => {
    let s = createTimer(config)
    for (let i = 0; i < 7; i++) s = runToEnd(s, T0).state
    expect(s).toMatchObject({ mode: 'longBreak', completedInCycle: 4 })
    expect(selectMode(s, 'focus', config).state.completedInCycle).toBe(0)
  })
})

describe('cycle focus time (scales the cycle bonus)', () => {
  it('adds up completed focus sessions only, and the event carries the total', () => {
    let s = createTimer(config)
    expect(s.cycleFocusMs).toBe(0)
    const totals: number[] = []
    for (let i = 0; i < 8; i++) {
      const started = start(s, T0, id()).state
      const done = reconcile(started, started.endsAt!, config)
      const e = done.events[0]
      if (e.type === 'sessionCompleted') totals.push(e.cycleFocusMs)
      s = done.state
    }
    // focus, short, focus, short, focus, short, focus (ends cycle), long
    expect(totals).toEqual([25, 25, 50, 50, 75, 75, 100, 100].map((m) => m * MIN))
    expect(s).toMatchObject({ mode: 'focus', completedInCycle: 0, cycleFocusMs: 0 }) // after the long break
  })

  it('uses each session\'s own length (mixed durations)', () => {
    const fifty: TimerConfig = { ...config, durations: { ...config.durations, focus: 50 } }
    const first = runToEnd(createTimer(config), T0).state // 25
    const brk = reconcile(start(first, T0, id()).state, T0 + 5 * MIN, config).state
    const longer = applyConfig(brk, fifty).state
    const second = start(longer, T0, id()).state
    const done = reconcile(second, second.endsAt!, fifty)
    expect(done.events[0]).toMatchObject({ durationMs: 50 * MIN, cycleFocusMs: 75 * MIN })
  })

  it('skipped focus sessions add nothing', () => {
    const running = start(createTimer(config), T0, 'x').state
    const skipped = skip(running, config).state
    expect(skipped.cycleFocusMs).toBe(0)
  })

  it('reset, mode changes and skipping a short break keep it', () => {
    let s = createTimer(config)
    for (let i = 0; i < 3; i++) s = runToEnd(s, T0).state // 2 focus done, short break waiting
    expect(s).toMatchObject({ mode: 'shortBreak', cycleFocusMs: 50 * MIN })
    expect(reset(start(s, T0, 'r').state, config).state.cycleFocusMs).toBe(50 * MIN)
    expect(selectMode(s, 'focus', config).state.cycleFocusMs).toBe(50 * MIN)
    expect(skip(s, config).state).toMatchObject({ mode: 'focus', cycleFocusMs: 50 * MIN })
  })

  it('starts over when the long break is skipped or abandoned', () => {
    let s = createTimer(config)
    for (let i = 0; i < 7; i++) s = runToEnd(s, T0).state // long break waiting
    expect(s).toMatchObject({ mode: 'longBreak', cycleFocusMs: 100 * MIN })
    expect(skip(s, config).state).toMatchObject({ completedInCycle: 0, cycleFocusMs: 0 })
    expect(selectMode(s, 'focus', config).state).toMatchObject({ completedInCycle: 0, cycleFocusMs: 0 })
  })

  it('is kept when settings refit a waiting session', () => {
    let s = createTimer(config)
    for (let i = 0; i < 5; i++) s = runToEnd(s, T0).state // 3 done, short break waiting
    const fitted = applyConfig(s, { ...config, sessionsPerCycle: 3 }, config).state
    expect(fitted).toMatchObject({ mode: 'longBreak', cycleFocusMs: 75 * MIN })
  })
})

describe('applyConfig', () => {
  const longer: TimerConfig = { ...config, durations: { ...config.durations, focus: 50 } }

  it('updates a session that has not started', () => {
    expect(applyConfig(createTimer(config), longer).state).toMatchObject({ durationMs: 50 * MIN, remainingMs: 50 * MIN })
  })

  it('leaves a session in progress untouched', () => {
    const running = start(createTimer(config), T0, 'a').state
    expect(applyConfig(running, longer).state).toBe(running)
  })

  it('clamps the cycle count when the cycle gets shorter, and the earned long break is up next', () => {
    let s = createTimer(config)
    for (let i = 0; i < 6; i++) s = runToEnd(s, T0).state // focus #4 is up next, 3 done
    expect(s).toMatchObject({ mode: 'focus', completedInCycle: 3 })
    expect(applyConfig(s, { ...config, sessionsPerCycle: 2 }, config).state).toMatchObject({
      mode: 'longBreak',
      status: 'idle',
      completedInCycle: 2,
      durationMs: 20 * MIN,
      remainingMs: 20 * MIN,
    })
  })

  it('a waiting short break becomes the long break when the new interval completes the cycle', () => {
    let s = createTimer(config)
    for (let i = 0; i < 5; i++) s = runToEnd(s, T0).state // 3 focus done, short break waiting
    expect(s).toMatchObject({ mode: 'shortBreak', status: 'idle', completedInCycle: 3 })
    expect(applyConfig(s, { ...config, sessionsPerCycle: 3 }, config).state).toMatchObject({ mode: 'longBreak', completedInCycle: 3 })
  })

  it('never changes the mode unless the interval was lowered (a hand-picked short break stays)', () => {
    let s = createTimer(config)
    for (let i = 0; i < 7; i++) s = runToEnd(s, T0).state // long break waiting, 4 done
    const picked = selectMode(s, 'shortBreak', config).state
    expect(picked).toMatchObject({ mode: 'shortBreak', completedInCycle: 4 })
    // A change that doesn't touch the interval (e.g. any other setting) leaves it alone.
    expect(applyConfig(picked, config, config).state).toBe(picked)
    expect(applyConfig(picked, { ...config, durations: { ...config.durations, shortBreak: 8 } }, config).state).toMatchObject({
      mode: 'shortBreak',
      durationMs: 8 * MIN,
    })
    // Raising the interval doesn't either.
    expect(applyConfig(picked, { ...config, sessionsPerCycle: 6 }, config).state.mode).toBe('shortBreak')
  })

  it('a waiting short break stays a short break when the cycle is not complete', () => {
    const s = runToEnd(createTimer(config), T0).state // 1 done, short break waiting
    expect(applyConfig(s, { ...config, sessionsPerCycle: 2 }).state).toMatchObject({ mode: 'shortBreak', completedInCycle: 1 })
  })

  it('a waiting long break is kept when the interval gets longer (it was earned)', () => {
    let s = createTimer(config)
    for (let i = 0; i < 7; i++) s = runToEnd(s, T0).state // 4 done, long break waiting
    expect(s).toMatchObject({ mode: 'longBreak', completedInCycle: 4 })
    expect(applyConfig(s, { ...config, sessionsPerCycle: 6 }).state).toMatchObject({ mode: 'longBreak', completedInCycle: 4 })
  })

  it('updates short and long break lengths of a waiting break', () => {
    const shortWaiting = runToEnd(createTimer(config), T0).state
    const longer: TimerConfig = { ...config, durations: { focus: 25, shortBreak: 10, longBreak: 30 } }
    expect(applyConfig(shortWaiting, longer).state.durationMs).toBe(10 * MIN)
    let s = createTimer(config)
    for (let i = 0; i < 7; i++) s = runToEnd(s, T0).state
    expect(applyConfig(s, longer).state.durationMs).toBe(30 * MIN)
  })

  it('returns the same state when nothing changes', () => {
    const s = createTimer(config)
    expect(applyConfig(s, { ...config }).state).toBe(s)
    expect(applyConfig(s, { ...config, durations: { ...config.durations, shortBreak: 10 } }).state).toBe(s)
  })

  it('leaves a paused session untouched, remaining time included', () => {
    const paused = pause(start(createTimer(config), T0, 'p').state, T0 + 10 * MIN, config).state
    expect(paused).toMatchObject({ status: 'paused', remainingMs: 15 * MIN })
    expect(applyConfig(paused, { ...longer, sessionsPerCycle: 2 }).state).toBe(paused)
  })

  it('a running focus session keeps its end time; the next one uses the new length', () => {
    const running = start(createTimer(config), T0, 'r').state
    const kept = applyConfig(running, longer).state
    expect(kept).toBe(running)
    const done = reconcile(kept, running.endsAt!, longer)
    expect(done.events[0]).toMatchObject({ type: 'sessionCompleted', durationMs: 25 * MIN, completedAt: T0 + 25 * MIN })
    const back = runToEnd(done.state, T0 + 25 * MIN) // the short break
    expect(back.state).toMatchObject({ mode: 'focus', durationMs: 25 * MIN }) // runToEnd uses `config`
    expect(applyConfig(back.state, longer).state.durationMs).toBe(50 * MIN)
  })

  it('the interval in effect when a running focus session ends decides what comes next', () => {
    let s = createTimer(config)
    for (let i = 0; i < 4; i++) s = runToEnd(s, T0).state // 2 done, focus #3 waiting
    const running = start(s, T0, 'third').state
    const shorter = { ...config, sessionsPerCycle: 3 }
    expect(applyConfig(running, shorter).state).toBe(running) // the session itself is unchanged
    const done = reconcile(running, running.endsAt!, shorter)
    expect(done.events[0]).toMatchObject({ endsCycle: true })
    expect(done.state).toMatchObject({ mode: 'longBreak', completedInCycle: 3 })
  })
})
