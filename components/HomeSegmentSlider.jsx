import { useEffect, useRef } from 'react'
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
const SWIPE_MIN_PX = 50
const SWIPE_MAX_MS = 800

const clamp = (n) => Math.min(LAST, Math.max(0, n))

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

  const stepRef = useRef(null)
  stepRef.current = (dir) => {
    const next = SEGMENTS[clamp(index + dir)]
    if (fireSame || next.id !== value) onChange(next.id)
  }

  useEffect(() => {
    const page = rootRef.current?.closest('.home-scroll')
    if (!page) return undefined
    let start = null
    const onDown = (e) => {
      if (!e.isPrimary || (e.button !== undefined && e.button !== 0)) return
      start = scrollsSideways(e.target, page) ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }
    }
    const onUp = (e) => {
      const s = start
      start = null
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5 || e.timeStamp - s.t > SWIPE_MAX_MS) return
      // Swiping left reveals the next segment, like paging forward.
      stepRef.current(dx < 0 ? 1 : -1)
    }
    const onCancel = () => {
      start = null
    }
    page.addEventListener('pointerdown', onDown)
    page.addEventListener('pointerup', onUp)
    page.addEventListener('pointercancel', onCancel)
    return () => {
      page.removeEventListener('pointerdown', onDown)
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
      className="home-segment-slider"
      role="status"
      aria-label={`${SEGMENTS[index].label}. Swipe left or right to switch.`}
      style={{ '--x': index }}
    >
      <span className={`wheel-arrow is-left${index === 0 ? ' is-end' : ''}`} aria-hidden="true">{arrow}</span>
      <span className={`wheel-arrow is-right${index === LAST ? ' is-end' : ''}`} aria-hidden="true">{arrow}</span>
      <div className="home-segment-track" aria-hidden="true">
        {SEGMENTS.map(({ id, Icon }, i) => (
          <span key={id} className="home-segment-tab" style={{ '--s': Math.max(-1, Math.min(1, i - index)), '--d': Math.min(1, Math.abs(i - index)) }}>
            <Icon />
          </span>
        ))}
      </div>
    </div>
  )
}
