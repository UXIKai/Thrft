const arrow = (
  <svg viewBox="0 0 12 10" aria-hidden="true"><path d="M6 1.2 10.6 8.4H1.4Z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
)

// One swept blade pointing up: convex outer edge, concave leading edge, sharp tip.
const BLADE = 'M0 -48C2 -30 10 -17 27 -10L5 -3L1 -7C-3 -20 -3 -34 0 -48Z'

/** The empty-middle state: a closed four-blade ninja star. */
function NinjaStar() {
  return (
    <svg className="ninja-star" viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="ninja-star-chrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="ns-hi" />
          <stop offset="0.45" className="ns-mid" />
          <stop offset="1" className="ns-lo" />
        </linearGradient>
      </defs>
      {[0, 90, 180, 270].map((deg) => (
        <g key={deg} transform={`rotate(${deg})`}>
          <path className="ns-blade" d={BLADE} fill="url(#ninja-star-chrome)" />
        </g>
      ))}
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
