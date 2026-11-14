import { useEffect, useMemo, useState } from 'react'
import OrbitCarousel from './OrbitCarousel.jsx'
import { COLOR_FAMILIES, colorHex } from '../colorsCatalog.js'
import { applySearchBackground, clearSearchBackground } from '../appAppearance.js'
import './HomeFilterLinks.css'

/**
 * Home search: magnifier button (top-left) opens a centered popup holding the
 * Brands / Category buttons, which launch the orbital picker.
 */
let handledSignal = 0

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
  openSignal = 0,
}) {
  const [open, setOpen] = useState(false)
  const [draftBrand, setDraftBrand] = useState(brandId)
  const [draftCategory, setDraftCategory] = useState(categoryId)
  const [draftColor, setDraftColor] = useState(colorId)
  const [resetRequested, setResetRequested] = useState(false)

  useEffect(() => {
    // Remounting (leaving Home and coming back) must not replay an old signal
    if (openSignal > handledSignal) {
      handledSignal = openSignal
      setOpen(true)
    }
  }, [openSignal])

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
    if (draftColor) applySearchBackground(colorHex(draftColor))
    else clearSearchBackground({ restoreDefault: resetRequested })
    setResetRequested(false)
    setOpen(false)
    if (draftBrand !== brandId) onPickBrand?.(draftBrand)
    if (draftColor !== colorId) onPickColor?.(draftColor)
    if (draftCategory !== categoryId) onPickCategory?.(draftCategory)
  }

  function resetColor() {
    setDraftColor('')
    setResetRequested(true)
  }

  function cancel() {
    setDraftBrand(brandId)
    setDraftCategory(categoryId)
    setDraftColor(colorId)
    setResetRequested(false)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') cancel()
    }
    document.addEventListener('keydown', onKey)
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-home-search-open')
    // React rewrites the stage's className on re-render; put the class back whenever it is dropped
    const keep = stage && new MutationObserver(() => {
      if (!stage.classList.contains('is-home-search-open')) stage.classList.add('is-home-search-open')
    })
    keep?.observe(stage, { attributes: true, attributeFilter: ['class'] })
    return () => {
      keep?.disconnect()
      document.removeEventListener('keydown', onKey)
      stage?.classList.remove('is-home-search-open')
    }
  }, [open, brandId, categoryId, colorId])

  const effectOn = document.documentElement.dataset.bgImage !== 'none'
  // The page uses the app's own effect, buttons and text colours; the picked colour does not tint it.
  const tintCard = !!draftColor
  const searchColor = (draftColor && colorHex(draftColor)) || '#ffffff'
  const searchRgb = searchColor.match(/[a-f0-9]{2}/gi)?.map((part) => parseInt(part, 16)) || [255, 255, 255]
  const luminance = (0.299 * searchRgb[0] + 0.587 * searchRgb[1] + 0.114 * searchRgb[2]) / 255
  // Starts as the page's own background; picking a colour paints the page that colour.
  const cardStyle = tintCard ? {
    '--tint-ink': luminance < 0.5 ? '#ffffff' : '#000000',
    '--search-tint': searchColor,
  } : {}

  return (
    <div className="home-search">
      {open && (
        <div
          className={`home-search-backdrop${tintCard ? ' is-tinted' : ''}`}
          style={cardStyle}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) cancel()
          }}
        >
          <div
            className="home-search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            style={cardStyle}
          >
            {false && effectOn && (
              <div className="home-search-blur" aria-hidden>
                <div className="atmosphere" aria-hidden>
                  <span className="atmosphere-bloom atmosphere-bloom-a" />
                  <span className="atmosphere-bloom atmosphere-bloom-b" />
                  <span className="atmosphere-bloom atmosphere-bloom-c" />
                  <span className="atmosphere-bloom atmosphere-bloom-d" />
                </div>
              </div>
            )}
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
            <button
              type="button"
              className="home-search-reset"
              aria-label="Reset color"
              title="Reset color"
              onClick={resetColor}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
