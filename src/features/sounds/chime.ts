import type { ChimeSpec } from '../../config/sounds'

/** Practically silent: exponential ramps can't reach 0. */
const FLOOR = 0.0001

/**
 * Schedule the chime on a running audio context. Each note is a sine plus a quiet octave
 * through its own envelope (soft attack, long exponential fade, so there's no click), all into
 * one master gain. Every node is disconnected when the last note ends, so nothing piles up.
 */
export function scheduleChime(ctx: BaseAudioContext, spec: ChimeSpec) {
  const start = ctx.currentTime + 0.02
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)

  const nodes: AudioNode[] = [master]
  let ended = 0
  const voices = spec.notes.length * 2
  const onEnded = () => {
    ended += 1
    if (ended < voices) return
    nodes.forEach((node) => node.disconnect())
  }

  for (const note of spec.notes) {
    const t = start + note.at
    const end = t + note.decay
    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(FLOOR, t)
    envelope.gain.linearRampToValueAtTime(spec.peak, t + spec.attack)
    envelope.gain.exponentialRampToValueAtTime(FLOOR, end)
    envelope.connect(master)
    nodes.push(envelope)

    for (const [multiple, level] of [
      [1, 1],
      [2, spec.overtone],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = note.frequency * multiple
      const voice = ctx.createGain()
      voice.gain.value = level
      osc.connect(voice)
      voice.connect(envelope)
      nodes.push(osc, voice)
      osc.addEventListener('ended', onEnded, { once: true })
      osc.start(t)
      osc.stop(end + 0.05)
    }
  }
}
