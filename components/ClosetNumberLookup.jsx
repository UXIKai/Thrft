import { useEffect, useRef, useState } from 'react'
import { lookupProductNumbers } from '../api.js'
import { addClosetItem, removeImageBackground } from '../closet.js'
import OrbitCarousel from './OrbitCarousel.jsx'
import StageSlot from './StageSlot.jsx'
import BrandLogo from './BrandLogo.jsx'
import './ClosetNumberLookup.css'

export default function ClosetNumberLookup({ brands, initialBrand, onClose, onAdded }) {
  const [brand, setBrand] = useState(initialBrand || brands[0] || '')
  const [page, setPage] = useState('brand')
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [products, setProducts] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(null)
  const busyRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      mountedRef.current = false
      requestRef.current?.abort()
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  async function search(event) {
    event.preventDefault()
    if (busyRef.current) return
    if (!partNumber.trim() && !orderNumber.trim()) {
      setError('Enter a P/N or O/N number.')
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    setProducts(null)
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const matches = await lookupProductNumbers({ brand, partNumber: partNumber.trim(), orderNumber: orderNumber.trim() }, controller.signal)
      if (mountedRef.current) setProducts(matches)
    } catch (err) {
      if (err.name !== 'AbortError' && mountedRef.current) setError(err.message || 'Could not find this product.')
    } finally {
      busyRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  async function addProduct(product, variant) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const response = await fetch(variant.imageUrl, { signal: controller.signal, credentials: 'omit' })
      if (!response.ok) throw new Error('Could not load the product photo.')
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) throw new Error('The product photo is not an image.')
      const imageUrl = await removeImageBackground(new File([blob], 'product-photo', { type: blob.type }))
      if (!mountedRef.current) return
      const item = addClosetItem({
        title: product.title, brand: product.brand, category: product.category,
        price: product.price, imageUrl, scanned: true, backgroundRemoved: true,
        color: variant.color, partNumber: product.partNumber,
      })
      onAdded(item)
    } catch (err) {
      if (err.name !== 'AbortError' && mountedRef.current) setError(err.message || 'Could not scan this product into your closet.')
    } finally {
      busyRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  return (
    <StageSlot>
      <section className="closet-number-page" role="dialog" aria-modal="true" aria-label="Add clothing by product number">
        {!(page === 'brand' && !expanded) && <button type="button" className="closet-number-back is-bare" aria-label="Back" onClick={onClose} autoFocus>‹</button>}
        <div className="closet-number-content">
          {page === 'brand' ? <>
            <h2>Choose a brand</h2>
            {expanded ? <>
              <div className="closet-number-brands" role="group" aria-label="Brands">
                {brands.filter((name) => name.toLowerCase().includes(query.toLowerCase())).map((name) =>
                  <button type="button" key={name} onClick={() => { setBrand(name); setExpanded(false) }}><BrandLogo name={name} /></button>,
                )}
                {!brands.some((name) => name.toLowerCase().includes(query.toLowerCase())) && <p role="status">No brands found.</p>}
              </div>
              <input className="closet-number-brand-search" type="search" aria-label="Search brands" placeholder="Search brands" value={query} onChange={(event) => setQuery(event.target.value)} />
            </> : <>
              <OrbitCarousel variant="wheel" className="closet-brand-wheel" wheelSpacing={60} wheelAngle={0} wheelScale={false} items={brands.map((name) => ({ id: name, label: name }))} activeId={brand} onSelect={setBrand} onActivate={() => setExpanded(true)} ariaLabel="Brand" renderItem={(item) => <BrandLogo name={item.label} />} />
              <div className="closet-number-actions">
                <button type="button" className="is-bare" aria-label="Back" onClick={onClose}>
                  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
                </button>
                <button type="button" className="is-bare" aria-label="Continue" disabled={!brand} onClick={() => setPage('numbers')}>
                  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </button>
              </div>
            </>}
          </> : <>
            <h2>{brand}</h2>
            <button type="button" className="is-bare" onClick={() => { setPage('brand'); setProducts(null); setError('') }} disabled={busy}>Change brand</button>
            <form onSubmit={search}>
              <input aria-label="P/N Number" placeholder="P/N Number" value={partNumber} maxLength={120} disabled={busy} onChange={(event) => { setPartNumber(event.target.value); setProducts(null) }} />
              <input aria-label="O/N Number" placeholder="O/N Number" value={orderNumber} maxLength={120} disabled={busy} onChange={(event) => { setOrderNumber(event.target.value); setProducts(null) }} />
              <button type="submit" disabled={busy}>Search</button>
            </form>
            {busy && <p role="status">Searching or scanning clothing…</p>}
            {products?.length === 0 && <p role="status">No matching product found for this brand and number.</p>}
            {products?.map((product, index) => <div key={index} className="closet-number-result">
              <h3>{product.title}</h3>
              <p>{product.variants.length > 1 ? 'Choose your color to scan into Closet' : 'Scan into Closet'}</p>
              {product.variants.map((variant) => <button key={variant.color} type="button" disabled={busy} onClick={() => addProduct(product, variant)}>
                <img src={variant.imageUrl} alt="" />{variant.color}
              </button>)}
            </div>)}
          </>}
          {error && <p role="alert">{error}</p>}
        </div>
      </section>
    </StageSlot>
  )
}
