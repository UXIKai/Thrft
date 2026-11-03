import { useMemo, useRef } from 'react'

const ORBIT_ANGLE = 48
const ORBIT_RADIUS = 168
const STRIP_STEP = 96
const WHEEL_STEP = 38
const WHEEL_STEP_COMPACT = 28
const WHEEL_ANGLE = 26
const WHEEL_ANGLE_COMPACT = 18
const VISIBLE_OFFSETS = [-2, -1, 0, 1, 2]
const COMPACT_WHEEL_OFFSETS = [-1, 0, 1]
const DRAG_THRESHOLD = 10
const WHEEL_DRAG_THRESHOLD = 8

function ChevronLeft() {
  return (
    <svg className="type-strip-arrow-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.5 5.5 8 12l6.5 6.5"
      />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg className="type-strip-arrow-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.5 5.5 16 12l-6.5 6.5"
      />
    </svg>
  )
}

function wrapIndex(index, total) {
  if (total <= 0) return 0
  return ((index % total) + total) % total
}

/**
 * One-step centered carousel.
 * "orbit" = 3D ring, "strip" = flat side chips, "wheel" = Apple timer drum.
 */
export default function OrbitCarousel({
  items = [],
  activeId,
  onSelect,
  onActivate,
  ariaLabel = 'Options',
  prevLabel = 'Previous',
  nextLabel = 'Next',
  className = '',
  variant = 'orbit',
  /** Closet-style: short drum that only reveals the centered word. */
  compact = false,
}) {
  const isStrip = variant === 'strip'
  const isWheel = variant === 'wheel'
  const isCompactWheel = isWheel && compact
  const total = items.length
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  )
  const dragRef = useRef({ active: false, start: 0, lastStep: 0 })
  const offsets = isCompactWheel ? COMPACT_WHEEL_OFFSETS : VISIBLE_OFFSETS
  const wheelStep = isCompactWheel ? WHEEL_STEP_COMPACT : WHEEL_STEP
  const wheelAngle = isCompactWheel ? WHEEL_ANGLE_COMPACT : WHEEL_ANGLE

  const orbitItems = useMemo(() => {
    if (total < 1) return []
    return offsets.map((offset) => {
      const index = wrapIndex(activeIndex + offset, total)
      return {
        offset,
        index,
        item: items[index],
      }
    })
  }, [activeIndex, items, total, offsets])

  function step(direction) {
    if (total < 1) return
    const delta = direction === 'prev' || direction === 'left' ? -1 : 1
    const next = wrapIndex(activeIndex + delta, total)
    onSelect?.(items[next].id)
  }

  function handleSelect(id) {
    onSelect?.(id)
    onActivate?.(id)
  }

  function onPointerDown(event) {
    if (!isWheel && !isStrip) return
    dragRef.current = {
      active: true,
      start: isWheel ? event.clientY : event.clientX,
      lastStep: 0,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event) {
    const drag = dragRef.current
    if (!drag.active) return
    const pos = isWheel ? event.clientY : event.clientX
    const delta = pos - drag.start
    const threshold = isWheel ? WHEEL_DRAG_THRESHOLD : DRAG_THRESHOLD
    const steps = Math.trunc(delta / threshold)
    if (steps === drag.lastStep) return
    const diff = steps - drag.lastStep
    drag.lastStep = steps
    if (diff > 0) {
      for (let i = 0; i < diff; i += 1) step(isWheel ? 'prev' : 'left')
    } else {
      for (let i = 0; i < -diff; i += 1) step(isWheel ? 'next' : 'right')
    }
  }

  function onPointerUp(event) {
    dragRef.current.active = false
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  function onWheel(event) {
    if (!isWheel && !isStrip) return
    event.preventDefault()
    if (event.deltaY > 0 || event.deltaX > 0) step('next')
    else if (event.deltaY < 0 || event.deltaX < 0) step('prev')
  }

  function onKeyDown(event) {
    if (isWheel) {
      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault()
        step('prev')
      } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault()
        step('next')
      }
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step('prev')
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      step('next')
    }
  }

  const wrapClass = [
    'type-strip-wrap',
    isStrip ? 'is-strip' : '',
    isWheel ? 'is-wheel' : '',
    isCompactWheel ? 'is-compact-wheel' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={wrapClass} aria-label={ariaLabel}>
      {!isWheel && (
        <div className="type-strip-side is-start">
          <button
            type="button"
            className="type-strip-arrow"
            aria-label={prevLabel}
            onClick={() => step('prev')}
          >
            <ChevronLeft />
          </button>
        </div>
      )}

      <div
        className={`type-carousel${isStrip ? ' is-strip' : ''}${
          isWheel ? ' is-wheel' : ''
        }`}
        aria-live="polite"
        tabIndex={isWheel ? 0 : undefined}
        role={isWheel ? 'listbox' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        {isWheel && <div className="type-wheel-band" aria-hidden />}
        <div className="type-carousel-stage">
          {orbitItems.map(({ item, offset }) => {
            if (!item) return null
            const selected = offset === 0
            const abs = Math.abs(offset)
            let scale
            let opacity
            let transform
            if (isWheel) {
              if (isCompactWheel) {
                scale = 1
                // Keep neighbors mounted for scroll physics, but only show center.
                opacity = selected ? 1 : 0
              } else {
                scale = selected ? 1 : Math.max(0.72, 1 - abs * 0.12)
                opacity = selected ? 1 : Math.max(0.18, 1 - abs * 0.28)
              }
              transform = `translate(-50%, -50%) translateY(${
                offset * wheelStep
              }px) rotateX(${-offset * wheelAngle}deg) scale(${scale})`
            } else if (isStrip) {
              scale = selected ? 1 : Math.max(0.88, 1 - abs * 0.06)
              opacity = selected ? 1 : Math.max(0.4, 1 - abs * 0.22)
              transform = `translate(-50%, -50%) translateX(${
                offset * STRIP_STEP
              }px) scale(${scale})`
            } else {
              scale = selected ? 1 : Math.max(0.68, 1 - abs * 0.14)
              opacity = selected ? 1 : Math.max(0.22, 1 - abs * 0.32)
              transform = `translate(-50%, calc(-50% + ${abs * 6}px)) rotateY(${
                offset * ORBIT_ANGLE
              }deg) translateZ(${ORBIT_RADIUS}px) scale(${scale})`
            }
            return (
              <button
                key={`${item.id ?? 'none'}-${offset}`}
                type="button"
                className={`type-box type-box-orbit${
                  isStrip ? ' is-strip' : ''
                }${isWheel ? ' is-wheel' : ''}${selected ? ' is-active' : ''}`}
                aria-pressed={selected}
                aria-label={item.label || 'None'}
                tabIndex={selected ? 0 : -1}
                onClick={() => handleSelect(item.id)}
                style={{
                  opacity,
                  zIndex: 20 - abs,
                  filter:
                    selected || isStrip || isWheel
                      ? 'none'
                      : `blur(${abs * 0.45}px)`,
                  transform,
                }}
              >
                {item.label || '\u00a0'}
              </button>
            )
          })}
        </div>
      </div>

      {!isWheel && (
        <div className="type-strip-side is-end">
          <button
            type="button"
            className="type-strip-arrow"
            aria-label={nextLabel}
            onClick={() => step('next')}
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </section>
  )
}
