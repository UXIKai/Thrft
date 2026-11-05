import { useEffect, useMemo, useRef, useState } from 'react'
import './HomeFilterLinks.css'

function matches(item, q) {
  return (
    String(item.label || '').toLowerCase().includes(q) ||
    String(item.id || '').toLowerCase().includes(q)
  )
}

/**
 * Home search: magnifier button (top-left) opens a centered popup where users
 * type to find a brand or category and pick it as the home filter.
 */
export default function HomeFilterLinks({
  brands = [],
  categories = [],
  brandLabel = null,
  categoryLabel = null,
  onPickBrand,
  onPickCategory,
  onClearBrand,
  onClearCategory,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    inputRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const q = query.trim().toLowerCase()
  const brandResults = useMemo(
    () => (q ? brands.filter((b) => matches(b, q)) : brands),
    [brands, q],
  )
  const categoryResults = useMemo(
    () => (q ? categories.filter((c) => matches(c, q)) : categories),
    [categories, q],
  )

  function close() {
    setOpen(false)
    setQuery('')
  }

  function pick(fn, id) {
    close()
    fn?.(id)
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
            if (e.target === e.currentTarget) close()
          }}
        >
          <div className="home-search-modal" role="dialog" aria-modal="true" aria-label="Search">
            <input
              ref={inputRef}
              type="search"
              className="home-search-input"
              placeholder="Search brands or categories"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <div className="home-search-results">
              {(brandLabel || categoryLabel) && !q && (
                <div className="home-search-active">
                  {brandLabel && (
                    <button type="button" className="home-search-chip" onClick={() => pick(onClearBrand)}>
                      {brandLabel} ✕
                    </button>
                  )}
                  {categoryLabel && (
                    <button type="button" className="home-search-chip" onClick={() => pick(onClearCategory)}>
                      {categoryLabel} ✕
                    </button>
                  )}
                </div>
              )}
              {brandResults.length > 0 && (
                <section>
                  <h2 className="home-search-heading">Brands</h2>
                  {brandResults.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="home-search-item"
                      onClick={() => pick(onPickBrand, b.id)}
                    >
                      {b.label}
                    </button>
                  ))}
                </section>
              )}
              {categoryResults.length > 0 && (
                <section>
                  <h2 className="home-search-heading">Categories</h2>
                  {categoryResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="home-search-item"
                      onClick={() => pick(onPickCategory, c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </section>
              )}
              {!brandResults.length && !categoryResults.length && (
                <p className="home-search-empty">No matches</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
