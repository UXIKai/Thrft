import { useEffect, useRef } from 'react'

const START_PX = 12
const CLOSE_FRACTION = 0.3
const CLOSE_VELOCITY = 0.5

/**
 * Swipe a page to the right to dismiss it. The page follows the finger and either
 * flies out (then `onClose` runs) or springs back.
 */
export default function useSwipeBack(onClose, enabled = true) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return undefined
    let start = null
    let dragging = false

    const reset = (animate) => {
      el.style.transition = animate ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' : ''
      el.style.transform = ''
    }

    const down = (e) => {
      if (!e.isPrimary || e.pointerType === 'mouse') return
      if (e.target.closest?.('input, textarea, select, [data-no-swipe-back]')) return
      start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }
      dragging = false
    }

    const move = (e) => {
      if (!start || e.pointerId !== start.id) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (!dragging) {
        if (Math.abs(dy) > START_PX && Math.abs(dy) > Math.abs(dx)) {
          start = null
          return
        }
        if (dx < START_PX || dx < Math.abs(dy) * 1.5) return
        dragging = true
        try { el.setPointerCapture?.(e.pointerId) } catch { /* pointer already gone */ }
        el.style.transition = 'none'
      }
      el.style.transform = `translateX(${Math.max(0, dx)}px)`
    }

    const up = (e) => {
      if (!start || e.pointerId !== start.id) return
      const wasDragging = dragging
      const dx = e.clientX - start.x
      const velocity = dx / Math.max(1, performance.now() - start.t)
      start = null
      dragging = false
      if (!wasDragging) return
      if (dx > el.clientWidth * CLOSE_FRACTION || velocity > CLOSE_VELOCITY) {
        el.style.transition = 'transform 0.2s ease-out'
        el.style.transform = 'translateX(100%)'
        setTimeout(() => closeRef.current?.(), 200)
      } else {
        reset(true)
      }
    }

    const cancel = () => {
      start = null
      if (dragging) reset(true)
      dragging = false
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
    }
  }, [enabled])

  return ref
}
