import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

const START_PX = 12
const SWITCH_FRACTION = 0.25
const SWITCH_VELOCITY = 0.4
const END_RESISTANCE = 0.3
const SHIFT_PX = 72
const EXIT_MS = 140
const ENTER_MS = 240
const SPRING = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease-out'

/**
 * Swipe a section left or right to open its neighbour: the content follows the finger,
 * slides out, and the next section slides in from the other side. Touch and pen only;
 * `go(i)` runs the same slide for dots and keys. Mark inner areas that scroll or drag
 * sideways themselves with `data-no-section-swipe`.
 */
export default function useSectionSwipe({ index, count, onChange }) {
  const ref = useRef(null)
  const live = useRef(null)
  live.current = { index, count, onChange }
  const enterFrom = useRef(0)
  const busy = useRef(false)
  const timers = useRef(new Set())

  const later = useCallback((fn, ms) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }, [])

  const settle = useCallback(() => {
    const el = ref.current
    enterFrom.current = 0
    busy.current = false
    if (!el) return
    el.style.transition = ''
    el.style.transform = ''
    el.style.opacity = ''
  }, [])

  // Slide the current section out, switch, then the layout effect below slides the new one in.
  const go = useCallback(
    (to, fromX = 0) => {
      const { index: now, count: total, onChange: change } = live.current
      const el = ref.current
      if (!el || busy.current || to === now || to < 0 || to >= total) return
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        change(to)
        return
      }
      const dir = Math.sign(to - now)
      busy.current = true
      enterFrom.current = dir
      el.style.transition = `transform ${EXIT_MS}ms ease-in, opacity ${EXIT_MS}ms ease-in`
      el.style.transform = `translateX(${fromX - dir * SHIFT_PX}px)`
      el.style.opacity = '0'
      later(() => {
        change(to)
        // The parent declined the change: put the section back instead of leaving it hidden.
        later(() => {
          if (enterFrom.current) settle()
        }, 150)
      }, EXIT_MS)
    },
    [later, settle],
  )

  useLayoutEffect(() => {
    const dir = enterFrom.current
    if (!dir) return
    enterFrom.current = 0
    const el = ref.current
    if (!el) {
      busy.current = false
      return
    }
    el.style.transition = 'none'
    el.style.transform = `translateX(${dir * SHIFT_PX}px)`
    el.style.opacity = '0'
    void el.offsetWidth
    el.style.transition = `transform ${ENTER_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${ENTER_MS}ms ease-out`
    el.style.transform = ''
    el.style.opacity = ''
    later(settle, ENTER_MS)
  }, [index, later, settle])

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    let start = null
    let dragging = false
    let swallowClick = false

    const offset = (dx) => {
      const { index: now, count: total } = live.current
      const atEnd = (dx > 0 && now === 0) || (dx < 0 && now === total - 1)
      return atEnd ? dx * END_RESISTANCE : dx
    }
    const paint = (x) => {
      el.style.transform = x ? `translateX(${x}px)` : ''
      el.style.opacity = x ? String(1 - Math.min(0.5, Math.abs(x) / Math.max(1, el.clientWidth))) : ''
    }
    const springBack = () => {
      el.style.transition = SPRING
      paint(0)
      later(() => {
        if (!busy.current) el.style.transition = ''
      }, 260)
    }

    const down = (e) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || busy.current) return
      if (e.target.closest?.('input, textarea, select, [data-no-section-swipe]')) return
      start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }
      dragging = false
    }

    const move = (e) => {
      if (!start || e.pointerId !== start.id) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (!dragging) {
        // Mostly vertical: leave it to the page scroll.
        if (Math.abs(dy) > START_PX && Math.abs(dy) > Math.abs(dx)) {
          start = null
          return
        }
        if (Math.abs(dx) < START_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          // The pointer is already gone.
        }
        if (!el.hasPointerCapture(e.pointerId)) {
          // The press ended elsewhere, so there is nothing left to drag.
          start = null
          return
        }
        dragging = true
        el.style.transition = 'none'
      }
      paint(offset(dx - Math.sign(dx) * START_PX))
    }

    const up = (e) => {
      if (!start || e.pointerId !== start.id) return
      const wasDragging = dragging
      const dx = e.clientX - start.x
      const velocity = dx / Math.max(1, performance.now() - start.t)
      start = null
      dragging = false
      if (!wasDragging) return
      swallowClick = true
      later(() => {
        swallowClick = false
      }, 0)
      const { index: now, count: total } = live.current
      const to = now + (dx < 0 ? 1 : -1)
      const far =
        Math.abs(dx) > el.clientWidth * SWITCH_FRACTION ||
        (Math.abs(dx) > 30 && Math.abs(velocity) > SWITCH_VELOCITY)
      if (far && to >= 0 && to < total) go(to, offset(dx - Math.sign(dx) * START_PX))
      else springBack()
    }

    const cancel = () => {
      start = null
      if (!dragging) return
      dragging = false
      springBack()
    }

    // A swipe that began on a card or button must not also open it.
    const click = (e) => {
      if (!swallowClick) return
      swallowClick = false
      e.stopPropagation()
      e.preventDefault()
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    el.addEventListener('click', click, true)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
      el.removeEventListener('click', click, true)
    }
  }, [go, later])

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      timers.current.clear()
    },
    [],
  )

  return { ref, go }
}
