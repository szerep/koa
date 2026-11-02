import { koalaContextFor } from '../core/koala/context'
import type { CelebrationLevel } from '../core/koala/brain'
import type { Grant } from '../core/rewards/wallet'
import { timerConfigFrom } from '../core/settings/settings'
import { koalaStore } from '../features/koala/store'
import { walletStore } from '../features/rewards/store'
import { settingsStore } from '../features/settings/store'
import { wardrobeStore } from '../features/shop/store'
import { timerStore } from '../features/timer/store'
import { wakeLock } from '../features/wakeLock/store'
import { STORAGE_KEY } from '../storage/persistence'

let connected = false

/** Koa reacts to the biggest thing in a payout. */
function celebrationFor(grants: readonly Grant[]): CelebrationLevel {
  if (grants.some((g) => g.kind === 'dailyGoal')) return 'dailyGoal'
  if (grants.some((g) => g.kind === 'cycle')) return 'cycle'
  return 'session'
}

/** Greet shortly after launch, once the home screen has settled. */
const GREETING_DELAY_MS = 1200

/**
 * Wire features together once, before the first render, so a session that finished
 * while the app was closed is rewarded as soon as the timer catches up on launch.
 */
export function connectFeatures() {
  if (connected) return
  connected = true

  timerStore.onEvent((event) => {
    if (event.type === 'sessionCompleted') walletStore.award(event)
  })

  // Settings → timer. Also covers other tabs' changes (settingsStore.refresh below).
  // The timer store was created from the saved settings, so this only handles changes.
  settingsStore.subscribe(() => timerStore.setConfig(timerConfigFrom(settingsStore.getState())))

  // Keep screen on: the wake lock follows the timer and the setting on its own (it subscribes
  // to both and to page visibility). Check once here for a focus session restored on launch.
  wakeLock.update()

  // Koa: celebrate payouts, note finished breaks, follow the timer's context.
  // Registered after the wallet, so a finished focus session celebrates with its payout.
  walletStore.onGrant((grants) => koalaStore.celebrate(celebrationFor(grants)))
  timerStore.onEvent((event) => {
    if (event.type === 'sessionCompleted' && event.mode !== 'focus') koalaStore.breakOver()
  })
  timerStore.subscribe(() => {
    const timer = timerStore.getState()
    koalaStore.setContext(koalaContextFor(timer), { longBreak: timer.mode === 'longBreak' })
  })

  // Any input counts as presence (keeps Koa awake, or wakes a nap).
  const onInput = () => koalaStore.activity()
  window.addEventListener('pointerdown', onInput, { passive: true })
  window.addEventListener('keydown', onInput, { passive: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') koalaStore.tick()
  })
  window.setTimeout(() => koalaStore.greet(), GREETING_DELAY_MS)

  // Another tab saved: pick up its coins, purchases, outfit and settings.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    walletStore.refresh()
    wardrobeStore.refresh()
    settingsStore.refresh()
  })
}
