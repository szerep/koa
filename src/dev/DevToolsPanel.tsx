import { useState, useSyncExternalStore } from 'react'
import { catalog } from '../config/catalog'
import { isOwned, wornItemIds } from '../core/shop/shop'
import { walletStore } from '../features/rewards/store'
import { wardrobeStore } from '../features/shop/store'
import { coinText } from '../ui/coinText'
import { DEV_COINS, DEV_TOOLS_MARKER, type DevTools } from './devTools'
import './dev-tools.css'

/**
 * The Dev Tools panel (local development only, see devTools.ts): a small "Dev" pill at the top of
 * the screen that opens a few seeding and reset actions. It reads the real stores, so the line at
 * the top always matches what the app shows.
 */
export function DevToolsPanel({ tools }: { tools: DevTools }) {
  const [open, setOpen] = useState(false)
  const wallet = useSyncExternalStore(walletStore.subscribe, walletStore.getState)
  const wardrobe = useSyncExternalStore(wardrobeStore.subscribe, wardrobeStore.getState)
  const owned = catalog.filter((item) => isOwned(wallet, item.id)).length
  const actions: [string, () => void][] = [
    [`Give ${new Intl.NumberFormat('en-US').format(DEV_COINS)} coins`, tools.giveCoins],
    ['Unlock all items', tools.unlockAll],
    ['Equip all', tools.equipAll],
    ['Reset wardrobe (take everything off)', tools.resetWardrobe],
    ['Reset wallet (coins, purchases, Stats)', tools.resetWallet],
  ]

  return (
    <div className="dev-tools" data-koa-dev-tools={DEV_TOOLS_MARKER}>
      <button type="button" className="dev-tools__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        Dev tools
      </button>
      {open && (
        <div className="dev-tools__panel" role="group" aria-label="Dev tools">
          <p className="dev-tools__state">
            {coinText(wallet.balance)} · {owned} of {catalog.length} items owned · wearing {wornItemIds(wardrobe).length}
          </p>
          {actions.map(([label, run]) => (
            <button key={label} type="button" className="dev-tools__action" onClick={run}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
