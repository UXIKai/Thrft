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

const SLOT = 97
const DIRS = { leaderboard: [0, -1], store: [-1, 0], market: [1, 0], cart: [0, 1], search: [0, 0] }
let origin = null
let selected = 'search'

const EDGE = 112

// Every button is placed continuously from the finger offset, so nothing snaps or sticks.
// Buttons slide with the finger, are kept inside the sphere, and fade as they reach its rim.
function paint(ox = 0, oy = 0) {
  const wheel = document.querySelector('.home-radial')
  if (!wheel) return
  let best = 'search'
  let bestD = Infinity
  wheel.querySelectorAll('[data-radial]').forEach((el) => {
    const k = el.dataset.radial
    const [ux, uy] = DIRS[k]
    const x = ux * SLOT + ox
    const y = uy * SLOT + oy
    const d = Math.hypot(x, y)
    const kd = d + (k === selected ? -6 : 0)
    if (kd < bestD) { bestD = kd; best = k }
    const k2 = d > EDGE ? EDGE / d : 1
    const fade = d <= EDGE ? 1 : Math.max(0, 1 - (d - EDGE) / 36)
    el.style.transform = 'none'
    el.style.transition = 'none'
    el.style.translate = `calc(-50% + ${x * k2}px) calc(-50% + ${y * k2}px)`
    el.style.setProperty('--gs', String(0.8 + 0.2 * (1 - Math.min(d, SLOT) / SLOT)))
    el.style.setProperty('opacity', String((0.55 + 0.45 * (1 - Math.min(d, SLOT) / SLOT)) * fade), 'important')
  })
  selected = best
  wheel.querySelectorAll('[data-radial]').forEach((el) => {
    el.classList.toggle('is-hot', el.dataset.radial === best && best !== 'search')
  })
  wheel.dataset.sel = best
}

// The menu slides with the finger, so swiping up brings the bottom button to the middle
export function moveKnob(x, y) {
  if (!origin) origin = [x, y]
  let ox = x - origin[0]
  let oy = y - origin[1]
  const len = Math.hypot(ox, oy)
  if (len > SLOT) { ox = ox / len * SLOT; oy = oy / len * SLOT }
  paint(ox, oy)
}

export function radialAt() {
  return document.querySelector(`.home-radial [data-radial="${selected}"]`)
}

function resetKnob() {
  origin = null
  selected = 'search'
  requestAnimationFrame(() => paint(0, 0))
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
        <svg className="home-radial-grid" viewBox="-100 -100 200 200" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="0.6">
            <ellipse rx="100" ry="34" />
            <ellipse rx="100" ry="68" />
            <ellipse rx="34" ry="100" />
            <ellipse rx="68" ry="100" />
            <path d="M-100 0H100M0 -100V100" />
          </g>
        </svg>
        <span className="home-radial-lens" aria-hidden="true" />
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
