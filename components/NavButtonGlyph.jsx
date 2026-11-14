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

/** The empty-middle state: four blades that twist shut like a shutter into a ninja star. */
function NinjaStar() {
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return (
    <svg className="ninja-star" viewBox="0 0 800 800" aria-hidden="true">
      <defs>
        <linearGradient id="ninja-star-chrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="ns-hi" />
          <stop offset="0.45" className="ns-mid" />
          <stop offset="1" className="ns-lo" />
        </linearGradient>
      </defs>
      <g>
        {!still && (
          // Blades twist a quarter turn as they close, like a camera shutter.
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 400 400"
            to="90 400 400"
            dur="0.7s"
            begin="0s"
            calcMode="spline"
            keyTimes="0;1"
            keySplines="0.45 0 0.2 1"
            fill="freeze"
          />
        )}
        {[0, 90, 180, 270].map((deg) => (
          <polygon
            key={deg}
            className="ns-blade"
            transform={`rotate(${deg} 400 400)`}
            points={STAR_FRAMES[still ? 4 : 0]}
            fill="url(#ninja-star-chrome)"
          >
            {!still && (
              <animate
                attributeName="points"
                values={STAR_FRAMES.join(';')}
                keyTimes="0;0.25;0.5;0.75;1"
                dur="0.7s"
                begin="0s"
                fill="freeze"
              />
            )}
          </polygon>
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
