/** Koa's own small brand glyphs (not the mascot). Interface icons come from lucide-react. */

interface GlyphProps {
  size?: number
  className?: string
}

/** A single eucalyptus leaf, the brand mark from the wordmark. */
export function LeafGlyph({ size = 16, className }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M5 20C4 12 9 5 20 3c0 10-6 17-15 17Z" fill="currentColor" />
      <path
        d="M5.5 19.5C8 14 12 9.5 16.5 6.5"
        fill="none"
        stroke="var(--glyph-vein, var(--cream-50))"
        strokeOpacity={0.75}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** The Coin: a honey-colored round coin with a leaf stamp. */
export function CoinGlyph({ size = 20, className }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12.8" r="10" fill="var(--honey-700)" />
      <circle cx="12" cy="11.6" r="10" fill="var(--honey-500)" />
      <circle cx="12" cy="11.6" r="7.2" fill="none" stroke="var(--honey-300)" strokeWidth="1.3" />
      <path d="M9 15.2c-.4-3.4 1.7-6.2 6.2-6.9.1 4-2.4 6.8-6.2 6.9Z" fill="var(--honey-300)" />
    </svg>
  )
}

/** "Koa" wordmark with the leaf sprig, after the reference sheet's logo. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark${className ? ` ${className}` : ''}`}>
      Koa
      <LeafGlyph size={14} className="wordmark__leaf" />
    </span>
  )
}
