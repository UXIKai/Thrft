/**
 * Horizontal chip strip scroll — same motion on Home types + Create categories.
 * First pins left, last pins right; otherwise always centers (both directions).
 */
export function scrollChipIntoView(scroller, btn, index, total, { smooth = true } = {}) {
  if (!scroller || !btn || total < 1) return

  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
  const behavior = smooth ? 'smooth' : 'auto'

  if (index <= 0) {
    scroller.scrollTo({ left: 0, behavior })
    return
  }

  if (index >= total - 1) {
    scroller.scrollTo({ left: max, behavior })
    return
  }

  const left = btn.offsetLeft - (scroller.clientWidth - btn.offsetWidth) / 2
  scroller.scrollTo({
    left: Math.min(Math.max(0, left), max),
    behavior,
  })
}
