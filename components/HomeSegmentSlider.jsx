import { useEffect, useRef, useState } from 'react'
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
const SLOT_PX = 220
const EDGE_RESISTANCE = 0.35
const FLICK_LOOKAHEAD_MS = 150

const clamp = (n) => Math.min(LAST, Math.max(0, n))
// Dragging past either end stretches, then springs back.
const resist = (n) => (n < 0 ? n * EDGE_RESISTANCE : n > LAST ? LAST + (n - LAST) * EDGE_RESISTANCE : n)

const scrollsSideways = (el, stop) => {
  for (let n = el; n && n !== stop; n = n.parentElement) {
    if (n.scrollWidth <= n.clientWidth) continue
    const ox = getComputedStyle(n).overflowX
    if (ox === 'auto' || ox === 'scroll') return true
  }
  return false
}

// Store / Market / Leaderboard: the chosen icon shows in the middle with arrows either side.
// Swipe left or right anywhere on the page to move between them (rows that scroll sideways keep their own swipe).
export default function HomeSegmentSlider({ value, onChange, fireSame = false }) {
  const rootRef = useRef(null)
  const index = Math.max(0, SEGMENTS.findIndex((s) => s.id === value))

  const [dragX, setDragX] = useState(null)
  const x = dragX ?? index

  const chooseRef = useRef(null)
  chooseRef.current = (i) => {
    const next = SEGMENTS[clamp(i)]
    if (fireSame || next.id !== value) onChange(next.id)
  }
  const indexRef = useRef(index)
  indexRef.current = index

  // The page follows the finger: swipe left for the next segment, right for the previous.
  useEffect(() => {
    const page = rootRef.current?.closest('.home-scroll')
    if (!page) return undefined
    let d = null
    const end = (e, flick) => {
      if (!d || d.id !== e.pointerId) return
      const s = d
      d = null
      if (!s.moving) return
      const last = s.samples[s.samples.length - 1]
      const from = s.samples.find((p) => last.t - p.t <= 100) || last
      const idle = e.timeStamp - last.t > 80
      const v = flick && !idle && last.t > from.t ? (last.pos - from.pos) / (last.t - from.t) : 0
      setDragX(null)
      // One segment per gesture, however far or fast the swipe.
      const landing = Math.round(last.pos + v * FLICK_LOOKAHEAD_MS)
      chooseRef.current(Math.min(s.start + 1, Math.max(s.start - 1, landing)))
    }
    const onDown = (e) => {
      if (!e.isPrimary || (e.button !== undefined && e.button !== 0) || scrollsSideways(e.target, page)) return
      d = { id: e.pointerId, x: e.clientX, y: e.clientY, start: indexRef.current, moving: false, samples: [] }
    }
    const onMove = (e) => {
      if (!d || d.id !== e.pointerId) return
      const dx = e.clientX - d.x
      if (!d.moving) {
        if (Math.abs(dx) < DRAG_START_PX) return
        if (Math.abs(dx) < Math.abs(e.clientY - d.y) * 1.5) {
          d = null
          return
        }
        d.moving = true
        d.x += Math.sign(dx) * DRAG_START_PX
      }
      const raw = d.start - (e.clientX - d.x) / SLOT_PX
      d.samples.push({ t: e.timeStamp, pos: raw })
      if (d.samples.length > 6) d.samples.shift()
      setDragX(resist(Math.min(d.start + 1, Math.max(d.start - 1, raw))))
    }
    const onUp = (e) => end(e, true)
    const onCancel = (e) => end(e, false)
    page.addEventListener('pointerdown', onDown)
    page.addEventListener('pointermove', onMove)
    page.addEventListener('pointerup', onUp)
    page.addEventListener('pointercancel', onCancel)
    return () => {
      page.removeEventListener('pointerdown', onDown)
      page.removeEventListener('pointermove', onMove)
      page.removeEventListener('pointerup', onUp)
      page.removeEventListener('pointercancel', onCancel)
    }
  }, [])

  const arrow = (
    <svg viewBox="0 0 12 10" aria-hidden="true"><path d="M6 1.2 10.6 8.4H1.4Z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
  )

  return (
    <div
      ref={rootRef}
      className={`home-segment-slider${dragX !== null ? ' is-dragging' : ''}`}
      role="status"
      aria-label={`${SEGMENTS[index].label}. Swipe left or right to switch.`}
      style={{ '--x': x }}
    >
      <span className={`wheel-arrow is-left${index === 0 ? ' is-end' : ''}`} aria-hidden="true">{arrow}</span>
      <span className={`wheel-arrow is-right${index === LAST ? ' is-end' : ''}`} aria-hidden="true">{arrow}</span>
      <div className="home-segment-track" aria-hidden="true">
        {SEGMENTS.map(({ id, Icon }, i) => (
          <span key={id} className="home-segment-tab" style={{ '--d': Math.min(1, Math.abs(i - x)) }}>
            <Icon />
          </span>
        ))}
      </div>
    </div>
  )
}
