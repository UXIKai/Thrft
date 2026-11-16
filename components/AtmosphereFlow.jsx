import { useId } from 'react'

export default function AtmosphereFlow() {
  const id = useId()
  const curve = 'M-180 930C210 350 350 390 720 485S1450 590 1480-160'
  return (
    <svg className="atmosphere-flow" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-surface`} x2="1" y2="1">
          <stop stopColor="var(--atmosphere-effect-c, #856344)" stopOpacity=".24" />
          <stop offset=".65" stopColor="var(--atmosphere-base, #050505)" />
        </linearGradient>
        <linearGradient id={`${id}-light`}>
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
          <path d={`${curve}L1620-300H-300V930Z`} />
        </clipPath>
      </defs>
      <path d={`${curve}L1620-300H-300V930Z`} fill={`url(#${id}-surface)`} />
      <path d={curve} fill="none" stroke={`url(#${id}-light)`} strokeWidth="120" opacity=".55" filter={`url(#${id}-soft)`} />
      <g clipPath={`url(#${id}-upper)`}>
        <path d={curve} fill="none" stroke={`url(#${id}-light)`} strokeWidth="72" filter={`url(#${id}-edge)`} />
      </g>
      <path d={curve} fill="none" stroke={`url(#${id}-light)`} strokeWidth="3" opacity=".95" />
    </svg>
  )
}
