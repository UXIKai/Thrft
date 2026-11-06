import { useEffect, useMemo, useState } from 'react'
import OrbitCarousel from './OrbitCarousel.jsx'
import { colorHex } from '../colorsCatalog.js'
import './HomeFilterLinks.css'

/**
 * Home search: magnifier button (top-left) opens a centered popup holding the
 * Brands / Category buttons, which launch the orbital picker.
 */
// Black or white text, whichever reads better on the card color.
function inkFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return '#000'
  const n = parseInt(m[1], 16)
  const lum =
    0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 150 ? '#000' : '#fff'
}

export default function HomeFilterLinks({
  brands = [],
  categories = [],
  brandId = '',
  categoryId = 'all',
  colors = [],
  colorId = '',
  onPickColor,
  brandLabel = null,
  categoryLabel = null,
  onPickBrand,
  onPickCategory,
  onOpenBrands,
  onOpenColors,
  onOpenCategory,
}) {
  const [open, setOpen] = useState(false)
  const [draftBrand, setDraftBrand] = useState(brandId)
  const [draftCategory, setDraftCategory] = useState(categoryId)
  const [draftColor, setDraftColor] = useState(colorId)

  // Orbital picks (and external changes) flow back into the wheels.
  useEffect(() => setDraftBrand(brandId), [brandId])
  useEffect(() => setDraftCategory(categoryId), [categoryId])
  useEffect(() => setDraftColor(colorId), [colorId])

  const brandItems = useMemo(
    () => [{ id: '', label: 'All' }, ...brands],
    [brands],
  )
  const colorItems = useMemo(
    () => [{ id: '', label: 'All' }, ...colors],
    [colors],
  )
  const categoryItems = useMemo(
    () => [{ id: 'all', label: 'All' }, ...categories.filter((c) => c.id !== 'all')],
    [categories],
  )

  function done() {
    setOpen(false)
    if (draftBrand !== brandId) onPickBrand?.(draftBrand)
    if (draftColor !== colorId) onPickColor?.(draftColor)
    if (draftCategory !== categoryId) onPickCategory?.(draftCategory)
  }

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-home-search-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      stage?.classList.remove('is-home-search-open')
    }
  }, [open])

  const cardHex = draftColor ? colorHex(draftColor) || '#ffffff' : '#ffffff'
  const cardStyle = {
    '--card-bg': cardHex,
    '--card-ink': inkFor(cardHex),
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
          className="home-search-blur"
          aria-hidden
          style={{ '--search-tint': (draftColor && colorHex(draftColor)) || '#000000' }}
        />
      )}
      {open && (
        <div
          className="home-search-backdrop"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) done()
          }}
        >
          <div
            className="home-search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            style={cardStyle}
          >
            <div className="home-search-wheel">
              <p className="home-search-label">Brand</p>
              <OrbitCarousel
                variant="wheel"
                compact
                className="home-search-orbit"
                items={brandItems}
                activeId={draftBrand}
                onSelect={setDraftBrand}
                onActivate={onOpenBrands}
                ariaLabel="Brand"
              />
            </div>
            <div className="home-search-wheel">
              <p className="home-search-label">Color</p>
              <OrbitCarousel
                variant="wheel"
                compact
                className="home-search-orbit"
                items={colorItems}
                activeId={draftColor}
                onSelect={setDraftColor}
                onActivate={onOpenColors}
                ariaLabel="Color"
              />
            </div>
            <div className="home-search-wheel">
              <p className="home-search-label">Category</p>
              <OrbitCarousel
                variant="wheel"
                compact
                className="home-search-orbit"
                items={categoryItems}
                activeId={draftCategory}
                onSelect={setDraftCategory}
                onActivate={onOpenCategory}
                ariaLabel="Category"
              />
            </div>
            <button
              type="button"
              className="home-search-done"
              aria-label="Done"
              onClick={done}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
