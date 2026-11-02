import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { Grant } from '../../core/rewards/wallet'
import { CoinGlyph } from '../../ui/glyphs'
import { walletStore } from './store'
import './reward-layer.css'

interface Point {
  x: number
  y: number
}

interface Burst {
  id: number
  origin: Point
  target: Point | null
  coins: number
  labels: { key: string; text: string; bonus: boolean }[]
}

const LIFETIME_MS = 2600

const labelFor = (g: Grant) => {
  if (g.kind === 'cycle') return `+${g.amount} Cycle bonus`
  if (g.kind === 'dailyGoal') return `+${g.amount} Daily goal`
  return `+${g.amount}`
}

function centerOf(el: Element | null, yFraction = 0.5): Point | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { x: r.left + r.width / 2, y: r.top + r.height * yFraction }
}

/** A short, cheerful moment whenever coins are earned: coins fly to the coin pill. */
export function RewardLayer() {
  const reduceMotion = useReducedMotion()
  const [bursts, setBursts] = useState<Burst[]>([])
  const [announcement, setAnnouncement] = useState('')
  const nextId = useRef(0)

  useEffect(
    () =>
      walletStore.onGrant((grants) => {
        const id = ++nextId.current
        const origin = centerOf(document.querySelector('[data-reward-origin]'), 0.42) ?? {
          x: window.innerWidth / 2,
          y: window.innerHeight * 0.45,
        }
        const target = centerOf(document.querySelector('[data-coin-target]'))
        const total = grants.reduce((sum, g) => sum + g.amount, 0)
        setBursts((list) => [
          ...list,
          {
            id,
            origin,
            target,
            coins: Math.min(9, 4 + grants.length * 2),
            labels: grants.map((g) => ({ key: g.key, text: labelFor(g), bonus: g.kind !== 'focus' })),
          },
        ])
        setAnnouncement(`You earned ${total} coins.`)
        window.setTimeout(() => setBursts((list) => list.filter((b) => b.id !== id)), LIFETIME_MS)
      }),
    [],
  )

  return (
    <>
      <div className="reward-layer" aria-hidden="true">
        {bursts.map((burst) => (
          <div key={burst.id}>
            {!reduceMotion &&
              burst.target &&
              Array.from({ length: burst.coins }, (_, i) => {
                const spread = (i - (burst.coins - 1) / 2) * 18
                const from = { x: burst.origin.x + spread, y: burst.origin.y + Math.abs(spread) * 0.3 }
                const to = burst.target!
                const lift = Math.max(16, Math.min(from.y, to.y) - 70 - (i % 3) * 18) // stay on screen
                return (
                  <motion.div
                    key={i}
                    className="reward-layer__coin"
                    initial={{ x: from.x, y: from.y, scale: 0.4, opacity: 0 }}
                    animate={{
                      x: [from.x, from.x + spread * 1.6, to.x],
                      y: [from.y, lift, to.y],
                      scale: [0.4, 1.1, 0.6],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{ duration: 0.9, delay: 0.15 + i * 0.05, ease: [0.45, 0, 0.2, 1] }}
                  >
                    <CoinGlyph size={22} />
                  </motion.div>
                )
              })}
            <div
              className="reward-layer__labels"
              style={{ left: burst.origin.x, top: burst.origin.y - 40 }}
            >
              {burst.labels.map((label, i) => (
                <motion.div
                  key={label.key}
                  className={`reward-layer__label${label.bonus ? ' is-bonus' : ''}`}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={
                    reduceMotion
                      ? { opacity: [0, 1, 1, 0] }
                      : { opacity: [0, 1, 1, 0], y: [10, -18, -30, -44], scale: [0.9, 1, 1, 1] }
                  }
                  transition={{ duration: 2.1, delay: 0.1 + i * 0.35, times: [0, 0.15, 0.75, 1] }}
                >
                  {!label.bonus && <CoinGlyph size={18} />}
                  {label.text}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </>
  )
}
