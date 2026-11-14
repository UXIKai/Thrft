import { startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react'
import HomeRadialMenu from './HomeRadialMenu.jsx'
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

const SEGMENTS = [
  { id: 'store', label: 'Store', Icon: StoreIcon },
  { id: 'market', label: 'Market', Icon: MarketIcon },
  { id: 'leaderboard', label: 'Leaderboard', Icon: LeaderboardIcon },
]

const SHOPS = ['store', 'market']
const HOLD_MS = 420

const DRAG_START_PX = 8
const SLOT_PX = 200
const EDGE_RESISTANCE = 0.35
const FLICK_LOOKAHEAD_MS = 150

const clamp01 = (n) => Math.min(1, Math.max(0, n))
// Dragging past either end stretches, then springs back.
const resist = (n) => (n < 0 ? n * EDGE_RESISTANCE : n > 1 ? 1 + (n - 1) * EDGE_RESISTANCE : n)

const scrollsSideways = (el, stop) => {
  for (let n = el; n && n !== stop; n = n.parentElement) {
    if (n.scrollWidth <= n.clientWidth) continue
    const ox = getComputedStyle(n).overflowX
    if (ox === 'auto' || ox === 'scroll') return true
  }
  return false
}

const scrolledDown = (el, stop) => {
  for (let n = el; n; n = n.parentElement) {
    if (n.scrollTop > 0) return true
    if (n === stop) break
  }
  return false
}

// Store and Market sit side by side (swipe left / right); the Leaderboard sits above them:
// pull down at the very top of the page to reach it, swipe up to come back. Swiping up at the bottom opens checkout.
export default function HomeSegmentSlider({ value, onChange, fireSame = false, onSearch, onCart, bagCount = 0 }) {
  const rootRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(false)
  menuRef.current = menuOpen
  const actionsRef = useRef({})
  actionsRef.current = { onSearch, onCart }
  const pickRef = useRef(null)
  pickRef.current = (id) => {
    setMenuOpen(false)
    if (id === 'search') actionsRef.current.onSearch?.()
    else if (id === 'cart') actionsRef.current.onCart?.()
    else chooseRef.current(id)
  }
  const holdRef = useRef(0)
  const onLeaderboard = value === 'leaderboard'
  const memRef = useRef('store')
  if (!onLeaderboard) memRef.current = value
  const shopIndex = Math.max(0, SHOPS.indexOf(memRef.current))

  // The view point is (x, y): x 0..1 picks Store / Market, y 1 is the Leaderboard above them.
  const paint = (x, y) => {
    const root = rootRef.current
    if (!root) return
    const lx = shopIndex
    root.style.setProperty('--x', x)
    root.style.setProperty('--y', y)
    root.style.setProperty('--lx', lx)
    const dist = (tx, ty) => Math.min(1, Math.hypot(tx - x, ty - y))
    const tabs = root.querySelectorAll('.home-segment-tab')
    tabs[0].style.setProperty('--d', dist(0, 0))
    tabs[1].style.setProperty('--d', dist(1, 0))
    tabs[2].style.setProperty('--d', dist(lx, 1))
  }
  const paintRef = useRef(paint)
  paintRef.current = paint
  useLayoutEffect(() => {
    paintRef.current(shopIndex, onLeaderboard ? 1 : 0)
  }, [shopIndex, onLeaderboard])

  const chooseRef = useRef(null)
  chooseRef.current = (id) => {
    if (!fireSame && id === value) return
    // Swap the (heavy) product list after the slide starts so the animation never stutters.
    startTransition(() => onChange(id))
  }
  const stateRef = useRef(null)
  stateRef.current = { onLeaderboard, shopIndex }

  useEffect(() => {
    const page = rootRef.current?.closest('.home-scroll')
    if (!page) return undefined
    let d = null
    let frame = 0
    let pending = [0, 0]
    const flush = () => {
      frame = 0
      paintRef.current(pending[0], pending[1])
    }
    const begin = (id, x, y, target) => {
      const { onLeaderboard: up, shopIndex: sx } = stateRef.current
      // Pulling down to the Leaderboard only works from the very top of the page.
      clearTimeout(holdRef.current)
      if (rootRef.current?.contains(target)) {
        holdRef.current = setTimeout(() => {
          if (d && !d.axis) {
            d = null
            setMenuOpen(true)
          }
        }, HOLD_MS)
      }
      d = { id, x, y, up, sx, axis: null, samples: [], atTop: page.scrollTop <= 0, atBottom: page.scrollTop + page.clientHeight >= page.scrollHeight - 2, sideways: scrollsSideways(target, page) }
    }
    const move = (id, x, y, t, ev) => {
      if (!d || d.id !== id) return
      const dx = x - d.x
      const dy = y - d.y
      if (!d.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_START_PX) return
        clearTimeout(holdRef.current)
        if (Math.abs(dx) > Math.abs(dy) * 1.5 && !d.up && !d.sideways) d.axis = 'x'
        else if (Math.abs(dy) > Math.abs(dx) * 1.5 && (d.up ? dy < 0 : dy > 0 ? d.atTop : d.atBottom)) d.axis = 'y'
        else {
          d = null
          return
        }
        d.ox = d.axis === 'x' ? d.x + Math.sign(dx) * DRAG_START_PX : d.x
        d.oy = d.axis === 'y' ? d.y + Math.sign(dy) * DRAG_START_PX : d.y
        rootRef.current.classList.add('is-dragging')
      }
      if (ev.cancelable) ev.preventDefault()
      // Swiping left reveals Market; pulling down reveals the Leaderboard; swiping up leaves it.
      const raw = d.axis === 'x' ? d.sx - (x - d.ox) / SLOT_PX : (d.up ? 1 : 0) + (y - d.oy) / SLOT_PX
      d.samples.push({ t, pos: raw })
      if (d.samples.length > 6) d.samples.shift()
      const shown = resist(raw)
      pending = d.axis === 'x' ? [shown, 0] : [d.sx, shown]
      if (!frame) frame = requestAnimationFrame(flush)
    }
    const end = (id, t, flick) => {
      clearTimeout(holdRef.current)
      if (!d || d.id !== id) return
      const s = d
      d = null
      if (!s.axis) return
      cancelAnimationFrame(frame)
      frame = 0
      const last = s.samples[s.samples.length - 1]
      const from = s.samples.find((p) => last.t - p.t <= 100) || last
      const idle = t - last.t > 80
      const v = flick && !idle && last.t > from.t ? (last.pos - from.pos) / (last.t - from.t) : 0
      // One step per gesture, however far or fast the swipe.
      const target = last.pos + v * FLICK_LOOKAHEAD_MS
      const landing = clamp01(Math.round(target))
      rootRef.current.classList.remove('is-dragging')
      if (s.axis === 'x') {
        paintRef.current(landing, 0)
        chooseRef.current(SHOPS[landing])
      } else if (!s.up && target <= -0.5) {
        paintRef.current(s.sx, 0)
        actionsRef.current.onCart?.()
      } else if (landing === 1) {
        paintRef.current(s.sx, 1)
        chooseRef.current('leaderboard')
      } else {
        paintRef.current(s.sx, 0)
        chooseRef.current(SHOPS[s.sx])
      }
    }

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) {
        d = null
        return
      }
      const t = e.touches[0]
      begin(t.identifier, t.clientX, t.clientY, e.target)
    }
    const touchById = (e) => (d ? Array.from(e.changedTouches).find((t) => t.identifier === d.id) : null)
    const onTouchMove = (e) => {
      const t = touchById(e)
      if (t) move(t.identifier, t.clientX, t.clientY, e.timeStamp, e)
    }
    const onTouchEnd = (e) => {
      if (menuRef.current && e.changedTouches.length) {
        const t0 = e.changedTouches[0]
        const hit = document.elementFromPoint(t0.clientX, t0.clientY)?.closest('[data-radial]')
        if (hit) {
          e.preventDefault()
          pickRef.current(hit.dataset.radial)
        }
        return
      }
      const t = touchById(e)
      if (t) end(t.identifier, e.timeStamp, true)
    }
    const onTouchCancel = (e) => {
      const t = touchById(e)
      if (t) end(t.identifier, e.timeStamp, false)
    }
    const mouse = (fn) => (e) => {
      if (e.pointerType === 'mouse' && e.isPrimary && (e.type !== 'pointerdown' || e.button === 0)) fn(e)
    }
    const onMouseDown = mouse((e) => begin(e.pointerId, e.clientX, e.clientY, e.target))
    const onMouseMove = mouse((e) => move(e.pointerId, e.clientX, e.clientY, e.timeStamp, e))
    const onMouseUp = mouse((e) => end(e.pointerId, e.timeStamp, true))

    page.addEventListener('touchstart', onTouchStart, { passive: true })
    page.addEventListener('touchmove', onTouchMove, { passive: false })
    page.addEventListener('touchend', onTouchEnd)
    page.addEventListener('touchcancel', onTouchCancel)
    // The page itself never rubber-bands down; only the Leaderboard pull moves it.
    let startY = 0
    let canBounce = false
    const onBounceStart = (e) => {
      startY = e.touches[0].clientY
      canBounce = !scrolledDown(e.target, page)
    }
    const onBounceMove = (e) => {
      if (e.cancelable && (menuRef.current || (canBounce && e.touches[0].clientY > startY))) e.preventDefault()
    }
    page.addEventListener('touchstart', onBounceStart, { passive: true })
    page.addEventListener('touchmove', onBounceMove, { passive: false })
    page.addEventListener('pointerdown', onMouseDown)
    page.addEventListener('pointermove', onMouseMove)
    page.addEventListener('pointerup', onMouseUp)
    return () => {
      clearTimeout(holdRef.current)
      cancelAnimationFrame(frame)
      page.removeEventListener('touchstart', onTouchStart)
      page.removeEventListener('touchmove', onTouchMove)
      page.removeEventListener('touchstart', onBounceStart)
      page.removeEventListener('touchmove', onBounceMove)
      page.removeEventListener('touchend', onTouchEnd)
      page.removeEventListener('touchcancel', onTouchCancel)
      page.removeEventListener('pointerdown', onMouseDown)
      page.removeEventListener('pointermove', onMouseMove)
      page.removeEventListener('pointerup', onMouseUp)
    }
  }, [])

  const arrow = (
    <svg viewBox="0 0 12 10" aria-hidden="true"><path d="M6 1.2 10.6 8.4H1.4Z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
  )
  // Arrows at a dead end are dimmed; the Leaderboard has no left/right neighbours.
  const side = onLeaderboard ? ' is-end' : ''

  return (
    <div
      ref={rootRef}
      className="home-segment-slider"
      role="status"
      aria-label={`${SEGMENTS.find((s) => s.id === value)?.label}. Swipe left or right for Store and Market; pull down at the top for the Leaderboard, swipe up at the bottom for checkout; hold for the menu.`}
    >
      <span className={`wheel-arrow is-left${shopIndex === 0 ? ' is-end' : side}`} aria-hidden="true">{arrow}</span>
      <span className={`wheel-arrow is-right${shopIndex === 1 ? ' is-end' : side}`} aria-hidden="true">{arrow}</span>
      <span className="wheel-arrow is-up" aria-hidden="true">{arrow}</span>
      <span className={`wheel-arrow is-down${onLeaderboard ? '' : ' is-end'}`} aria-hidden="true">{arrow}</span>
      <div className="home-segment-track" aria-hidden="true">
        {SEGMENTS.map(({ id, Icon }) => (
          <span key={id} className={`home-segment-tab is-${id}`}>
            <Icon />
          </span>
        ))}
      </div>
      {menuOpen && <HomeRadialMenu bagCount={bagCount} onPick={(id) => pickRef.current(id)} onClose={() => setMenuOpen(false)} />}
    </div>
  )
}
