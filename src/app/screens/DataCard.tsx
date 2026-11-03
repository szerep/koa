import { useEffect, useId, useRef, useSyncExternalStore } from 'react'
import type { ProgressSummary } from '../../core/data/data'
import { progressData } from '../../features/data/store'
import type { ExportStatus, ResetStatus } from '../../features/data/progressData'
import { formatDuration, sessionCount } from '../../features/stats/format'
import { Button } from '../../ui/Button'

const coins = (n: number) => `${n} ${n === 1 ? 'coin' : 'coins'}`
const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`

function exportMessage(status: ExportStatus): string {
  switch (status.kind) {
    case 'idle':
      return 'Download everything Koa keeps on this device as a JSON file.'
    case 'exported':
      return `Your download should start now: ${status.fileName}.`
    case 'failed':
      return "Koa couldn't create the file. Check that downloads are allowed for this site, then try again."
  }
}

function resetMessage(status: ResetStatus): string {
  switch (status.kind) {
    case 'done':
      return 'Progress reset. Your settings are just as they were, and a backup was saved on this device.'
    case 'backupFailed':
      return "Koa couldn't save a backup on this device, so nothing was deleted. Private browsing or full storage can cause this."
    case 'saveFailed':
      return "Koa couldn't save the reset, so nothing was deleted. Private browsing or full storage can cause this."
    default:
      return 'Start over with 0 coins. Your settings stay as they are.'
  }
}

/** Export and Reset progress (Phase 8, Step 11). */
export function DataCard() {
  const state = useSyncExternalStore(progressData.subscribe, progressData.getState)
  const exportHintId = useId()
  const resetLabelId = useId()
  const resetHintId = useId()
  const resetButton = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  const confirming = state.reset.kind === 'confirming'

  // Leaving the screen clears old result messages.
  useEffect(() => () => progressData.dismiss(), [])

  // Back from the confirmation: focus returns to the button that opened it.
  useEffect(() => {
    if (wasConfirming.current && !confirming) resetButton.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  const resetFailed = state.reset.kind === 'backupFailed' || state.reset.kind === 'saveFailed'

  return (
    <section className="settings-card" aria-labelledby="settings-data">
      <h2 id="settings-data" className="settings-card__title">
        Your data
      </h2>

      <div className="settings-row">
        <div className="settings-row__main">
          <div className="settings-row__text">
            <span className="settings-row__label">Export data</span>
            <span
              id={exportHintId}
              className={`settings-row__hint${state.export.kind === 'failed' ? ' settings-row__hint--alert' : ''}`}
              aria-live="polite"
            >
              {exportMessage(state.export)}
            </span>
          </div>
          <Button variant="secondary" className="data__action" onClick={progressData.exportData} aria-describedby={exportHintId}>
            Export
          </Button>
        </div>
      </div>

      <div className="settings-row">
        {state.reset.kind === 'confirming' ? (
          <ResetConfirm summary={state.reset.summary} />
        ) : (
          <div className="settings-row__main">
            <div className="settings-row__text">
              <span id={resetLabelId} className="settings-row__label">
                Reset progress
              </span>
              <span
                id={resetHintId}
                className={`settings-row__hint${resetFailed ? ' settings-row__hint--alert' : ''}`}
                aria-live="polite"
              >
                {resetMessage(state.reset)}
              </span>
            </div>
            <Button
              ref={resetButton}
              variant="secondary"
              className="data__action data__action--reset"
              onClick={progressData.requestReset}
              aria-describedby={resetHintId}
            >
              Reset…
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

/** What will be deleted, from the user's actual data. */
function deletedLines(s: ProgressSummary): string[] {
  const lines = [`Your coins: ${coins(s.balance)} to spend, ${coins(s.totalEarned)} earned in total`]
  lines.push(
    s.itemsOwned > 0
      ? `${items(s.itemsOwned)} you bought in the shop${s.itemsWorn > 0 ? ", and Koa's outfit" : ''}`
      : 'Anything you buy in the shop, and the outfit',
  )
  lines.push(
    s.focusSessions > 0
      ? `Your stats: ${sessionCount(s.focusSessions)}, ${formatDuration(Math.round(s.focusMinutes))} of focus, streaks and goal days`
      : 'Your stats and streaks',
  )
  lines.push(
    s.sessionInProgress
      ? 'The session in progress (it stops without earning coins) and your cycle so far'
      : s.cycleSessions > 0
        ? `Your cycle so far (${sessionCount(s.cycleSessions)} toward a long break)`
        : 'The timer and your cycle so far',
  )
  return lines
}

function ResetConfirm({ summary }: { summary: ProgressSummary }) {
  const keepRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  useEffect(() => keepRef.current?.focus(), [])

  return (
    <div
      className="reset-confirm"
      role="group"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === 'Escape') progressData.cancelReset()
      }}
    >
      <p id={titleId} className="reset-confirm__title">
        Reset your progress?
      </p>
      <p className="reset-confirm__lead">This deletes the following from Koa, and you can't undo it here:</p>
      <ul className="reset-confirm__list reset-confirm__list--deleted">
        {deletedLines(summary).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="reset-confirm__lead">These stay as they are:</p>
      <ul className="reset-confirm__list reset-confirm__list--kept">
        <li>All your settings: timer lengths, long break, daily goal, screen, notification and sound choices</li>
        <li>Your browser's permission for notifications</li>
      </ul>
      <p className="reset-confirm__note">
        Koa saves a backup on this device first. To keep your own copy, export your data before you reset.
      </p>
      <div className="reset-confirm__actions">
        <Button ref={keepRef} variant="secondary" onClick={progressData.cancelReset}>
          Keep my progress
        </Button>
        <Button variant="secondary" className="reset-confirm__delete" onClick={progressData.confirmReset}>
          Reset progress
        </Button>
      </div>
    </div>
  )
}
