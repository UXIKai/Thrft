import { useLayoutEffect, useRef } from 'react'

// The open ninja star's top blade; the other arrows are 90-degree turns of it (set in CSS).
export const arrow = (
  <svg viewBox="313 39 146 238" aria-hidden="true"><polygon points="389,39 459,175 410,277 313,214" fill="currentColor" stroke="currentColor" strokeWidth="12" strokeLinejoin="round" /></svg>
)

// One blade (top one) per animation frame, open -> closed; the other three are 90-degree turns of it.
const STAR_FRAMES = [
  '389,39 459,175 410,277 313,214',
  '345,74 455,180 441,293 329,265',
  '332,106 452,200 450,314 336,298',
  '357,123 457,238 433,350 323,313',
  '413,147 458,293 393,385 307,305',
]

const STAR_MS = 900
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
// Overshoots a little, then settles, so the shutter clicks shut.
const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2

const FRAME_NUMS = STAR_FRAMES.map((f) => f.split(' ').map((pt) => pt.split(',').map(Number)))
const blendList = (list, p) => {
  const pos = Math.min(Math.max(p, 0), 1) * (list.length - 1)
  const i = Math.min(Math.floor(pos), list.length - 2)
  const f = pos - i
  return list[i]
    .map(([x, y], k) => `${(x + (list[i + 1][k][0] - x) * f).toFixed(1)},${(y + (list[i + 1][k][1] - y) * f).toFixed(1)}`)
    .join(' ')
}
const blendFrames = (p) => blendList(FRAME_NUMS, p)

/** The empty-middle state: four blades that twist shut like a camera shutter into a ninja star. */
function NinjaStar() {
  const groupRef = useRef(null)
  const bladeRefs = useRef([])

  useLayoutEffect(() => {
    const apply = (shape, spin) => {
      bladeRefs.current.forEach((el) => el?.setAttribute('points', shape))
      groupRef.current?.setAttribute('transform', `rotate(${spin.toFixed(2)} 400 400)`)
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      apply(blendFrames(1), 0)
      return undefined
    }
    let raf = 0
    let start = 0
    const tick = (now) => {
      if (!start) start = now
      const t = Math.min((now - start) / STAR_MS, 1)
      apply(blendFrames(easeInOutCubic(t)), 90 * easeOutBack(t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    apply(blendFrames(0), 0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <svg className="ninja-star" viewBox="0 0 800 800" aria-hidden="true">
      <defs>
        <linearGradient id="ninja-star-chrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="ns-hi" />
          <stop offset="0.45" className="ns-mid" />
          <stop offset="1" className="ns-lo" />
        </linearGradient>
      </defs>
      <g ref={groupRef}>
        {[0, 90, 180, 270].map((deg, i) => (
          <polygon
            key={deg}
            ref={(el) => { bladeRefs.current[i] = el }}
            className="ns-blade"
            transform={`rotate(${deg} 400 400)`}
            points={STAR_FRAMES[0]}
            fill="url(#ninja-star-chrome)"
          />
        ))}
      </g>
    </svg>
  )
}

// Where the real arrows sit, in star units: the open frame pushed out from the centre.
const PUSH_UNITS = { vertical: 82, horizontal: 126 }
const OPEN_MS = 950

/**
 * Plays the shutter backwards: the closed star opens up into the four arrows, then hands over to them.
 * `final` is the end opacity of each arrow (up, right, down, left), 0 for hidden ones.
 */
export function OpeningStar({ final = [1, 1, 1, 1], onDone }) {
  const groupRef = useRef(null)
  const bladeRefs = useRef([])
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useLayoutEffect(() => {
    const open = FRAME_NUMS[0]
    const lists = [0, 90, 180, 270].map((deg) => {
      const push = deg % 180 === 0 ? PUSH_UNITS.vertical : PUSH_UNITS.horizontal
      return [...FRAME_NUMS].reverse().concat([open.map(([x, y]) => [x + 17, y - push])])
    })
    const apply = (t) => {
      const p = easeInOutCubic(t)
      bladeRefs.current.forEach((el, i) => {
        if (!el) return
        el.setAttribute('points', blendList(lists[i], p))
        el.setAttribute('opacity', (1 - (1 - final[i]) * p).toFixed(3))
      })
      groupRef.current?.setAttribute('transform', `rotate(${(90 * (1 - easeOutBack(t))).toFixed(2)} 400 400)`)
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      doneRef.current?.()
      return undefined
    }
    let raf = 0
    let start = 0
    const tick = (now) => {
      if (!start) start = now
      const t = Math.min((now - start) / OPEN_MS, 1)
      apply(t)
      if (t < 1) raf = requestAnimationFrame(tick)
      else doneRef.current?.()
    }
    apply(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <svg className="opening-star" viewBox="0 0 800 800" aria-hidden="true">
      <g ref={groupRef}>
        {[0, 90, 180, 270].map((deg, i) => (
          <polygon
            key={deg}
            ref={(el) => { bladeRefs.current[i] = el }}
            transform={`rotate(${deg} 400 400)`}
            points={STAR_FRAMES[4]}
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  )
}

/**
 * The Home picker's button. With an icon in the middle the four arrows stay open around it;
 * with `star` (nothing in the middle) they close into a ninja star.
 */
export default function NavButtonGlyph({ icon = null, star = false }) {
  if (star && !icon) return <NinjaStar />
  return (
    <>
      <span className="wheel-arrow is-up" aria-hidden="true">{arrow}</span>
      <span className="wheel-arrow is-down" aria-hidden="true">{arrow}</span>
      <span className="wheel-arrow is-left" aria-hidden="true">{arrow}</span>
      <span className="wheel-arrow is-right" aria-hidden="true">{arrow}</span>
      {icon && <span className="nav-button-ico" aria-hidden="true">{icon}</span>}
    </>
  )
}
