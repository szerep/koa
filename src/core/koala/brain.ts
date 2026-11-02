/**
 * Koa's brain: a small, pure state machine that decides what the koala is doing.
 *
 * - No React, DOM or real clock. Every function takes `now` and an environment with the
 *   tuning, the line pools and a random source, so behavior is deterministic in tests.
 * - It only decides *what* happens (a motion, a line, napping). `<KoaCompanion>` renders it
 *   with the approved frames. Missing poses are never substituted: motions are transforms
 *   of the existing art and eye changes use the approved blink frame.
 *
 * Priorities (character bible §4): timer-driven reactions (celebrating, break start/end,
 * settling in for focus) beat user-driven ones (taps, show-off), which beat ambient ones
 * (idle actions, chatter, napping). During focus Koa stays calm: no ambient actions, no
 * speech, no naps, and taps only get a soft squish.
 */

import type { KoalaBehavior } from '../../config/koalaBehavior'
import type { LineTopic } from '../../config/koalaLines'

export type KoalaContext = 'idle' | 'focus' | 'break'
export type AmbientAction = 'sway' | 'tilt' | 'stretch' | 'slowBlink' | 'wiggle' | 'chat'
export type CelebrationLevel = 'session' | 'cycle' | 'dailyGoal'

export type KoalaMotionName =
  | 'squish'
  | 'softSquish'
  | 'wiggle'
  | 'bounce'
  | 'giggle'
  | 'surprised'
  | 'sway'
  | 'tilt'
  | 'stretch'
  | 'settle'
  | 'hop'
  | 'bigHop'
  | 'wake'
  | 'slowBlink'

export interface KoalaMotion {
  name: KoalaMotionName
  /** Increments with every new motion, so the same motion can play twice. */
  seq: number
  /** Lean direction for asymmetric motions (tilt, sway). */
  dir: 1 | -1
}

export interface Bubble {
  topic: LineTopic
  text: string
  seq: number
  /** Milliseconds to wait before showing (a celebration lets the coins land first). */
  delay: number
  until: number
}

export interface KoalaState {
  context: KoalaContext
  napping: boolean
  motion: KoalaMotion | null
  bubble: Bubble | null
  /** A motion or reaction is playing; no ambient action starts before this. */
  busyUntil: number
  nextAmbientAt: number
  lastAmbient: AmbientAction | null
  lastInputAt: number
  lastBubbleAt: number
  lastTapBubbleAt: number
  /** Most recent lines first. */
  recentLines: readonly string[]
  /** Recent tap times, within the burst window. */
  taps: readonly number[]
  tapCooldownUntil: number
  lastFocusTapAt: number
  lastTapMotion: KoalaMotionName | null
  wokeAt: number
  celebratedAt: number
  celebrationLevel: CelebrationLevel | null
  seq: number
}

export interface KoalaEnv {
  behavior: KoalaBehavior
  lines: Record<LineTopic, readonly string[]>
  /** Uniform in [0, 1). */
  random: () => number
}

export interface TickInput {
  /** The wallet can buy at least one item the user doesn't own (enables shop hints). */
  canAffordSomething: boolean
}

const NEVER = Number.NEGATIVE_INFINITY

/** Tap reactions rotate so the same one never plays twice in a row. */
const TAP_MOTIONS = ['squish', 'wiggle', 'bounce'] as const satisfies readonly KoalaMotionName[]

const CELEBRATION_RANK: Record<CelebrationLevel, number> = { session: 0, cycle: 1, dailyGoal: 2 }

/** Celebrations within this window of each other are the same moment. */
const CELEBRATION_WINDOW = 2000

/* ---------------------------------------------------------------------------- helpers */

function between(min: number, max: number, env: KoalaEnv) {
  return min + env.random() * (max - min)
}

function ambientDelay(context: KoalaContext, env: KoalaEnv) {
  if (context === 'focus') return Number.POSITIVE_INFINITY
  const { min, max } = env.behavior.ambientEvery[context]
  return between(min, max, env)
}

function pickWeighted<T extends string>(weights: Partial<Record<T, number>>, env: KoalaEnv): T | null {
  const entries = (Object.entries(weights) as [T, number][]).filter(([, w]) => w > 0)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  if (total <= 0) return null
  let roll = env.random() * total
  for (const [key, w] of entries) {
    roll -= w
    if (roll < 0) return key
  }
  return entries[entries.length - 1][0]
}

function pickFrom<T>(items: readonly T[], env: KoalaEnv): T {
  return items[Math.min(items.length - 1, Math.floor(env.random() * items.length))]
}

function withMotion(state: KoalaState, name: KoalaMotionName, env: KoalaEnv): KoalaState {
  const seq = state.seq + 1
  return { ...state, seq, motion: { name, seq, dir: env.random() < 0.5 ? -1 : 1 } }
}

type SpeechKind = 'event' | 'unprompted' | 'tap'

/** Show a line from a topic, avoiding recently said lines. Koa never speaks during focus. */
function say(
  state: KoalaState,
  topic: LineTopic,
  now: number,
  env: KoalaEnv,
  kind: SpeechKind,
  delay = 0,
): KoalaState {
  if (state.context === 'focus') return state
  const pool = env.lines[topic]
  if (pool.length === 0) return state
  const fresh = pool.filter((line) => !state.recentLines.includes(line))
  const text = pickFrom(fresh.length > 0 ? fresh : pool, env)
  const seq = state.seq + 1
  return {
    ...state,
    seq,
    bubble: { topic, text, seq, delay, until: now + delay + env.behavior.bubble.showFor },
    lastBubbleAt: now + delay,
    lastTapBubbleAt: kind === 'tap' ? now : state.lastTapBubbleAt,
    recentLines: [text, ...state.recentLines.filter((l) => l !== text)].slice(0, env.behavior.bubble.memory),
  }
}

/** Keep Koa busy for a moment and push the next ambient action past it. */
function busy(state: KoalaState, now: number, env: KoalaEnv): KoalaState {
  const busyUntil = now + env.behavior.busyFor
  return {
    ...state,
    busyUntil,
    nextAmbientAt: Math.max(state.nextAmbientAt, busyUntil + ambientDelay(state.context, env) / 2),
  }
}

function canChat(state: KoalaState, now: number, env: KoalaEnv) {
  return state.bubble === null && now - state.lastBubbleAt >= env.behavior.bubble.unpromptedGap
}

function wake(state: KoalaState, now: number, env: KoalaEnv): KoalaState {
  const awake: KoalaState = { ...state, napping: false, wokeAt: now, lastInputAt: now }
  return busy(say(withMotion(awake, 'wake', env), 'wake', now, env, 'event'), now, env)
}

export function greetingTopic(hour: number): LineTopic {
  if (hour >= 5 && hour < 12) return 'greetMorning'
  if (hour >= 12 && hour < 18) return 'greetAfternoon'
  if (hour >= 18 && hour < 22) return 'greetEvening'
  return 'greetNight'
}

/* ------------------------------------------------------------------------ transitions */

export function createKoala(now: number, context: KoalaContext, env: KoalaEnv): KoalaState {
  return {
    context,
    napping: false,
    motion: null,
    bubble: null,
    busyUntil: now,
    nextAmbientAt: now + ambientDelay(context, env),
    lastAmbient: null,
    lastInputAt: now,
    lastBubbleAt: NEVER,
    lastTapBubbleAt: NEVER,
    recentLines: [],
    taps: [],
    tapCooldownUntil: NEVER,
    lastFocusTapAt: NEVER,
    lastTapMotion: null,
    wokeAt: NEVER,
    celebratedAt: NEVER,
    celebrationLevel: null,
    seq: 0,
  }
}

/**
 * The timer moved Koa into a new context.
 * - focus: Koa wakes, settles in quietly and stops talking.
 * - break: Koa stretches and suggests a break (a long-break line after a full cycle).
 * - idle: Koa goes back to ambient life; an ongoing celebration is left alone.
 */
export function setContext(
  state: KoalaState,
  context: KoalaContext,
  now: number,
  env: KoalaEnv,
  opts: { longBreak?: boolean } = {},
): KoalaState {
  if (context === state.context) return state
  const base: KoalaState = { ...state, context, napping: false, taps: [] }

  if (context === 'focus') {
    return { ...withMotion(base, 'settle', env), bubble: null, busyUntil: now, nextAmbientAt: Number.POSITIVE_INFINITY }
  }
  if (context === 'break') {
    const stretched = withMotion(base, 'stretch', env)
    return busy(say(stretched, opts.longBreak ? 'longBreakStart' : 'breakStart', now, env, 'event'), now, env)
  }
  return { ...base, nextAmbientAt: Math.max(now, state.busyUntil) + ambientDelay('idle', env) }
}

/** Any input anywhere in the app. Wakes a napping Koa. */
export function activity(state: KoalaState, now: number, env: KoalaEnv): KoalaState {
  if (state.napping) return wake(state, now, env)
  return { ...state, lastInputAt: now }
}

/** The user tapped Koa. */
export function tap(state: KoalaState, now: number, env: KoalaEnv): KoalaState {
  const { taps: rules, bubble } = env.behavior
  if (state.napping) return wake(state, now, env)
  // The touch that woke Koa also lands here as a tap; don't double-react.
  if (now - state.wokeAt < rules.wakeGrace) return state

  if (state.context === 'focus') {
    if (now - state.lastFocusTapAt < rules.focusGap) return state
    return { ...withMotion(state, 'softSquish', env), lastFocusTapAt: now, lastInputAt: now }
  }

  const touched: KoalaState = { ...state, lastInputAt: now }
  if (now < state.tapCooldownUntil) return withMotion(touched, 'softSquish', env)

  const taps = [...state.taps.filter((t) => now - t < rules.window), now]

  if (taps.length >= rules.surpriseAt) {
    const startled = say(withMotion(touched, 'surprised', env), 'surprised', now, env, 'tap')
    return busy({ ...startled, taps: [], tapCooldownUntil: now + rules.cooldown, lastTapMotion: 'surprised' }, now, env)
  }
  if (taps.length === rules.tickleAt) {
    const tickled = say(withMotion(touched, 'giggle', env), 'tickle', now, env, 'tap')
    return busy({ ...tickled, taps, lastTapMotion: 'giggle' }, now, env)
  }

  const options = TAP_MOTIONS.filter((m) => m !== state.lastTapMotion)
  const name = pickFrom(options, env)
  let next: KoalaState = { ...withMotion(touched, name, env), taps, lastTapMotion: name }
  const mayReply = next.bubble === null && now - next.lastTapBubbleAt >= bubble.tapGap
  if (mayReply && env.random() < bubble.tapChance) next = say(next, 'tap', now, env, 'tap')
  return busy(next, now, env)
}

/**
 * A focus session paid out. The session is over, so Koa leaves focus and celebrates.
 * Calls for the same moment keep the biggest celebration (daily goal > cycle > session).
 */
export function celebrate(state: KoalaState, level: CelebrationLevel, now: number, env: KoalaEnv): KoalaState {
  const previous = state.celebrationLevel
  const sameMoment = previous !== null && now - state.celebratedAt < CELEBRATION_WINDOW
  if (sameMoment && CELEBRATION_RANK[level] <= CELEBRATION_RANK[previous]) return state

  const base: KoalaState = {
    ...state,
    context: state.context === 'focus' ? 'idle' : state.context,
    napping: false,
    taps: [],
    celebratedAt: now,
    celebrationLevel: level,
  }
  const moved = withMotion(base, level === 'session' ? 'hop' : 'bigHop', env)
  const topic: LineTopic = level === 'session' ? 'celebrate' : level
  return busy(say(moved, topic, now, env, 'event', env.behavior.bubble.celebrationDelay[level]), now, env)
}

/** A break finished on its own. Koa wakes up and gently says it's time. */
export function breakOver(state: KoalaState, now: number, env: KoalaEnv): KoalaState {
  const base: KoalaState = { ...state, context: 'idle', napping: false, taps: [] }
  return busy(say(withMotion(base, 'stretch', env), 'breakOver', now, env, 'event'), now, env)
}

/** Koa put on something new from the shop. */
export function showOff(state: KoalaState, now: number, env: KoalaEnv): KoalaState {
  const base: KoalaState = { ...state, napping: false, lastInputAt: now }
  return busy(say(withMotion(base, 'wiggle', env), 'showOff', now, env, 'event'), now, env)
}

/** Say hello when the app opens. Skipped if Koa is already talking, napping or focusing. */
export function greet(state: KoalaState, now: number, hour: number, env: KoalaEnv): KoalaState {
  if (state.context === 'focus' || state.napping || state.bubble !== null) return state
  if (now - state.celebratedAt < env.behavior.bubble.showFor * 2) return state
  return say(state, greetingTopic(hour), now, env, 'unprompted')
}

/** Time passes: bubbles expire, Koa may doze off or do an ambient action. */
export function tick(state: KoalaState, now: number, env: KoalaEnv, input: TickInput): KoalaState {
  let next = state
  if (next.bubble && now >= next.bubble.until) next = { ...next, bubble: null }
  if (next.context === 'focus' || next.napping || now < next.busyUntil) return next

  if (now - next.lastInputAt >= env.behavior.napAfter[next.context]) {
    return { ...next, napping: true, bubble: null, motion: null }
  }

  if (now < next.nextAmbientAt) return next

  const weights: Partial<Record<AmbientAction, number>> = { ...env.behavior.ambientWeights[next.context] }
  if (next.lastAmbient) delete weights[next.lastAmbient]
  if (!canChat(next, now, env)) delete weights.chat
  const action = pickWeighted(weights, env)
  const scheduled: KoalaState = { ...next, nextAmbientAt: now + ambientDelay(next.context, env) }
  if (!action) return scheduled

  if (action === 'chat') {
    const shopHint = input.canAffordSomething && env.random() < env.behavior.bubble.shopHintChance
    return { ...say(scheduled, shopHint ? 'shopHint' : 'idle', now, env, 'unprompted'), lastAmbient: 'chat' }
  }
  return {
    ...withMotion(scheduled, action, env),
    lastAmbient: action,
    busyUntil: now + env.behavior.busyFor,
  }
}

/* ------------------------------------------------------------------------ presentation */

export type KoalaTempo = 'normal' | 'calm' | 'sleepy'

export interface KoalaView {
  /** Breathing and blink pace. */
  tempo: KoalaTempo
  /** Napping: the approved blink frame is held, eyes closed. */
  eyesClosed: boolean
  motion: KoalaMotion | null
  bubble: Bubble | null
}

export function present(state: KoalaState): KoalaView {
  return {
    tempo: state.napping ? 'sleepy' : state.context === 'idle' ? 'normal' : 'calm',
    eyesClosed: state.napping,
    motion: state.motion,
    bubble: state.context === 'focus' ? null : state.bubble,
  }
}
