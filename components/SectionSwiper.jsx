import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useSectionSwipe from './useSectionSwipe.js'
import './SectionSwiper.css'

/**
 * A section picker without a wheel: the current section's icon over a row of dots,
 * and the content below swaps when it is swiped left or right (or a dot is tapped).
 * Holding the chip opens a centered popup listing every section.
 */
const HOLD_MS = 450
const HOLD_SLOP_PX = 10

export default function SectionSwiper({
  sections,
  value,
  onChange,
  label,
  className = '',
  children,
}) {
  const index = Math.max(0, sections.findIndex((s) => s.id === value))
  const { ref, go } = useSectionSwipe({
    index,
    count: sections.length,
    onChange: (i) => onChange(sections[i].id),
  })

  const drum = useRef(null)
  const settle = useRef(0)
  const paintDrum = () => {
    const el = drum.current
    if (!el) return
    const pos = el.scrollLeft / (el.clientWidth || 1)
    Array.from(el.children).forEach((child, i) => {
      const d = Math.min(2, Math.abs(i - pos))
      child.style.opacity = String(1 - d * 0.42)
      child.style.transform = `scale(${1 - d * 0.15})`
    })
  }
  const onDrumScroll = () => {
    paintDrum()
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      const el = drum.current
      if (!el) return
      const i = Math.max(0, Math.min(sections.length - 1, Math.round(el.scrollLeft / (el.clientWidth || 1))))
      if (i !== index) {
        navigator.vibrate?.(8)
        onChange(sections[i].id)
      }
    }, 110)
  }
  useEffect(() => {
    const el = drum.current
    if (!el) return
    if (Math.abs(el.scrollLeft - index * el.clientWidth) > 1) el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
    paintDrum()
  }, [index])
  useEffect(() => () => window.clearTimeout(settle.current), [])

  const [open, setOpen] = useState(false)

  const hold = useRef({ timer: 0, x: 0, y: 0, fired: false })
  const cancelHold = () => {
    window.clearTimeout(hold.current.timer)
    hold.current.timer = 0
  }
  useEffect(() => cancelHold, [])
  const onPointerDown = (e) => {
    if ((e.pointerType === 'mouse' && e.button !== 0)) return
    const h = hold.current
    cancelHold()
    h.fired = false
    h.x = e.clientX
    h.y = e.clientY
    h.timer = window.setTimeout(() => {
      h.timer = 0
      h.fired = true
      navigator.vibrate?.(8)
      setOpen(true)
    }, HOLD_MS)
  }
  const onPointerMove = (e) => {
    const h = hold.current
    if (h.timer && Math.hypot(e.clientX - h.x, e.clientY - h.y) > HOLD_SLOP_PX) cancelHold()
  }
  // A hold must not also count as a tap on a dot.
  const onClickCapture = (e) => {
    if (!hold.current.fired) return
    hold.current.fired = false
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <>
      <div
        className="section-pager"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
        onClickCapture={onClickCapture}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          className="section-pager-arrow is-bare"
          aria-label="Previous section"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div ref={drum} className="section-pager-drum" data-no-section-swipe aria-hidden="true" onScroll={onDrumScroll}>
          {sections.map(({ id, label: name }) => (
            <span key={id} className="section-pager-label">
              {name}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="section-pager-arrow is-bare"
          aria-label="Next section"
          disabled={index === sections.length - 1}
          onClick={() => go(index + 1)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      {open &&
        createPortal(
          <div className="section-popup-backdrop" onClick={() => setOpen(false)}>
            <div className="section-popup" role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}>
              {sections.map(({ id, label: name }) => (
                <button
                  key={id}
                  type="button"
                  className={`section-popup-btn is-bare${id === value ? ' is-active' : ''}`}
                  onClick={() => {
                    setOpen(false)
                    onChange(id)
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
      <div ref={ref} className={`section-swipe ${className}`.trim()}>
        {children}
      </div>
    </>
  )
}
