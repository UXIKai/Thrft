import { startTransition, useEffect, useLayoutEffect, useRef } from 'react'
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

const LAST = SEGMENTS.length - 1
const DRAG_START_PX = 8
const SLOT_PX = 200
const EDGE_RESISTANCE = 0.35
const FLICK_LOOKAHEAD_MS = 150

const clamp = (n) => Math.min(LAST, Math.max(0, n))
// Dragging past either end stretches, then springs back.
const resist = (n) => (n < 0 ? n * EDGE_RESISTANCE : n > LAST ? LAST + (n - LAST) * EDGE_RESISTANCE : n)

// Store / Market / Leaderboard: the chosen icon shows in the middle with arrows above and below.
// At the top of the page, swipe up for the next segment (Leaderboard) and down to go back (Market / Store).
// Swiping up over scrollable products still scrolls them, unless the swipe starts on this header strip.
export default function HomeSegmentSlider({ value, onChange, fireSame = false }) {
  const rootRef = useRef(null)
  const index = Math.max(0, SEGMENTS.findIndex((s) => s.id === value))

  // Position is painted straight onto the DOM so a drag never re-renders React.
  const paint = (x) => {
    const root = rootRef.current
    if (!root) return
    root.style.setProperty('--x', x)
    root.querySelectorAll('.home-segment-tab').forEach((el, i) => el.style.setProperty('--d', Math.min(1, Math.abs(i - x))))
  }
  const paintRef = useRef(paint)
  paintRef.current = paint
  useLayoutEffect(() => {
    paintRef.current(index)
  }, [index])

  const chooseRef = useRef(null)
  chooseRef.current = (i) => {
    const next = SEGMENTS[clamp(i)]
    if (!fireSame && next.id === value) return
    // Swap the (heavy) product list after the slide starts so the animation never stutters.
    startTransition(() => onChange(next.id))
  }
  const indexRef = useRef(index)
  indexRef.current = index

  useEffect(() => {
    const page = rootRef.current?.closest('.home-scroll')
    const header = rootRef.current?.parentElement
    if (!page) return undefined
    let d = null
    let frame = 0
    let pending = 0
    const flush = () => {
      frame = 0
      paintRef.current(pending)
    }
    const begin = (id, x, y, target) => {
      // Only from the very top of the page.
      if (page.scrollTop > 0) {
        d = null
        return
      }
      d = { id, x, y, start: indexRef.current, moving: false, samples: [], fromHeader: header?.contains(target) }
    }
    const move = (id, x, y, t, ev) => {
      if (!d || d.id !== id) return
      const dy = y - d.y
      if (!d.moving) {
        if (Math.abs(dy) < DRAG_START_PX) return
        const scrollable = page.scrollHeight > page.clientHeight + 1
        // Swiping up over scrollable content is a normal scroll; the header strip always switches.
        if (Math.abs(dy) < Math.abs(x - d.x) * 1.5 || (dy < 0 && scrollable && !d.fromHeader)) {
          d = null
          return
        }
        d.moving = true
        d.y += Math.sign(dy) * DRAG_START_PX
        rootRef.current.classList.add('is-dragging')
      }
      if (ev.cancelable) ev.preventDefault()
      const raw = d.start - (y - d.y) / SLOT_PX
      d.samples.push({ t, pos: raw })
      if (d.samples.length > 6) d.samples.shift()
      pending = resist(Math.min(d.start + 1, Math.max(d.start - 1, raw)))
      if (!frame) frame = requestAnimationFrame(flush)
    }
    const end = (id, t, flick) => {
      if (!d || d.id !== id) return
      const s = d
      d = null
      if (!s.moving) return
      cancelAnimationFrame(frame)
      frame = 0
      const last = s.samples[s.samples.length - 1]
      const from = s.samples.find((p) => last.t - p.t <= 100) || last
      const idle = t - last.t > 80
      const v = flick && !idle && last.t > from.t ? (last.pos - from.pos) / (last.t - from.t) : 0
      // One segment per gesture, however far or fast the swipe.
      const landing = clamp(Math.min(s.start + 1, Math.max(s.start - 1, Math.round(last.pos + v * FLICK_LOOKAHEAD_MS))))
      rootRef.current.classList.remove('is-dragging')
      paintRef.current(landing)
      chooseRef.current(landing)
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
      const t = touchById(e)
      if (t) end(t.identifier, e.timeStamp, true)
    }
    const onTouchCancel = (e) => {
      const t = touchById(e)
      if (t) end(t.identifier, e.timeStamp, false)
    }
    const mouse = (fn) => (e) => {
      if (e.pointerType === 'mouse' && e.isPrimary && (e.button === undefined || e.button === 0 || e.type !== 'pointerdown')) fn(e)
    }
    const onMouseDown = mouse((e) => begin(e.pointerId, e.clientX, e.clientY, e.target))
    const onMouseMove = mouse((e) => move(e.pointerId, e.clientX, e.clientY, e.timeStamp, e))
    const onMouseUp = mouse((e) => end(e.pointerId, e.timeStamp, true))

    page.addEventListener('touchstart', onTouchStart, { passive: true })
    page.addEventListener('touchmove', onTouchMove, { passive: false })
    page.addEventListener('touchend', onTouchEnd)
    page.addEventListener('touchcancel', onTouchCancel)
    page.addEventListener('pointerdown', onMouseDown)
    page.addEventListener('pointermove', onMouseMove)
    page.addEventListener('pointerup', onMouseUp)
    return () => {
      cancelAnimationFrame(frame)
      page.removeEventListener('touchstart', onTouchStart)
      page.removeEventListener('touchmove', onTouchMove)
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

  return (
    <div
      ref={rootRef}
      className="home-segment-slider"
      role="status"
      aria-label={`${SEGMENTS[index].label}. At the top of the page, swipe up or down to switch.`}
    >
      <span className={`wheel-arrow is-up${index === 0 ? ' is-end' : ''}`} aria-hidden="true">{arrow}</span>
      <span className={`wheel-arrow is-down${index === LAST ? ' is-end' : ''}`} aria-hidden="true">{arrow}</span>
      <div className="home-segment-track" aria-hidden="true">
        {SEGMENTS.map(({ id, Icon }) => (
          <span key={id} className="home-segment-tab">
            <Icon />
          </span>
        ))}
      </div>
    </div>
  )
}
