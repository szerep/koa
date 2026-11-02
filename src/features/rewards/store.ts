import { rewardRules } from '../../config/rewards'
import { localStorageAdapter } from '../../storage/adapter'
import { settingsStore } from '../settings/store'
import { createWalletStore } from './walletStore'

/** The app's wallet. The daily goal comes from Settings, read whenever a session is paid. */
export const walletStore = createWalletStore({
  rules: rewardRules,
  dailyGoalMinutes: () => settingsStore.getState().dailyGoalMinutes,
  storage: localStorageAdapter,
})
