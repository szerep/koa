import './switch.css'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name (usually the visible label's id via `labelledBy`). */
  labelledBy: string
  describedBy?: string
  disabled?: boolean
}

/** An on/off switch: a 52×32 pill, 44pt tall hit area. */
export function Switch({ checked, onChange, labelledBy, describedBy, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
    </button>
  )
}
