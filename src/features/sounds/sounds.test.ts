import { describe, expect, it } from 'vitest'
import { rewardRules } from '../../config/rewards'
import { settingsSpec as spec } from '../../config/settings'
import { chimeMaxLateMs, chimeMinGapMs, chimeResumeTimeoutMs, chimeSpec } from '../../config/sounds'
import { timerConfigFrom } from '../../core/settings/settings'
import type { SessionCompleted, TimerEvent } from '../../core/timer/engine'
import { createMemoryAdapter } from '../../storage/adapter'
import { loadState } from '../../storage/persistence'
import { createWalletStore } from '../rewards/walletStore'
import { createSettingsStore } from '../settings/settingsStore'
import { createTimerStore } from '../timer/timerStore'
import { bindSounds } from './bindSounds'
import { scheduleChime } from './chime'
import { browserSoundEnv, type SoundContextLike, type SoundEnv } from './sounds'

const MIN = 60_000
const T0 = 1_700_000_000_000

/** Let pending promise callbacks run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

interface Page {
  /** The browser has seen a tap in this page (Chrome's sticky activation): resume() works anywhere. */
  activated: boolean
  /** A gesture is being handled right now. */
  inGesture: boolean
  createThrows: boolean
  playThrows: boolean
  /** resume() resolves only after the clock moved this far (a slow browser). */
  resumeDelayMs: number
  resumes: number
  plays: number
}

/** A mock AudioContext: it starts suspended unless created during a gesture, like browsers do. */
class FakeContext implements SoundContextLike {
  state: 'suspended' | 'running' | 'closed' | 'interrupted'
  closed = 0
  private listeners = new Set<() => void>()
  private page: Page
  private clock: { now: number }
  constructor(page: Page, clock: { now: number }) {
    this.page = page
    this.clock = clock
    this.state = page.inGesture ? 'running' : 'suspended'
  }
  addEventListener(_type: 'statechange', listener: () => void) {
    this.listeners.add(listener)
  }
  removeEventListener(_type: 'statechange', listener: () => void) {
    this.listeners.delete(listener)
  }
  listenerCount = () => this.listeners.size
  setState(state: FakeContext['state']) {
    this.state = state
    this.listeners.forEach((l) => l())
  }
  resume() {
    this.page.resumes += 1
    if (this.state === 'closed') return Promise.reject(new DOMException('Closed', 'InvalidStateError'))
    if (this.page.inGesture || this.page.activated) {
      this.clock.now += this.page.resumeDelayMs
      this.setState('running')
    }
    return Promise.resolve()
  }
  close() {
    this.closed += 1
    this.setState('closed')
    return Promise.resolve()
  }
}

function fakeEnv(clock: { now: number }, supported = true) {
  const page: Page = {
    activated: false,
    inGesture: false,
    createThrows: false,
    playThrows: false,
    resumeDelayMs: 0,
    resumes: 0,
    plays: 0,
  }
  const contexts: FakeContext[] = []
  const gestures = new Set<() => void>()
  const env: SoundEnv<FakeContext> = {
    createContext: supported
      ? () => {
          if (page.createThrows) throw new Error('Too many audio contexts')
          const ctx = new FakeContext(page, clock)
          contexts.push(ctx)
          return ctx
        }
      : null,
    play(ctx) {
      if (page.playThrows) throw new Error('Audio device lost')
      if (ctx.state !== 'running') throw new Error('Played on a suspended context')
      page.plays += 1
    },
    onUserGesture(listener) {
      gestures.add(listener)
      return () => {
        gestures.delete(listener)
      }
    },
  }
  return {
    env,
    page,
    contexts,
    gestureListeners: () => gestures.size,
    /** The user taps somewhere in Koa (optionally running the tapped control's handler). */
    tap(handler?: () => void) {
      page.inGesture = true
      page.activated = true
      gestures.forEach((l) => l())
      handler?.()
      page.inGesture = false
    },
  }
}

/** The real timer, settings and wallet stores, wired to a mock Web Audio. */
function setup({ supported = true, sounds = false } = {}) {
  const clock = { now: T0 }
  const fake = fakeEnv(clock, supported)
  const storage = createMemoryAdapter()
  const settings = createSettingsStore({ spec, storage })
  if (sounds) settings.setFlag('sounds', true)
  let n = 0
  const timer = createTimerStore({
    config: timerConfigFrom(settings.getState()),
    storage,
    now: () => clock.now,
    newId: () => `id-${++n}`,
  })
  const audio = bindSounds({ timer, settings, env: fake.env, now: () => clock.now })
  // Registered after the chime, like the app's wallet (connect.ts runs after the stores exist).
  const wallet = createWalletStore({ rules: rewardRules, storage, now: () => clock.now })
  timer.onEvent((event) => {
    if (event.type === 'sessionCompleted') wallet.award(event)
  })
  /** Run the current session to its end and let the timer notice. */
  const finish = async () => {
    timer.toggle()
    clock.now += timer.getState().durationMs
    timer.sync()
    await flush()
  }
  /** Turn Sounds on with a tap on the switch. */
  const turnOn = async () => {
    fake.tap(() => audio.enable())
    await flush()
  }
  return { clock, fake, storage, settings, timer, wallet, audio, finish, turnOn }
}

describe('sounds: support and defaults', () => {
  it('is off by default and sets up no audio, even after taps', async () => {
    const { fake, settings, audio, finish } = setup()
    expect(settings.getState().sounds).toBe(false)
    expect(audio.getStatus()).toBe('off')
    fake.tap()
    await finish()
    expect(fake.contexts).toHaveLength(0)
    expect(fake.page.plays).toBe(0)
  })

  it('reports unsupported browsers, never listens or plays, and stays off', async () => {
    const { fake, settings, audio, finish } = setup({ supported: false })
    expect(audio.getStatus()).toBe('unsupported')
    expect(fake.gestureListeners()).toBe(0)
    fake.tap(() => audio.enable())
    await finish()
    expect(settings.getState().sounds).toBe(false)
    expect(fake.page.plays).toBe(0)
  })

  it('the browser environment is unsupported without Web Audio', () => {
    // Vitest runs without a DOM here, so there is no window or AudioContext.
    expect(browserSoundEnv().createContext).toBeNull()
  })
})

describe('sounds: enabling and disabling', () => {
  it('turning it on from a tap saves it, sets up audio and plays one preview chime', async () => {
    const { fake, settings, audio, turnOn } = setup()
    await turnOn()
    expect(settings.getState().sounds).toBe(true)
    expect(fake.contexts).toHaveLength(1)
    expect(fake.page.plays).toBe(1)
    expect(audio.getStatus()).toBe('ready')
  })

  it('turning it off closes the audio context and stops chiming', async () => {
    const { fake, settings, audio, turnOn, finish } = setup()
    await turnOn()
    audio.disable()
    expect(settings.getState().sounds).toBe(false)
    expect(fake.contexts[0].closed).toBe(1)
    expect(audio.getStatus()).toBe('off')
    await finish()
    expect(fake.page.plays).toBe(1) // only the preview
  })

  it('turned off from another tab: closes the audio context', async () => {
    const { fake, settings, audio, turnOn } = setup()
    await turnOn()
    settings.setFlag('sounds', false) // what settingsStore.refresh() does for another tab's change
    expect(fake.contexts[0].closed).toBe(1)
    expect(audio.getStatus()).toBe('off')
  })

  it('turned back on, it sets up a fresh audio context', async () => {
    const { fake, audio, turnOn, clock } = setup()
    await turnOn()
    audio.disable()
    clock.now += chimeMinGapMs
    await turnOn()
    expect(fake.contexts).toHaveLength(2)
    expect(fake.page.plays).toBe(2)
    expect(audio.getStatus()).toBe('ready')
  })
})

describe('sounds: timer states', () => {
  it('chimes exactly once when a focus session completes', async () => {
    const { fake, turnOn, finish, clock } = setup()
    await turnOn()
    clock.now += chimeMinGapMs
    await finish()
    expect(fake.page.plays).toBe(2) // preview + completion
  })

  it('chimes when a break completes', async () => {
    const { fake, turnOn, finish, timer } = setup()
    await turnOn()
    await finish() // focus
    expect(timer.getState().mode).toBe('shortBreak')
    await finish() // short break
    expect(fake.page.plays).toBe(3)
  })

  it('never chimes for start, pause, resume, reset, skip, mode changes or ticks', async () => {
    const { fake, turnOn, timer, clock } = setup()
    await turnOn()
    clock.now += chimeMinGapMs
    timer.toggle() // start
    for (let i = 0; i < 20; i++) {
      clock.now += 250
      timer.sync() // ticks
    }
    timer.toggle() // pause
    timer.toggle() // resume
    timer.reset()
    timer.toggle()
    timer.skip()
    timer.selectMode('longBreak')
    timer.setConfig(timerConfigFrom({ ...spec.defaults, longBreakEvery: 3 })) // a settings change
    await flush()
    expect(fake.page.plays).toBe(1) // only the preview
  })

  it("doesn't chime for a completion caught up long after (app reopened later)", async () => {
    const { fake, turnOn, timer, clock } = setup()
    await turnOn()
    timer.toggle()
    clock.now += timer.getState().durationMs + chimeMaxLateMs + MIN
    timer.sync()
    await flush()
    expect(fake.page.plays).toBe(1)
  })
})

describe('sounds: autoplay rules', () => {
  it('after a reload, waits for a tap: no audio is set up and nothing plays before it', async () => {
    const { fake, audio, finish, clock } = setup({ sounds: true })
    expect(audio.getStatus()).toBe('locked')
    await finish()
    expect(fake.contexts).toHaveLength(0)
    expect(fake.page.plays).toBe(0)

    fake.tap()
    await flush()
    expect(audio.getStatus()).toBe('ready')
    clock.now += chimeMinGapMs
    await finish()
    expect(fake.page.plays).toBe(1)
  })

  it('when the browser pauses audio (iOS in the background) and refuses to resume, the chime is dropped', async () => {
    const { fake, audio, turnOn, finish } = setup()
    await turnOn()
    fake.page.activated = false // iOS: resume() only works inside a gesture
    fake.contexts[0].setState('interrupted')
    expect(audio.getStatus()).toBe('locked')
    await finish()
    expect(fake.page.plays).toBe(1)
    expect(fake.contexts[0].state).toBe('interrupted')

    fake.tap() // the next tap wakes it
    await flush()
    expect(audio.getStatus()).toBe('ready')
  })

  it('resumes a suspended context when the browser allows it (Chrome after a tap)', async () => {
    const { fake, turnOn, finish } = setup()
    await turnOn()
    fake.contexts[0].setState('suspended')
    await finish()
    expect(fake.page.plays).toBe(2)
  })

  it("drops a chime the browser allows only late, rather than playing it late", async () => {
    const { fake, turnOn, finish } = setup()
    await turnOn()
    fake.contexts[0].setState('suspended')
    fake.page.resumeDelayMs = chimeResumeTimeoutMs + 1
    await finish()
    expect(fake.page.plays).toBe(1)
  })
})

describe('sounds: duplicates', () => {
  const completed = (sessionId: string, at: number): SessionCompleted => ({
    type: 'sessionCompleted',
    sessionId,
    mode: 'focus',
    durationMs: 25 * MIN,
    startedAt: at - 25 * MIN,
    completedAt: at,
    endsCycle: false,
    cycleFocusMs: 25 * MIN,
  })

  /** A bare event source standing in for the timer. */
  function manual() {
    const clock = { now: T0 }
    const fake = fakeEnv(clock)
    const storage = createMemoryAdapter()
    const settings = createSettingsStore({ spec, storage })
    const listeners = new Set<(event: TimerEvent) => void>()
    const timer = {
      onEvent(listener: (event: TimerEvent) => void) {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    }
    const audio = bindSounds({ timer, settings, env: fake.env, now: () => clock.now })
    fake.tap(() => audio.enable())
    const emit = (event: TimerEvent) => listeners.forEach((l) => l(event))
    return { clock, fake, audio, emit, listenerCount: () => listeners.size }
  }

  it('never chimes twice for the same session', async () => {
    const { clock, fake, emit } = manual()
    clock.now += chimeMinGapMs
    emit(completed('a', clock.now))
    clock.now += chimeMinGapMs
    emit(completed('a', clock.now))
    await flush()
    expect(fake.page.plays).toBe(2) // preview + one
  })

  it('two completions at the same moment chime once', async () => {
    const { clock, fake, emit } = manual()
    clock.now += chimeMinGapMs
    emit(completed('a', clock.now))
    emit(completed('b', clock.now))
    await flush()
    expect(fake.page.plays).toBe(2)
  })
})

describe('sounds: failures never affect the timer or rewards', () => {
  it('a chime that throws reports failed; the session completes, pays and saves', async () => {
    const { fake, audio, turnOn, finish, timer, wallet, storage } = setup()
    await turnOn()
    fake.page.playThrows = true
    await finish()
    expect(audio.getStatus()).toBe('failed')
    expect(timer.getState().mode).toBe('shortBreak')
    expect(loadState(storage).timer).toMatchObject({ mode: 'shortBreak' })
    expect(wallet.getState().ledger).toHaveProperty(['focus:id-1'])

    fake.page.playThrows = false
    await finish() // the break
    expect(audio.getStatus()).toBe('ready')
  })

  it('an audio context that fails to start reports failed and pays as usual', async () => {
    const { fake, audio, turnOn, finish, wallet } = setup()
    fake.page.createThrows = true
    await turnOn()
    expect(audio.getStatus()).toBe('failed')
    await finish()
    expect(wallet.getState().ledger).toHaveProperty(['focus:id-1'])
  })

  it('a resume that rejects is ignored', async () => {
    const { fake, turnOn, finish, wallet } = setup()
    await turnOn()
    const ctx = fake.contexts[0]
    ctx.setState('suspended')
    ctx.resume = () => Promise.reject(new Error('No audio device'))
    await finish()
    expect(fake.page.plays).toBe(1)
    expect(Object.keys(wallet.getState().ledger)).toEqual(['focus:id-1'])
  })

  it('turning it off clears a failure', async () => {
    const { fake, audio, turnOn, finish } = setup()
    await turnOn()
    fake.page.playThrows = true
    await finish()
    audio.disable()
    expect(audio.getStatus()).toBe('off')
  })
})

describe('sounds: cleanup', () => {
  it('dispose closes the audio context and removes every listener', async () => {
    const { fake, audio, turnOn, finish, settings } = setup()
    await turnOn()
    let calls = 0
    audio.subscribe(() => calls++)
    const ctx = fake.contexts[0]
    audio.dispose()
    expect(ctx.closed).toBe(1)
    expect(ctx.listenerCount()).toBe(0)
    expect(fake.gestureListeners()).toBe(0)
    await finish()
    settings.setFlag('sounds', false)
    fake.tap()
    expect(fake.page.plays).toBe(1)
    expect(calls).toBe(0)
  })
})

describe('scheduleChime', () => {
  /** Records the audio graph the chime builds. */
  function fakeAudio() {
    const ramps: { kind: string; value: number; at: number }[] = []
    const param = () => ({
      value: 0,
      setValueAtTime: (value: number, at: number) => ramps.push({ kind: 'set', value, at }),
      linearRampToValueAtTime: (value: number, at: number) => ramps.push({ kind: 'linear', value, at }),
      exponentialRampToValueAtTime: (value: number, at: number) => ramps.push({ kind: 'exp', value, at }),
    })
    const nodes: { disconnected: boolean }[] = []
    const oscillators: { ended?: () => void; started?: number; stopped?: number; frequency: { value: number } }[] = []
    const node = () => {
      const n = { disconnected: false, connect: () => {}, disconnect: () => (n.disconnected = true) }
      nodes.push(n)
      return n
    }
    const ctx = {
      currentTime: 10,
      destination: {},
      createGain: () => ({ ...node(), gain: param() }),
      createOscillator: () => {
        const base = node()
        const osc = {
          type: '',
          frequency: { value: 0 },
          ended: undefined as (() => void) | undefined,
          started: undefined as number | undefined,
          stopped: undefined as number | undefined,
          connect: base.connect,
          disconnect: () => base.disconnect(),
          addEventListener: (_type: string, listener: () => void) => (osc.ended = listener),
          start: (at: number) => (osc.started = at),
          stop: (at: number) => (osc.stopped = at),
        }
        oscillators.push(osc)
        return osc
      },
    }
    return { ctx: ctx as unknown as BaseAudioContext, ramps, nodes, oscillators }
  }

  it('plays each note with a soft attack and fade, never louder than the peak', () => {
    const { ctx, ramps, oscillators } = fakeAudio()
    scheduleChime(ctx, chimeSpec)
    expect(oscillators).toHaveLength(chimeSpec.notes.length * 2)
    expect(oscillators.map((o) => o.frequency.value)).toContain(chimeSpec.notes[0].frequency)
    const starts = ramps.filter((r) => r.kind === 'set')
    expect(starts.every((r) => r.value < 0.001)).toBe(true) // starts silent: no click
    expect(Math.max(...ramps.map((r) => r.value))).toBeLessThanOrEqual(chimeSpec.peak)
    expect(ramps.filter((r) => r.kind === 'exp').every((r) => r.value < 0.001)).toBe(true)
    expect(oscillators.every((o) => o.started !== undefined && (o.stopped ?? 0) > o.started)).toBe(true)
  })

  it('disconnects every node once all notes have ended', () => {
    const { ctx, nodes, oscillators } = fakeAudio()
    scheduleChime(ctx, chimeSpec)
    oscillators.slice(0, -1).forEach((o) => o.ended?.())
    expect(nodes.some((n) => n.disconnected)).toBe(false)
    oscillators.at(-1)?.ended?.()
    expect(nodes.every((n) => n.disconnected)).toBe(true)
  })
})
