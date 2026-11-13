import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ClosetIcon, MarketIcon, StoreIcon } from './SegmentIcons.jsx'
import { stepNavigationSpring } from '../navigationSpring.js'

export const MAP_X = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22256%22%20height%3D%22128%22%20viewBox%3D%220%200%20256%20128%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%20y1%3D%220%22%20y2%3D%220%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22rgb%28255%2C0%2C0%29%22/%3E%3Cstop%20offset%3D%220.3%22%20stop-color%3D%22rgb%28128%2C0%2C0%29%22/%3E%3Cstop%20offset%3D%220.7%22%20stop-color%3D%22rgb%28128%2C0%2C0%29%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22rgb%280%2C0%2C0%29%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22256%22%20height%3D%22128%22%20fill%3D%22url%28%23g%29%22/%3E%3C/svg%3E"
export const MAP_Y = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22256%22%20height%3D%22128%22%20viewBox%3D%220%200%20256%20128%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%220%22%20y1%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22rgb%280%2C255%2C0%29%22/%3E%3Cstop%20offset%3D%220.3%22%20stop-color%3D%22rgb%280%2C128%2C0%29%22/%3E%3Cstop%20offset%3D%220.7%22%20stop-color%3D%22rgb%280%2C128%2C0%29%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22rgb%280%2C0%2C0%29%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22256%22%20height%3D%22128%22%20fill%3D%22url%28%23g%29%22/%3E%3C/svg%3E"


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

const CLOSET_OPTION = { id: 'closet', label: 'Closet', Icon: ClosetIcon }
const SLIDE_OPTIONS = [
  { id: 'store', label: 'Store', Icon: StoreIcon },
  { id: 'market', label: 'Market', Icon: MarketIcon },
]
// Finger travel (px) needed to slide from Store to Market.
const SLIDE_DRAG_PX = 70

export default function TabBar({ active = 'home', onChange, onCreate }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [createClosing, setCreateClosing] = useState(false)
  const [stageEl, setStageEl] = useState(null)
  const pageRef = useRef(null)
  const [hoverOpt, setHoverOpt] = useState(null)
  const [slideT, setSlideT] = useState(0)
  const slideRef = useRef(0)
  const navRef = useRef(null)
  const dragRef = useRef(null)
  const activeIdx = Math.max(0, TABS.findIndex((t) => t.id === active))
  const [dragPos, setDragPos] = useState(null)
  const [pressed, setPressed] = useState(false)
  const [releaseCount, setReleaseCount] = useState(0)
  const motionRef = useRef({
    position: { value: activeIdx, velocity: 0 },
    x: { value: 1, velocity: 0 },
    y: { value: 1, velocity: 0 },
    icon: { value: 1, velocity: 0 },
    activeIdx,
    releaseCount: 0,
  })
  const [lens, setLens] = useState({ w: 104, h: 56 })

  useLayoutEffect(() => {
    setStageEl(navRef.current?.closest('.stage') || null)
  }, [])

  useLayoutEffect(() => {
    const nav = navRef.current
    const bubble = nav.querySelector('.tab-pill')
    const icons = [...nav.querySelectorAll('.tab-item .tab-icon')]
    const motion = motionRef.current
    const released = motion.releaseCount !== releaseCount
    const changed = motion.activeIdx !== activeIdx
    motion.activeIdx = activeIdx
    motion.releaseCount = releaseCount
    const target = dragPos ?? activeIdx
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame
    let lastTime = performance.now()

    if (!pressed && (released || changed) && !media.matches) {
      motion.x = { value: 1.12, velocity: 0 }
      motion.y = { value: 0.94, velocity: 0 }
      motion.icon = { value: 1.15, velocity: 0 }
    }

    const paint = () => {
      nav.style.setProperty('--tab-i', motion.position.value)
      bubble.style.transform = `scale(${motion.x.value}, ${motion.y.value})`
      icons.forEach((icon, index) => {
        icon.style.transform = `scale(${index === activeIdx ? motion.icon.value : 1})`
      })
    }
    const finish = () => {
      motion.position = { value: target, velocity: 0 }
      motion.x = { value: pressed && !media.matches ? 0.92 : 1, velocity: 0 }
      motion.y = { ...motion.x }
      motion.icon = { value: 1, velocity: 0 }
      paint()
    }
    const tick = (time) => {
      if (media.matches) {
        finish()
        return
      }
      const dt = Math.min((time - lastTime) / 1000, 0.032)
      lastTime = time
      const targets = { position: target, x: pressed ? 0.92 : 1, y: pressed ? 0.92 : 1, icon: 1 }
      let moving = false
      for (const key of Object.keys(targets)) {
        motion[key] = key === 'position' && dragPos !== null
          ? { value: target, velocity: 0 }
          : stepNavigationSpring(motion[key].value, motion[key].velocity, targets[key], dt)
        moving ||= Math.abs(motion[key].value - targets[key]) > 0.0001 || Math.abs(motion[key].velocity) > 0.001
      }
      paint()
      if (moving) frame = requestAnimationFrame(tick)
      else finish()
    }
    const onReducedMotion = () => {
      if (media.matches) {
        cancelAnimationFrame(frame)
        finish()
      }
    }
    media.addEventListener('change', onReducedMotion)
    if (media.matches) finish()
    else frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      media.removeEventListener('change', onReducedMotion)
    }
  }, [activeIdx, dragPos, pressed, releaseCount])

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

  useEffect(() => {
    if (createOpen) return undefined
    setCreateClosing(true)
    const t = setTimeout(() => setCreateClosing(false), 400)
    return () => clearTimeout(t)
  }, [createOpen])

  useEffect(() => {
    if (!stageEl) return undefined
    stageEl.classList.toggle('is-create-page-open', createOpen)
    return () => stageEl.classList.remove('is-create-page-open')
  }, [createOpen, stageEl])

  const openCreate = () => {
    const nav = navRef.current
    if (nav) {
      nav.style.setProperty('--bar-w', `${nav.offsetWidth}px`)
      nav.style.setProperty('--bar-h', `${nav.offsetHeight}px`)
      const stage = nav.closest('.stage')
      if (stage && pageRef.current) {
        const gap = stage.getBoundingClientRect().bottom - nav.getBoundingClientRect().top + 12
        pageRef.current.style.setProperty('--menu-bottom', `${gap}px`)
      }
    }
    setCreateOpen(true)
  }
  const toggleCreate = () => (createOpen ? setCreateOpen(false) : openCreate())

  useEffect(() => {
    if (!createOpen) return undefined
    const close = (e) => {
      if (navRef.current?.contains(e.target) || e.target.closest?.('.create-menu-btn, .create-slider')) return
      setCreateOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setCreateOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [createOpen])

  const pickCreate = (segment) => {
    setCreateOpen(false)
    setHoverOpt(null)
    onCreate?.(segment)
  }

  const setSlide = (t) => {
    slideRef.current = t
    setSlideT(t)
  }

  // Closet sits above; everything at the Store/Market slider's height (any x) drives the slider.
  const zoneAt = (e) => {
    const page = pageRef.current
    const closet = page?.querySelector('.is-closet')?.getBoundingClientRect()
    const slider = page?.querySelector('.create-slider')?.getBoundingClientRect()
    if (!closet || !slider) return null
    if (e.clientY < (closet.bottom + slider.top) / 2) {
      return Math.abs(e.clientX - (closet.left + closet.right) / 2) < 90 ? 'closet' : null
    }
    return e.clientY < slider.bottom + 24 ? 'slider' : null
  }

  const posFromEvent = (e) => {
    const r = navRef.current.getBoundingClientRect()
    const raw = ((e.clientX - r.left) / r.width) * TABS.length - 0.5
    return Math.min(TABS.length - 1, Math.max(0, raw))
  }

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    const onPlus = TABS[Math.round(posFromEvent(e))]?.id === 'design'
    const d = { moved: false, startX: e.clientX, startY: e.clientY, create: onPlus, held: false, timer: null }
    dragRef.current = d
    navRef.current.setPointerCapture?.(e.pointerId)
    setPressed(true)
    if (onPlus) {
      d.timer = setTimeout(() => {
        if (dragRef.current !== d) return
        d.held = true
        navigator.vibrate?.(10)
        openCreate()
      }, 220)
    }
  }
  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    if (d.create) {
      if (d.held) {
        const zone = zoneAt(e)
        setHoverOpt(zone)
        if (zone === 'slider') {
          if (d.anchorX == null) {
            d.anchorX = e.clientX
            d.baseT = slideRef.current
          }
          setSlide(Math.min(1, Math.max(0, d.baseT - (e.clientX - d.anchorX) / SLIDE_DRAG_PX)))
        } else if (d.anchorX != null) {
          d.anchorX = null
          setSlide(Math.round(slideRef.current))
        }
        return
      }
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 10) return
      clearTimeout(d.timer)
      d.create = false
    }
    if (Math.abs(e.clientX - d.startX) > 6) d.moved = true
    if (d.moved) setDragPos(posFromEvent(e))
  }
  const endDrag = (e, commit) => {
    const d = dragRef.current
    if (!d) return
    clearTimeout(d.timer)
    dragRef.current = null
    setPressed(false)
    if (d.create) {
      // A quick tap on the plus does nothing; it only works as hold, drag onto an option, release.
      if (d.held) {
        const zone = commit ? zoneAt(e) : null
        setHoverOpt(null)
        setSlide(Math.round(slideRef.current))
        if (zone === 'closet') pickCreate('closet')
        else if (zone === 'slider') pickCreate(slideRef.current < 0.5 ? 'store' : 'market')
        else setCreateOpen(false)
      }
      return
    }
    const idx = Math.round(posFromEvent(e))
    setDragPos(null)
    if (!commit || !TABS[idx]) return
    if (TABS[idx].id === 'design') return
    setReleaseCount((count) => count + 1)
    setCreateOpen(false)
    if (TABS[idx].id !== active) onChange?.(TABS[idx].id)
  }

  return (
    <>
    <nav
      ref={navRef}
      className={`tab-bar${pressed ? ' is-pressed' : ''}${dragPos !== null ? ' is-dragging' : ''}${createOpen ? ' is-create-open' : ''}${createClosing ? ' is-create-closing' : ''}`}
      aria-label="Main"
      style={{ touchAction: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
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
            <feDisplacementMap in="SourceGraphic" in2="map" scale="52" xChannelSelector="R" yChannelSelector="G" />
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
      {TABS.map((tab, index) => {
        const selected = tab.id === active && !createOpen
        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-item ${selected ? 'is-active' : ''}${tab.id === 'design' ? ' is-create' : ''}`}
            style={{ '--tab-n': index - 2 }}
            aria-current={selected ? 'page' : undefined}
            aria-label={tab.label}
            onClick={(e) => {
              if (e.detail !== 0) return
              setReleaseCount((count) => count + 1)
              if (tab.id === 'design') {
                toggleCreate()
                return
              }
              setCreateOpen(false)
              onChange?.(tab.id)
            }}
          >
            {tab.icon}
          </button>
        )
      })}
      </div>
    </nav>
    {stageEl && createPortal(
    <div
      ref={pageRef}
      className={`create-page${createOpen ? ' is-open' : ''}`}
      role="menu"
      aria-label="Create"
      aria-hidden={!createOpen}
    >
      <button
        type="button"
        role="menuitem"
        tabIndex={createOpen ? 0 : -1}
        data-create={CLOSET_OPTION.id}
        className={`create-menu-btn is-closet${hoverOpt === 'closet' ? ' is-hover' : ''}`}
        onClick={() => pickCreate(CLOSET_OPTION.id)}
      >
        <CLOSET_OPTION.Icon className="create-menu-ico" />
        <span>{CLOSET_OPTION.label}</span>
      </button>
      <div
        className={`create-slider${hoverOpt === 'slider' ? ' is-hover' : ''}`}
        role="group"
        aria-label="Store or Market"
        style={{ '--t': slideT }}
      >
        <div className="create-slider-track">
          {SLIDE_OPTIONS.map(({ id, label, Icon }, i) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              tabIndex={createOpen ? 0 : -1}
              data-create={id}
              className="create-slide-btn"
              onClick={() => pickCreate(id)}
              onFocus={() => setSlide(i)}
            >
              <Icon className="create-menu-ico" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="create-slider-dots" aria-hidden="true">
          <i />
          <i />
        </div>
      </div>
    </div>,
      stageEl,
    )}
    </>
  )
}
