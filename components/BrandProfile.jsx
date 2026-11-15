import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { fetchStoreProducts, fetchExternalBrandSettings } from '../api.js'
import { getAuthSession } from '../auth.js'
import BrandCatalogSync from './BrandCatalogSync.jsx'
import { findBrandById } from '../brandsCatalog.js'
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
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('loading') // loading | ready | empty | error
  const [ownedBrandId, setOwnedBrandId] = useState('')
  const [ownerError, setOwnerError] = useState('')

  useEffect(() => {
    let active = true
    setOwnedBrandId('')
    setOwnerError('')
    if (!brandId?.startsWith('external-')) return undefined
    getAuthSession().then(async (session) => {
      if (!session) return
      const brands = await fetchExternalBrandSettings()
      if (active && brands.some((brand) => `external-${brand.id}` === brandId)) setOwnedBrandId(brandId.slice(9))
    }).catch((error) => { if (active) setOwnerError(error.message || 'Could not load brand management.') })
    return () => { active = false }
  }, [brandId])

  useEffect(() => {
    setStageEl(document.querySelector('.stage'))
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-overlay-open')
    return () => stage?.classList.remove('is-overlay-open')
  }, [])

  useEffect(() => {
    let alive = true
    setStatus('loading')
    setProducts([])
    setLoadError('')
    const resolvedName = brandName || findBrandById(brandId)?.name
    if (!resolvedName) {
      setLoadError('Brand name is required to load listings.')
      setStatus('error')
      return undefined
    }
    fetchStoreProducts({ brand: resolvedName, brandId })
      .then((rows) => {
        if (!alive) return
        setProducts(rows)
        setStatus(rows.length ? 'ready' : 'empty')
      })
      .catch((error) => {
        console.error('Could not load brand products:', error)
        if (!alive) return
        setProducts([])
        setLoadError(error.message || 'Could not load listings.')
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
      <div className="glass-overlay-body brand-profile-body">
        <div className="brand-profile-hero">
          <button
            type="button"
            className="brand-profile-back is-bare"
            aria-label="Back"
            onClick={onClose}
          >
            <BackIcon />
          </button>
          <span className="brand-profile-mark" aria-hidden>
            {products[0]?.brandLogoUrl ? <img src={products[0].brandLogoUrl} alt="" /> : name.slice(0, 1)}
          </span>
          <h1 className="brand-profile-cat">{name}</h1>
        </div>
        {ownerError && <p role="alert">{ownerError}</p>}
        {ownedBrandId && <BrandCatalogSync brandId={ownedBrandId} onSynced={async () => {
          const rows = await fetchStoreProducts({ brand: brandName || name, brandId })
          setProducts(rows)
          setStatus(rows.length ? 'ready' : 'empty')
          setLoadError('')
        }} />}
        {status === 'loading' && (
          <p className="brand-profile-empty" role="status">
            Loading…
          </p>
        )}
        {status === 'error' && (
          <p className="brand-profile-empty" role="alert">
            {loadError || 'Could not load listings'}
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
                onClick={() => onOpenProduct?.({ ...p, detailVariant: 'store' })}
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
