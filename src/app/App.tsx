import { ChartNoAxesColumn, House, Settings, ShoppingBag } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { UpdatePrompt } from '../features/pwa/UpdatePrompt'
import { RewardLayer } from '../features/rewards/RewardLayer'
import { walletStore } from '../features/rewards/store'
import { BottomNav, type NavItem } from '../ui/BottomNav'
import { CoinPill } from '../ui/CoinPill'
import { Wordmark } from '../ui/glyphs'
import { HomeScreen } from './screens/HomeScreen'
import { StatsScreen } from './screens/StatsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { ShopScreen } from './screens/ShopScreen'
import { pageTitle } from './pageTitle'
import { useHashTab } from './useHashTab'
import { useTimerAmbience } from './useTimerAmbience'
import './app.css'

type Tab = 'home' | 'shop' | 'stats' | 'settings'

const TABS = ['home', 'shop', 'stats', 'settings'] as const satisfies readonly Tab[]

const navItems: readonly NavItem<Tab>[] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
  { id: 'stats', label: 'Stats', icon: ChartNoAxesColumn },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const screens: Record<Tab, () => React.JSX.Element> = {
  home: HomeScreen,
  shop: ShopScreen,
  stats: StatsScreen,
  settings: SettingsScreen,
}

export default function App() {
  const [tab, setTab] = useHashTab(TABS, 'home')
  const Screen = screens[tab]
  const { focusRunning, announcement } = useTimerAmbience()
  const wallet = useSyncExternalStore(walletStore.subscribe, walletStore.getState)

  // Each tab is its own history entry, so it gets its own title ("Shop · Koa"); Home stays "Koa".
  useEffect(() => {
    document.title = pageTitle(tab, navItems)
  }, [tab])

  return (
    <MotionConfig reducedMotion="user">
      <div className="app" data-focus-running={focusRunning || undefined}>
        <header className="app__bar">
          <Wordmark />
          <CoinPill coins={wallet.balance} countUpDelayMs={900} />
        </header>

        <UpdatePrompt />

        <main className="app__main">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              className="app__screen"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              // A shorter exit: with mode="wait" the new screen only starts after it, so a tab tap
              // took 400 ms to settle; now about 320 ms.
              exit={{ opacity: 0, y: -4, transition: { duration: 0.12, ease: [0.22, 1, 0.36, 1] } }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Screen />
            </motion.div>
          </AnimatePresence>
        </main>

        <BottomNav items={navItems} current={tab} onSelect={setTab} />

        <p className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </p>

        <RewardLayer />
      </div>
    </MotionConfig>
  )
}
