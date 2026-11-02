import { catalog } from '../../config/catalog'
import { koalaContextFor } from '../../core/koala/context'
import { canAffordAnything } from '../../core/shop/shop'
import { walletStore } from '../rewards/store'
import { timerStore } from '../timer/store'
import { createKoalaStore } from './koalaStore'

/** The app's Koa. Wired to the timer, wallet and shop in src/app/connect.ts. */
export const koalaStore = createKoalaStore({
  context: koalaContextFor(timerStore.getState()),
  getTickInput: () => ({ canAffordSomething: canAffordAnything(walletStore.getState(), catalog) }),
})
