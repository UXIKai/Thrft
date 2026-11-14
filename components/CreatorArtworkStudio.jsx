import { useEffect, useRef, useState } from 'react'
import { uploadCreatorArtwork } from '../artworkStorage.js'
import { fetchPrintfulProducts, fetchPrintfulProduct,
  startPrintfulMockups, fetchPrintfulMockups } from '../api.js'
import './CreatorArtworkStudio.css'
import { isAvailablePrintfulVariant } from '../creatorProducts.js'

export default function CreatorArtworkStudio({ initialArtwork, onReady, onBusy }) {
  const [products, setProducts] = useState([])
  const [variants, setVariants] = useState([])
  const [productId, setProductId] = useState(initialArtwork?.productId || '')
  const [color, setColor] = useState(initialArtwork?.color || '')
  const [selectedIds, setSelectedIds] = useState(initialArtwork?.variantIds || [])
  const [artworkUrl, setArtworkUrl] = useState(initialArtwork?.artworkUrl || '')
  const [mockups, setMockups] = useState(initialArtwork?.mockupUrls || [])
  const [dimensions, setDimensions] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef(null)
  const alive = useRef(true)

  useEffect(() => {
    const abort = new AbortController()
    fetchPrintfulProducts(abort.signal)
      .then((data) => setProducts(data.products))
      .catch((error) => { if (!abort.signal.aborted) setError(error.message) })
    return () => abort.abort()
  }, [])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      controller.current?.abort()
      onBusy(false)
    }
  }, [onBusy])

  useEffect(() => {
    if (!productId) return undefined
    const abort = new AbortController()
    fetchPrintfulProduct(productId, abort.signal)
      .then((data) => setVariants(data.variants.filter(isAvailablePrintfulVariant)))
      .catch((error) => { if (!abort.signal.aborted) setError(error.message) })
    return () => abort.abort()
  }, [productId])

  const colors = [...new Set(variants.map((variant) => variant.color))]
  const colorVariants = variants.filter((variant) => variant.color === color)
  const selected = colorVariants.filter((variant) => selectedIds.includes(variant.id))

  function invalidate() {
    onReady(null)
    setMockups([])
    setError('')
  }

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy) return
    invalidate()
    setArtworkUrl('')
    setDimensions(null)
    setBusy(true)
    onBusy(true)
    try {
      const url = await uploadCreatorArtwork(file)
      if (alive.current) setArtworkUrl(url)
    } catch (error) {
      if (alive.current) setError(error.message)
    } finally {
      if (alive.current) { setBusy(false); onBusy(false) }
    }
  }

  async function generate() {
    if (busy) return
    invalidate()
    setBusy(true)
    onBusy(true)
    const abort = new AbortController()
    controller.current = abort
    try {
      const task = await startPrintfulMockups({
        product_id: Number(productId), variant_ids: selected.map((variant) => variant.id),
        artwork_url: artworkUrl, placement: 'front',
        artwork_dimensions: dimensions,
      }, abort.signal)
      const deadline = Date.now() + 120000
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000))
        if (abort.signal.aborted) return
        const result = await fetchPrintfulMockups(task.task_key, abort.signal)
        if (result.status === 'completed') {
          if (!Array.isArray(result.variants) || !result.variants.length) {
            throw new Error('Mockup result is missing its size variants')
          }
          setMockups(result.mockup_urls)
          onReady({ taskKey: task.task_key, artworkUrl, productId, color,
            variantIds: selected.map((variant) => variant.id), variants: result.variants,
            mockupUrls: result.mockup_urls })
          return
        }
        if (result.status === 'failed') throw new Error('Printful could not generate mockups')
      }
      throw new Error('Mockups are taking longer than expected. Try generating again.')
    } catch (error) {
      if (!abort.signal.aborted) setError(error.message)
    } finally {
      if (alive.current) { setBusy(false); onBusy(false) }
    }
  }

  return (
    <div className="creator-artwork-studio">
      <label className="listing-field">
        <span>Artwork (PNG or JPEG, up to 20 MB)</span>
        <input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={upload} />
      </label>
      {artworkUrl && <img className="creator-artwork-preview" src={artworkUrl}
        alt="Uploaded creator artwork" onLoad={(event) => setDimensions({
          width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight,
        })} onError={() => setError('Uploaded artwork could not be loaded. Check the Thrft bucket is public.')} />}
      <label className="listing-field">
        <span>Printful blank</span>
        <select className="listing-input is-inset" value={productId} disabled={busy}
          onChange={(event) => {
            invalidate(); setVariants([]); setSelectedIds([]); setColor(''); setProductId(event.target.value)
          }}>
          <option value="">Choose a blank product</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
        </select>
      </label>
      <label className="listing-field">
        <span>Color</span>
        <select className="listing-input is-inset" value={color} disabled={busy || !variants.length}
          onChange={(event) => { invalidate(); setSelectedIds([]); setColor(event.target.value) }}>
          <option value="">Choose a garment color</option>
          {colors.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {color && <fieldset className="creator-size-field">
        <legend>Available sizes (choose one or more)</legend>
        <div className="creator-size-options">
          {colorVariants.map((variant) => (
            <button key={variant.id} type="button" role="checkbox"
              className="creator-size-option is-bare" aria-checked={selectedIds.includes(variant.id)}
              disabled={busy} onClick={() => {
                invalidate()
                setSelectedIds((ids) => ids.includes(variant.id)
                  ? ids.filter((id) => id !== variant.id) : [...ids, variant.id])
              }}>{variant.size}</button>
          ))}
        </div>
      </fieldset>}
      <p>Artwork fits the front print area without stretching. Buyers choose from your selected sizes on one listing.</p>
      <button type="button" className="creator-generate is-bare"
        disabled={busy || !artworkUrl || !dimensions || !selected.length} onClick={generate}>
        {busy ? 'Preparing mockups...' : 'Generate mockups'}
      </button>
      <div className="creator-mockup-previews">
        {mockups.map((url) => <img key={url} src={url} alt="Printful product mockup" />)}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
