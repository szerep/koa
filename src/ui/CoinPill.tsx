import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { CoinGlyph } from './glyphs'
import './coin-pill.css'

interface CoinPillProps {
  coins: number
  /** Delay before counting up to a higher value, so flying coins can land first. */
  countUpDelayMs?: number
}

const format = new Intl.NumberFormat()

export function CoinPill({ coins, countUpDelayMs = 0 }: CoinPillProps) {
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState(coins)
  const [bump, setBump] = useState(0)
  const shownRef = useRef(coins)

  useEffect(() => {
    const from = shownRef.current
    if (coins === from) return
    // Spending: a quick, quiet count-down with no bump.
    if (coins < from && !reduceMotion) {
      const controls = animate(from, coins, {
        duration: 0.45,
        ease: 'easeOut',
        onUpdate: (v: number) => {
          shownRef.current = Math.round(v)
          setShown(Math.round(v))
        },
      })
      return () => controls.stop()
    }
    if (reduceMotion) {
      const id = window.setTimeout(() => {
        shownRef.current = coins
        setShown(coins)
      }, 0)
      return () => window.clearTimeout(id)
    }
    const bumpId = window.setTimeout(() => setBump((b) => b + 1), countUpDelayMs)
    const controls = animate(from, coins, {
      delay: countUpDelayMs / 1000,
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v: number) => {
        shownRef.current = Math.round(v)
        setShown(Math.round(v))
      },
    })
    return () => {
      window.clearTimeout(bumpId)
      controls.stop()
    }
  }, [coins, countUpDelayMs, reduceMotion])

  return (
    <div className="coin-pill" data-coin-target aria-label={`${format.format(coins)} coins`}>
      <CoinGlyph size={22} className={bump ? 'coin-pill__coin is-bumping' : 'coin-pill__coin'} key={bump} />
      <span className="coin-pill__value" aria-hidden="true">
        {format.format(shown)}
      </span>
    </div>
  )
}
