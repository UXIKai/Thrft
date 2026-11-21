import { useRef } from 'react'
import { createPortal } from 'react-dom'
import './HoldMenu.css'

const HOLD_MS = 450
const SLOP = 8

// Press-and-hold (or right-click) opens a menu; the click that follows a hold is swallowed.
export function useHold(onHold) {
  const st = useRef({ timer: 0, x: 0, y: 0, fired: false })
  const cancel = () => { window.clearTimeout(st.current.timer); st.current.timer = 0 }
  return (payload) => ({
    onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      cancel()
      st.current.fired = false
      st.current.x = e.clientX
      st.current.y = e.clientY
      st.current.timer = window.setTimeout(() => {
        st.current.fired = true
        onHold(payload, { x: st.current.x, y: st.current.y })
      }, HOLD_MS)
    },
    onPointerMove(e) {
      if (st.current.timer && Math.hypot(e.clientX - st.current.x, e.clientY - st.current.y) > SLOP) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu(e) {
      e.preventDefault()
      cancel()
      st.current.fired = true
      onHold(payload, { x: e.clientX, y: e.clientY })
    },
    onClickCapture(e) {
      if (st.current.fired) { st.current.fired = false; e.preventDefault(); e.stopPropagation() }
    },
    style: { WebkitTouchCallout: 'none' },
  })
}

export default function HoldMenu({ x, y, actions, onClose }) {
  const width = 170
  const height = actions.length * 46 + 12
  const left = Math.max(8, Math.min(x - width / 2, window.innerWidth - width - 8))
  const top = Math.max(8, Math.min(y + 8, window.innerHeight - height - 8))
  return createPortal(
    <div className="hold-menu-backdrop" onPointerDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      <div className="hold-menu" role="menu" style={{ left, top, width }} onPointerDown={(e) => e.stopPropagation()}>
        {actions.map((a) => (
          <button key={a.label} type="button" role="menuitem" className={`hold-menu-item is-bare${a.danger ? ' is-danger' : ''}`}
            onClick={() => { onClose(); a.onClick() }}>
            {a.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}
