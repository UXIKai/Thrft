import { useEffect } from 'react'
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

const R = 84
const SLOTS = { leaderboard: [0, -R], store: [-R, 0], market: [R, 0], cart: [0, R], search: [0, 0] }
let origin = null
let selected = 'search'

// Moving the finger from where it first pressed rotates that direction's button into the middle; the old middle takes its place
export function moveKnob(x, y) {
  const wheel = document.querySelector('.home-radial')
  if (!wheel) return
  if (!origin) origin = [x, y]
  const dx = x - origin[0]
  const dy = y - origin[1]
  let id = 'search'
  if (Math.hypot(dx, dy) > 24) {
    id = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'store' : 'market') : dy < 0 ? 'leaderboard' : 'cart'
  }
  selected = id
  const [px, py] = SLOTS[id]
  wheel.querySelectorAll('[data-radial]').forEach((el) => {
    const k = el.dataset.radial
    const [kx, ky] = k === id ? [-px, -py] : k === 'search' ? [px, py] : [0, 0]
    el.style.setProperty('--kx', `${kx}px`)
    el.style.setProperty('--ky', `${ky}px`)
    el.classList.toggle('is-hot', k === id)
  })
  wheel.dataset.sel = id
}

export function radialAt() {
  return document.querySelector(`.home-radial [data-radial="${selected}"]`)
}

function resetKnob() {
  origin = null
  selected = 'search'
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
  useEffect(() => {
    resetKnob()
    return resetKnob
  }, [])
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
