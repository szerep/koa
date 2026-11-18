import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { catalog } from '../config/catalog'
import { walletStore } from '../features/rewards/store'
import { wardrobeStore } from '../features/shop/store'
import { localStorageAdapter } from '../storage/adapter'
import { createDevTools } from './devTools'
import { DevToolsPanel } from './DevToolsPanel'

/**
 * Mounts the Dev Tools in their own root, outside the app. Only `main.tsx` calls this, and only
 * inside `if (import.meta.env.DEV)`, so production builds never include this module.
 */
export function mountDevTools() {
  const host = document.createElement('div')
  document.body.append(host)
  const tools = createDevTools({ storage: localStorageAdapter, catalog, wallet: walletStore, wardrobe: wardrobeStore })
  createRoot(host).render(
    <StrictMode>
      <DevToolsPanel tools={tools} />
    </StrictMode>,
  )
}
