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
const HOME_DIRS = { leaderboard: [0, -1], store: [-1, 0], market: [1, 0], cart: [0, 1], search: [0, 0] }
// Each swipe steps the selection one place that way; swiping back goes through the middle
const HOME_PICKS = { '0,0': 'search', '0,-1': 'cart', '0,1': 'leaderboard', '-1,0': 'market', '1,0': 'store' }
// Other pages: Home on top, Chat left, Liked right, Profile below, and "stay" in the middle
const TAB_DIRS = { home: [0, -1], chat: [-1, 0], saved: [1, 0], profile: [0, 1], stay: [0, 0] }
const TAB_PICKS = { '0,0': 'stay', '0,-1': 'profile', '0,1': 'home', '-1,0': 'saved', '1,0': 'chat' }
const CONFIGS = {
  home: { centre: 'search', dirs: HOME_DIRS, picks: HOME_PICKS },
  tabs: { centre: 'stay', dirs: TAB_DIRS, picks: TAB_PICKS },
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
  cursor = next
  const id = cfg.picks[`${next[0]},${next[1]}`]
  if (id !== selected) paint(id)
}

export function radialAt() {
  return document.querySelector(`.home-radial [data-radial="${selected}"]`)
}

function resetKnob() {
  origin = null
  cursor = [0, 0]
  selected = cfg.centre
  const centre = cfg.centre
  requestAnimationFrame(() => paint(centre))
}

const TabIcon = ({ d, circle }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {circle && <circle cx="12" cy="8" r="3.4" fill="currentColor" />}
    <path fill="currentColor" d={d} />
  </svg>
)
export const TAB_ICONS = {
  home: <TabIcon d="M12 3.2 3.5 10.2V21h6.2v-6.4h4.6V21h6.2V10.2L12 3.2z" />,
  chat: <TabIcon d="M4 4.8h16A1.2 1.2 0 0 1 21.2 6v9.2a1.2 1.2 0 0 1-1.2 1.2H9.4L4.8 20.4V16.4H4A1.2 1.2 0 0 1 2.8 15.2V6A1.2 1.2 0 0 1 4 4.8z" />,
  design: <TabIcon d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />,
  saved: <TabIcon d="M12 20.4S3.6 15.1 3.6 9.7A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 8.4 2.5c0 5.4-8.4 10.7-8.4 10.7z" />,
  profile: <TabIcon circle d="M5.2 19.6c.6-3.4 3.3-5.2 6.8-5.2s6.2 1.8 6.8 5.2H5.2z" />,
}

// `slot` is the class that places the button; the centre one is styled as the hub
const ITEMS = [
  { id: 'leaderboard', slot: 'leaderboard', label: 'Leaderboard', Icon: LeaderboardIcon },
  { id: 'store', slot: 'store', label: 'Store', Icon: StoreIcon },
  { id: 'search', slot: 'search', label: 'Search', Icon: SearchIcon },
  { id: 'market', slot: 'market', label: 'Market', Icon: MarketIcon },
  { id: 'cart', slot: 'cart', label: 'Checkout', Icon: CartIcon },
]

const tabItems = (current) => [
  { id: 'home', slot: 'leaderboard', label: 'Home', Icon: () => TAB_ICONS.home },
  { id: 'chat', slot: 'store', label: 'Chat', Icon: () => TAB_ICONS.chat },
  { id: 'stay', slot: 'search', label: 'Stay here', Icon: () => TAB_ICONS[current] || TAB_ICONS.home },
  { id: 'saved', slot: 'market', label: 'Liked', Icon: () => TAB_ICONS.saved },
  { id: 'profile', slot: 'cart', label: 'Profile', Icon: () => TAB_ICONS.profile },
]

/** Plus-shaped menu centred on the page: Leaderboard top, Store left, Search middle, Market right, Checkout bottom. */
export default function HomeRadialMenu({ onPick, onClose, bagCount = 0, mode = 'home', current = 'home' }) {
  cfg = CONFIGS[mode] || CONFIGS.home
  const items = mode === 'tabs' ? tabItems(current) : ITEMS
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
        {items.map(({ id, slot, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="menuitem"
            className={`home-radial-btn is-${slot}`}
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
