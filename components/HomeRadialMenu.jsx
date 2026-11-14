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

const TH = (60 * Math.PI) / 180
const RS = 112
const DIRS = { leaderboard: [0, -1], store: [-1, 0], market: [1, 0], cart: [0, 1], search: [0, 0] }
let origin = null
let selected = 'search'
let cur = [0, 0]
let target = [0, 0]
let raf = 0

// Each button sits on a globe: turning the globe carries it along the surface, shrinking and fading as it rolls away
function paint() {
  const wheel = document.querySelector('.home-radial')
  if (!wheel) return
  const [ax, ay] = cur
  wheel.querySelectorAll('[data-radial]').forEach((el) => {
    const [ux, uy] = DIRS[el.dataset.radial]
    let x = ux * Math.sin(TH)
    let y = uy * Math.sin(TH)
    let z = Math.cos(TH)
    if (!ux && !uy) z = 1
    const x1 = x * Math.cos(ay) + z * Math.sin(ay)
    const z1 = -x * Math.sin(ay) + z * Math.cos(ay)
    const y2 = y * Math.cos(ax) - z1 * Math.sin(ax)
    const z2 = y * Math.sin(ax) + z1 * Math.cos(ax)
    x = x1
    y = y2
    z = z2
    el.style.transform = 'none'
    el.style.transition = 'none'
    el.style.translate = `calc(-50% + ${(x * RS).toFixed(1)}px) calc(-50% + ${(y * RS).toFixed(1)}px)`
    el.style.setProperty('--gs', (0.45 + 0.55 * Math.max(z, 0)).toFixed(3))
    el.style.opacity = Math.max(0, Math.min(1, z * 1.6)).toFixed(3)
    el.style.pointerEvents = z > 0.3 ? '' : 'none'
  })
}

function tick() {
  cur = [cur[0] + (target[0] - cur[0]) * 0.22, cur[1] + (target[1] - cur[1]) * 0.22]
  if (Math.abs(target[0] - cur[0]) < 0.002 && Math.abs(target[1] - cur[1]) < 0.002) {
    cur = [...target]
    raf = 0
  } else {
    raf = requestAnimationFrame(tick)
  }
  paint()
}

// Pointing a direction turns the globe so that direction's button comes to the middle
export function moveKnob(x, y) {
  const wheel = document.querySelector('.home-radial')
  if (!wheel) return
  if (!origin) origin = [x, y]
  const dx = x - origin[0]
  const dy = y - origin[1]
  let id = 'search'
  if (Math.hypot(dx, dy) > 10) {
    id = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'store' : 'market') : dy < 0 ? 'leaderboard' : 'cart'
  }
  selected = id
  const [ux, uy] = DIRS[id]
  target = [uy * TH, -ux * TH]
  if (!raf) raf = requestAnimationFrame(tick)
  wheel.querySelectorAll('[data-radial]').forEach((el) => el.classList.toggle('is-hot', el.dataset.radial === id))
  wheel.dataset.sel = id
}

export function radialAt() {
  return document.querySelector(`.home-radial [data-radial="${selected}"]`)
}

function resetKnob() {
  origin = null
  selected = 'search'
  cur = [0, 0]
  target = [0, 0]
  cancelAnimationFrame(raf)
  raf = 0
  requestAnimationFrame(paint)
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
