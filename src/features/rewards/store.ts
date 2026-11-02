import { rewardRules } from '../../config/rewards'
import { localStorageAdapter } from '../../storage/adapter'
import { createWalletStore } from './walletStore'

export const walletStore = createWalletStore({ rules: rewardRules, storage: localStorageAdapter })
