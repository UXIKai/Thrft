import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './BrandGlobe.css'

function GlobeBackIcon() {
  return (
    <svg className="brand-globe-dock-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 5.5 8.5 12 15 18.5"
      />
    </svg>
  )
}

function GlobePlusIcon() {
  return (
    <svg className="brand-globe-dock-ico" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
    </svg>
  )
}

const CIRCLE_LIMIT = 1.2
/** Clear the visual select circle — no shell words inside (fraction of seat). */
const CENTER_SELECT = 0.48
/** Extra px clear of the seat so chips never clip / pop into the circle. */
const SEAT_PAD_PX = 36
/** Hide any shell chip whose center falls inside this seat radius (px). */
const SEAT_HIDE_R = 72
/** Concentric orbit spacing — clear air so courses sit above/below, not on. */
const RING_GAP_PX = 34
/** Air between neighboring words on the same orbit (no overlap). */
const CHIP_GAP_PX = 14
/** Pack each orbit nearly full, then spill to the next outer ring. */
const RING_FILL = 0.92
const DRAG_THRESHOLD = 6
/** Drag / trackpad pan the flat canvas (px per px). */
const PAN_DRAG = 1
/** Two-finger trackpad / wheel → free pan (no mouse button held). */
const PAN_WHEEL = 1.15
/** Slow shared current — brands follow each other on their circle. */
const ORBIT_SPIN = 0.0035
/**
 * Extra pan past the outer brand ring so edge labels can fully reach the
 * seat — not so much that you scroll into empty void beyond the pack.
 */
const PAN_REACH_PX = 56

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function chipWidthPx(label, dense, veryDense) {
  const len = Math.max(1, String(label || '').length)
  // Honest width so orbit packing leaves real gaps (no visual overlap)
  const fs = veryDense ? (len > 9 ? 7.4 : 8.6) : dense ? 11 : 12.2
  return len * fs * 0.62 + 14
}

function chipHeightPx(dense, veryDense) {
  return veryDense ? 14 : dense ? 17 : 19
}

function chipArc(w, rPx) {
  return (
    2 * Math.atan((w * 0.5) / Math.max(28, rPx)) +
    CHIP_GAP_PX / Math.max(28, rPx)
  )
}

function pairNeed(A, B) {
  // Keep neighboring orbits from stacking onto the same screen pixels
  let need = Math.hypot((A.w + B.w) * 0.4, (A.h + B.h) * 0.85) + 10
  if (Math.abs(A.ring - B.ring) === 1) {
    need = Math.max(need, (A.h + B.h) * 0.58 + (A.w + B.w) * 0.16 + 12)
  }
  return need
}

function normAngle(a) {
  const t = Math.PI * 2
  let x = a % t
  if (x < 0) x += t
  return x
}

function angleDelta(a, b) {
  let d = normAngle(a) - normAngle(b)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

/** Empty gaps on a ring: center lon + angular width (edge-aware). */
function gapSlots(ringItems) {
  const sorted = [...ringItems].sort((a, b) => a.lon - b.lon)
  const n = sorted.length
  if (n < 1) return []
  if (n === 1) {
    return [{ lon: normAngle(sorted[0].lon + Math.PI), width: Math.PI * 2 }]
  }
  const slots = []
  for (let i = 0; i < n; i += 1) {
    const A = sorted[i]
    const B = sorted[(i + 1) % n]
    const aEnd = A.lon + chipArc(A.w, A.r) * 0.5
    let bStart = B.lon - chipArc(B.w, B.r) * 0.5
    if (i === n - 1) bStart += Math.PI * 2
    const width = Math.max(0, bStart - aEnd)
    slots.push({ lon: normAngle(aEnd + width * 0.5), width })
  }
  return slots
}

/**
 * Slide a ring so word centers sit in gaps of the course inside.
 * If this course has more words than gaps, maximize clearance from
 * every adjacent word instead (best-effort brick).
 */
function phaseIntoAdjacentGaps(ringItems, adjacentItems) {
  const n = ringItems.length
  if (n < 1 || adjacentItems.length < 1) return
  const gaps = gapSlots(adjacentItems)
  const step = (Math.PI * 2) / n
  const base = ringItems.map((_, i) => i * step)
  const crowded = n > gaps.length
  let bestPhase = 0
  let bestScore = crowded ? -Infinity : Infinity
  const samples = Math.max(72, n * 12)

  for (let k = 0; k < samples; k += 1) {
    const phase = (k / samples) * step
    let score = 0
    for (let i = 0; i < n; i += 1) {
      const lon = normAngle(base[i] + phase)
      if (crowded) {
        // Maximize distance to nearest word on the course inside.
        let nearest = Infinity
        for (const adj of adjacentItems) {
          const d = Math.abs(angleDelta(lon, adj.lon))
          if (d < nearest) nearest = d
        }
        // Long names need more clearance.
        const weight = 1 + ringItems[i].w / 80
        score += nearest * nearest * weight
      } else {
        let nearest = Infinity
        for (const g of gaps) {
          const d = Math.abs(angleDelta(lon, g.lon))
          if (d < nearest) nearest = d
        }
        score += nearest * nearest
      }
    }
    if (crowded ? score > bestScore : score < bestScore) {
      bestScore = score
      bestPhase = phase
    }
  }
  for (let i = 0; i < n; i += 1) {
    ringItems[i].lon = normAngle(base[i] + bestPhase)
    ringItems[i]._baseLon = ringItems[i].lon
  }
}

/**
 * Running-bond (brick wall): each course is shifted half a brick so
 * vertical joints hit the center of the course above/below — words sit
 * in the gap, never on the face of the word next to them.
 */
function applyRunningBond(byRing) {
  if (byRing.length < 1) return
  const n0 = byRing[0].length
  if (n0 < 1) return
  const step = (Math.PI * 2) / n0

  for (let r = 0; r < byRing.length; r += 1) {
    const items = byRing[r]
    const n = items.length
    // Odd courses shift half a brick; even courses line up with course 0.
    const phase = (r % 2) * (step * 0.5)

    if (n === n0) {
      for (let i = 0; i < n; i += 1) {
        const lon = normAngle(phase + i * step)
        items[i].lon = lon
        items[i]._baseLon = lon
      }
      continue
    }

    if (r > 0 && n < n0) {
      // Sparse outer course: sit exactly on evenly spaced gaps of the course inside.
      const gaps = gapSlots(byRing[r - 1])
      if (gaps.length >= n) {
        const used = new Set()
        const picked = []
        for (let i = 0; i < n; i += 1) {
          let gi = Math.round((i * gaps.length) / n) % gaps.length
          while (used.has(gi)) gi = (gi + 1) % gaps.length
          used.add(gi)
          picked.push(gaps[gi])
        }
        // Keep circumferential order; longest labels get the widest of those gaps.
        picked.sort((a, b) => a.lon - b.lon)
        const byWidth = [...picked].sort((a, b) => b.width - a.width)
        const words = [...items].sort((a, b) => b.w - a.w)
        const assigned = new Map()
        for (let i = 0; i < n; i += 1) assigned.set(byWidth[i], words[i])
        const orderedSlots = picked.map((g) => assigned.get(g))
        for (let i = 0; i < n; i += 1) {
          orderedSlots[i].lon = picked[i].lon
          orderedSlots[i]._baseLon = picked[i].lon
        }
        continue
      }
    }

    // Crowded / uneven: equal spacing, maximize clearance into adjacent gaps.
    const localStep = (Math.PI * 2) / Math.max(1, n)
    for (let i = 0; i < n; i += 1) {
      const lon = normAngle(phase + i * localStep)
      items[i].lon = lon
      items[i]._baseLon = lon
    }
    if (r > 0) phaseIntoAdjacentGaps(items, byRing[r - 1])
  }
}

/**
 * Carousel orbit for compact / snug lists (group members, Type categories):
 * equal spacing on concentric rings, grown until neighbors clear each other
 * and every label sits outside the center orb — nothing tucked under the seat.
 */
function packCarouselOrbit(
  brands,
  { dense = false, veryDense = false, seatPx = 56, fillR = 160 } = {},
) {
  const n = brands.length
  if (n < 1) return { slots: [], maxR: fillR }

  const h = chipHeightPx(dense, veryDense)
  // Preserve list order — members feel like a carousel, not a re-sort.
  const ordered = brands.map((brand, index) => ({
    index,
    label: String(brand?.label || ''),
    w: chipWidthPx(brand?.label, dense, veryDense),
    h,
  }))

  const seatR = Math.max(52, seatPx * 0.95)
  const minClearR = seatR + h * 0.65 + 24
  const gap = 26
  const ringStep = Math.max(h + 22, 34)
  // Cap how many labels share a ring so Type lists don't crush into each other.
  const maxPerRing = Math.max(6, Math.min(10, Math.ceil(Math.sqrt(n) * 1.9)))
  const maxRCap = Math.max(fillR * 2.1, minClearR + ringStep * 4)

  function minRadiusForSlice(slice) {
    const m = slice.length
    if (m < 1) return minClearR
    if (m === 1) return minClearR
    const step = (Math.PI * 2) / m
    const sinHalf = Math.sin(step / 2)
    let need = minClearR
    for (let i = 0; i < m; i += 1) {
      const a = slice[i]
      const b = slice[(i + 1) % m]
      const chord = (a.w + b.w) * 0.52 + gap
      const rNeed = sinHalf > 0.001 ? chord / (2 * sinHalf) : maxRCap
      if (rNeed > need) need = rNeed
    }
    return need
  }

  const groups = []
  let cursor = 0
  let ringIndex = 0
  let outerR = 0

  while (cursor < n && ringIndex <= 24) {
    // Grow from the previous ring — don't let two courses collapse to one radius.
    const baseR =
      ringIndex === 0 ? minClearR : outerR + ringStep
    let bestTake = 1
    let bestR = Math.max(
      baseR,
      minRadiusForSlice(ordered.slice(cursor, cursor + 1)),
    )

    const tryMax = Math.min(maxPerRing, n - cursor)
    for (let tryN = tryMax; tryN >= 1; tryN -= 1) {
      const slice = ordered.slice(cursor, cursor + tryN)
      const needR = Math.max(baseR, minRadiusForSlice(slice))
      if (needR <= maxRCap || tryN === 1) {
        bestTake = tryN
        bestR = needR
        break
      }
    }

    // If this course still can't clear at maxRCap, peel labels onto more rings.
    while (bestTake > 1 && bestR > maxRCap) {
      bestTake -= 1
      bestR = Math.max(
        baseR,
        minRadiusForSlice(ordered.slice(cursor, cursor + bestTake)),
      )
    }

    const slice = ordered.slice(cursor, cursor + bestTake)
    const rPx = Math.max(baseR, bestR)
    groups.push({ slice, rPx })
    outerR = rPx
    cursor += slice.length
    ringIndex += 1
  }

  // Never shrink a carousel pack — scaling down reintroduces overlaps.
  const scale =
    outerR > 1 && outerR < fillR ? Math.min(1.06, fillR / outerR) : 1

  const placed = []
  const byRing = []
  for (let r = 0; r < groups.length; r += 1) {
    const { slice, rPx } = groups[r]
    const step = (Math.PI * 2) / Math.max(1, slice.length)
    // Odd rings offset half a step — carousel brick, names sit in gaps.
    const phase = (r % 2) * (step * 0.5)
    const ringItems = []
    for (let i = 0; i < slice.length; i += 1) {
      const lon = normAngle(phase + i * step)
      const item = {
        index: slice[i].index,
        lon,
        _baseLon: lon,
        r: rPx * scale,
        ring: r,
        w: slice[i].w,
        h: slice[i].h,
      }
      ringItems.push(item)
      placed.push(item)
    }
    byRing.push(ringItems)
  }

  const slots = new Array(n)
  let maxR = 0
  for (const p of placed) {
    slots[p.index] = { lon: p.lon, r: p.r, ring: p.ring }
    if (p.r > maxR) maxR = p.r
  }
  return { slots, maxR }
}

/**
 * Flat concentric brick courses on the page canvas (no sphere / no 360°).
 * Rings expand in real pixels past the viewport so every corner is reachable
 * by pan — words never vanish behind a globe limb.
 */
function packCircleLanes(
  brands,
  {
    dense = false,
    veryDense = false,
    seatPx = 56,
    fillR = 220,
    compact = false,
    /** Small lists (Type) stay near the seat; grow only as items are added. */
    snug = false,
  } = {},
) {
  const n = brands.length
  if (n < 1) return { slots: [], maxR: fillR }

  // Group members + Type — carousel around the center orb (no overlap / seat clip).
  if (compact || snug) {
    return packCarouselOrbit(brands, { dense, veryDense, seatPx, fillR })
  }

  const h = chipHeightPx(dense, veryDense)
  const ordered = brands
    .map((brand, index) => ({
      index,
      len: String(brand?.label || '').length,
      label: String(brand?.label || ''),
      w: chipWidthPx(brand?.label, dense, veryDense),
      h,
    }))
    .sort(
      (a, b) =>
        a.len - b.len || a.label.localeCompare(b.label) || a.index - b.index,
    )

  // Full brand page stretches to fill.
  const ringStep = Math.max(RING_GAP_PX, h + 12)
  const innerR = Math.max(36, seatPx + h * 0.55 + SEAT_PAD_PX)

  let innerCap = 0
  let innerArc = 0
  while (innerCap < n) {
    const arc = chipArc(ordered[innerCap].w, innerR)
    if (innerCap > 0 && innerArc + arc > Math.PI * 2 * RING_FILL) break
    innerArc += arc
    innerCap += 1
  }
  if (innerCap < 1) innerCap = 1

  let brickCount = innerCap
  for (let tryN = innerCap; tryN >= 6; tryN -= 1) {
    const full = Math.floor(n / tryN)
    const last = n - tryN * full
    if (last === 0 || last >= 3) {
      brickCount = tryN
      break
    }
  }

  const groups = []
  let cursor = 0
  let ringIndex = 0
  let outerR = innerR

  while (cursor < n && ringIndex <= 48) {
    const rPx = innerR + ringStep * ringIndex
    let capacity = 0
    let arcUsed = 0
    while (cursor + capacity < n) {
      const next = ordered[cursor + capacity]
      const arc = chipArc(next.w, rPx)
      if (capacity > 0 && arcUsed + arc > Math.PI * 2 * RING_FILL) break
      arcUsed += arc
      capacity += 1
    }
    if (capacity < 1) capacity = 1

    let take = Math.min(capacity, brickCount, n - cursor)
    if (take < 1) take = 1

    const left = n - cursor - take
    if (
      left > 0 &&
      left < 3 &&
      take + left <= Math.max(capacity + 1, brickCount + 1)
    ) {
      take += left
    }

    const slice = ordered.slice(cursor, cursor + take)
    groups.push({ slice, rPx })
    outerR = rPx
    cursor += slice.length
    ringIndex += 1
    if (ringIndex === 1) brickCount = slice.length
  }

  // Brand page stretches to the stage.
  const scale = outerR > 1 ? Math.max(1, fillR / outerR) : 1

  const placed = []
  const byRing = []
  for (let r = 0; r < groups.length; r += 1) {
    const { slice, rPx } = groups[r]
    const step = (Math.PI * 2) / Math.max(1, slice.length)
    const ringItems = []
    for (let i = 0; i < slice.length; i += 1) {
      const baseLon = i * step
      const item = {
        index: slice[i].index,
        lon: baseLon,
        _baseLon: baseLon,
        r: rPx * scale,
        ring: r,
        w: slice[i].w,
        h: slice[i].h,
      }
      ringItems.push(item)
      placed.push(item)
    }
    byRing.push(ringItems)
  }
  applyRunningBond(byRing)

  const slots = new Array(n)
  let maxR = 0
  for (const p of placed) {
    slots[p.index] = { lon: p.lon, r: p.r, ring: p.ring }
    if (p.r > maxR) maxR = p.r
  }
  return { slots, maxR }
}

/**
 * Flat brick-staggered brand canvas — pan any direction (incl. corners).
 * Hold center, drag, release to pick. No 360° sphere.
 */
export default function BrandGlobe({
  brands = [],
  activeId,
  onSelect,
  onClose,
  title = 'Brands',
  variant = 'dock',
  phase = 'open',
  origin = null,
  onExitComplete,
  searchValue = null,
  onSearchChange = null,
  searchPlaceholder = 'Search',
  onSearchConfirm = null,
  searchConfirmDisabled = false,
  searchConfirmLabel = 'Confirm',
  /** Right-side + — same chrome as Chat / Favorites dock. */
  onSearchPlus = null,
  searchPlusLabel = 'Add',
  /** Tight ring around the seat — group-chat members globe. */
  compact = false,
  /** Type / small lists — stay near the seat; expand only as items grow. */
  snug = false,
}) {
  const [focusId, setFocusId] = useState(null)
  const [brushing, setBrushing] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [orbit, setOrbit] = useState(0)
  const [pointer, setPointer] = useState(null)
  const [focusFitPx, setFocusFitPx] = useState(24)
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const focusBtnRef = useRef(null)
  const focusTextRef = useRef(null)
  const slotsRef = useRef([])
  const projectedRef = useRef([])
  const brandsRef = useRef(brands)
  const focusRef = useRef(focusId)
  const movedRef = useRef(false)
  const rotatingRef = useRef(false)
  const pointerDownRef = useRef({ x: 0, y: 0 })
  const lastDragRef = useRef({ x: 0, y: 0 })
  const panXRef = useRef(0)
  const panYRef = useRef(0)
  const orbitRef = useRef(0)
  const focusLockRef = useRef(false)
  const choosingRef = useRef(false)
  const velocityRef = useRef({ x: 0, y: 0 })
  /** Circular pan radius — matches the outer brand ring (+ reach pad). */
  const panLimitRef = useRef({ r: 200 })
  const rafRef = useRef(0)
  const orbitRafRef = useRef(0)
  const [choosing, setChoosing] = useState(false)
  const [popping, setPopping] = useState(false)
  const [stageSize, setStageSize] = useState({ w: 390, h: 560 })
  const popTimerRef = useRef(0)
  const isDock = variant === 'dock'
  const dense = brands.length > 24
  const veryDense = brands.length > 48
  // Seat size tracks the CSS select circle.
  const seatPx = Math.min(
    59,
    Math.max(44, Math.min(stageSize.w, stageSize.h) * 0.16),
  )
  // Page = stretch to corners; compact / snug = orbit near the seat.
  const fillR = compact
    ? Math.min(stageSize.w, stageSize.h) * 0.32
    : snug
      ? Math.min(stageSize.w, stageSize.h) * 0.36
      : Math.hypot(stageSize.w * 0.5, stageSize.h * 0.5) * 0.98

  const packed = useMemo(
    () =>
      packCircleLanes(brands, {
        dense,
        veryDense,
        seatPx,
        fillR,
        compact,
        snug,
      }),
    [brands, dense, veryDense, seatPx, fillR, compact, snug],
  )
  const slots = packed.slots
  const maxR = packed.maxR || fillR
  slotsRef.current = slots
  brandsRef.current = brands
  focusRef.current = focusId
  panXRef.current = panX
  panYRef.current = panY
  orbitRef.current = orbit
  // Pan border = outer pack circle + reach pad so every ring can slide onto
  // the seat — carousel packs (Type / members) stay tighter than brand page.
  panLimitRef.current = {
    r:
      compact || snug
        ? Math.max(48, maxR * 0.85 + PAN_REACH_PX * 0.35)
        : Math.max(80, maxR + PAN_REACH_PX),
  }

  useEffect(() => {
    if (focusId && !brands.some((b) => b.id === focusId)) {
      setFocusId(null)
    }
  }, [brands, focusId])

  const onExitCompleteRef = useRef(onExitComplete)
  onExitCompleteRef.current = onExitComplete
  useEffect(() => {
    if (phase !== 'exit') return undefined
    const t = window.setTimeout(() => onExitCompleteRef.current?.(), 420)
    return () => window.clearTimeout(t)
  }, [phase])

  function applyPan(nextX, nextY, velocity) {
    const limR = panLimitRef.current.r || 200
    let x = nextX
    let y = nextY
    const dist = Math.hypot(x, y)
    if (dist > limR && dist > 0) {
      const s = limR / dist
      x *= s
      y *= s
    }
    panXRef.current = x
    panYRef.current = y
    setPanX(x)
    setPanY(y)
    if (velocity) velocityRef.current = velocity
  }

  function stopOrbit() {
    if (orbitRafRef.current) {
      window.cancelAnimationFrame(orbitRafRef.current)
      orbitRafRef.current = 0
    }
  }

  function startOrbit() {
    if (orbitRafRef.current) return
    if (choosingRef.current || rotatingRef.current || phase === 'exit') return

    const tick = () => {
      if (choosingRef.current || rotatingRef.current || phase === 'exit') {
        orbitRafRef.current = 0
        return
      }
      // Yield to drag/inertia frames.
      if (rafRef.current) {
        orbitRafRef.current = window.requestAnimationFrame(tick)
        return
      }
      // Shared river current — brands drift. Seat stays empty while idle.
      orbitRef.current += ORBIT_SPIN
      setOrbit(orbitRef.current)
      orbitRafRef.current = window.requestAnimationFrame(tick)
    }
    orbitRafRef.current = window.requestAnimationFrame(tick)
  }

  /**
   * Ease pan back to the packing origin so rings stay concentric with the
   * middle button. Clear the seat when idle again — words only while choosing.
   */
  function settleOrbitHome() {
    stopOrbit()
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    let frames = 0
    rafRef.current = window.requestAnimationFrame(function tick() {
      frames += 1
      const dx = -panXRef.current
      const dy = -panYRef.current
      const dist = Math.hypot(dx, dy)
      if (dist < 1.5 || frames > 36) {
        applyPan(0, 0)
        velocityRef.current = { x: 0, y: 0 }
        rafRef.current = 0
        rotatingRef.current = false
        setRotating(false)
        if (!choosingRef.current) {
          focusRef.current = null
          setFocusId(null)
        }
        startOrbit()
        return
      }
      const pull = Math.min(0.42, 22 / Math.max(22, dist))
      applyPan(panXRef.current + dx * pull, panYRef.current + dy * pull)
      rafRef.current = window.requestAnimationFrame(tick)
    })
  }

  function kickInertia() {
    stopOrbit()
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    let frames = 0
    rafRef.current = window.requestAnimationFrame(function tick() {
      const v = velocityRef.current
      frames += 1
      if (
        (Math.abs(v.x) < 0.35 && Math.abs(v.y) < 0.35) ||
        frames > 18
      ) {
        velocityRef.current = { x: 0, y: 0 }
        settleOrbitHome()
        return
      }
      applyPan(panXRef.current + v.x, panYRef.current + v.y)
      syncFocusToCenter({ force: true })
      v.x *= 0.88
      v.y *= 0.88
      rafRef.current = window.requestAnimationFrame(tick)
    })
  }

  // Gentle sun-orbit while idle.
  useEffect(() => {
    if (phase === 'exit') {
      stopOrbit()
      return undefined
    }
    startOrbit()
    return () => stopOrbit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, brands])

  // Size the flat canvas to the live stage so brands fill the whole page.
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => {
      const r = el.getBoundingClientRect()
      const w = Math.max(1, r.width)
      const h = Math.max(1, r.height)
      setStageSize((prev) =>
        Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1
          ? prev
          : { w, h },
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [phase])

  const layout = useMemo(() => {
    // Flat brick courses — one pack that grows as brands are added.
    const half = Math.max(1, Math.min(stageSize.w, stageSize.h) * 0.5)
    return brands.map((brand, i) => {
      const slot = slots[i] || { lon: 0, r: 80, ring: 0 }
      const lon = (slot.lon || 0) + orbit
      const r = slot.r || 80
      const x = Math.cos(lon) * r + panX
      const y = Math.sin(lon) * r + panY
      return {
        brand,
        x,
        y,
        nx: x / half,
        ny: y / half,
        z: 1,
        facing: 1,
        front: true,
        depth: 1,
        ring: slot.ring || 0,
        underAmt: 0,
        display: brand.label,
        long: String(brand.label || '').length > 9,
      }
    })
  }, [brands, slots, panX, panY, orbit, stageSize.w, stageSize.h])

  projectedRef.current = layout

  // Seat name only while actively scrubbing / holding to choose.
  // Idle (and after settle): empty orb — no leftover brand popping in.
  const seatOpen = choosing || rotating || popping
  const focusBrand =
    seatOpen && focusId
      ? brands.find((b) => b.id === focusId) || null
      : null
  const focusLabel = focusBrand?.label || ''
  const focusWords = focusLabel.trim().split(/\s+/).filter(Boolean)

  /**
   * Flat canvas words — always mounted (no far-side cull). Soft-dim only when
   * tips overlap. Seat clear is the CSS mask around the center circle.
   */
  const shellLabels = useMemo(() => {
    const candidates = []
    for (const slot of layout) {
      // Keep every orbit chip mounted — seat is the center button only.
      // Soft-hide only when a chip actually slides into the select circle.
      // Carousel rings (Type / members) already clear the orb, so don't erase them.
      const w = chipWidthPx(slot.display, dense, veryDense)
      const h = chipHeightPx(dense, veryDense)
      const hideR =
        compact || snug
          ? Math.min(SEAT_HIDE_R, seatPx * 0.55 + 8)
          : SEAT_HIDE_R
      const inSeat = Math.hypot(slot.x, slot.y) < hideR
      candidates.push({
        ...slot,
        baseVis: inSeat ? 0 : 1,
        _w: w,
        _h: h,
        _left: slot.x - w / 2,
        _right: slot.x + w / 2,
        _top: slot.y - h / 2,
        _bottom: slot.y + h / 2,
      })
    }
    // Prefer inner rings when tips overlap.
    candidates.sort((a, b) => a.ring - b.ring)
    const kept = []
    for (const c of candidates) {
      let dim = 1
      for (const k of kept) {
        if (k.vis < 0.12) continue
        const ox = Math.max(
          0,
          Math.min(c._right, k._right) - Math.max(c._left, k._left),
        )
        const oy = Math.max(
          0,
          Math.min(c._bottom, k._bottom) - Math.max(c._top, k._top),
        )
        const area = ox * oy
        if (area < 1) continue
        const smaller = Math.min(c._w * c._h, k._w * k._h)
        const ratio = area / Math.max(1, smaller)
        if (ratio > 0.14) dim = Math.min(dim, 0.55)
      }
      kept.push({ ...c, vis: c.baseVis * dim })
    }
    return kept
  }, [layout, dense, veryDense, compact, snug, seatPx])

  // Scale seated name (whole words only) so it stays fully inside the circle.
  useLayoutEffect(() => {
    const btn = focusBtnRef.current
    const text = focusTextRef.current
    if (!btn || !text) return undefined

    const btnRect = btn.getBoundingClientRect()
    const cx = btnRect.left + btnRect.width / 2
    const cy = btnRect.top + btnRect.height / 2
    const radius = Math.min(btnRect.width, btnRect.height) / 2 - 10
    const maxPx = 22
    const minPx = 12

    function fitsSize(px) {
      text.style.fontSize = `${px}px`
      const tr = text.getBoundingClientRect()
      if (tr.width < 2 || tr.height < 2) return false
      const pts = [
        [tr.left, tr.top],
        [tr.right, tr.top],
        [tr.left, tr.bottom],
        [tr.right, tr.bottom],
        [tr.left, cy],
        [tr.right, cy],
        [cx, tr.top],
        [cx, tr.bottom],
      ]
      return pts.every(([x, y]) => Math.hypot(x - cx, y - cy) <= radius)
    }

    let lo = minPx
    let hi = maxPx
    let best = minPx

    for (let i = 0; i < 14; i += 1) {
      const mid = (lo + hi) / 2
      if (fitsSize(mid)) {
        best = mid
        lo = mid
      } else {
        hi = mid
      }
    }

    text.style.fontSize = `${best}px`
    setFocusFitPx(best)
    return undefined
  }, [focusLabel, isDock, dense, veryDense])

  /** Brand whose label is closest to the middle seat (true nearest). */
  function nearestToCenter() {
    const pts = projectedRef.current
    let bestId = null
    let bestDist = Infinity
    for (let i = 0; i < pts.length; i += 1) {
      const slot = pts[i]
      if (!slot?.brand) continue
      const d = Math.hypot(slot.x, slot.y)
      if (d < bestDist) {
        bestDist = d
        bestId = slot.brand.id
      }
    }
    return bestId
  }

  /** Keep the middle button on whoever is closest right now. */
  function syncFocusToCenter({ force = false } = {}) {
    if (focusLockRef.current && !force) return
    const id = nearestToCenter()
    if (id && id !== focusRef.current) {
      focusRef.current = id
      setFocusId(id)
    }
    return id
  }

  // Fresh open: pan home, empty seat — no brand until the user moves.
  const seededRef = useRef(false)
  useEffect(() => {
    seededRef.current = false
    focusRef.current = null
    setFocusId(null)
  }, [brands])
  useEffect(() => {
    if (seededRef.current || brands.length < 1 || slots.length < 1) return
    seededRef.current = true
    applyPan(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, activeId, slots])

  function localPoint(clientX, clientY) {
    const stage = stageRef.current
    if (!stage) return null
    const rect = stage.getBoundingClientRect()
    const half = Math.max(1, Math.min(rect.width, rect.height) * 0.5)
    return {
      px: (clientX - (rect.left + rect.width / 2)) / half,
      py: (clientY - (rect.top + rect.height / 2)) / half,
    }
  }

  function pickNearest(clientX, clientY) {
    if (brandsRef.current.length < 1) return null
    const local = localPoint(clientX, clientY)
    if (!local) return null
    const { px, py } = local
    // Allow the full stage — snug Type packs and outer rings must stay pickable.
    if (Math.hypot(px, py) > Math.max(CIRCLE_LIMIT, 2.6)) return null

    let bestId = null
    let bestDist = Infinity
    const pts = projectedRef.current
    for (let i = 0; i < pts.length; i += 1) {
      const slot = pts[i]
      if (!slot?.brand) continue
      // Prefer chips the pointer is actually over (hit box), else nearest.
      const hw = (slot._w || chipWidthPx(slot.display, dense, veryDense)) / 2
      const hh = (slot._h || chipHeightPx(dense, veryDense)) / 2
      const half = Math.max(1, Math.min(stageSize.w, stageSize.h) * 0.5)
      const dx = slot.x - px * half
      const dy = slot.y - py * half
      const inside = Math.abs(dx) <= hw + 10 && Math.abs(dy) <= hh + 10
      const d = dx * dx + dy * dy
      const score = inside ? d * 0.15 : d
      if (score < bestDist) {
        bestDist = score
        bestId = slot.brand.id
      }
    }
    return bestId
  }

  function applyFocusFromPointer(clientX, clientY) {
    if (rotatingRef.current && !choosingRef.current) return
    const id = pickNearest(clientX, clientY)
    if (id && id !== focusRef.current) {
      focusRef.current = id
      setFocusId(id)
    }
  }

  function beginChoosing(event) {
    stopOrbit()
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    if (popTimerRef.current) {
      window.clearTimeout(popTimerRef.current)
      popTimerRef.current = 0
    }
    velocityRef.current = { x: 0, y: 0 }
    rotatingRef.current = false
    setRotating(false)
    setPopping(false)
    choosingRef.current = true
    setChoosing(true)
    focusLockRef.current = false
    movedRef.current = false
    pointerDownRef.current = { x: event.clientX, y: event.clientY }
    lastDragRef.current = { x: event.clientX, y: event.clientY }
    setBrushing(true)
    stageRef.current?.setPointerCapture?.(event.pointerId)
    const local = localPoint(event.clientX, event.clientY)
    if (local) setPointer(local)
    // Reveal nearest into the seat now that choose has started.
    syncFocusToCenter({ force: true })
    applyFocusFromPointer(event.clientX, event.clientY)
  }

  function endChoosing() {
    const focused =
      focusRef.current &&
      brandsRef.current.find((b) => b.id === focusRef.current)
    choosingRef.current = false
    setChoosing(false)
    setPopping(true)
    setBrushing(false)
    focusLockRef.current = false
    movedRef.current = false
    setPointer(null)
    // Let the pop-up spring play before committing the pick.
    if (popTimerRef.current) window.clearTimeout(popTimerRef.current)
    popTimerRef.current = window.setTimeout(() => {
      popTimerRef.current = 0
      setPopping(false)
      if (focused) pick(focused)
    }, 170)
  }

  useEffect(
    () => () => {
      if (popTimerRef.current) window.clearTimeout(popTimerRef.current)
    },
    [],
  )

  // Trackpad / mouse-wheel: free pan with no button held — scroll anywhere on
  // the globe, then tap the middle button when the right brand is seated.
  useEffect(() => {
    if (phase === 'exit') return undefined
    const root = rootRef.current
    if (!root) return undefined

    function onWheel(event) {
      // Let the search field keep native caret scrolling.
      if (event.target?.closest?.('.brand-globe-search-row, .brand-globe-search-input')) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      stopOrbit()
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      rotatingRef.current = true
      setRotating(true)
      focusLockRef.current = false

      // Normalize line/page deltas so mouse wheels and trackpads both feel even.
      let sx = event.deltaX
      let sy = event.deltaY
      if (event.deltaMode === 1) {
        sx *= 16
        sy *= 16
      } else if (event.deltaMode === 2) {
        sx *= 320
        sy *= 320
      }
      // Inverse pan — scroll toward a brand and it comes into the seat.
      const dx = sx * PAN_WHEEL
      const dy = sy * PAN_WHEEL
      applyPan(panXRef.current + dx, panYRef.current + dy, {
        x: dx * 0.5,
        y: dy * 0.5,
      })
      syncFocusToCenter({ force: true })

      window.clearTimeout(onWheel._settle)
      onWheel._settle = window.setTimeout(() => {
        rotatingRef.current = false
        setRotating(false)
        kickInertia()
      }, 90)
    }

    root.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      root.removeEventListener('wheel', onWheel)
      window.clearTimeout(onWheel._settle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function onPointerDown(event) {
    if (event.button != null && event.button !== 0) return
    if (event.target?.closest?.('.brand-globe-search-row, .brand-globe-search'))
      return

    // Hold the center to start choosing.
    if (event.target?.closest?.('.brand-globe-focus')) {
      event.stopPropagation()
      beginChoosing(event)
      return
    }

    // Outside center: drag pans the flat canvas (no select).
    stopOrbit()
    choosingRef.current = false
    setChoosing(false)
    focusLockRef.current = false
    movedRef.current = false
    rotatingRef.current = false
    velocityRef.current = { x: 0, y: 0 }
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    pointerDownRef.current = { x: event.clientX, y: event.clientY }
    lastDragRef.current = { x: event.clientX, y: event.clientY }
    setBrushing(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const local = localPoint(event.clientX, event.clientY)
    if (local) setPointer(local)
  }

  function panFromDrag(event) {
    const stepX = event.clientX - lastDragRef.current.x
    const stepY = event.clientY - lastDragRef.current.y
    lastDragRef.current = { x: event.clientX, y: event.clientY }
    // Inverse drag — pull toward a brand and it rides into the seat
    // (content comes to the button, instead of grabbing the page).
    applyPan(
      panXRef.current - stepX * PAN_DRAG,
      panYRef.current - stepY * PAN_DRAG,
      {
        x: -stepX * PAN_DRAG * 0.9,
        y: -stepY * PAN_DRAG * 0.9,
      },
    )
    // Middle button shows the brand you're moving toward.
    syncFocusToCenter({ force: true })
  }

  function onPointerMove(event) {
    // Hold-center choose: same globe spin, seat updates as it turns.
    if (choosingRef.current) {
      const dx = event.clientX - pointerDownRef.current.x
      const dy = event.clientY - pointerDownRef.current.y
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        movedRef.current = true
        if (!rotatingRef.current) {
          rotatingRef.current = true
          setRotating(true)
        }
      }
      if (rotatingRef.current) {
        panFromDrag(event)
      } else {
        // Finger still on seat — scrub to the chip under the pointer.
        applyFocusFromPointer(event.clientX, event.clientY)
      }
      const local = localPoint(event.clientX, event.clientY)
      if (local) setPointer(local)
      return
    }

    if (event.buttons > 0) {
      const dx = event.clientX - pointerDownRef.current.x
      const dy = event.clientY - pointerDownRef.current.y
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        movedRef.current = true
        if (!rotatingRef.current) {
          rotatingRef.current = true
          setRotating(true)
        }
      }

      if (rotatingRef.current) {
        panFromDrag(event)
        return
      }
    }

    const local = localPoint(event.clientX, event.clientY)
    if (local) setPointer(local)
  }

  function onPointerUp() {
    if (choosingRef.current) {
      // Stop pan, then commit the seated brand.
      rotatingRef.current = false
      setRotating(false)
      velocityRef.current = { x: 0, y: 0 }
      endChoosing()
      return
    }

    if (rotatingRef.current) {
      rotatingRef.current = false
      setRotating(false)
      setBrushing(false)
      kickInertia()
      window.requestAnimationFrame(() => {
        movedRef.current = false
      })
      return
    }

    setBrushing(false)
    focusLockRef.current = false
    window.requestAnimationFrame(() => {
      movedRef.current = false
    })
  }

  function onPointerLeave() {
    if (choosingRef.current) {
      // Keep choosing while captured; only clear hover chrome.
      setPointer(null)
      return
    }
    if (rotatingRef.current) {
      rotatingRef.current = false
      setRotating(false)
      kickInertia()
    }
    setBrushing(false)
    movedRef.current = false
    setPointer(null)
  }

  function pick(brand) {
    choosingRef.current = false
    setChoosing(false)
    focusLockRef.current = false
    movedRef.current = false
    rotatingRef.current = false
    velocityRef.current = { x: 0, y: 0 }
    onSelect?.(brand.id)
  }

  const originStyle =
    origin && typeof origin.dx === 'number'
      ? {
          '--globe-dx': `${origin.dx}px`,
          '--globe-dy': `${origin.dy}px`,
        }
      : undefined

  return (
    <div
      ref={rootRef}
      className={`brand-globe${isDock ? ' is-dock is-blend' : ''} is-${phase}${
        dense ? ' is-dense' : ''
      }${veryDense ? ' is-very-dense' : ''}${
        compact || snug ? ' is-compact' : ''
      }${rotating ? ' is-rotating' : ''}`}
      style={originStyle}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="brand-globe-scrim"
        aria-label="Close brands"
        onClick={onClose}
      />
      <div className={`brand-globe-panel${isDock ? ' is-dock is-blend' : ''}`}>
        {!isDock && (
          <header className="brand-globe-head">
            <p className="brand-globe-title">{title}</p>
            <button
              type="button"
              className="brand-globe-close"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </header>
        )}
        <div
          ref={stageRef}
          className={`brand-globe-stage${brushing ? ' is-brushing' : ''}${
            focusBrand ? ' has-focus' : ''
          }${rotating ? ' is-rotating' : ''}${choosing ? ' is-choosing' : ''}${
            popping ? ' is-popping' : ''
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
        >
          {/* Soft limb + select circle — no ring guides. */}
          <div className="brand-globe-earth" aria-hidden />
          <div className="brand-globe-center-hole" aria-hidden />
          <div className="brand-globe-field">
            {shellLabels.map(
              ({
                brand,
                x,
                y,
                nx,
                ny,
                ring,
                display,
                long,
                vis,
              }) => {
                const isActive = brand.id === activeId
                let proximity = 0
                if (pointer && !rotating) {
                  const d = Math.hypot(nx - pointer.px, ny - pointer.py)
                  proximity = 1 - smoothstep(0.06, 0.42, d)
                }
                const opacity = clamp(
                  (0.82 + proximity * 0.18 + (isActive ? 0.1 : 0)) * (vis ?? 1),
                  0,
                  1,
                )
                const scale = 1 + proximity * 0.06
                return (
                  <span
                    key={brand.id}
                    data-brand-id={brand.id}
                    data-orbit-ring={ring}
                    aria-hidden
                    className={`brand-globe-label${
                      isActive ? ' is-active' : ''
                    }${long ? ' is-long' : ''}${
                      proximity > 0.5 ? ' is-near' : ''
                    }`}
                    style={{
                      // Flat canvas — no sphere depth fade / clip.
                      transform: `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`,
                      opacity,
                      visibility: 'visible',
                      zIndex: 20 + (8 - (ring || 0)),
                    }}
                  >
                    <span className="brand-globe-label-text">{display}</span>
                  </span>
                )
              },
            )}
          </div>
          <button
            ref={focusBtnRef}
            type="button"
            className={`brand-globe-focus${
              focusBrand?.id === activeId ? ' is-active' : ''
            }${choosing || rotating ? ' is-scrolling' : ''}${
              choosing ? ' is-choosing' : ''
            }${popping ? ' is-popping' : ''}`}
            aria-label={
              focusBrand
                ? `Tap to choose ${focusBrand.label}`
                : 'Scroll to a brand, then tap to choose'
            }
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              beginChoosing(event)
            }}
            onClick={(event) => {
              // Prefer the pointerup choose path; block a second click select.
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <span
              ref={focusTextRef}
              className={`brand-globe-focus-text${
                focusWords.length > 1 ? ' is-stacked' : ''
              }`}
              key={focusBrand?.id || 'empty'}
              style={{ fontSize: `${focusFitPx}px` }}
            >
              {focusWords.length > 1
                ? focusWords.map((word, index) => (
                    <span
                      key={`${word}-${index}`}
                      className="brand-globe-focus-line"
                    >
                      {word}
                    </span>
                  ))
                : focusLabel}
            </span>
          </button>
        </div>
        {typeof onSearchChange === 'function' ? (
          <div
            className={`brand-globe-search-row${
              typeof onSearchConfirm === 'function' ? ' has-confirm' : ''
            }`}
          >
            <div className="brand-globe-search">
              <button
                type="button"
                className="brand-globe-dock-back"
                aria-label="Back"
                onClick={(event) => {
                  event.stopPropagation()
                  onClose?.()
                }}
              >
                <GlobeBackIcon />
              </button>
              <input
                className="brand-globe-search-input"
                type="text"
                inputMode="search"
                name="thrft_globe_search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                value={searchValue ?? ''}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder || 'Search'}
                onChange={(event) => onSearchChange(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    typeof onSearchConfirm === 'function' &&
                    !searchConfirmDisabled
                  ) {
                    event.preventDefault()
                    onSearchConfirm()
                  }
                }}
              />
              {typeof onSearchConfirm === 'function' ? (
                <button
                  type="button"
                  className="brand-globe-search-confirm dock-chip"
                  aria-label={searchConfirmLabel}
                  disabled={searchConfirmDisabled}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!searchConfirmDisabled) onSearchConfirm()
                  }}
                >
                  <svg
                    className="brand-globe-check-ico"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 12.5 10 17.5 19 7"
                    />
                  </svg>
                </button>
              ) : typeof onSearchPlus === 'function' ? (
                <button
                  type="button"
                  className="brand-globe-dock-plus"
                  aria-label={searchPlusLabel}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSearchPlus()
                  }}
                >
                  <GlobePlusIcon />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
