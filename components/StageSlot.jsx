import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Render children on `.stage` so width/position use the full window,
 * not the 560px phone column (`contain: layout` + `overflow: hidden`).
 * `active` false keeps the node in place.
 */
export default function StageSlot({ children, active = true }) {
  const [stage, setStage] = useState(null)

  useLayoutEffect(() => {
    if (!active) return undefined
    setStage(document.querySelector('.stage'))
    return undefined
  }, [active])

  if (!active) return children
  if (!stage) return null
  return createPortal(children, stage)
}
