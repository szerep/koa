import { Share } from 'lucide-react'
import { useId, useSyncExternalStore, type Ref } from 'react'
import type { InstallBrowser } from '../../core/pwa/install'
import { install } from '../../features/pwa/store'
import { Button } from '../../ui/Button'

/** Where a browser keeps its install command (the `menu` state). */
const menuSteps: Record<InstallBrowser, string> = {
  'chromium-desktop': "Use the install icon in the address bar, or choose Install Koa in your browser's menu.",
  'chromium-android': "Open your browser's menu and choose Add to Home screen or Install app.",
  'firefox-android': "Open Firefox's menu and choose Add to Home screen.",
  'safari-mac': 'In Safari, choose File, then Add to Dock (macOS Sonoma or later).',
  // Never shown: these get `ios-steps` or `hidden`.
  'apple-mobile': '',
  other: '',
}

const benefit = 'Koa opens in its own window and works offline.'

/**
 * Install Koa (Phase 9, Step 6; decision D8). A quiet card in Settings, hidden when Koa already
 * runs as an installed app or can't be installed here. The install prompt opens only from the
 * Install button. `headingRef` lets the notifications row bring this card into view.
 */
export function InstallCard({ headingRef }: { headingRef?: Ref<HTMLHeadingElement> }) {
  const { help, prompting } = useSyncExternalStore(install.subscribe, install.getState)
  const titleId = useId()
  const hintId = useId()
  if (help === 'installed' || help === 'hidden') return null

  return (
    <section className="settings-card" aria-labelledby={titleId}>
      <h2 id={titleId} ref={headingRef} tabIndex={-1} className="settings-card__title">
        Install Koa
      </h2>

      {help === 'ios-steps' ? (
        <div className="settings-row">
          <p className="settings-row__label">Add Koa to your Home Screen</p>
          <ol className="install-steps">
            <li>
              Tap <Share className="install-steps__icon" size={16} strokeWidth={2.2} aria-hidden="true" />
              <strong>Share</strong> in the toolbar (on iOS 26, tap <strong>•••</strong> first).
            </li>
            <li>
              Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
            </li>
          </ol>
          <p className="settings-row__hint">
            Koa then opens full screen and works offline. The Home Screen app keeps its own coins and progress, separate from Safari's, so it may start
            fresh.
          </p>
        </div>
      ) : (
        <div className="settings-row">
          <div className="settings-row__main">
            <div className="settings-row__text">
              <span className="settings-row__label">
                {help === 'accepted' ? 'Koa is installed' : 'Add Koa to this device'}
              </span>
              <span id={hintId} className="settings-row__hint" aria-live="polite">
                {help === 'accepted'
                  ? 'Open it from your home screen or app list.'
                  : help === 'prompt-available'
                    ? benefit
                    : `${benefit} ${menuSteps[install.browser]}`}
              </span>
            </div>
            {help === 'prompt-available' && (
              <Button
                variant="secondary"
                className="install__action"
                // The only place the browser's install prompt is opened: this tap.
                onClick={() => void install.install()}
                disabled={prompting}
                aria-describedby={hintId}
              >
                Install
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
