import { useLayoutEffect, useRef, useState } from 'react'

const MAP_X = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22256%22%20height%3D%22128%22%20viewBox%3D%220%200%20256%20128%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%20y1%3D%220%22%20y2%3D%220%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22rgb%28255%2C0%2C0%29%22/%3E%3Cstop%20offset%3D%220.3%22%20stop-color%3D%22rgb%28128%2C0%2C0%29%22/%3E%3Cstop%20offset%3D%220.7%22%20stop-color%3D%22rgb%28128%2C0%2C0%29%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22rgb%280%2C0%2C0%29%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22256%22%20height%3D%22128%22%20fill%3D%22url%28%23g%29%22/%3E%3C/svg%3E"
const MAP_Y = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22256%22%20height%3D%22128%22%20viewBox%3D%220%200%20256%20128%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%220%22%20y1%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22rgb%280%2C255%2C0%29%22/%3E%3Cstop%20offset%3D%220.3%22%20stop-color%3D%22rgb%280%2C128%2C0%29%22/%3E%3Cstop%20offset%3D%220.7%22%20stop-color%3D%22rgb%280%2C128%2C0%29%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22rgb%280%2C0%2C0%29%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22256%22%20height%3D%22128%22%20fill%3D%22url%28%23g%29%22/%3E%3C/svg%3E"


const TABS = [
  {
    id: 'home',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="tab-icon">
        <path
          fill="currentColor"
          d="M12 3.2 3.5 10.2V21h6.2v-6.4h4.6V21h6.2V10.2L12 3.2z"
        />
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="tab-icon">
        <path
          fill="currentColor"
          d="M4 4.8h16A1.2 1.2 0 0 1 21.2 6v9.2a1.2 1.2 0 0 1-1.2 1.2H9.4L4.8 20.4V16.4H4A1.2 1.2 0 0 1 2.8 15.2V6A1.2 1.2 0 0 1 4 4.8z"
        />
      </svg>
    ),
  },
  {
    id: 'design',
    label: 'Create',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="tab-icon tab-icon-plus">
        <path
          fill="currentColor"
          d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"
        />
      </svg>
    ),
  },
  {
    id: 'saved',
    label: 'Saved',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="tab-icon">
        <path
          fill="currentColor"
          d="M12 20.4S3.6 15.1 3.6 9.7A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 8.4 2.5c0 5.4-8.4 10.7-8.4 10.7z"
        />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="tab-icon">
        <circle cx="12" cy="8" r="3.4" fill="currentColor" />
        <path
          fill="currentColor"
          d="M5.2 19.6c.6-3.4 3.3-5.2 6.8-5.2s6.2 1.8 6.8 5.2H5.2z"
        />
      </svg>
    ),
  },
]

export default function TabBar({ active = 'home', onChange }) {
  const navRef = useRef(null)
  const dragRef = useRef(null)
  const activeIdx = Math.max(0, TABS.findIndex((t) => t.id === active))
  const [dragPos, setDragPos] = useState(null)
  const [pressed, setPressed] = useState(false)
  const [lens, setLens] = useState({ w: 104, h: 56 })

  // The bubble's refraction map needs the lens size in pixels.
  useLayoutEffect(() => {
    const el = navRef.current
    if (!el) return undefined
    const measure = () => {
      const w = Math.round(el.offsetWidth / TABS.length)
      const h = Math.round(el.offsetHeight)
      setLens((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const posFromEvent = (e) => {
    const r = navRef.current.getBoundingClientRect()
    const raw = ((e.clientX - r.left) / r.width) * TABS.length - 0.5
    return Math.min(TABS.length - 1, Math.max(0, raw))
  }

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    dragRef.current = { moved: false, startX: e.clientX }
    navRef.current.setPointerCapture?.(e.pointerId)
    setPressed(true)
  }
  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    if (Math.abs(e.clientX - d.startX) > 6) d.moved = true
    if (d.moved) setDragPos(posFromEvent(e))
  }
  const endDrag = (e, commit) => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    const idx = Math.round(posFromEvent(e))
    setDragPos(null)
    setPressed(false)
    if (commit && TABS[idx] && TABS[idx].id !== active) onChange?.(TABS[idx].id)
  }

  const pos = dragPos ?? activeIdx
  return (
    <nav
      ref={navRef}
      className={`tab-bar${pressed ? ' is-pressed' : ''}${dragPos !== null ? ' is-dragging' : ''}`}
      aria-label="Main"
      style={{ '--tab-i': pos, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e, true)}
      onPointerCancel={(e) => endDrag(e, false)}
    >
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <filter
            id="lg-bubble"
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={lens.w}
            height={lens.h}
            colorInterpolationFilters="sRGB"
          >
            <feImage href={MAP_X} x="0" y="0" width={lens.w} height={lens.h} preserveAspectRatio="none" result="mx" />
            <feImage href={MAP_Y} x="0" y="0" width={lens.w} height={lens.h} preserveAspectRatio="none" result="my" />
            <feComposite in="mx" in2="my" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="30" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <span className="tab-pill" aria-hidden="true">
        <span className="tab-lens-inner">
          {TABS.map((tab) => (
            <span key={tab.id} className="tab-lens-item">
              {tab.icon}
            </span>
          ))}
        </span>
      </span>
      <div className="tab-items">
      {TABS.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-item ${selected ? 'is-active' : ''}`}
            aria-current={selected ? 'page' : undefined}
            aria-label={tab.label}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onChange?.(tab.id)
            }}
          >
            {tab.icon}
          </button>
        )
      })}
      </div>
    </nav>
  )
}
