/**
 * The session-complete chime (Phase 8, Step 10), synthesized with Web Audio: no audio files.
 * Two soft bell notes a fifth apart, each a sine with a quiet octave on top, a gentle
 * attack and a long fade. Quiet on purpose: it should feel like Koa tapping a tiny bell.
 */
export interface ChimeNote {
  /** Hz. */
  frequency: number
  /** Seconds after the chime starts. */
  at: number
  /** Seconds until it has faded out. */
  decay: number
}

export interface ChimeSpec {
  notes: readonly ChimeNote[]
  /** Peak level of each note (0–1); the master level is kept low. */
  peak: number
  /** Seconds to reach the peak (soft, no click). */
  attack: number
  /** Level of the octave overtone relative to the note. */
  overtone: number
}

export const chimeSpec: ChimeSpec = {
  notes: [
    { frequency: 659.25, at: 0, decay: 1.4 }, // E5
    { frequency: 987.77, at: 0.16, decay: 1.8 }, // B5
  ],
  peak: 0.14,
  attack: 0.012,
  overtone: 0.18,
}

/** A completion noticed later than this (the app was away) doesn't chime: it would be stale news. */
export const chimeMaxLateMs = 5 * 60_000

/** Chimes closer together than this are dropped (two sessions caught up at once, quick toggling). */
export const chimeMinGapMs = 1500

/** If the browser takes longer than this to allow playback, the chime is dropped rather than played late. */
export const chimeResumeTimeoutMs = 1000
