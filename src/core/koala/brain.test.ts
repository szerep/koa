import { describe, expect, it } from 'vitest'
import { koalaBehavior } from '../../config/koalaBehavior'
import { koalaLines } from '../../config/koalaLines'
import {
  activity,
  breakOver,
  celebrate,
  createKoala,
  greet,
  greetingTopic,
  present,
  setContext,
  showOff,
  tap,
  tick,
  type KoalaEnv,
  type KoalaState,
} from './brain'

const SEC = 1000
const MIN = 60 * SEC
const T0 = 1_000_000

/** Small seeded PRNG (mulberry32), so every run is reproducible. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const env = (seed = 1, random?: () => number): KoalaEnv => ({
  behavior: koalaBehavior,
  lines: koalaLines,
  random: random ?? seeded(seed),
})

const noShop = { canAffordSomething: false }

/** Advance in 1s ticks, simulating continuous user presence unless `idle` is set. */
function run(state: KoalaState, from: number, ms: number, e: KoalaEnv, opts: { present?: boolean } = {}) {
  let s = state
  for (let t = from; t <= from + ms; t += SEC) {
    if (opts.present) s = activity(s, t, e)
    s = tick(s, t, e, noShop)
  }
  return s
}

describe('ambient behavior', () => {
  it('starts an ambient action within the configured interval when idle', () => {
    const e = env()
    const s = run(createKoala(T0, 'idle', e), T0, koalaBehavior.ambientEvery.idle.max, e, { present: true })
    expect(s.lastAmbient).not.toBeNull()
  })

  it('never repeats the same ambient action twice in a row', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const e = env(seed)
      let s = createKoala(T0, 'idle', e)
      let actions = 0
      for (let t = T0; t < T0 + 20 * MIN; t += SEC) {
        const before = activity(s, t, e)
        s = tick(before, t, e, noShop)
        if (s.nextAmbientAt !== before.nextAmbientAt) {
          actions++
          expect(s.lastAmbient).not.toBeNull()
          expect(s.lastAmbient).not.toBe(before.lastAmbient)
        }
      }
      expect(actions).toBeGreaterThan(30)
    }
  })

  it('does nothing ambient during focus, even for a long session', () => {
    const e = env()
    let s = setContext(createKoala(T0, 'idle', e), 'focus', T0, e)
    const seq = s.seq
    s = run(s, T0, 30 * MIN, e)
    expect(s.seq).toBe(seq)
    expect(s.napping).toBe(false)
    expect(s.bubble).toBeNull()
  })

  it('only chats when the unprompted gap allows it', () => {
    const e = env(3)
    let s = createKoala(T0, 'idle', e)
    let lastBubbleAt = Number.NEGATIVE_INFINITY
    for (let t = T0; t < T0 + 30 * MIN; t += SEC) {
      s = activity(s, t, e)
      const before = s.bubble?.seq
      s = tick(s, t, e, noShop)
      if (s.bubble && s.bubble.seq !== before) {
        expect(t - lastBubbleAt).toBeGreaterThanOrEqual(koalaBehavior.bubble.unpromptedGap)
        lastBubbleAt = t
      }
    }
    expect(lastBubbleAt).toBeGreaterThan(T0) // it did talk at some point
  })

  it('offers shop hints only when something is affordable', () => {
    const topics = (canAffordSomething: boolean) => {
      const e = env(5)
      let s = createKoala(T0, 'idle', e)
      const seen = new Set<string>()
      for (let t = T0; t < T0 + 120 * MIN; t += SEC) {
        s = tick(activity(s, t, e), t, e, { canAffordSomething })
        if (s.bubble) seen.add(s.bubble.topic)
      }
      return seen
    }
    expect(topics(false).has('shopHint')).toBe(false)
    expect(topics(true).has('shopHint')).toBe(true)
  })
})

describe('speech bubbles', () => {
  it('dismiss themselves after the configured time', () => {
    const e = env()
    let s = breakOver(createKoala(T0, 'idle', e), T0, e)
    expect(s.bubble).not.toBeNull()
    s = tick(s, T0 + koalaBehavior.bubble.showFor - 1, e, noShop)
    expect(s.bubble).not.toBeNull()
    s = tick(s, T0 + koalaBehavior.bubble.showFor, e, noShop)
    expect(s.bubble).toBeNull()
  })

  it('do not repeat a recent line', () => {
    const e = env(9)
    let s = createKoala(T0, 'idle', e)
    const said: string[] = []
    for (let i = 0; i < 4; i++) {
      s = breakOver(s, T0 + i * 10 * SEC, e)
      said.push(s.bubble!.text)
    }
    expect(new Set(said.slice(0, 3)).size).toBe(3) // the pool has 3 lines
  })

  it('are cleared and suppressed when focus starts', () => {
    const e = env()
    let s = breakOver(createKoala(T0, 'idle', e), T0, e)
    s = setContext(s, 'focus', T0 + 100, e)
    expect(s.bubble).toBeNull()
    expect(present(s).bubble).toBeNull()
    expect(greet(s, T0 + 200, 9, e).bubble).toBeNull()
    expect(showOff(s, T0 + 300, e).bubble).toBeNull()
  })
})

describe('taps', () => {
  it('react with a motion that never repeats twice in a row', () => {
    const e = env(2)
    let s = createKoala(T0, 'idle', e)
    let previous: string | null = null
    for (let i = 0; i < 30; i++) {
      // Spaced out, so no burst builds up.
      s = tap(s, T0 + i * 5 * SEC, e)
      expect(s.motion).not.toBeNull()
      expect(s.motion!.name).not.toBe(previous)
      previous = s.motion!.name
    }
  })

  it('tickle on the third quick tap and startle on the fifth, then cool down', () => {
    const e = env(4)
    let s = createKoala(T0, 'idle', e)
    const names: string[] = []
    for (let i = 0; i < 5; i++) {
      s = tap(s, T0 + i * 300, e)
      names.push(s.motion!.name)
    }
    expect(names[2]).toBe('giggle')
    expect(s.bubble?.topic).toBe('surprised')
    expect(names[4]).toBe('surprised')
    s = tap(s, T0 + 2000, e)
    expect(s.motion!.name).toBe('softSquish')
    s = tap(s, T0 + 1200 + koalaBehavior.taps.cooldown + 10, e)
    expect(s.motion!.name).not.toBe('softSquish')
  })

  it('spoken tap replies respect the tap gap', () => {
    const e = env(1, () => 0) // always reply when allowed
    let s = createKoala(T0, 'idle', e)
    s = tap(s, T0, e)
    expect(s.bubble?.topic).toBe('tap')
    s = tick(s, T0 + 5 * SEC, e, noShop) // bubble expired
    s = tap(s, T0 + 5 * SEC, e)
    expect(s.bubble).toBeNull()
    s = tap(s, T0 + koalaBehavior.bubble.tapGap + 10, e)
    expect(s.bubble?.topic).toBe('tap')
  })

  it('during focus only get a soft squish, rate limited, and never a bubble', () => {
    const e = env(1, () => 0)
    let s = setContext(createKoala(T0, 'idle', e), 'focus', T0, e)
    s = tap(s, T0 + 10, e)
    expect(s.motion!.name).toBe('softSquish')
    const seq = s.seq
    s = tap(s, T0 + 500, e)
    expect(s.seq).toBe(seq)
    for (let i = 0; i < 10; i++) s = tap(s, T0 + 2000 + i * 200, e)
    expect(s.bubble).toBeNull()
    expect(s.motion!.name).toBe('softSquish')
  })
})

describe('napping', () => {
  it('dozes off after the idle timeout without input, and wakes on activity', () => {
    const e = env()
    let s = run(createKoala(T0, 'idle', e), T0, koalaBehavior.napAfter.idle - 2 * SEC, e)
    expect(s.napping).toBe(false)
    s = run(s, T0 + koalaBehavior.napAfter.idle - SEC, 2 * SEC, e)
    expect(s.napping).toBe(true)
    expect(present(s)).toMatchObject({ eyesClosed: true, tempo: 'sleepy' })

    const seq = s.seq
    s = run(s, T0 + koalaBehavior.napAfter.idle + 2 * SEC, 5 * MIN, e)
    expect(s.seq).toBe(seq) // nothing ambient while asleep

    const t = T0 + 20 * MIN
    s = activity(s, t, e)
    expect(s.napping).toBe(false)
    expect(s.motion!.name).toBe('wake')
    expect(s.bubble?.topic).toBe('wake')
    // The same touch arriving as a tap does not react twice.
    expect(tap(s, t + 100, e)).toBe(s)
  })

  it('dozes off sooner during a break', () => {
    const e = env()
    let s = setContext(createKoala(T0, 'idle', e), 'break', T0, e)
    s = run(s, T0, koalaBehavior.napAfter.break + SEC, e)
    expect(s.napping).toBe(true)
  })

  it('never naps during focus', () => {
    const e = env()
    const s = run(setContext(createKoala(T0, 'idle', e), 'focus', T0, e), T0, 60 * MIN, e)
    expect(s.napping).toBe(false)
  })

  it('keeps awake while the user is active', () => {
    const e = env()
    const s = run(createKoala(T0, 'idle', e), T0, 30 * MIN, e, { present: true })
    expect(s.napping).toBe(false)
  })

  it('a tap on a napping koala wakes it', () => {
    const e = env()
    let s = run(createKoala(T0, 'idle', e), T0, koalaBehavior.napAfter.idle + SEC, e)
    s = tap(s, T0 + 10 * MIN, e)
    expect(s.napping).toBe(false)
    expect(s.motion!.name).toBe('wake')
  })
})

describe('timer contexts', () => {
  it('settles in quietly when focus starts', () => {
    const e = env()
    const s = setContext(createKoala(T0, 'idle', e), 'focus', T0, e)
    expect(s.motion!.name).toBe('settle')
    expect(present(s).tempo).toBe('calm')
  })

  it('suggests a break, with a long-break line after a full cycle', () => {
    const e = env()
    expect(setContext(createKoala(T0, 'idle', e), 'break', T0, e).bubble?.topic).toBe('breakStart')
    expect(setContext(createKoala(T0, 'idle', e), 'break', T0, e, { longBreak: true }).bubble?.topic).toBe(
      'longBreakStart',
    )
  })

  it('ignores a repeated context', () => {
    const e = env()
    const s = setContext(createKoala(T0, 'idle', e), 'break', T0, e)
    expect(setContext(s, 'break', T0 + 10, e)).toBe(s)
  })

  it('says the break is over when a break completes', () => {
    const e = env()
    const s = breakOver(setContext(createKoala(T0, 'idle', e), 'break', T0, e), T0 + 5 * MIN, e)
    expect(s.context).toBe('idle')
    expect(s.bubble?.topic).toBe('breakOver')
  })
})

describe('celebrations', () => {
  it('leave focus and celebrate a finished session', () => {
    const e = env()
    const s = celebrate(setContext(createKoala(T0, 'idle', e), 'focus', T0, e), 'session', T0 + 25 * MIN, e)
    expect(s.context).toBe('idle')
    expect(s.motion!.name).toBe('hop')
    expect(s.bubble?.topic).toBe('celebrate')
  })

  it('use a bigger hop and line for a cycle or the daily goal', () => {
    const e = env()
    expect(celebrate(createKoala(T0, 'idle', e), 'cycle', T0, e)).toMatchObject({
      motion: { name: 'bigHop' },
      bubble: { topic: 'cycle' },
    })
    expect(celebrate(createKoala(T0, 'idle', e), 'dailyGoal', T0, e).bubble?.topic).toBe('dailyGoal')
  })

  it('speak only after the coin labels have floated away, then stay up as long as any bubble', () => {
    const e = env()
    const s = celebrate(createKoala(T0, 'idle', e), 'session', T0, e)
    const delay = koalaBehavior.bubble.celebrationDelay.session
    expect(s.bubble).toMatchObject({ delay, until: T0 + delay + koalaBehavior.bubble.showFor })
    expect(tick(s, T0 + delay + 1000, e, noShop).bubble).not.toBeNull()
  })

  it('keep the biggest celebration for the same moment', () => {
    const e = env()
    const goal = celebrate(createKoala(T0, 'idle', e), 'dailyGoal', T0, e)
    expect(celebrate(goal, 'session', T0 + 100, e)).toBe(goal)
    const session = celebrate(createKoala(T0, 'idle', e), 'session', T0, e)
    expect(celebrate(session, 'cycle', T0 + 100, e).bubble?.topic).toBe('cycle')
  })

  it('wake a napping koala', () => {
    const e = env()
    let s = run(createKoala(T0, 'idle', e), T0, koalaBehavior.napAfter.idle + SEC, e)
    s = celebrate(s, 'session', T0 + 10 * MIN, e)
    expect(s.napping).toBe(false)
  })

  it('hold off ambient actions while they play', () => {
    const e = env()
    const s = celebrate(createKoala(T0, 'idle', e), 'session', T0, e)
    const after = tick(s, T0 + koalaBehavior.busyFor - 1, e, noShop)
    expect(after.motion).toBe(s.motion)
  })
})

describe('greeting', () => {
  it('picks a line for the time of day', () => {
    expect(greetingTopic(8)).toBe('greetMorning')
    expect(greetingTopic(14)).toBe('greetAfternoon')
    expect(greetingTopic(19)).toBe('greetEvening')
    expect(greetingTopic(23)).toBe('greetNight')
    expect(greetingTopic(3)).toBe('greetNight')
  })

  it('does not interrupt a celebration or focus', () => {
    const e = env()
    const celebrating = celebrate(createKoala(T0, 'idle', e), 'session', T0, e)
    expect(greet(celebrating, T0 + 1200, 9, e)).toBe(celebrating)
    const focusing = createKoala(T0, 'focus', e)
    expect(greet(focusing, T0 + 1200, 9, e)).toBe(focusing)
    expect(greet(createKoala(T0, 'idle', e), T0 + 1200, 9, e).bubble?.topic).toBe('greetMorning')
  })
})

describe('show-off', () => {
  it('wiggles and comments on a newly equipped item', () => {
    const e = env()
    const s = showOff(createKoala(T0, 'idle', e), T0, e)
    expect(s.motion!.name).toBe('wiggle')
    expect(s.bubble?.topic).toBe('showOff')
  })
})
