import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { useBag } from '../BagContext.jsx'
import { LETTER_SIZES } from '../sizeOptions.js'
import { productSizeOptions } from '../productSizes.js'
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
  onOpenBrand,
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
  const isMarket = product?.detailVariant === 'market'

  useEffect(() => {
    setStageEl(document.querySelector('.stage'))
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-overlay-open')
    return () => stage?.classList.remove('is-overlay-open')
  }, [])

  const [sizing, setSizing] = useState(false)
  const [sizeMetric, setSizeMetric] = useState('EN')
  const [sizeFormat, setSizeFormat] = useState(null)
  const [showInformation, setShowInformation] = useState(false)
  const [quantityOpen, setQuantityOpen] = useState(false)
  const [editingSizeIndex, setEditingSizeIndex] = useState(null)
  const [draftSize, setDraftSize] = useState('')

  useEffect(() => {
    if (!sizing) return undefined
    const dismiss = (event) => {
      if (event.key === 'Escape') setSizing(false)
    }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [sizing])

  useEffect(() => {
    setSizing(false)
    setQuantityOpen(false)
    setEditingSizeIndex(null)
    setShowInformation(false)
    setSizeMetric('EN')
    setSizeFormat(null)
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
    if (isMarket) {
      if (!added) addItem(product)
      return
    }
    setShowInformation(false)
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
  const brand = String(product.brandName || product.brand || '').trim()
  const title = String(name).trim()
  const hasBrandPrefix =
    brand &&
    title.slice(0, brand.length).toLowerCase() === brand.toLowerCase() &&
    (title.length === brand.length || /^[\s:|-]/.test(title.slice(brand.length)))
  const displayTitle = hasBrandPrefix
    ? title.slice(brand.length).replace(/^[\s:|-]+/, '')
    : title

  const originalSizeOptions = productSizeOptions(product)
  const numericSizes = (sizeFormat || (originalSizeOptions.some((option) => /\d/.test(option.value)) ? 'numbers' : 'letters')) === 'numbers'
  const sizeOptions = productSizeOptions(product, numericSizes ? 'numbers' : 'letters')
  const canShowLetters = sizeOptions.some((option) => /[a-z]/i.test(option.letter))
  const sizePanel = sizing && !isMarket ? (
      <section className="product-store-size-panel" aria-label="Select size">
        <header className="product-store-size-header">
          {numericSizes ? <button type="button" className="is-bare" aria-label={`Size metric ${sizeMetric}; switch to ${sizeMetric === 'EN' ? 'EU' : 'EN'}`} onClick={() => setSizeMetric(sizeMetric === 'EN' ? 'EU' : 'EN')}>{sizeMetric}</button> : <span />}
          <h2>Select size</h2>
          <div className="product-store-size-actions">
            {(!numericSizes || canShowLetters) && <button type="button" className="is-bare" aria-label={numericSizes ? 'Show letter sizes' : 'Show numeric sizes'} onClick={() => setSizeFormat(numericSizes ? 'letters' : 'numbers')}>{numericSizes ? 'Aa' : '123'}</button>}
            <button type="button" className="is-bare" aria-label="Close size selection" onClick={() => setSizing(false)}>×</button>
          </div>
        </header>
        <div className="product-store-size-content">
          {showInformation ? (
            <section className="product-store-information" aria-label="Product information">
              <h2>{displayTitle || name}</h2>
              {product.description && <p>{product.description}</p>}
              <h3>Materials</h3>
              <p>{Array.isArray(product.materials) ? product.materials.join(', ') : product.materials || 'Materials not provided.'}</p>
              <button type="button" className="is-bare" onClick={() => setShowInformation(false)}>Select size</button>
            </section>
          ) : (
            <>
              <div className="product-store-size-grid" role="group" aria-label={numericSizes ? `${sizeMetric} sizes` : 'Letter sizes'}>
                {sizeOptions.map((option) => (
                  <button type="button" className="product-detail-size is-bare" key={option.value} onClick={() => pickSize(option.value)}>
                    {!numericSizes ? option.letter : sizeMetric === 'EU' ? option.eu : option.en}
                  </button>
                ))}
              </div>
              {numericSizes && <p className="product-store-size-note">General size equivalents vary by brand. Sizes without a conversion retain their original label.</p>}
              <button type="button" className="product-store-info-button is-bare" onClick={() => setShowInformation(true)}>Information</button>
            </>
          )}
        </div>
      </section>
  ) : null

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
              aria-pressed={draftSize === size}
              autoFocus={draftSize === size}
              onClick={() => setDraftSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="product-detail-done is-bare"
          aria-label="Done choosing size"
          onClick={() => {
            if (draftSize && draftSize !== selectedSizes[editingSizeIndex]) {
              const nextSizes = selectedSizes.map((selected, index) =>
                index === editingSizeIndex ? draftSize : selected,
              )
              replaceItems(items.map((row) => row.id === product.id
                ? { ...row, size: nextSizes[nextSizes.length - 1], selectedSizes: nextSizes }
                : row))
            }
            setEditingSizeIndex(null)
          }}
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
                  onClick={() => {
                    setDraftSize(size || '')
                    setEditingSizeIndex(index)
                  }}
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
        {!isMarket && brand && (
          <button
            type="button"
            className="product-detail-brand is-bare"
            onClick={() => onOpenBrand?.(product.brandId || '', brand)}
            aria-label={`View ${brand} brand page`}
          >
            {brand}
          </button>
        )}
        <div className="product-detail-photo">
          {photo ? (
            <img src={photo} alt="" />
          ) : (
            <span className="product-detail-photo-empty" aria-hidden />
          )}
        </div>
        {(isMarket ? title : displayTitle) && <h1 className="product-detail-title">{isMarket ? title : displayTitle}</h1>}
        {isMarket && (
          <div className="product-detail-market-info">
            <div className="product-detail-market-meta">
              {brand && <button type="button" className="product-detail-brand is-bare" onClick={() => onOpenBrand?.(product.brandId || '', brand)} aria-label={`View ${brand} brand page`}>{brand}</button>}
              {product.category && <span>{product.category}</span>}
            </div>
            <p className="product-detail-price">{product.price}</p>
            {product.condition && <p className="product-detail-condition">{product.condition}</p>}
            {product.description && <p className="product-detail-description">{product.description}</p>}
          </div>
        )}
        {!isMarket && <p className="product-detail-price">{product.price}</p>}
        {sizePanel}
        {isMarket ? (
          <button
            type="button"
            className="is-bare"
            aria-label={added ? 'Remove from bag' : 'Add to bag'}
            aria-pressed={added}
            onClick={() => added ? removeItem(product.id) : start()}
          >
            {added ? <DoneCheckIcon /> : <PlusIcon />}
          </button>
        ) : !sizing && <div
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
        </div>}
      </div>
    </div>,
    stageEl,
  )
}
