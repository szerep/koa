import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { present } from '../../core/koala/brain'
import { Koala } from './Koala'
import { koalaStore } from './store'
import './koa-companion.css'

interface KoaCompanionProps {
  width: string
  figureSizes: string
  wearing: readonly string[]
  /** Show speech bubbles and sleep glyphs. */
  speaks?: boolean
  /** Tap to interact. */
  interactive?: boolean
  className?: string
}

/** Koa with a personality: renders what the koala brain is doing (src/core/koala/). */
export function KoaCompanion({ width, figureSizes, wearing, speaks = false, interactive = false, className }: KoaCompanionProps) {
  const state = useSyncExternalStore(koalaStore.subscribe, koalaStore.getState)
  const view = present(state)

  return (
    <Koala
      className={className}
      width={width}
      figureSizes={figureSizes}
      wearing={wearing}
      motion={view.motion}
      eyesClosed={view.eyesClosed}
      tempo={view.tempo}
      onTap={interactive ? koalaStore.tap : undefined}
    >
      {speaks && (
        <>
          <div className="koa-bubble-anchor" aria-live="polite">
            <AnimatePresence>
              {view.bubble && (
                <motion.p
                  key={view.bubble.seq}
                  className="koa-bubble"
                  initial={{ opacity: 0, scale: 0.85, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -2 }}
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 26,
                    delay: view.bubble.delay / 1000,
                    opacity: { duration: 0.18, delay: view.bubble.delay / 1000 },
                  }}
                >
                  {view.bubble.text}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          {view.eyesClosed && (
            <div className="koa-nap" aria-hidden="true">
              <span>z</span>
              <span>z</span>
              <span>z</span>
            </div>
          )}
        </>
      )}
    </Koala>
  )
}
