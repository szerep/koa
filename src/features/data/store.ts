import { koalaContextFor } from '../../core/koala/context'
import { localStorageAdapter } from '../../storage/adapter'
import { koalaStore } from '../koala/store'
import { walletStore } from '../rewards/store'
import { settingsStore } from '../settings/store'
import { wardrobeStore } from '../shop/store'
import { sounds } from '../sounds/store'
import { timerStore } from '../timer/store'
import { wakeLock } from '../wakeLock/store'
import { browserDisplayModeEnv, isStandalone } from '../pwa/displayMode'
import { browserDownload, browserFileShare, createProgressData } from './progressData'

/**
 * After Reset progress (in this tab or another): every store re-reads the save, so nothing from
 * before can stay active. The timer drops its session without events (no payout, notification
 * or chime), the wake lock follows the now idle timer, and Koa forgets pending celebrations.
 * Settings and the notification permission are left alone.
 */
export function reloadProgress() {
  timerStore.reload()
  walletStore.refresh()
  wardrobeStore.refresh() // after the wallet: ownership comes from it
  sounds.cancelPending()
  wakeLock.update()
  koalaStore.reset(koalaContextFor(timerStore.getState()))
}

export const progressData = createProgressData({
  storage: localStorageAdapter,
  snapshot: () => ({
    timer: timerStore.getState(),
    wallet: walletStore.getState(),
    wardrobe: wardrobeStore.getState(),
    settings: settingsStore.getState(),
  }),
  reload: reloadProgress,
  download: browserDownload,
  share: browserFileShare(() => isStandalone(browserDisplayModeEnv())),
})
