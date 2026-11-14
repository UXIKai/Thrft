const arrow = (
  <svg viewBox="0 0 12 10" aria-hidden="true"><path d="M6 1.2 10.6 8.4H1.4Z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
)

/** The Home picker's button: four small arrows, with an optional icon in the middle (Home pages keep theirs). */
export default function NavButtonGlyph({ icon = null }) {
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
