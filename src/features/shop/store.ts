import { catalog } from '../../config/catalog'
import { localStorageAdapter } from '../../storage/adapter'
import { walletStore } from '../rewards/store'
import { createWardrobeStore } from './wardrobeStore'

export const wardrobeStore = createWardrobeStore({
  storage: localStorageAdapter,
  catalog,
  getWallet: walletStore.getState,
})
