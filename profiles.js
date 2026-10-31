/**
 * 10 account slots — 5 left / 5 right in the zig-zag.
 * `avatarUrl` is null until a real profile fills the circle.
 */
export const INITIAL_PROFILES = [
  { id: 'p1', label: 'Account 1', profit: 14200, avatarUrl: null },
  { id: 'p2', label: 'Account 2', profit: 12840, avatarUrl: null },
  { id: 'p3', label: 'Account 3', profit: 11550, avatarUrl: null },
  { id: 'p4', label: 'Account 4', profit: 10220, avatarUrl: null },
  { id: 'p5', label: 'Account 5', profit: 9140, avatarUrl: null },
  { id: 'p6', label: 'Account 6', profit: 8360, avatarUrl: null },
  { id: 'p7', label: 'Account 7', profit: 7480, avatarUrl: null },
  { id: 'p8', label: 'Account 8', profit: 6610, avatarUrl: null },
  { id: 'p9', label: 'Account 9', profit: 5730, avatarUrl: null },
  { id: 'p10', label: 'Account 10', profit: 4850, avatarUrl: null },
]

export function sortByProfit(profiles) {
  return [...profiles].sort(
    (a, b) => b.profit - a.profit || a.id.localeCompare(b.id),
  )
}

/** Pick a climber from the lower half (not already #1). */
export function pickClimberId(profiles) {
  const ranked = sortByProfit(profiles)
  if (ranked.length < 2) return null
  const from = Math.max(1, Math.floor(ranked.length / 2))
  const pool = ranked.slice(from)
  return pool[Math.floor(Math.random() * pool.length)]?.id ?? ranked[ranked.length - 1].id
}
