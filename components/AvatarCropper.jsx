import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './AvatarCropper.css'

const STAGE = 300
const MIN_FRAME = 90
const OUT = 512

export default function AvatarCropper({ file, onCancel, onDone }) {
  const [src, setSrc] = useState('')
  const [nat, setNat] = useState(null)
  const [frame, setFrame] = useState(240)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  const imgRef = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Keeps the photo covering the square so no empty edges get cropped in.
  function fit(v, f = frame, n = nat) {
    if (!n) return v
    const minS = f / Math.min(n.w, n.h)
    const s = Math.min(Math.max(v.s, minS), minS * 8)
    const limX = Math.max(0, (n.w * s - f) / 2)
    const limY = Math.max(0, (n.h * s - f) / 2)
    return { s, x: Math.min(limX, Math.max(-limX, v.x)), y: Math.min(limY, Math.max(-limY, v.y)) }
  }

  function onLoad(e) {
    const n = { w: e.target.naturalWidth, h: e.target.naturalHeight }
    const f = Math.min(240, STAGE - 20)
    setNat(n)
    setFrame(f)
    setView(fit({ s: 0, x: 0, y: 0 }, f, n))
  }

  function begin() {
    const pts = [...pointers.current.values()]
    gesture.current = {
      view,
      p0: pts[0],
      dist: pts[1] ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 0,
    }
  }

  function down(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    begin()
  }

  function move(e) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    const g = gesture.current
    if (pts.length >= 2 && g.dist) {
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      setView(fit({ ...g.view, s: g.view.s * (dist / g.dist) }))
    } else if (g.p0 && pts.length === 1) {
      setView(fit({ ...g.view, x: g.view.x + pts[0].x - g.p0.x, y: g.view.y + pts[0].y - g.p0.y }))
    }
  }

  function up(e) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size) begin()
    else gesture.current = null
  }

  function onWheel(e) {
    setView((v) => fit({ ...v, s: v.s * Math.exp(-e.deltaY * 0.0015) }))
  }

  function resizeFrame(e) {
    if (e.buttons === 0 && e.pointerType === 'mouse') return
    const rect = e.currentTarget.parentElement.getBoundingClientRect()
    const half = Math.max(Math.abs(e.clientX - (rect.left + rect.width / 2)), Math.abs(e.clientY - (rect.top + rect.height / 2)))
    const f = Math.min(STAGE - 8, Math.max(MIN_FRAME, half * 2))
    setFrame(f)
    setView((v) => fit(v, f))
  }

  async function save() {
    if (!nat || busy) return
    setBusy(true)
    const size = frame / view.s
    const sx = nat.w / 2 - view.x / view.s - size / 2
    const sy = nat.h / 2 - view.y / view.s - size / 2
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    canvas.getContext('2d').drawImage(imgRef.current, sx, sy, size, size, 0, 0, OUT, OUT)
    onDone(canvas.toDataURL('image/jpeg', 0.86))
  }

  const stage = document.querySelector('.stage') || document.body
  return createPortal(
    <div className="avatar-cropper" role="dialog" aria-label="Adjust profile photo">
      <p className="avatar-cropper-hint">Pinch or scroll to zoom, drag to move, drag the corners to resize</p>
      <div className="avatar-cropper-stage" style={{ width: STAGE, height: STAGE }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={onWheel}>
        {src && (
          <img ref={imgRef} src={src} alt="" draggable="false" onLoad={onLoad}
            style={nat ? { width: nat.w * view.s, height: nat.h * view.s,
              transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))` } : { opacity: 0 }} />
        )}
        <div className="avatar-cropper-frame" style={{ width: frame, height: frame }}>
          {['tl', 'tr', 'bl', 'br'].map((c) => (
            <span key={c} className={`avatar-cropper-handle is-${c}`}
              onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId) }}
              onPointerMove={(e) => { e.stopPropagation(); if (e.currentTarget.hasPointerCapture?.(e.pointerId)) resizeFrame(e) }} />
          ))}
        </div>
      </div>
      <div className="avatar-cropper-actions">
        <button type="button" className="is-bare" onClick={onCancel}>Cancel</button>
        <button type="button" className="is-bare is-primary" disabled={!nat || busy} onClick={save}>Save</button>
      </div>
    </div>,
    stage,
  )
}
