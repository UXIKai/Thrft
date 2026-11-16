import { useEffect, useId, useRef } from 'react'

const WAVE_POINTS = [
  [210, 350, 350, 390, 720, 485, 1450, 590],
  [80, 630, 500, 170, 850, 420, 1370, 720],
  [300, 140, 400, 650, 690, 520, 1550, 220],
]

function wavePath(points) {
  return `M-180 930C${points.slice(0, 6).join(' ')}S${points.slice(6).join(' ')} 1480-160`
}

export default function AtmosphereFlow() {
  const id = useId()
  const curveRef = useRef(null)
  const surfaceRef = useRef(null)
  const lightRef = useRef(null)
  const curve = wavePath(WAVE_POINTS[0])

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame
    let startedAt
    const paint = (elapsed) => {
      const phase = (elapsed / 14000 % 1) * WAVE_POINTS.length
      const index = Math.floor(phase)
      const blend = (1 - Math.cos((phase - index) * Math.PI)) / 2
      const points = WAVE_POINTS[index].map((value, i) =>
        value + (WAVE_POINTS[(index + 1) % WAVE_POINTS.length][i] - value) * blend)
      const path = wavePath(points)
      curveRef.current.setAttribute('d', path)
      surfaceRef.current.setAttribute('d', `${path}L1620-300H-300V930Z`)
      lightRef.current.setAttribute('gradientTransform', `translate(${Math.sin(elapsed / 10000 * Math.PI * 2) * .18} 0)`)
    }
    const tick = (now) => {
      if (startedAt === undefined) startedAt = now
      paint(now - startedAt)
      frame = requestAnimationFrame(tick)
    }
    const syncMotion = () => {
      cancelAnimationFrame(frame)
      if (motion.matches) {
        paint(0)
      } else {
        startedAt = undefined
        frame = requestAnimationFrame(tick)
      }
    }
    syncMotion()
    motion.addEventListener('change', syncMotion)
    return () => {
      cancelAnimationFrame(frame)
      motion.removeEventListener('change', syncMotion)
    }
  }, [])

  return (
    <svg className="atmosphere-flow" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <path ref={curveRef} id={`${id}-curve`} d={curve} />
        <path ref={surfaceRef} id={`${id}-surface-path`} d={`${curve}L1620-300H-300V930Z`} />
        <linearGradient id={`${id}-surface`} x2="1" y2="1">
          <stop stopColor="var(--atmosphere-effect-c, #856344)" stopOpacity=".24" />
          <stop offset=".65" stopColor="var(--atmosphere-base, #050505)" />
        </linearGradient>
        <linearGradient ref={lightRef} id={`${id}-light`}>
          <stop stopColor="var(--atmosphere-effect-b, #d6a467)" stopOpacity=".45" />
          <stop offset=".28" stopColor="var(--atmosphere-effect-a, #ffe2a3)" />
          <stop offset=".52" stopColor="var(--atmosphere-effect-b, #d6a467)" stopOpacity=".5" />
          <stop offset=".84" stopColor="var(--atmosphere-effect-a, #ffe2a3)" />
          <stop offset="1" stopColor="var(--atmosphere-effect-c, #856344)" stopOpacity=".2" />
        </linearGradient>
        <filter id={`${id}-soft`} x="-.5" y="-.5" width="2" height="2">
          <feGaussianBlur stdDeviation="42" />
        </filter>
        <filter id={`${id}-edge`} x="-.5" y="-.5" width="2" height="2">
          <feGaussianBlur stdDeviation="24" />
        </filter>
        <clipPath id={`${id}-upper`}>
          <use href={`#${id}-surface-path`} />
        </clipPath>
      </defs>
      <use href={`#${id}-surface-path`} fill={`url(#${id}-surface)`} />
      <use href={`#${id}-curve`} fill="none" stroke={`url(#${id}-light)`} strokeWidth="120" opacity=".55" filter={`url(#${id}-soft)`} />
      <g clipPath={`url(#${id}-upper)`}>
        <use href={`#${id}-curve`} fill="none" stroke={`url(#${id}-light)`} strokeWidth="72" filter={`url(#${id}-edge)`} />
      </g>
      <use href={`#${id}-curve`} fill="none" stroke={`url(#${id}-light)`} strokeWidth="3" opacity=".95" />
    </svg>
  )
}
