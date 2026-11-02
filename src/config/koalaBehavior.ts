/**
 * Koa's personality tuning: timings and weights for the koala brain (src/core/koala/).
 * Character bible §4 describes the rules these numbers drive.
 */

const SECOND = 1000
const MINUTE = 60 * SECOND

export const koalaBehavior = {
  /** Seconds between ambient actions, by context. Focus has none. */
  ambientEvery: {
    idle: { min: 12 * SECOND, max: 25 * SECOND },
    break: { min: 18 * SECOND, max: 35 * SECOND },
  },
  /** Relative weights of ambient actions, by context. `chat` only runs when a bubble is allowed. */
  ambientWeights: {
    idle: { sway: 3, tilt: 3, stretch: 2, slowBlink: 2, wiggle: 1, chat: 2 },
    break: { sway: 3, tilt: 1, stretch: 2, slowBlink: 3, wiggle: 0, chat: 1 },
  },
  /** How long an ambient or reaction motion keeps Koa busy before the next ambient action. */
  busyFor: 3 * SECOND,
  /** Koa dozes off after this long without any input. Never during focus. */
  napAfter: { idle: 5 * MINUTE, break: 3 * MINUTE },

  bubble: {
    /** How long a bubble stays up. */
    showFor: 3.5 * SECOND,
    /** Koa speaks on its own at most this often. */
    unpromptedGap: 2 * MINUTE,
    /** A tap gets a spoken reply at most this often (taps still always get a motion). */
    tapGap: 20 * SECOND,
    /** Chance that a plain tap gets a spoken reply when allowed. */
    tapChance: 0.5,
    /** Lines not repeated until this many others have been said. */
    memory: 6,
    /**
     * Celebration lines wait until the coin labels have floated away (RewardLayer), so the
     * bubble and the "+25" never overlap. Bigger payouts show more labels.
     */
    celebrationDelay: { session: 2300, cycle: 2700, dailyGoal: 3000 },
    /** Chance that an idle chat is a shop hint when something is affordable. */
    shopHintChance: 0.35,
  },

  taps: {
    /** Taps within this window count as a burst. */
    window: 3 * SECOND,
    /** The third tap in a burst tickles. */
    tickleAt: 3,
    /** The fifth tap in a burst startles Koa. */
    surpriseAt: 5,
    /** After a startle, taps only get a soft squish for this long. */
    cooldown: 4 * SECOND,
    /** During focus, at most one soft squish per this interval. */
    focusGap: 1.2 * SECOND,
    /** Taps right after waking up are ignored (the same touch woke Koa). */
    wakeGrace: 700,
  },
} as const

export type KoalaBehavior = typeof koalaBehavior
