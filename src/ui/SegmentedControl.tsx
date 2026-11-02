import { useId } from 'react'
import { motion } from 'motion/react'
import './segmented.css'

interface Option<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  label: string
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
  /** Locks the choice (e.g. while a session is in progress). */
  disabled?: boolean
  className?: string
}

/** Pill-shaped single choice with a sliding selection. Uses radio semantics. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const id = useId()

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={`segmented${className ? ` ${className}` : ''}`}
      onKeyDown={(e) => {
        if (disabled || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return
        e.preventDefault()
        const i = options.findIndex((o) => o.value === value)
        const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length
        onChange(options[next].value)
        const el = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]
        el?.focus()
      }}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled && !selected}
            className={`segmented__option${selected ? ' is-selected' : ''}`}
            onClick={() => {
              if (!disabled) onChange(option.value)
            }}
          >
            {selected && (
              <motion.span
                layoutId={`${id}-thumb`}
                className="segmented__thumb"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            <span className="segmented__label">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
