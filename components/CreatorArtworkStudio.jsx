import { useEffect, useRef, useState } from 'react'
import { uploadCreatorArtwork } from '../artworkStorage.js'
import { fetchPrintfulProducts, fetchPrintfulProduct,
  startPrintfulMockups, fetchPrintfulMockups } from '../api.js'
import './CreatorArtworkStudio.css'

export default function CreatorArtworkStudio({ initialArtwork, onReady, onBusy }) {
  const [products, setProducts] = useState([])
  const [variants, setVariants] = useState([])
  const [productId, setProductId] = useState(initialArtwork?.productId || '')
  const [variantId, setVariantId] = useState(initialArtwork?.variantId || '')
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
      .then((data) => setVariants(data.variants.filter((variant) =>
        variant.availability_status !== 'discontinued')))
      .catch((error) => { if (!abort.signal.aborted) setError(error.message) })
    return () => abort.abort()
  }, [productId])

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
        product_id: Number(productId), variant_id: Number(variantId),
        artwork_url: artworkUrl, placement: 'front',
        artwork_dimensions: dimensions,
      }, abort.signal)
      const deadline = Date.now() + 120000
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000))
        if (abort.signal.aborted) return
        const result = await fetchPrintfulMockups(task.task_key, abort.signal)
        if (result.status === 'completed') {
          setMockups(result.mockup_urls)
          onReady({ taskKey: task.task_key, artworkUrl, productId, variantId,
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
            invalidate(); setVariants([]); setVariantId(''); setProductId(event.target.value)
          }}>
          <option value="">Choose a blank product</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
        </select>
      </label>
      <label className="listing-field">
        <span>Size / color</span>
        <select className="listing-input is-inset" value={variantId} disabled={busy || !variants.length}
          onChange={(event) => { invalidate(); setVariantId(event.target.value) }}>
          <option value="">Choose a variant</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>
            {variant.size} / {variant.color}
          </option>)}
        </select>
      </label>
      <p>Artwork fits the front print area without stretching. Publish a separate product for each size/color.</p>
      <button type="button" disabled={busy || !artworkUrl || !dimensions || !variantId} onClick={generate}>
        {busy ? 'Preparing mockups...' : 'Generate mockups'}
      </button>
      <div className="creator-mockup-previews">
        {mockups.map((url) => <img key={url} src={url} alt="Printful product mockup" />)}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
