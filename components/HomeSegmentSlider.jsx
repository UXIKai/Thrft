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
  { id: 'leaderboard', label: 'Leaderboard', Icon: LeaderboardIcon },
  { id: 'store', label: 'Store', Icon: StoreIcon },
  { id: 'market', label: 'Market', Icon: MarketIcon },
]

const LAST = SEGMENTS.length - 1
const DRAG_START_PX = 6
const EDGE_RESISTANCE = 0.35
const FLICK_LOOKAHEAD_MS = 150
const FLICK_IDLE_MS = 80

const clamp = (n) => Math.min(LAST, Math.max(0, n))
// Dragging past either end stretches, then springs back.
const resist = (n) => (n < 0 ? n * EDGE_RESISTANCE : n > LAST ? LAST + (n - LAST) * EDGE_RESISTANCE : n)

// Leaderboard / Store / Market on a vertical picker wheel: the chosen icon sits in the middle, the other waits above or below.
// Drag up or down (one icon per gesture), tap the neighbour, or use the arrow keys.
export default function HomeSegmentSlider({ value, onChange, fireSame = false }) {
  const rootRef = useRef(null)
  const dragRef = useRef(null)
  const swallowClickRef = useRef(false)
  const [dragX, setDragX] = useState(null)
  const [pressed, setPressed] = useState(false)

  const index = Math.max(0, SEGMENTS.findIndex((s) => s.id === value))
  const x = dragX ?? index
  const progress = clamp(x)

  const choose = (i) => {
    const next = SEGMENTS[i]
    if (next && (fireSame || next.id !== value)) onChange(next.id)
  }

  // A mouse wheel moves one icon per scroll gesture.
  const stepRef = useRef(null)
  stepRef.current = (dir) => choose(clamp(index + dir))
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    let lastEvent = 0
    const onWheel = (e) => {
      e.preventDefault()
      const now = performance.now()
      const sameGesture = now - lastEvent < 150
      lastEvent = now
      if (sameGesture || Math.abs(e.deltaY) < 2) return
      stepRef.current(Math.sign(e.deltaY))
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e) => {
    // One pointer at a time: a second finger neither starts nor steals a drag.
    if (!e.isPrimary || (e.button !== undefined && e.button !== 0)) return
    const slot = rootRef.current?.querySelector('.home-segment-tab')?.offsetHeight || 44
    setPressed(true)
    dragRef.current = { id: e.pointerId, startY: e.clientY, originY: e.clientY, startPos: x, slot, moving: false, samples: [] }
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    if (!d.moving) {
      if (Math.abs(e.clientY - d.startY) <= DRAG_START_PX) return
      // Only a real drag captures the pointer, so plain taps still reach the buttons.
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // No active pointer left to capture.
      }
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
        // The press ended elsewhere (release outside the slider), so there is nothing to drag.
        dragRef.current = null
        return
      }
      d.moving = true
      d.originY = d.startY + Math.sign(e.clientY - d.startY) * DRAG_START_PX
    }
    const pos = d.startPos - (e.clientY - d.originY) / d.slot
    d.samples.push({ t: e.timeStamp, pos })
    if (d.samples.length > 6) d.samples.shift()
    setDragX(resist(pos))
  }

  const finishDrag = (e, flick) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    dragRef.current = null
    setPressed(false)
    if (!d.moving) return
    swallowClickRef.current = true
    setTimeout(() => {
      swallowClickRef.current = false
    }, 0)
    const last = d.samples[d.samples.length - 1]
    const resting = e.timeStamp - last.t > FLICK_IDLE_MS
    const from = d.samples.find((s) => last.t - s.t <= 100) || last
    const velocity = !resting && last.t > from.t ? (last.pos - from.pos) / (last.t - from.t) : 0
    const landing = last.pos + (flick ? velocity * FLICK_LOOKAHEAD_MS : 0)
    setDragX(null)
    choose(clamp(Math.round(landing)))
  }

  const onClickCapture = (e) => {
    if (!swallowClickRef.current) return
    swallowClickRef.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  const onKeyDown = (e) => {
    let next
    if (e.key === 'ArrowUp') next = index - 1
    else if (e.key === 'ArrowDown') next = index + 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = LAST
    else return
    next = clamp(next)
    e.preventDefault()
    choose(next)
    rootRef.current?.querySelector(`#home-${SEGMENTS[next].id}-tab`)?.focus()
  }

  return (
    <div
      ref={rootRef}
      className={`home-segment-slider${dragX !== null ? ' is-dragging' : ''}${pressed ? ' is-pressed' : ''}`}
      role="tablist"
      aria-label="Shop Market or Store"
      aria-orientation="vertical"
      style={{ '--x': x, '--p': progress }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finishDrag(e, true)}
      onPointerCancel={(e) => finishDrag(e, false)}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
    >
      <span className={`wheel-arrow is-up${index === 0 ? ' is-end' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 12 10" aria-hidden="true"><path d="M6 1.2 10.6 8.4H1.4Z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
      </span>
      <span className={`wheel-arrow is-down${index === LAST ? ' is-end' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 12 10" aria-hidden="true"><path d="M6 1.2 10.6 8.4H1.4Z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
      </span>
      <div className="home-segment-track" role="presentation">
        {SEGMENTS.map(({ id, label, Icon }, i) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`home-${id}-tab`}
            aria-label={label}
            aria-controls="home-product-panel"
            aria-selected={value === id}
            tabIndex={value === id ? 0 : -1}
            style={{ '--s': Math.max(-1, Math.min(1, i - x)), '--d': Math.min(1, Math.abs(i - x)) }}
            className={`home-segment-tab is-bare${value === id ? ' is-active' : ''}`}
            onClick={() => choose(i)}
          >
            <Icon />
          </button>
        ))}
      </div>
    </div>
  )
}
