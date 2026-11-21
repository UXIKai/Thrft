import { updateMyListing } from '../listings.js'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { useBag } from '../BagContext.jsx'
import { LETTER_SIZES } from '../sizeOptions.js'
import { productSizeOptions } from '../productSizes.js'
import { externalProductVariants, externalVariantLabel, isExternalProduct, storedPrintfulVariants } from '../creatorProducts.js'
import { formatMoney, selectedExternalVariants } from '../cart.js'
import ProductPhoto from './ProductPhoto.jsx'
import ProductSpin from './ProductSpin.jsx'
import { fetchSaved, saveSavedItems } from '../api.js'
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

function productPhotos(product) {
  const mockups = product?.mockupUrls?.length ? product.mockupUrls : product?.mockup_urls
  const photos = [product?.photoUrl || product?.photo_url || product?.imageUrl || product?.image_url, ...(mockups || [])]
  return [...new Set(photos.filter((photo) =>
    typeof photo === 'string' && photo && !/^placeholder$/i.test(photo)))]
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
  openQuantity = false,
  onSavedChange,
  accountId,
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
  const variants = product?.printfulVariants?.length ? product.printfulVariants :
    storedPrintfulVariants(product || {})
  const isPrintful = Boolean(variants.length || product?.printfulVariantId)
  const isExternal = isExternalProduct(product)
  const isMarket = product?.detailVariant === 'market' && !isPrintful && !isExternal
  const isOwnListing = isMarket && accountId && product?.sellerId === accountId
  async function deleteListing() {
    if (!window.confirm(`Delete "${product.title || 'this listing'}"?`)) return
    try {
      await updateMyListing(product.id, { status: 'removed' })
      onSavedChange?.()
      onClose?.()
    } catch (error) {
      setSelectionError(error.message || 'Could not delete this listing.')
    }
  }
  const externalVariants = externalProductVariants(product)
  const selectedVariantIds = Array.isArray(bagItem?.selectedVariantIds) ? bagItem.selectedVariantIds :
    Array.from({ length: inBag }, () => bagItem?.externalVariantId || '')
  const [selectionError, setSelectionError] = useState('')
  const [savedProducts, setSavedProducts] = useState(null)
  const [savingLike, setSavingLike] = useState(false)
  const [likeError, setLikeError] = useState('')
  const liked = savedProducts?.some((item) => String(item.id) === String(product?.id)) || false

  useEffect(() => {
    if (isMarket) return undefined
    let active = true
    setSavedProducts(null)
    setLikeError('')
    fetchSaved().then((rows) => {
      if (active) setSavedProducts(rows)
    }).catch((error) => {
      if (active) setLikeError(error.message || 'Could not load liked products')
    })
    return () => { active = false }
  }, [product?.id, isMarket])

  async function toggleLike() {
    if (!savedProducts || savingLike) return
    navigator.vibrate?.(10)
    setSavingLike(true)
    setLikeError('')
    const previous = savedProducts
    const next = liked
      ? savedProducts.filter((item) => String(item.id) !== String(product.id))
      : [...savedProducts, product]
    setSavedProducts(next) // heart flips instantly; the save happens behind it
    try {
      const result = await saveSavedItems(next)
      setSavedProducts(result.items)
      onSavedChange?.()
    } catch (error) {
      setSavedProducts(previous)
      setLikeError(error.message || 'Could not update liked products')
    } finally {
      setSavingLike(false)
    }
  }

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
  const [quantityOpen, setQuantityOpen] = useState(openQuantity)
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
    setQuantityOpen(openQuantity)
    setEditingSizeIndex(null)
    setShowInformation(false)
    setSizeMetric('EN')
    setSizeFormat(null)
    setSelectionError('')
  }, [product?.id, openQuantity])

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
    if (isExternal && inBag && !selectedExternalVariants({ ...bagItem,
      externalVariants: product.externalVariants ?? product.external_variants,
      externalCurrency: product.externalCurrency ?? product.external_currency })) {
      setSelectionError('A selected variant is no longer available. Tap the quantity to change it or remove it.')
      return
    }
    setSelectionError('')
    setShowInformation(false)
    setSizing(true)
  }

  function pickSize(size) {
    if (!product || (isPrintful && !availableSizes.includes(size))) return
    if (inBag) {
      replaceItems(
        items.map((row) =>
          row.id === product.id
            ? {
                ...row,
                size,
                qty: Math.min(inBag + 1, 10),
                selectedSizes: [...selectedSizes, size].slice(0, 10),
              }
            : row,
        ),
      )
    } else {
      addItem({ ...product, size })
    }
    setSizing(false)
  }

  function pickExternalVariant(variant) {
    if (!product || !variant || inBag >= 10) return
    addItem({ ...product, externalVariantId: variant.id })
    setSelectionError('')
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
          ? { ...row, qty: Math.min(next, 10), selectedSizes: selectedSizes.slice(0, next),
              ...(isExternal ? { selectedVariantIds: selectedVariantIds.slice(0, next) } : {}) }
          : row,
      ),
    )
  }

  if (!product || !stageEl) return null

  const chosenVariant = isExternal ? externalVariants.find((variant) => variant.id === selectedVariantIds[selectedVariantIds.length - 1]) : null
  const photos = chosenVariant?.image ? [chosenVariant.image] : productPhotos(product)
  const photo = photos[0] || ''
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
  const availableSizes = [...new Set((variants.length ? variants.map((variant) => variant.size) :
    product.sizes?.length ? product.sizes : [product.size]).filter(Boolean))]
  const numericSizes = !isExternal && !isPrintful && (sizeFormat || (originalSizeOptions.some((option) => /\d/.test(option.value)) ? 'numbers' : 'letters')) === 'numbers'
  const sizeOptions = isPrintful
    ? availableSizes.map((size) => ({ value: size, letter: size, en: size, eu: size }))
    : productSizeOptions(product, numericSizes ? 'numbers' : 'letters')
  const canShowLetters = sizeOptions.some((option) => /[a-z]/i.test(option.letter))
  const sizePanel = sizing && !isMarket ? (
      <section className="product-store-size-panel" aria-label="Select size">
        <header className="product-store-size-header">
          {numericSizes ? <button type="button" className="is-bare" aria-label={`Size metric ${sizeMetric}; switch to ${sizeMetric === 'EN' ? 'EU' : 'EN'}`} onClick={() => setSizeMetric(sizeMetric === 'EN' ? 'EU' : 'EN')}>{sizeMetric}</button> : <span />}
          <span />
          <div className="product-store-size-actions">
          </div>
        </header>
        <div className="product-store-size-content">
          {showInformation ? (
            <section className="product-store-information" aria-label="Product information">
              <button type="button" className="product-store-materials is-bare" aria-label="Return to sizes" onClick={() => setShowInformation(false)}>
                {Array.isArray(product.materials) ? product.materials.join(', ') : product.materials || 'Not provided.'}
              </button>
            </section>
          ) : (
            <>
              <div className={`product-store-size-grid${isExternal ? ' is-external-variants' : ''}`} role="group" aria-label={isExternal ? 'Available variants' : numericSizes ? `${sizeMetric} sizes` : 'Letter sizes'}>
                {isExternal ? externalVariants.map((variant) => (
                  <button type="button" className="product-detail-size is-bare" key={variant.id} onClick={() => pickExternalVariant(variant)}>
                    {variant.image && <ProductPhoto src={variant.image} cutout alt="" />}
                    {externalVariantLabel(variant)} · {formatMoney(variant.price)}
                  </button>
                )) : sizeOptions.map((option) => (
                  <button type="button" className="product-detail-size is-bare" key={option.value} onClick={() => pickSize(option.value)}>
                    {!numericSizes ? option.letter : sizeMetric === 'EU' ? option.eu : option.en}
                  </button>
                ))}
              </div>
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
        aria-label={isExternal ? 'Choose variant' : 'Choose size'}
        onClick={(event) => {
          if (event.target === event.currentTarget) setEditingSizeIndex(null)
        }}
      >
        <div className={`product-detail-sizes${isExternal ? ' is-external-variants' : ''}`} role="group" aria-label={isExternal ? 'Available variants' : 'Sizes'}>
          {isExternal ? externalVariants.map((variant) => (
            <button key={variant.id} type="button" className="product-detail-size is-bare"
              aria-pressed={draftSize === variant.id} onClick={() => setDraftSize(variant.id)}>
              {variant.image && <ProductPhoto src={variant.image} cutout alt="" />}
              {externalVariantLabel(variant)} · {formatMoney(variant.price)}
            </button>
          )) : (isPrintful ? availableSizes : product.sizes?.length ? product.sizes : LETTER_SIZES).map((size) => (
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
          aria-label={isExternal ? 'Done choosing variant' : 'Done choosing size'}
          onClick={() => {
            if (isExternal && draftSize && externalVariants.some((variant) => variant.id === draftSize)) {
              const nextIds = selectedVariantIds.map((id, index) => index === editingSizeIndex ? draftSize : id)
              const nextSizes = nextIds.map((id, index) =>
                externalVariants.find((variant) => variant.id === id)?.size || selectedSizes[index] || '')
              replaceItems(items.map((row) => row.id === product.id ? {
                ...row, externalVariants: product.externalVariants ?? product.external_variants,
                externalCurrency: product.externalCurrency ?? product.external_currency,
                selectedVariantIds: nextIds, selectedSizes: nextSizes, size: nextSizes[nextSizes.length - 1],
              } : row))
              setSelectionError('')
            } else if (!isExternal && draftSize && draftSize !== selectedSizes[editingSizeIndex]) {
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

  if (quantityOpen && !isMarket) {
    return createPortal(
      <div className="glass-overlay product-detail product-detail-quantity-page" role="dialog" aria-modal="true" aria-label="Selected products">
        <header className="glass-overlay-top">
          <h1 className="product-detail-quantity-title">Quantity: {qty}</h1>
        </header>
        <div className="glass-overlay-body">
          <ul className="product-detail-selected-list">
            {selectedSizes.map((size, index) => {
              const externalVariant = isExternal && externalVariants.find((variant) => variant.id === selectedVariantIds[index])
              const label = isExternal ? externalVariant ? `${externalVariantLabel(externalVariant)} · ${formatMoney(externalVariant.price)}` : 'Variant unavailable' : size ? `Size: ${size}` : 'Size not selected'
              return (
              <li key={index}>
                <button
                  type="button"
                  className="product-detail-selected-item is-bare"
                  aria-label={`Change ${isExternal ? 'variant' : 'size'} for ${displayTitle || name}, item ${index + 1}, ${label}`}
                  onClick={() => {
                    setDraftSize(isExternal ? selectedVariantIds[index] || '' : size || '')
                    setEditingSizeIndex(index)
                  }}
                >
                {(externalVariant?.image || photo) && <ProductPhoto src={externalVariant?.image || photo} cutout={isPrintful || isExternal} alt="" />}
                <div>
                  {brand && <p>{brand}</p>}
                  <h2>{displayTitle || name}</h2>
                  <p>{label}</p>
                </div>
                </button>
              </li>
            )})}
          </ul>
        </div>
        <button
          type="button"
          className="product-detail-done is-bare"
          aria-label="Done"
          onClick={() => openQuantity ? onClose() : setQuantityOpen(false)}
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
      {!isMarket && (
        <button type="button" className="product-detail-like is-bare"
          aria-label={liked ? 'Remove from Liked' : 'Add to Liked'}
          aria-pressed={liked} disabled={!savedProducts}
          onClick={toggleLike}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
              fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {!isExternal && sizing && !isMarket && !isPrintful && (!numericSizes || canShowLetters) && (
        <button
          type="button"
          className="product-detail-format-toggle is-bare"
          aria-label={numericSizes ? 'Show letter sizes' : 'Show numeric sizes'}
          onClick={() => setSizeFormat(numericSizes ? 'letters' : 'numbers')}
        >
          {numericSizes ? 'Aa' : '123'}
        </button>
      )}
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
        {likeError && <p role="alert">{likeError}</p>}
        {!isMarket && brand && (
          <button
            type="button"
            className="product-detail-brand is-bare"
            onClick={() => onOpenBrand?.(product.brandId || '', brand)}
            aria-label={`View ${brand} brand page`}
          >
            {isExternal && product.brandLogoUrl && <img className="product-detail-brand-logo" src={product.brandLogoUrl} alt="" />}
            {!(isExternal && product.brandLogoUrl) && brand}
          </button>
        )}
        <div className="product-detail-photo">
          {photos.length > 1 ? (
            <ProductSpin count={photos.length} label="Product mockups; drag to rotate">
              {photos.map((url, index) => <ProductPhoto key={url} src={url} cutout={isPrintful || isExternal}
                alt={`${name}, preview ${index + 1} of ${photos.length}`} />)}
            </ProductSpin>
          ) : photos.length ? (
            <ProductPhoto src={photos[0]} cutout={isPrintful || isExternal} alt={name} />
          ) : (
            <span className="product-detail-photo-empty" aria-hidden />
          )}
        </div>
        {(isMarket ? title : displayTitle) && <h1 className="product-detail-title">{isMarket ? title : displayTitle}</h1>}
        {isMarket && (
          <div className="product-detail-market-info">
            <div className="product-detail-market-meta">
              {brand && <button type="button" className="product-detail-brand is-bare" onClick={() => onOpenBrand?.(product.brandId || '', brand)} aria-label={`View ${brand} brand page`}>{isExternal && product.brandLogoUrl && <img className="product-detail-brand-logo" src={product.brandLogoUrl} alt="" />}{!(isExternal && product.brandLogoUrl) && brand}</button>}
              {product.category && <span>{product.category}</span>}
            </div>
            <p className="product-detail-price">{product.price}</p>
            {product.condition && <p className="product-detail-condition">{product.condition}</p>}
            {product.description && <p className="product-detail-description">{product.description}</p>}
          </div>
        )}
        {!isMarket && <p className="product-detail-price">{isExternal
          ? externalVariants.length ? `${externalVariants.length > 1 ? 'From ' : ''}${formatMoney(Math.min(...externalVariants.map((variant) => variant.price)))}` : 'Unavailable'
          : product.price}</p>}
        {isExternal && !externalVariants.length && <p className="product-detail-external-unavailable">This product is not available for checkout. USD pricing and saved variants are required.</p>}
        {selectionError && <p role="alert">{selectionError}</p>}
        {isMarket ? (
          <div className="product-detail-market-actions">
            <button
              type="button"
              className="is-bare"
              aria-label={added ? 'Remove from bag' : 'Add to bag'}
              aria-pressed={added}
              onClick={() => added ? removeItem(product.id) : start()}
            >
              {added ? <DoneCheckIcon /> : <PlusIcon />}
            </button>
            {isOwnListing && (
              <button type="button" className="is-bare" aria-label="Delete listing" onClick={deleteListing}>
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
                  <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                </svg>
              </button>
            )}
          </div>
        ) : <div
          className={`product-detail-buy${added && !sizing ? ' is-added' : ''}`}
        >
          <button
            type="button"
            className={`product-detail-add${sizing ? ' is-open' : ''}`}
            aria-label={sizing ? 'Close size selection' : 'Choose amount'}
            aria-expanded={sizing}
            disabled={isExternal && !externalVariants.length}
            tabIndex={added && !sizing ? -1 : 0}
            onClick={() => sizing ? setSizing(false) : start()}
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="product-detail-step product-detail-minus is-bare"
            aria-label="Remove one"
            tabIndex={added && !sizing ? 0 : -1}
            onClick={() => step(qty - 1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M5 11h14v2H5z" />
            </svg>
          </button>
          <div className="product-detail-stepper" aria-hidden={!added || sizing}>
            <button
              type="button"
              className="product-detail-qty is-bare"
              aria-label={`View ${qty} selected products`}
              tabIndex={added && !sizing ? 0 : -1}
              onClick={() => setQuantityOpen(true)}
            >
              {qty}
            </button>
          </div>
          <button
            type="button"
            className="product-detail-step product-detail-plus-btn is-bare"
            aria-label="Add one"
            disabled={qty >= 10 || (isExternal && !externalVariants.length)}
            tabIndex={added && !sizing ? 0 : -1}
            onClick={start}
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="product-detail-step product-detail-confirm is-bare"
            aria-label="Done, return to previous page"
            tabIndex={added && !sizing ? 0 : -1}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>}
        {sizePanel}
      </div>
    </div>,
    stageEl,
  )
}
