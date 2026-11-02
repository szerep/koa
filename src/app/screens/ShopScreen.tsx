import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Check, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { categories, catalog, itemById } from '../../config/catalog'
import {
  isEquipped,
  isOwned,
  shortfall,
  SLOTS,
  type ItemCategory,
  type ShopItem,
} from '../../core/shop/shop'
import { Koala } from '../../features/koala/Koala'
import { hasAccessoryArt } from '../../features/koala/manifest'
import { walletStore } from '../../features/rewards/store'
import { wardrobeStore } from '../../features/shop/store'
import { Button } from '../../ui/Button'
import { CoinGlyph } from '../../ui/glyphs'
import { SegmentedControl } from '../../ui/SegmentedControl'
import './shop.css'

const CONFIRM_MS = 3500

export function ShopScreen() {
  const wallet = useSyncExternalStore(walletStore.subscribe, walletStore.getState)
  const wardrobe = useSyncExternalStore(wardrobeStore.subscribe, wardrobeStore.getState)
  const [category, setCategory] = useState<ItemCategory>('hats')
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const [hop, setHop] = useState(0)
  const noticeId = useRef(0)

  const wearing = SLOTS.flatMap((slot) => {
    const id = wardrobe[slot]
    const item = id ? itemById(id) : undefined
    return item ? [item] : []
  })
  const wearingWithoutArt = wearing.filter((item) => !hasAccessoryArt(item.id))
  const items = catalog.filter((item) => item.category === category)

  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), 2800)
    return () => window.clearTimeout(id)
  }, [notice])

  const say = (text: string) => setNotice({ id: ++noticeId.current, text })

  const buy = (item: ShopItem) => {
    const result = walletStore.purchase(item)
    if (result.ok) {
      wardrobeStore.equip(item) // put it on right away; easy to take off again
      setHop((h) => h + 1)
      say(`${item.name} is yours. Koa is wearing it now.`)
    } else if (result.reason === 'insufficientFunds') {
      say(`You need ${shortfall(result.wallet, item)} more coins for the ${item.name.toLowerCase()}.`)
    } else if (result.reason === 'alreadySpent') {
      say(`You already own the ${item.name.toLowerCase()}.`)
    }
  }

  const toggleWear = (item: ShopItem) => {
    if (isEquipped(wardrobe, item)) {
      wardrobeStore.unequip(item.slot)
      say(`Took off the ${item.name.toLowerCase()}.`)
    } else if (wardrobeStore.equip(item).ok) {
      setHop((h) => h + 1)
      say(`Koa is wearing the ${item.name.toLowerCase()}.`)
    }
  }

  return (
    <div className="shop">
      <section className="shop__preview" aria-labelledby="shop-title">
        <div className="shop__koala">
          <Koala width="clamp(120px, 34vw, 190px)" figureSizes="(min-width: 960px) 190px, 34vw" hop={hop} wearing={wearing.map((i) => i.id)} />
        </div>
        <div className="shop__outfit">
          <h1 id="shop-title" className="shop__title">
            Shop
          </h1>
          {wearing.length === 0 ? (
            <p className="shop__hint">Koa isn't wearing anything special yet. Pick something cozy below.</p>
          ) : (
            <ul className="shop__wearing" aria-label="Koa is wearing">
              {wearing.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="wearing-chip"
                    onClick={() => toggleWear(item)}
                    aria-label={`Take off the ${item.name.toLowerCase()}`}
                  >
                    <span className="wearing-chip__swatch" style={{ background: item.swatch }} aria-hidden="true" />
                    {item.name}
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {wearingWithoutArt.length > 0 && (
            <p className="shop__art-note">
              Accessory artwork is still being made, so Koa can't show {wearing.length > 1 ? 'these' : 'this'} off
              yet. Your outfit is saved.
            </p>
          )}
        </div>
      </section>

      <SegmentedControl
        className="shop__tabs"
        label="Item category"
        options={categories.map((c) => ({ value: c.id, label: c.label }))}
        value={category}
        onChange={setCategory}
      />

      <ul className="shop__grid" aria-label={`${categories.find((c) => c.id === category)?.label} for Koa`}>
        {items.map((item) => (
          <li key={item.id}>
            <ItemCard
              item={item}
              owned={isOwned(wallet, item.id)}
              equipped={isEquipped(wardrobe, item)}
              missing={shortfall(wallet, item)}
              onBuy={() => buy(item)}
              onToggleWear={() => toggleWear(item)}
            />
          </li>
        ))}
      </ul>

      <div className="shop__toast-area" role="status" aria-live="polite">
        <AnimatePresence>
          {notice && (
            <motion.p
              key={notice.id}
              className="shop__toast"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              {notice.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

interface ItemCardProps {
  item: ShopItem
  owned: boolean
  equipped: boolean
  missing: number
  onBuy: () => void
  onToggleWear: () => void
}

function ItemCard({ item, owned, equipped, missing, onBuy, onToggleWear }: ItemCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [justBought, setJustBought] = useState(0)

  useEffect(() => {
    if (!confirming) return
    const id = window.setTimeout(() => setConfirming(false), CONFIRM_MS)
    return () => window.clearTimeout(id)
  }, [confirming])

  let action
  if (owned) {
    action = (
      <Button
        variant={equipped ? 'primary' : 'secondary'}
        className="item-card__action"
        icon={equipped ? <Check /> : undefined}
        aria-pressed={equipped}
        onClick={onToggleWear}
      >
        {equipped ? 'Wearing' : 'Wear'}
      </Button>
    )
  } else if (missing > 0) {
    action = (
      <div className="item-card__locked">
        <span className="item-card__price">
          <CoinGlyph size={18} />
          {item.price}
        </span>
        <span className="item-card__need">{missing} to go</span>
      </div>
    )
  } else if (confirming) {
    action = (
      <Button
        className="item-card__action item-card__action--confirm"
        onClick={() => {
          setConfirming(false)
          setJustBought((n) => n + 1)
          onBuy()
        }}
      >
        Buy for {item.price}?
      </Button>
    )
  } else {
    action = (
      <Button
        variant="secondary"
        className="item-card__action"
        icon={<CoinGlyph size={18} />}
        onClick={() => setConfirming(true)}
        aria-label={`Buy ${item.name} for ${item.price} coins`}
      >
        {item.price}
      </Button>
    )
  }

  return (
    <motion.article
      key={justBought}
      className={`item-card${equipped ? ' is-equipped' : ''}`}
      initial={justBought ? { scale: 0.96 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
    >
      <div className="item-card__art">
        <span className="item-card__swatch" style={{ background: item.swatch }} aria-hidden="true" />
        {!hasAccessoryArt(item.id) && <span className="item-card__art-status">Artwork coming soon</span>}
        {owned && <span className="item-card__owned">Owned</span>}
      </div>
      <h2 className="item-card__name">{item.name}</h2>
      <p className="item-card__desc">{item.description}</p>
      {action}
    </motion.article>
  )
}
