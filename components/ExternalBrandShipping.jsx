import { useEffect, useState } from 'react'
import { fetchExternalBrandSettings, saveBrandShopify, saveExternalBrandShipping } from '../api.js'
import './GlassOverlay.css'
import './ExternalBrandShipping.css'
import BrandCatalogSync from './BrandCatalogSync.jsx'

function ShippingBrand({ brand }) {
  const [amount, setAmount] = useState((brand.flatShippingCents / 100).toFixed(2))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [shop, setShop] = useState(brand.shopifyShop || '')
  const [token, setToken] = useState('')
  const [connected, setConnected] = useState(Boolean(brand.shopifyConnected))

  async function saveShopify(disconnect = false) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const saved = await saveBrandShopify(brand.id, disconnect ? { disconnect: true } : { shop, token })
      setToken('')
      setConnected(Boolean(saved.shopifyConnected))
      setShop(saved.shopifyShop || '')
      setMessage(disconnect ? 'Shopify sync disabled.' : 'Shopify settings saved.')
    } catch (err) {
      setError(err.message || 'Could not save Shopify settings.')
    } finally { setBusy(false) }
  }

  async function save(event) {
    event.preventDefault()
    if (busy) return
    const value = amount.trim()
    if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(value) || Number(value) > 100000) {
      setError('Enter an amount from $0 to $100,000 with at most two decimal places.')
      return
    }
    const [dollars, cents = ''] = value.split('.')
    const total = Number(dollars) * 100 + Number(cents.padEnd(2, '0'))
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await saveExternalBrandShipping(brand.id, total)
      setAmount((total / 100).toFixed(2))
      setMessage('Shipping rate saved.')
    } catch (err) {
      setError(err.message || 'Could not save shipping rate.')
    } finally { setBusy(false) }
  }

  return <section className="external-shipping-brand">
    <h2>{brand.name}</h2>
    <p>{brand.domain}</p>
    <BrandCatalogSync brandId={brand.id} disabled={busy} />
    <form onSubmit={save}>
      <label>Flat shipping rate (USD)
        <input type="text" inputMode="decimal" value={amount} disabled={busy}
          onChange={(event) => { setAmount(event.target.value); setMessage(''); setError('') }} />
      </label>
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save rate'}</button>
    </form>
    <form onSubmit={(event) => { event.preventDefault(); saveShopify() }}>
      <h3>Shopify sync (optional)</h3>
      <p>{connected ? 'Connected. Leave the token blank to keep your current connection.' : 'Not connected.'}</p>
      <label>Shop domain
        <input type="text" value={shop} placeholder="your-store.myshopify.com" disabled={busy}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          onChange={(event) => setShop(event.target.value)} />
      </label>
      <label>Admin API access token
        <input type="password" value={token} disabled={busy} autoComplete="new-password"
          placeholder={connected ? 'Leave blank to keep existing token' : 'Access token'}
          onChange={(event) => setToken(event.target.value)} />
      </label>
      <button type="submit" disabled={busy || !shop.trim()}>Save Shopify settings</button>
      {connected && <button type="button" disabled={busy} onClick={() => saveShopify(true)}>Disable Shopify sync</button>}
    </form>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}

export default function ExternalBrandShipping({ onBack }) {
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    fetchExternalBrandSettings().then((items) => {
      if (active) setBrands(items)
    }).catch((err) => {
      if (active) setError(err.message || 'Could not load brand settings.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  return <section className="glass-overlay external-shipping" role="dialog" aria-modal="true" aria-label="Store settings">
    <header className="glass-overlay-top">
      <button type="button" className="glass-overlay-back is-bare" aria-label="Back to Settings" onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5.5 8.5 12 15 18.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h1 className="glass-overlay-title">Store settings</h1>
      <span aria-hidden="true" />
    </header>
    <div className="glass-overlay-body external-shipping-body">
      <p>One flat shipping rate per brand; $0 means free shipping. Thrft charges a 10% item fee, with no monthly fee. Your payout = item sales × 90% + shipping − processing (2.9% of the total charged + $0.30), with a $0 minimum. Shared checkouts split the processing fee proportionally. Payouts are manual.</p>
      {loading && <p role="status">Loading brands…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !brands.length && <p>No verified stores yet. Import a brand website from Create to sync its catalog here.</p>}
      {brands.map((brand) => <ShippingBrand key={brand.id} brand={brand} />)}
    </div>
  </section>
}
