import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import {
  fetchAvailableListings,
  filterListingsByClothingType,
} from '../listings.js'
import { clothingTypeById } from '../clothingTypes.js'
import { isSupabaseConfigured } from '../supabase.js'
import './GlassOverlay.css'
import './ClothingTypePage.css'

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 5.5 8.5 12 15 18.5"
      />
    </svg>
  )
}

/**
 * Dedicated browse page for one home clothing-type button.
 */
export default function ClothingTypePage({
  typeId,
  onClose,
  onOpenProduct,
}) {
  const [stageEl, setStageEl] = useState(null)
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | empty | error

  const meta = clothingTypeById(typeId)
  const title = meta?.label || 'Type'

  useEffect(() => {
    setStageEl(document.querySelector('.stage'))
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-overlay-open')
    return () => stage?.classList.remove('is-overlay-open')
  }, [])

  useEffect(() => {
    let alive = true
    if (!typeId || typeId === 'all') {
      setProducts([])
      setStatus('empty')
      return undefined
    }
    if (!isSupabaseConfigured()) {
      setStatus('error')
      setProducts([])
      return undefined
    }
    setStatus('loading')
    fetchAvailableListings({ limit: 160 })
      .then((rows) => {
        if (!alive) return
        const next = filterListingsByClothingType(rows, typeId)
        setProducts(next)
        setStatus(next.length ? 'ready' : 'empty')
      })
      .catch(() => {
        if (!alive) return
        setProducts([])
        setStatus('error')
      })
    return () => {
      alive = false
    }
  }, [typeId])

  if (!stageEl) return null

  return createPortal(
    <div
      className="glass-overlay clothing-type-page"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="glass-overlay-top">
        <button
          type="button"
          className="glass-overlay-back"
          aria-label="Back"
          onClick={onClose}
        >
          <BackIcon />
        </button>
        <h1 className="glass-overlay-title">{title}</h1>
        <span className="glass-overlay-spacer" aria-hidden />
      </header>

      <div className="glass-overlay-body">
        <div className="clothing-type-hero glass-pane-card">
          <p className="clothing-type-kicker">Browse</p>
          <h2 className="clothing-type-heading">{title}</h2>
          <p className="clothing-type-sub">
            {status === 'ready'
              ? `${products.length} listing${products.length === 1 ? '' : 's'}`
              : 'Available listings in this type'}
          </p>
        </div>

        {status === 'loading' && (
          <p className="clothing-type-empty" role="status">
            Loading…
          </p>
        )}
        {status === 'error' && (
          <p className="clothing-type-empty" role="status">
            Could not load listings
          </p>
        )}
        {status === 'empty' && (
          <p className="clothing-type-empty" role="status">
            No listings in {title} yet
          </p>
        )}

        <ul className="clothing-type-list">
          {products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="clothing-type-row"
                onClick={() => onOpenProduct?.(p)}
              >
                <span className="clothing-type-row-main">
                  <span className="clothing-type-row-title">{p.title}</span>
                  <span className="clothing-type-row-brand">
                    {p.brandName || p.brand || 'Brand'}
                  </span>
                </span>
                <span className="clothing-type-row-price">{p.price}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    stageEl,
  )
}
