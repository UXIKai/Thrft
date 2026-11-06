import { useRef, useState } from 'react'

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

  const posFromEvent = (e) => {
    const r = navRef.current.getBoundingClientRect()
    const raw = ((e.clientX - r.left) / r.width) * TABS.length - 0.5
    return Math.min(TABS.length - 1, Math.max(0, raw))
  }

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    dragRef.current = { moved: false, startX: e.clientX }
    navRef.current.setPointerCapture?.(e.pointerId)
    setDragPos(posFromEvent(e))
  }
  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    if (Math.abs(e.clientX - d.startX) > 4) d.moved = true
    setDragPos(posFromEvent(e))
  }
  const endDrag = (e, commit) => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    const idx = Math.round(posFromEvent(e))
    setDragPos(null)
    if (commit && TABS[idx] && TABS[idx].id !== active) onChange?.(TABS[idx].id)
  }

  const pos = dragPos ?? activeIdx
  return (
    <nav
      ref={navRef}
      className={`tab-bar ${dragPos !== null ? 'is-dragging' : ''}`}
      aria-label="Main"
      style={{ '--tab-i': pos, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e, true)}
      onPointerCancel={(e) => endDrag(e, false)}
    >
      <span className="tab-pill" aria-hidden="true">
        <span className="tab-lens-inner">
          {TABS.map((tab) => (
            <span key={tab.id} className="tab-lens-item">
              {tab.icon}
            </span>
          ))}
        </span>
      </span>
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
    </nav>
  )
}
