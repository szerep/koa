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
import { WardrobeScreen } from './screens/WardrobeScreen'
import { isTab, ROUTES, wardrobeNav, type Route, type Tab } from './navigation'
import { pageTitle } from './pageTitle'
import { useHashTab } from './useHashTab'
import { useTimerAmbience } from './useTimerAmbience'
import './app.css'

const navItems: readonly NavItem<Tab>[] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
  { id: 'stats', label: 'Stats', icon: ChartNoAxesColumn },
  { id: 'settings', label: 'Settings', icon: Settings },
]

/** Every route's title; the Wardrobe isn't in the nav (it opens from Home and the Shop). */
const routeTitles: readonly { id: Route; label: string }[] = [...navItems, { id: 'wardrobe', label: 'Wardrobe' }]

const screens: Record<Route, () => React.JSX.Element> = {
  home: HomeScreen,
  shop: ShopScreen,
  stats: StatsScreen,
  settings: SettingsScreen,
  wardrobe: WardrobeScreen,
}

export default function App() {
  const [route, setRoute] = useHashTab(ROUTES, 'home')
  const Screen = screens[route]
  const { focusRunning, announcement, countdown } = useTimerAmbience()
  const wallet = useSyncExternalStore(walletStore.subscribe, walletStore.getState)

  // Each tab is its own history entry, so it gets its own title ("Shop · Koa"); Home stays "Koa".
  // A running session shows its countdown instead. One effect owns the title, so the tab's title
  // comes back when a session ends or pauses.
  const title = pageTitle(route, routeTitles, countdown)
  useEffect(() => {
    document.title = title
  }, [title])

  // The Wardrobe's Done and keyboard focus depend on how it was reached (navigation.ts).
  useEffect(() => {
    wardrobeNav.arrived(route)
  }, [route])

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
              key={route}
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

        {/* No tab is current on the Wardrobe: it isn't one of them (Home isn't highlighted either). */}
        <BottomNav items={navItems} current={isTab(route) ? route : null} onSelect={setRoute} />

        <p className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </p>

        <RewardLayer />
      </div>
    </MotionConfig>
  )
}
