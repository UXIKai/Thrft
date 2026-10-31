/**
 * Zig-zag DNA formation: 5 bubbles left, 5 right.
 * Left column sits slightly above; the first right bubble starts at the
 * vertical middle of the first left bubble.
 *
 * Chain rule: a bubble moves up or down by swapping with the next opposite-side
 * neighbor along the zig-zag polyline (L↔R↔L↔R…). Every link uses the same
 * straight-along-segment flow — ascending and descending.
 */

export const BUBBLE = 68
export const DISK = BUBBLE
export const CONTACT_GAP = 2
export const MIN_CENTER_DIST = DISK + CONTACT_GAP

const ROW_GAP = BUBBLE + 10
const TOP = 4
const COL_GAP = 18
const RIGHT_STAGGER = BUBBLE / 2

export function sideOfRank(rank) {
  return (rank - 1) % 2 === 0 ? 'left' : 'right'
}

/** Next slot up on the opposite side, or null if already #1. */
export function oppositeAboveRank(rank) {
  if (rank <= 1) return null
  return rank - 1
}

/** Next slot down on the opposite side, or null if already last. */
export function oppositeBelowRank(rank, total = 10) {
  if (rank >= total) return null
  return rank + 1
}

function columnXs(stageW) {
  const pairW = BUBBLE * 2 + COL_GAP
  const leftX = (stageW - pairW) / 2
  return { leftX, rightX: leftX + BUBBLE + COL_GAP }
}

/**
 * Rank order zig-zag: L0, R0, L1, R1, …
 * Rank 1 = top-left; rank 2 = first right (half-bubble lower); etc.
 */
export function slotForRank(rank, stageW) {
  const index = rank - 1
  const onLeft = index % 2 === 0
  const row = Math.floor(index / 2)
  const { leftX, rightX } = columnXs(stageW)
  const x = onLeft ? leftX : rightX
  const y = TOP + row * ROW_GAP + (onLeft ? 0 : RIGHT_STAGGER)
  return { x, y }
}

function toCenter(slot) {
  const half = BUBBLE / 2
  return { x: slot.x + half, y: slot.y + half }
}

function toTopLeft(center) {
  const half = BUBBLE / 2
  return { x: center.x - half, y: center.y - half }
}

function smootherstep(t) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * One chain-link swap along the zig-zag edge.
 *
 * Traveler moves straight along the L↔R segment toward the neighbor’s slot;
 * neighbor reciprocates. Gloss lane is ±90° from the **canonical ascending**
 * direction of that link (worse rank → better rank), so the weave feels the
 * same whether the traveler is going up or down the chain.
 *
 * opts.fromRank / opts.toRank — ranks before the swap (for weave + ascend dir)
 * Returns `{ climber, neighbor, scale }` (climber = traveler).
 */
export function fluidSwapAt(
  climberFrom,
  climberTo,
  neighborFrom,
  neighborTo,
  t,
  opts = {},
) {
  const ease = smootherstep(t)
  const a0 = toCenter(climberFrom)
  const a1 = toCenter(climberTo)
  const b0 = toCenter(neighborFrom)
  const b1 = toCenter(neighborTo)

  const fromRank = opts.fromRank ?? 2
  const toRank = opts.toRank ?? 1
  const linkId = Math.min(fromRank, toRank)

  // Canonical ascending vector on this link (higher rank# → lower rank# / up board)
  const ascending = toRank < fromRank
  const up0 = ascending ? a0 : a1
  const up1 = ascending ? a1 : a0
  const cdx = up1.x - up0.x
  const cdy = up1.y - up0.y
  const clen = Math.hypot(cdx, cdy) || 1
  // Alternating DNA weave per link, locked in world space for up & down
  const weave = linkId % 2 === 0 ? 1 : -1
  const px = (-cdy / clen) * weave
  const py = (cdx / clen) * weave

  const dx = a1.x - a0.x
  const dy = a1.y - a0.y
  const mid = Math.sin(Math.PI * ease)
  const lane = BUBBLE * 0.2 * mid

  const climber = {
    x: a0.x + dx * ease + px * lane,
    y: a0.y + dy * ease + py * lane,
  }
  const neighbor = {
    x: b0.x + (b1.x - b0.x) * ease - px * lane,
    y: b0.y + (b1.y - b0.y) * ease - py * lane,
  }

  const scale = 1 + 0.05 * mid

  if (t >= 1) {
    return {
      climber: { x: climberTo.x, y: climberTo.y },
      neighbor: { x: neighborTo.x, y: neighborTo.y },
      scale: 1,
    }
  }

  return {
    climber: toTopLeft(climber),
    neighbor: toTopLeft(neighbor),
    scale,
  }
}

/** @deprecated */
export function fluidSwapPair(climberFrom, climberTo, neighborFrom, neighborTo, t, opts) {
  return fluidSwapAt(climberFrom, climberTo, neighborFrom, neighborTo, t, opts)
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
