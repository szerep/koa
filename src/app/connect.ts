import { walletStore } from '../features/rewards/store'
import { wardrobeStore } from '../features/shop/store'
import { timerStore } from '../features/timer/store'
import { STORAGE_KEY } from '../storage/persistence'

let connected = false

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

  // Another tab saved: pick up its coins, purchases and outfit.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    walletStore.refresh()
    wardrobeStore.refresh()
  })
}
