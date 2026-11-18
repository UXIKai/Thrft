import { useEffect, useRef, useState } from 'react'
import './ProductSpin.css'

const SLOP = 6

export default function ProductSpin({ count, label, children }) {
  const hostRef = useRef(null)
  const ringRef = useRef(null)
  const drag = useRef(null)
  const angle = useRef(0)
  const [width, setWidth] = useState(0)
  const step = 360 / count

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const measure = () => setWidth(host.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const apply = (animate) => {
    const ring = ringRef.current
    if (!ring) return
    ring.style.transition = animate ? 'transform .45s cubic-bezier(.2,.8,.2,1)' : 'none'
    ring.style.transform = `translateZ(${-radius}px) rotateY(${angle.current}deg)`
  }

  const radius = count < 3 ? width / 2 : width / 2 / Math.tan(Math.PI / count)

  useEffect(() => { apply(false) })

  const snap = (delta = 0) => {
    angle.current = Math.round(angle.current / step + delta) * step
    apply(true)
  }

  const onPointerDown = (event) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    drag.current = { id: event.pointerId, x: event.clientX, start: angle.current, last: event.clientX,
      lastT: event.timeStamp, v: 0, active: false }
  }
  const onPointerMove = (event) => {
    const d = drag.current
    if (!d || event.pointerId !== d.id) return
    const dx = event.clientX - d.x
    if (!d.active) {
      if (Math.abs(dx) < SLOP) return
      d.active = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const dt = Math.max(1, event.timeStamp - d.lastT)
    d.v = (event.clientX - d.last) / dt
    d.last = event.clientX
    d.lastT = event.timeStamp
    angle.current = d.start + (dx / Math.max(width, 1)) * 180
    apply(false)
  }
  const onPointerUp = (event) => {
    const d = drag.current
    if (!d || event.pointerId !== d.id) return
    drag.current = null
    if (!d.active) return
    snap(Math.abs(d.v) > 0.4 ? -Math.sign(d.v) * 0.5 : 0)
  }
  const onKeyDown = (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); snap(1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); snap(-1) }
  }

  return (
    <div ref={hostRef} className="product-spin" role="region" aria-label={label} tabIndex={0}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp} onKeyDown={onKeyDown}>
      <div ref={ringRef} className="product-spin-ring">
        {children.map((child, index) => (
          <div key={child.key} className="product-spin-face"
            style={{ transform: `rotateY(${index * step}deg) translateZ(${radius}px)` }}>{child}</div>
        ))}
      </div>
    </div>
  )
}
