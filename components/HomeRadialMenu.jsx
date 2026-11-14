import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ClosetIcon, MarketIcon, StoreIcon } from './SegmentIcons.jsx'

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
const HOME_DIRS = { leaderboard: [0, -1], store: [-1, 0], market: [1, 0], cart: [0, 1], search: [0, 0] }
// Each swipe steps the selection one place that way; swiping back goes through the middle button
const HOME_PICKS = { '0,0': 'search', '0,-1': 'cart', '0,1': 'leaderboard', '-1,0': 'market', '1,0': 'store' }
// Profile: My store, Closet and Market in a row
const SPACES_DIRS = { store: [-1, 0], market: [1, 0], closet: [0, 0] }
const SPACES_PICKS = { '0,0': 'closet', '-1,0': 'market', '1,0': 'store' }
const CONFIGS = {
  home: { centre: 'search', dirs: HOME_DIRS, picks: HOME_PICKS },
  spaces: { centre: 'closet', dirs: SPACES_DIRS, picks: SPACES_PICKS },
}
let cfg = CONFIGS.home
let origin = null
let selected = 'search'

// The chosen button comes forward into the middle and the old middle button takes the chosen one's place
function paint(id) {
  const wheel = document.querySelector('.home-radial')
  if (!wheel) return
  selected = id
  wheel.querySelectorAll('[data-radial]').forEach((el) => {
    const k = el.dataset.radial
    const slotOf = k === cfg.centre ? id : k
    const centre = k === id
    const [ux, uy] = centre ? [0, 0] : cfg.dirs[slotOf]
    el.style.transform = 'none'
    el.style.translate = `calc(-50% + ${ux * SLOT}px) calc(-50% + ${uy * SLOT}px)`
    el.style.setProperty('--gs', centre ? '1' : '0.8')
    el.style.opacity = centre ? '1' : '0.8'
    el.classList.toggle('is-hot', centre && id !== cfg.centre)
  })
  wheel.dataset.sel = id
}

let cursor = [0, 0]

export function moveKnob(x, y) {
  if (!origin) origin = [x, y]
  const dx = x - origin[0]
  const dy = y - origin[1]
  if (Math.hypot(dx, dy) < 14) return
  // Direction only: the finger can be anywhere, and each fresh swipe restarts from where it is
  const horizontal = Math.abs(dx) > Math.abs(dy)
  const step = horizontal ? [Math.sign(dx), 0] : [0, Math.sign(dy)]
  origin = [x, y]
  const sameAxis = horizontal ? cursor[1] === 0 : cursor[0] === 0
  const next = sameAxis
    ? [Math.max(-1, Math.min(1, cursor[0] + step[0])), Math.max(-1, Math.min(1, cursor[1] + step[1]))]
    : step
  const id = cfg.picks[`${next[0]},${next[1]}`]
  if (!id) return
  cursor = next
  if (id !== selected) paint(id)
}

export function radialAt() {
  return document.querySelector(`.home-radial [data-radial="${selected}"]`)
}

function resetKnob() {
  origin = null
  cursor = [0, 0]
  selected = cfg.centre
  requestAnimationFrame(() => paint(cfg.centre))
}

const SPACE_ITEMS = [
  { id: 'store', label: 'My store', Icon: StoreIcon },
  { id: 'closet', label: 'Closet', Icon: ClosetIcon },
  { id: 'market', label: 'Market', Icon: MarketIcon },
]

const ITEMS = [
  { id: 'leaderboard', label: 'Leaderboard', Icon: LeaderboardIcon },
  { id: 'store', label: 'Store', Icon: StoreIcon },
  { id: 'search', label: 'Search', Icon: SearchIcon },
  { id: 'market', label: 'Market', Icon: MarketIcon },
  { id: 'cart', label: 'Checkout', Icon: CartIcon },
]

/** Plus-shaped menu centred on the page: Leaderboard top, Store left, Search middle, Market right, Checkout bottom. */
export default function HomeRadialMenu({ onPick, onClose, bagCount = 0, mode = 'home' }) {
  cfg = CONFIGS[mode] || CONFIGS.home
  const items = mode === 'spaces' ? SPACE_ITEMS : ITEMS
  useEffect(() => {
    resetKnob()
    return resetKnob
  }, [mode])
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
        {items.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="menuitem"
            className={`home-radial-btn is-${id}${id === cfg.centre ? ' is-search' : ''}`}
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
