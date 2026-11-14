import { createPortal } from 'react-dom'
import { MarketIcon, StoreIcon } from './SegmentIcons.jsx'

const LeaderboardIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="3" y="10" width="5.5" height="9" rx="1.4" />
      <rect x="9.25" y="4" width="5.5" height="15" rx="1.4" />
      <rect x="15.5" y="13" width="5.5" height="6" rx="1.4" />
    </g>
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </g>
  </svg>
)

const CartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h2.4l2.1 11h9.6l1.9-8H6.2" />
      <circle cx="9" cy="19" r="1.2" />
      <circle cx="16.5" cy="19" r="1.2" />
    </g>
  </svg>
)

export function moveKnob(x, y) {
  const wheel = document.querySelector('.home-radial')
  const knob = wheel?.querySelector('.is-search')
  if (!knob) return
  const r = wheel.getBoundingClientRect()
  let dx = x - (r.left + r.width / 2)
  let dy = y - (r.top + r.height / 2)
  const len = Math.hypot(dx, dy)
  const max = 64
  if (len > max) {
    dx = (dx / len) * max
    dy = (dy / len) * max
  }
  knob.style.setProperty('--kx', `${dx}px`)
  knob.style.setProperty('--ky', `${dy}px`)
}

// The centre button follows the finger, so it is hit-tested by distance from the wheel centre instead
export function radialAt(x, y) {
  const wheel = document.querySelector('.home-radial')
  if (!wheel) return null
  const hit = document.elementFromPoint(x, y)?.closest('[data-radial]:not(.is-search)')
  if (hit) return hit
  const r = wheel.getBoundingClientRect()
  return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) < 40 ? wheel.querySelector('.is-search') : null
}

const ITEMS = [
  { id: 'leaderboard', label: 'Leaderboard', Icon: LeaderboardIcon },
  { id: 'store', label: 'Store', Icon: StoreIcon },
  { id: 'search', label: 'Search', Icon: SearchIcon },
  { id: 'market', label: 'Market', Icon: MarketIcon },
  { id: 'cart', label: 'Checkout', Icon: CartIcon },
]

/** Plus-shaped menu centred on the page: Leaderboard top, Store left, Search middle, Market right, Checkout bottom. */
export default function HomeRadialMenu({ onPick, onClose, bagCount = 0 }) {
  return createPortal(
    <div className="home-radial-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="home-radial" role="menu" aria-label="Menu">
        {ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="menuitem"
            className={`home-radial-btn is-${id}`}
            data-radial={id}
            aria-label={label}
            onClick={() => onPick?.(id)}
          >
            <Icon />
            {id === 'cart' && bagCount > 0 ? <span className="home-radial-badge">{bagCount > 9 ? '9+' : bagCount}</span> : null}
          </button>
        ))}
      </div>
    </div>,
    document.querySelector('.stage') || document.body,
  )
}
