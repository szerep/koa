import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Check } from 'lucide-react'
import { catalog, slotLabels } from '../../config/catalog'
import { closetBySlot, isEquipped, wornItemIds, type ShopItem } from '../../core/shop/shop'
import { AccessoryThumb } from '../../features/koala/AccessoryThumb'
import { KoaCompanion } from '../../features/koala/KoaCompanion'
import { accessoryPreview, hasAccessoryArt } from '../../features/koala/manifest'
import { walletStore } from '../../features/rewards/store'
import { wardrobeStore } from '../../features/shop/store'
import { Button } from '../../ui/Button'
import { wardrobeNav } from '../navigation'
import { toggleWear } from '../toggleWear'
import './wardrobe.css'

/**
 * The Wardrobe (Phase 12): Koa, large and alive, and everything you own, grouped by where it goes
 * on Koa. Tap an item to put it on (Koa shows it off) or take it off. The Shop is where items are
 * bought; nothing here costs coins. Reached from Home and the Shop; Done goes back there.
 */
export function WardrobeScreen() {
  const wallet = useSyncExternalStore(walletStore.subscribe, walletStore.getState)
  const wardrobe = useSyncExternalStore(wardrobeStore.subscribe, wardrobeStore.getState)
  const [status, setStatus] = useState('')
  const title = useRef<HTMLHeadingElement>(null)

  const closet = closetBySlot(catalog, wallet)
  const waitingForArt = closet.some((group) => group.items.some((item) => !hasAccessoryArt(item.id)))

  // Opened from Home or the Shop: keyboard and screen reader users start at the heading.
  useEffect(() => {
    if (wardrobeNav.takeFocus('wardrobe')) title.current?.focus({ preventScroll: true })
  }, [])

  const toggle = (item: ShopItem) => {
    const result = toggleWear(item)
    if (result) setStatus(result.message)
  }

  return (
    <div className={`wardrobe${closet.length === 0 ? ' wardrobe--empty' : ''}`}>
      <div className="wardrobe__top">
        <header className="wardrobe__header">
          <h1 ref={title} id="wardrobe-title" className="wardrobe__title" tabIndex={-1}>
            Wardrobe
          </h1>
          <Button variant="secondary" className="wardrobe__done" onClick={wardrobeNav.close}>
            Done
          </Button>
        </header>
        <div className="wardrobe__stage">
          <KoaCompanion
            className="wardrobe__koala"
            width="calc(var(--wardrobe-stage) * 0.7)"
            figureSizes="(min-width: 960px) 280px, (min-width: 600px) 240px, 44vw"
            interactive
            speaks
            wearing={wornItemIds(wardrobe)}
          />
        </div>
      </div>

      {closet.length === 0 ? (
        <div className="wardrobe__empty">
          <p className="wardrobe__empty-title">Nothing to try on yet</p>
          <p className="wardrobe__empty-message">Things you buy in the Shop end up here, ready for Koa to wear.</p>
          <Button onClick={() => wardrobeNav.visit('shop')}>Visit the Shop</Button>
        </div>
      ) : (
        <div className="wardrobe__closet">
          <div className="wardrobe__intro">
            <p className="wardrobe__hint">Tap an item to put it on or take it off.</p>
            {/* Shown while you own any such item (not only while it's worn), so wearing one never
                pushes the tiles down under your finger. */}
            {waitingForArt && (
              <p className="wardrobe__art-note">
                Artwork for some items is still being made. Koa can wear them, but can't show them off yet.
              </p>
            )}
          </div>
          {closet.map(({ slot, items }) => (
            <section key={slot} className="closet-slot" aria-labelledby={`closet-slot-${slot}`}>
              <h2 id={`closet-slot-${slot}`} className="closet-slot__title">
                {slotLabels[slot]}
              </h2>
              <ul className="closet-slot__items">
                {items.map((item) => (
                  <li key={item.id}>
                    <ClosetTile item={item} worn={isEquipped(wardrobe, item)} onToggle={() => toggle(item)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  )
}

interface ClosetTileProps {
  item: ShopItem
  worn: boolean
  onToggle: () => void
}

/** One owned item: a toggle button showing the item's own artwork, or its swatch until that exists. */
function ClosetTile({ item, worn, onToggle }: ClosetTileProps) {
  const preview = accessoryPreview(item.id)
  const hasArt = hasAccessoryArt(item.id)
  const soonId = useId()

  return (
    <button
      type="button"
      className={`closet-tile${worn ? ' is-worn' : ''}`}
      aria-pressed={worn}
      // Named like the Shop's Wear buttons; the visible item name is part of it.
      aria-label={`${worn ? 'Wearing' : 'Wear'} the ${item.name.toLowerCase()}`}
      aria-describedby={hasArt ? undefined : soonId}
      onClick={(e) => {
        // Like the Shop: only the first click of a double-tap counts, so a double-tap can't put an
        // item on and take it straight off again (`detail` is 0 for keyboard activation).
        if (e.detail > 1) return
        onToggle()
      }}
    >
      {worn && (
        <span className="closet-tile__worn" aria-hidden="true">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
      <span className="closet-tile__art">
        {preview ? (
          <AccessoryThumb frame={preview.frame} box={preview.box} sizes="(min-width: 960px) 120px, (min-width: 600px) 100px, 22vw" />
        ) : (
          <span className="closet-tile__swatch" style={{ background: item.swatch }} aria-hidden="true" />
        )}
      </span>
      <span className="closet-tile__name">{item.name}</span>
      {!hasArt && (
        <span id={soonId} className="closet-tile__soon">
          Artwork coming soon
        </span>
      )}
    </button>
  )
}
