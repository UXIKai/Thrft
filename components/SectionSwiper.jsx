import { useEffect, useRef } from 'react'
import useSectionSwipe from './useSectionSwipe.js'
import './SectionSwiper.css'

/**
 * A section picker without a wheel: the current section's icon over a row of dots,
 * and the content below swaps when it is swiped left or right (or a dot is tapped).
 * `controls` is the id of the panel the dots label, when the content already has one.
 * `onHold(sectionId)` fires when the icon or dots are held down on the current section.
 */
const HOLD_MS = 450
const HOLD_SLOP_PX = 10

export default function SectionSwiper({
  sections,
  value,
  onChange,
  label,
  idPrefix,
  controls,
  onHold,
  className = '',
  children,
}) {
  const index = Math.max(0, sections.findIndex((s) => s.id === value))
  const { ref, go } = useSectionSwipe({
    index,
    count: sections.length,
    onChange: (i) => onChange(sections[i].id),
  })
  const { Icon } = sections[index]

  const hold = useRef({ timer: 0, x: 0, y: 0, fired: false })
  const cancelHold = () => {
    window.clearTimeout(hold.current.timer)
    hold.current.timer = 0
  }
  useEffect(() => cancelHold, [])
  const onPointerDown = (e) => {
    if (!onHold || (e.pointerType === 'mouse' && e.button !== 0)) return
    const h = hold.current
    cancelHold()
    h.fired = false
    h.x = e.clientX
    h.y = e.clientY
    const id = sections[index].id
    h.timer = window.setTimeout(() => {
      h.timer = 0
      h.fired = true
      onHold(id)
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

  const onKeyDown = (e) => {
    let next
    if (e.key === 'ArrowLeft') next = index - 1
    else if (e.key === 'ArrowRight') next = index + 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = sections.length - 1
    else return
    e.preventDefault()
    if (next < 0 || next >= sections.length) return
    go(next)
    e.currentTarget.querySelector(`#${idPrefix}-${sections[next].id}-tab`)?.focus()
  }

  return (
    <>
      <div
        className="section-pager"
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
        onClickCapture={onClickCapture}
        onContextMenu={onHold ? (e) => e.preventDefault() : undefined}
      >
        <span className="section-pager-icon" aria-hidden="true">
          <Icon />
        </span>
        <div className="section-pager-dots">
          {sections.map(({ id, label: name }, i) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${idPrefix}-${id}-tab`}
              aria-label={name}
              aria-selected={i === index}
              aria-controls={controls}
              tabIndex={i === index ? 0 : -1}
              className={`section-pager-dot is-bare${i === index ? ' is-active' : ''}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
      </div>
      <div ref={ref} className={`section-swipe ${className}`.trim()}>
        {children}
      </div>
    </>
  )
}
