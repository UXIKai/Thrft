import { useEffect, useState } from 'react'
import './HomeFilterLinks.css'

/**
 * Home search: magnifier button (top-left) opens a centered popup holding the
 * Brands / Category buttons, which launch the orbital picker.
 */
export default function HomeFilterLinks({
  brandLabel = null,
  categoryLabel = null,
  onOpenBrands,
  onOpenCategory,
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const pick = (fn) => () => {
    setOpen(false)
    fn?.()
  }

  return (
    <div className="home-search">
      <button
        type="button"
        className={`home-search-btn${brandLabel || categoryLabel ? ' is-set' : ''}`}
        aria-label="Search brands and categories"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <svg className="home-search-ico" viewBox="0 0 24 24" aria-hidden>
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          className="home-search-backdrop"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="home-search-modal" role="dialog" aria-modal="true" aria-label="Search">
            <button
              type="button"
              className={`home-filter-link${brandLabel ? ' is-set' : ''}`}
              aria-label={brandLabel ? `Brand filter: ${brandLabel}` : 'Open brands'}
              onClick={pick(onOpenBrands)}
            >
              {brandLabel || 'Brands'}
            </button>
            <button
              type="button"
              className={`home-filter-link${categoryLabel ? ' is-set' : ''}`}
              aria-label={categoryLabel ? `Category filter: ${categoryLabel}` : 'Open category'}
              onClick={pick(onOpenCategory)}
            >
              {categoryLabel || 'Category'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
