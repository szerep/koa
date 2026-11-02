import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { commitInput, stepValue, type NumberRange } from '../core/settings/settings'
import './stepper.css'

interface StepperProps {
  /** Accessible name of the value, e.g. "Focus length". */
  label: string
  value: number
  range: NumberRange
  /** Called with a valid value (stepped, or typed and then clamped and snapped). */
  onChange: (value: number) => void
  /** Short unit under the number, e.g. "min". */
  unit: string
  /** Spoken value, e.g. "25 minutes". */
  valueText: (value: number) => string
  decreaseLabel: string
  increaseLabel: string
  /** Id of the text that describes the range, for screen readers. */
  describedBy?: string
}

/** Pause before a held button starts repeating, then the repeat interval. */
const HOLD_DELAY_MS = 420
const HOLD_EVERY_MS = 80

/**
 * −/+ stepper around a big, typeable number. The buttons stop at the bounds (and are disabled
 * there); holding one repeats. A typed value is checked on blur or Enter: rounded, clamped and
 * snapped to a valid value, and empty or non-numeric input reverts. Escape cancels typing.
 */
export function Stepper({
  label,
  value,
  range,
  onChange,
  unit,
  valueText,
  decreaseLabel,
  increaseLabel,
  describedBy,
}: StepperProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [adjusted, setAdjusted] = useState<number | null>(null)
  const hold = useRef<{ timeout?: number; interval?: number; value: number }>({ value })
  /** Escape was pressed: the blur that follows must not commit the typed text. */
  const cancelled = useRef(false)

  const stopHold = () => {
    window.clearTimeout(hold.current.timeout)
    window.clearInterval(hold.current.interval)
    hold.current.timeout = undefined
    hold.current.interval = undefined
  }

  // Stop repeating if the pointer is released anywhere, and on unmount.
  useEffect(() => {
    window.addEventListener('pointerup', stopHold)
    window.addEventListener('pointercancel', stopHold)
    return () => {
      stopHold()
      window.removeEventListener('pointerup', stopHold)
      window.removeEventListener('pointercancel', stopHold)
    }
  }, [])

  // "Adjusted to …" hint after a typed value was changed to fit.
  useEffect(() => {
    if (adjusted === null) return
    const id = window.setTimeout(() => setAdjusted(null), 3200)
    return () => window.clearTimeout(id)
  }, [adjusted])

  /** One step from `from`. Returns the new value, or null at a bound. */
  const stepFrom = (from: number, direction: 1 | -1) => {
    const next = stepValue(from, direction, range)
    if (next === from) return null
    onChange(next)
    return next
  }

  const startHold = (e: PointerEvent<HTMLButtonElement>, direction: 1 | -1) => {
    if (e.button !== 0) return
    e.preventDefault() // keep focus where it is; no text selection or callout on long press
    stopHold()
    setDraft(null)
    const first = stepFrom(value, direction)
    if (first === null) return
    hold.current.value = first
    hold.current.timeout = window.setTimeout(() => {
      hold.current.interval = window.setInterval(() => {
        const next = stepFrom(hold.current.value, direction)
        if (next === null) stopHold()
        else hold.current.value = next
      }, HOLD_EVERY_MS)
    }, HOLD_DELAY_MS)
  }

  // Pointer presses step on pointerdown; keyboard activation (Enter/Space) arrives as a click with detail 0.
  const keyboardStep = (e: { detail: number }, direction: 1 | -1) => {
    if (e.detail === 0) stepFrom(value, direction)
  }

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false
      setDraft(null)
      return
    }
    if (draft === null) return
    const typed = draft.trim()
    const next = commitInput(typed, value, range)
    setDraft(null)
    if (next !== value) onChange(next)
    const asNumber = Number(typed.replace(',', '.'))
    setAdjusted(typed !== '' && Number.isFinite(asNumber) && asNumber !== next ? next : null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      cancelled.current = true
      e.currentTarget.blur()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      setDraft(null)
      stepFrom(value, e.key === 'ArrowUp' ? 1 : -1)
    }
  }

  const atMin = value <= range.min
  const atMax = value >= range.max

  return (
    <div className="stepper">
      <div className="stepper__controls">
        <button
          type="button"
          className="stepper__button"
          aria-label={decreaseLabel}
          disabled={atMin}
          onPointerDown={(e) => startHold(e, -1)}
          onClick={(e) => keyboardStep(e, -1)}
        >
          <Minus aria-hidden="true" strokeWidth={2.6} />
        </button>

        <label className="stepper__value">
          <input
            className="stepper__input"
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            role="spinbutton"
            aria-label={label}
            aria-valuemin={range.min}
            aria-valuemax={range.max}
            aria-valuenow={value}
            aria-valuetext={valueText(value)}
            aria-describedby={describedBy}
            value={draft ?? String(value)}
            onFocus={(e) => {
              setDraft(String(value))
              e.currentTarget.select()
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
          />
          <span className="stepper__unit" aria-hidden="true">
            {unit}
          </span>
        </label>

        <button
          type="button"
          className="stepper__button"
          aria-label={increaseLabel}
          disabled={atMax}
          onPointerDown={(e) => startHold(e, 1)}
          onClick={(e) => keyboardStep(e, 1)}
        >
          <Plus aria-hidden="true" strokeWidth={2.6} />
        </button>
      </div>

      <p className="stepper__note" role="status" aria-live="polite">
        {adjusted !== null ? `Adjusted to ${valueText(adjusted)}` : ''}
      </p>
    </div>
  )
}
