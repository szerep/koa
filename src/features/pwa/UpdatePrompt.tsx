import { useId, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { shouldOfferUpdate } from '../../core/pwa/update'
import { Button } from '../../ui/Button'
import { LeafGlyph } from '../../ui/glyphs'
import { timerStore } from '../timer/store'
import { updates } from './store'
import './update-prompt.css'

/**
 * "A new version of Koa is ready" (Phase 9, Step 4; decision D3). A small card under the top bar,
 * in the page flow so it never covers the timer controls. Never shown during a running focus
 * session: it appears once the session ends (or is paused). Update hands over to the new version
 * and reloads; Later hides it until the next launch.
 * It never takes focus by itself; the live region announces it once.
 */
export function UpdatePrompt() {
  const { state, dismissed } = useSyncExternalStore(updates.subscribe, updates.getState)
  const timer = useSyncExternalStore(timerStore.subscribe, timerStore.getState)
  const titleId = useId()
  const hintId = useId()
  const visible = state !== 'none' && !dismissed && shouldOfferUpdate(timer)
  const updating = state === 'updating'

  return (
    <div className="update-prompt-area" aria-live="polite">
      <AnimatePresence>
        {visible && (
          <motion.section
            key="update"
            className="update-prompt"
            aria-labelledby={titleId}
            aria-describedby={hintId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="update-prompt__mark" aria-hidden="true">
              <LeafGlyph size={18} />
            </span>
            <div className="update-prompt__text">
              <h2 id={titleId} className="update-prompt__title">
                Koa has an update
              </h2>
              <p id={hintId} className="update-prompt__hint">
                Koa reloads to update. Your progress stays.
              </p>
            </div>
            <div className="update-prompt__actions">
              <Button variant="ghost" onClick={() => updates.later()} disabled={updating}>
                Later
              </Button>
              <Button onClick={() => void updates.update()} disabled={updating}>
                {updating ? 'Updating…' : 'Update'}
              </Button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
