import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import './GlassOverlay.css'
import './ProductDetail.css'

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
 * Product page — add listing to the marketplace bag.
 */
export default function ProductDetail({
  product,
  onClose,
  onOpenBrand,
  onAddToCart,
}) {
  const [stageEl, setStageEl] = useState(null)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    setStageEl(document.querySelector('.stage'))
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-overlay-open')
    return () => stage?.classList.remove('is-overlay-open')
  }, [])

  useEffect(() => {
    setAdded(false)
  }, [product?.id])

  function add() {
    if (!product) return
    onAddToCart?.(product)
    setAdded(true)
  }

  if (!product || !stageEl) return null

  return createPortal(
    <div className="glass-overlay product-detail" role="dialog" aria-modal="true">
      <header className="glass-overlay-top">
        <button
          type="button"
          className="glass-overlay-back"
          aria-label="Back"
          onClick={onClose}
        >
          <BackIcon />
        </button>
        <h1 className="glass-overlay-title">Listing</h1>
        <span className="glass-overlay-spacer" aria-hidden />
      </header>
      <div className="glass-overlay-body">
        <div className="product-detail-hero">
          <p className="product-detail-code">{product.code}</p>
          <p className="product-detail-price">{product.price}</p>
        </div>
        <h2 className="product-detail-title">{product.title}</h2>
        {product.description ? (
          <p className="glass-muted product-detail-desc">{product.description}</p>
        ) : null}
        <button
          type="button"
          className="product-detail-brand"
          onClick={() => onOpenBrand?.(product.brandId, product.brandName)}
        >
          {product.brandName || 'Brand'}
        </button>

        <button type="button" className="product-detail-buy" onClick={add}>
          {added ? 'In bag' : 'Add to bag'}
        </button>
      </div>
    </div>,
    stageEl,
  )
}
