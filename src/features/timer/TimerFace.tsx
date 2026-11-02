import { useEffect, useRef } from 'react'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import type { TimerMode, TimerStatus } from '../../core/timer/engine'
import { Button, IconButton } from '../../ui/Button'
import { LeafGlyph } from '../../ui/glyphs'
import { formatClock } from './format'
import './timer.css'

export function TimerDisplay({ seconds }: { seconds: number }) {
  return (
    <p className="timer-display">
      <time>{formatClock(seconds)}</time>
    </p>
  )
}

function cycleLabel(mode: TimerMode, completed: number, total: number) {
  if (mode === 'focus') return `Session ${Math.min(completed + 1, total)} of ${total}`
  if (mode === 'longBreak') return completed >= total ? 'Cycle complete' : 'Long break'
  return `${completed} of ${total} sessions done`
}

/** One leaf per focus session in the cycle; filled leaves are completed sessions. */
export function CycleLeaves({ mode, completed, total }: { mode: TimerMode; completed: number; total: number }) {
  return (
    <div className="cycle">
      <div className="cycle__leaves" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <LeafGlyph key={i} size={16} className={`cycle__leaf${i < completed ? ' is-done' : ''}`} />
        ))}
      </div>
      <span className="cycle__label">{cycleLabel(mode, completed, total)}</span>
    </div>
  )
}

function primaryLabel(status: TimerStatus, mode: TimerMode) {
  if (status === 'running') return 'Pause'
  if (status === 'paused') return 'Resume'
  return mode === 'focus' ? 'Start' : 'Start break'
}

interface TimerControlsProps {
  status: TimerStatus
  mode: TimerMode
  canReset: boolean
  onPrimary: () => void
  onReset: () => void
  onSkip: () => void
}

export function TimerControls({ status, mode, canReset, onPrimary, onReset, onSkip }: TimerControlsProps) {
  const running = status === 'running'
  return (
    <div className="timer-controls">
      <IconButton label="Reset timer" onClick={onReset} disabled={!canReset}>
        <RotateCcw />
      </IconButton>
      <Button
        size="lg"
        icon={running ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        onClick={onPrimary}
      >
        {primaryLabel(status, mode)}
      </Button>
      <IconButton label={mode === 'focus' ? 'Skip to break' : 'Skip to focus'} onClick={onSkip}>
        <SkipForward />
      </IconButton>
    </div>
  )
}

/** Inline confirmation in place of the controls, so skipping a focus session is never an accident. */
export function SkipConfirm({ onKeep, onSkip }: { onKeep: () => void; onSkip: () => void }) {
  const keepRef = useRef<HTMLButtonElement>(null)
  useEffect(() => keepRef.current?.focus(), [])

  return (
    <div className="skip-confirm" role="group" aria-labelledby="skip-confirm-text">
      <p id="skip-confirm-text" className="skip-confirm__text">
        Skip this focus session? It won't count toward your cycle.
      </p>
      <div className="skip-confirm__actions">
        <Button ref={keepRef} variant="secondary" onClick={onKeep}>
          Keep going
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip session
        </Button>
      </div>
    </div>
  )
}
