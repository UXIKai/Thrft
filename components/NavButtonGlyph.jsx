import { MarketIcon } from './SegmentIcons.jsx'

const arrow = (
  <svg viewBox="0 0 12 10" aria-hidden="true"><path d="M6 1.2 10.6 8.4H1.4Z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
)

/** The same button as the Home picker: the bag between four small arrows. */
export default function NavButtonGlyph() {
  return (
    <>
      <span className="wheel-arrow is-up" aria-hidden="true">{arrow}</span>
      <span className="wheel-arrow is-down" aria-hidden="true">{arrow}</span>
      <span className="wheel-arrow is-left" aria-hidden="true">{arrow}</span>
      <span className="wheel-arrow is-right" aria-hidden="true">{arrow}</span>
      <span className="nav-button-ico" aria-hidden="true"><MarketIcon /></span>
    </>
  )
}
