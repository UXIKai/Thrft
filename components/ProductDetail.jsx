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

/** Product page with a size picker and bag controls. */
function DoneCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

export default function ProductDetail({
  product,
  onClose,
}) {
  const [stageEl, setStageEl] = useState(null)
  const { items, addItem, replaceItems, removeItem } = useBag()
  const bagItem = items.find((row) => row.id === product?.id)
  const inBag = bagItem?.qty || 0
  const selectedSizes = Array.from({ length: inBag }, (_, index) =>
    bagItem?.selectedSizes?.[index] || bagItem?.size || '',
  )
  const qty = inBag
  const added = inBag > 0

  useEffect(() => {
    setStageEl(document.querySelector('.stage'))
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-overlay-open')
    return () => stage?.classList.remove('is-overlay-open')
  }, [])

  const [sizing, setSizing] = useState(false)
  const [quantityOpen, setQuantityOpen] = useState(false)
  const [editingSizeIndex, setEditingSizeIndex] = useState(null)

  useEffect(() => {
    setSizing(false)
    setQuantityOpen(false)
    setEditingSizeIndex(null)
  }, [product?.id])

  useEffect(() => {
    if (editingSizeIndex === null) return undefined
    const dismiss = (event) => {
      if (event.key === 'Escape') setEditingSizeIndex(null)
    }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [editingSizeIndex])

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
            ? {
                ...row,
                size,
                qty: Math.min(inBag + 1, 99),
                selectedSizes: [...selectedSizes, size].slice(0, 99),
              }
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
        row.id === product.id
          ? { ...row, qty: Math.min(next, 99), selectedSizes: selectedSizes.slice(0, next) }
          : row,
      ),
    )
  }

  if (!product || !stageEl) return null

  const photo = productPhoto(product)
  const name = product.title || product.brandName || 'Product'
  const brand = String(product.brandName || '').trim()
  const title = String(name).trim()
  const hasBrandPrefix =
    brand &&
    title.slice(0, brand.length).toLowerCase() === brand.toLowerCase() &&
    (title.length === brand.length || /^[\s:|-]/.test(title.slice(brand.length)))
  const displayTitle = hasBrandPrefix
    ? title.slice(brand.length).replace(/^[\s:|-]+/, '')
    : title

  if (editingSizeIndex !== null) {
    return createPortal(
      <div
        className="glass-overlay product-detail-size-page"
        role="dialog"
        aria-modal="true"
        aria-label="Choose size"
        onClick={(event) => {
          if (event.target === event.currentTarget) setEditingSizeIndex(null)
        }}
      >
        <div className="product-detail-sizes" role="group" aria-label="Sizes">
          {(product.sizes?.length ? product.sizes : LETTER_SIZES).map((size) => (
            <button
              key={size}
              type="button"
              className="product-detail-size is-bare"
              aria-pressed={selectedSizes[editingSizeIndex] === size}
              autoFocus={selectedSizes[editingSizeIndex] === size}
              onClick={() => {
                const nextSizes = selectedSizes.map((selected, index) =>
                  index === editingSizeIndex ? size : selected,
                )
                replaceItems(items.map((row) => row.id === product.id
                  ? { ...row, size: nextSizes[nextSizes.length - 1], selectedSizes: nextSizes }
                  : row))
                setEditingSizeIndex(null)
              }}
            >
              {size}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="product-detail-done is-bare"
          aria-label="Done choosing size"
          onClick={() => setEditingSizeIndex(null)}
        >
          <DoneCheckIcon />
        </button>
      </div>,
      stageEl,
    )
  }

  if (quantityOpen) {
    return createPortal(
      <div className="glass-overlay product-detail product-detail-quantity-page" role="dialog" aria-modal="true" aria-label="Selected products">
        <header className="glass-overlay-top">
          <h1 className="product-detail-quantity-title">Quantity: {qty}</h1>
        </header>
        <div className="glass-overlay-body">
          <ul className="product-detail-selected-list">
            {selectedSizes.map((size, index) => (
              <li key={index}>
                <button
                  type="button"
                  className="product-detail-selected-item is-bare"
                  aria-label={`Change size for ${displayTitle || name}, item ${index + 1}, ${size || 'no size selected'}`}
                  onClick={() => setEditingSizeIndex(index)}
                >
                {photo && <img src={photo} alt="" />}
                <div>
                  {brand && <p>{brand}</p>}
                  <h2>{displayTitle || name}</h2>
                  <p>{size ? `Size: ${size}` : 'Size not selected'}</p>
                </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className="product-detail-done is-bare"
          aria-label="Done"
          onClick={() => setQuantityOpen(false)}
        >
          <DoneCheckIcon />
        </button>
      </div>,
      stageEl,
    )
  }

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
        {product.brandName && (
          <p className="product-detail-brand">{product.brandName}</p>
        )}
        <div className="product-detail-photo">
          {photo ? (
            <img src={photo} alt="" />
          ) : (
            <span className="product-detail-photo-empty" aria-hidden />
          )}
        </div>
        {displayTitle && <h1 className="product-detail-title">{displayTitle}</h1>}
        <p className="product-detail-price">{product.price}</p>
        {sizing && (
          <div className="product-detail-sizes-reveal">
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
            aria-expanded={sizing}
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
            <button
              type="button"
              className="product-detail-qty is-bare"
              aria-label={`View ${qty} selected products`}
              tabIndex={added ? 0 : -1}
              onClick={() => setQuantityOpen(true)}
            >
              {qty}
            </button>
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
          <button
            type="button"
            className="product-detail-step product-detail-confirm is-bare"
            aria-label="Done, return to previous page"
            tabIndex={added ? 0 : -1}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    stageEl,
  )
}
