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

function PlusIcon() {
  return (
    <svg className="product-detail-plus" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
    </svg>
  )
}

function productPhoto(product) {
  const photo = product?.photoUrl || product?.imageUrl || product?.image_url || ''
  if (!photo || /^placeholder$/i.test(photo)) return ''
  return photo
}

/**
 * Product page — name, image, price, and a bare add plus.
 */
export default function ProductDetail({
  product,
  onClose,
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

  const photo = productPhoto(product)
  const name = product.title || product.brandName || 'Product'

  return createPortal(
    <div
      className="glass-overlay product-detail"
      role="dialog"
      aria-modal="true"
      aria-label={name}
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
        <span className="glass-overlay-spacer" aria-hidden />
        <span className="glass-overlay-spacer" aria-hidden />
      </header>
      <div className="glass-overlay-body product-detail-body">
        <h1 className="product-detail-title">{name}</h1>
        <div className="product-detail-photo">
          {photo ? (
            <img src={photo} alt="" />
          ) : (
            <span className="product-detail-photo-empty" aria-hidden />
          )}
        </div>
        <p className="product-detail-price">{product.price}</p>
        <button
          type="button"
          className="product-detail-add"
          aria-label={added ? 'In bag' : 'Add to bag'}
          aria-pressed={added}
          onClick={add}
        >
          <PlusIcon />
        </button>
      </div>
    </div>,
    stageEl,
  )
}
