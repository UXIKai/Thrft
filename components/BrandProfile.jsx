import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { fetchListingsForBrand } from '../listings.js'
import { isSupabaseConfigured } from '../supabase.js'
import './GlassOverlay.css'
import './BrandProfile.css'

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

export default function BrandProfile({ brandId, brandName, onClose, onOpenProduct }) {
  const [stageEl, setStageEl] = useState(null)
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | empty | error
  const [category, setCategory] = useState('')

  useEffect(() => {
    setStageEl(document.querySelector('.stage'))
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-overlay-open')
    return () => stage?.classList.remove('is-overlay-open')
  }, [])

  useEffect(() => {
    let alive = true
    if (!isSupabaseConfigured()) {
      setStatus('error')
      setProducts([])
      return undefined
    }
    setStatus('loading')
    fetchListingsForBrand({ brandId, brandName })
      .then((rows) => {
        if (!alive) return
        setProducts(rows)
        setCategory(rows[0]?.category || '')
        setStatus(rows.length ? 'ready' : 'empty')
      })
      .catch(() => {
        if (!alive) return
        setProducts([])
        setStatus('error')
      })
    return () => {
      alive = false
    }
  }, [brandId, brandName])

  if (!stageEl) return null
  const name = brandName || products[0]?.brandName || 'Brand'

  return createPortal(
    <div className="glass-overlay brand-profile" role="dialog" aria-modal="true">
      <header className="glass-overlay-top">
        <button type="button" className="glass-overlay-back" aria-label="Back" onClick={onClose}>
          <BackIcon />
        </button>
        <h1 className="glass-overlay-title">{name}</h1>
        <span className="glass-overlay-spacer" aria-hidden />
      </header>
      <div className="glass-overlay-body">
        <div className="brand-profile-hero glass-pane-card">
          <span className="brand-profile-mark" aria-hidden>
            {name.slice(0, 1)}
          </span>
          <p className="brand-profile-cat">{category || 'Brand'}</p>
        </div>
        {status === 'loading' && (
          <p className="brand-profile-empty" role="status">
            Loading…
          </p>
        )}
        {status === 'error' && (
          <p className="brand-profile-empty" role="status">
            Could not load listings
          </p>
        )}
        {status === 'empty' && (
          <p className="brand-profile-empty" role="status">
            No listings yet
          </p>
        )}
        <ul className="brand-profile-list">
          {products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="brand-profile-row"
                onClick={() => onOpenProduct?.(p)}
              >
                <span>{p.title}</span>
                <span>{p.price}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    stageEl,
  )
}
