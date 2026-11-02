import type { ReactNode } from 'react'
import './progress-ring.css'

interface ProgressRingProps {
  /** 0..1 */
  progress: number
  /** Stroke width as a fraction of the diameter. */
  thickness?: number
  label: string
  children?: ReactNode
  className?: string
}

const VIEW = 200

/**
 * Circular progress drawn as a halo. Sized by CSS (it fills its box), so it scales
 * with the stage. A small leaf rides on the end of the progress arc.
 */
export function ProgressRing({ progress, thickness = 0.055, label, children, className }: ProgressRingProps) {
  const p = Math.min(1, Math.max(0, progress))
  const stroke = VIEW * thickness
  const r = VIEW / 2 - stroke / 2 - 4
  const c = 2 * Math.PI * r
  const angle = p * 360

  return (
    <div
      className={`ring${className ? ` ${className}` : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
    >
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="ring__svg" aria-hidden="true">
        <circle className="ring__glow" cx={VIEW / 2} cy={VIEW / 2} r={r - stroke / 2} />
        <circle className="ring__track" cx={VIEW / 2} cy={VIEW / 2} r={r} strokeWidth={stroke} />
        <circle
          className="ring__fill"
          cx={VIEW / 2}
          cy={VIEW / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${VIEW / 2} ${VIEW / 2})`}
          opacity={p > 0 ? 1 : 0}
        />
        {/* Leaf end-cap rides at the head of the arc. */}
        <g transform={`rotate(${angle} ${VIEW / 2} ${VIEW / 2}) translate(${VIEW / 2} ${VIEW / 2 - r})`}>
          <circle r={stroke * 0.62} className="ring__cap" />
          <path
            className="ring__leaf"
            d="M-4.6 3.4C-5 -1 -1.8 -4.4 4.8 -4.8 4.6 0.6 1.4 3.8 -4.6 3.4Z"
            transform={`scale(${stroke / 12})`}
          />
        </g>
      </svg>
      <div className="ring__content">{children}</div>
    </div>
  )
}
