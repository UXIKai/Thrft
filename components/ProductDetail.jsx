import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { useBag } from '../BagContext.jsx'
import { LETTER_SIZES } from '../sizeOptions.js'
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
}) {
  const [stageEl, setStageEl] = useState(null)
  const { items, addItem, replaceItems, removeItem } = useBag()
  const inBag = items.find((row) => row.id === product?.id)?.qty || 0
  const qty = inBag
  const added = inBag > 0

  useEffect(() => {
    setStageEl(document.querySelector('.stage'))
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-overlay-open')
    return () => stage?.classList.remove('is-overlay-open')
  }, [])

  const [sizing, setSizing] = useState(false)

  useEffect(() => {
    setSizing(false)
  }, [product?.id])

  // Plus opens the size list; picking a size adds one and brings the stepper back.
  function start() {
    setSizing(true)
  }

  function pickSize(size) {
    if (!product) return
    if (inBag) {
      replaceItems(
        items.map((row) =>
          row.id === product.id
            ? { ...row, size, qty: Math.min(inBag + 1, 99) }
            : row,
        ),
      )
    } else {
      addItem({ ...product, size })
    }
    setSizing(false)
  }

  function step(next) {
    if (!product) return
    if (next <= 0) {
      removeItem(product.id)
      return
    }
    replaceItems(
      items.map((row) =>
        row.id === product.id ? { ...row, qty: Math.min(next, 99) } : row,
      ),
    )
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
          className="glass-overlay-back is-bare"
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
        {sizing && (
          <div className="product-detail-sizes" role="listbox" aria-label="Size">
            {(product.sizes?.length ? product.sizes : LETTER_SIZES).map((size) => (
              <button
                key={size}
                type="button"
                className="product-detail-size is-bare"
                onClick={() => pickSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        )}
        <div
          className={`product-detail-buy${added ? ' is-added' : ''}`}
          hidden={sizing}
        >
          <button
            type="button"
            className="product-detail-add"
            aria-label="Choose amount"
            tabIndex={added ? -1 : 0}
            onClick={start}
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="product-detail-step product-detail-minus is-bare"
            aria-label="Remove one"
            tabIndex={added ? 0 : -1}
            onClick={() => step(qty - 1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M5 11h14v2H5z" />
            </svg>
          </button>
          <div className="product-detail-stepper" aria-hidden={!added}>
            <span className="product-detail-qty">{qty}</span>
          </div>
          <button
            type="button"
            className="product-detail-step product-detail-plus-btn is-bare"
            aria-label="Add one"
            tabIndex={added ? 0 : -1}
            onClick={start}
          >
            <PlusIcon />
          </button>
        </div>
      </div>
    </div>,
    stageEl,
  )
}
