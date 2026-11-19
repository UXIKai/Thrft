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
        <button type="button" className="section-pager-chip is-bare" aria-haspopup="dialog" aria-expanded={open}>
          {sections[index].label}
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
