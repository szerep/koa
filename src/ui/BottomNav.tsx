import type { ComponentType, SVGProps } from 'react'
import { motion } from 'motion/react'
import './bottom-nav.css'

export interface NavItem<T extends string> {
  id: T
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>
}

interface BottomNavProps<T extends string> {
  items: readonly NavItem<T>[]
  current: T
  onSelect: (id: T) => void
}

/** Floating pill on phones; becomes a left rail on wide screens (pure CSS). */
export function BottomNav<T extends string>({ items, current, onSelect }: BottomNavProps<T>) {
  return (
    <nav className="nav" aria-label="Main">
      <ul className="nav__list">
        {items.map(({ id, label, icon: Icon }) => {
          const active = id === current
          return (
            <li key={id} className="nav__cell">
              <a
                href={`#/${id}`}
                className={`nav__item${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  onSelect(id)
                }}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="nav__active"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon className="nav__icon" size={22} strokeWidth={active ? 2.3 : 2} aria-hidden="true" />
                <span className="nav__label">{label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
