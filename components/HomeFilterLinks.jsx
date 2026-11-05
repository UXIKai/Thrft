import { useEffect, useRef, useState } from 'react'
import './HomeFilterLinks.css'

/**
 * Home search button (top-left). Opens a small menu with Brands / Category,
 * which launch the circular picker; labels show the pick when set.
 */
export default function HomeFilterLinks({
  brandLabel = null,
  categoryLabel = null,
  onOpenBrands,
  onOpenCategory,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (fn) => () => {
    setOpen(false)
    fn?.()
  }

  return (
    <div className="home-search" ref={rootRef}>
      <button
        type="button"
        className={`home-search-btn${brandLabel || categoryLabel ? ' is-set' : ''}`}
        aria-label="Search"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="home-search-ico" viewBox="0 0 24 24" aria-hidden>
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="home-search-menu" role="menu" aria-label="Browse filters">
          <button
            type="button"
            role="menuitem"
            className={`home-filter-link${brandLabel ? ' is-set' : ''}`}
            aria-label={brandLabel ? `Brand filter: ${brandLabel}` : 'Open brands'}
            onClick={pick(onOpenBrands)}
          >
            {brandLabel || 'Brands'}
          </button>
          <button
            type="button"
            role="menuitem"
            className={`home-filter-link${categoryLabel ? ' is-set' : ''}`}
            aria-label={categoryLabel ? `Category filter: ${categoryLabel}` : 'Open category'}
            onClick={pick(onOpenCategory)}
          >
            {categoryLabel || 'Category'}
          </button>
        </div>
      )}
    </div>
  )
}
