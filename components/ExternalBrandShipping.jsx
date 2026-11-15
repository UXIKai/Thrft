import { useEffect, useState } from 'react'
import { fetchExternalBrandSettings, saveExternalBrandShipping } from '../api.js'
import './GlassOverlay.css'
import './ExternalBrandShipping.css'

function ShippingBrand({ brand }) {
  const [amount, setAmount] = useState((brand.flatShippingCents / 100).toFixed(2))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

  return <form className="external-shipping-brand" onSubmit={save}>
    <h2>{brand.name}</h2>
    <p>{brand.domain}</p>
    <label>Flat shipping rate (USD)
      <input type="text" inputMode="decimal" value={amount} disabled={busy}
        onChange={(event) => { setAmount(event.target.value); setMessage(''); setError('') }} />
    </label>
    <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save rate'}</button>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </form>
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

  return <section className="glass-overlay external-shipping" role="dialog" aria-modal="true" aria-label="Brand shipping">
    <header className="glass-overlay-top">
      <button type="button" className="glass-overlay-back is-bare" aria-label="Back to Settings" onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5.5 8.5 12 15 18.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h1 className="glass-overlay-title">Brand shipping</h1>
      <span aria-hidden="true" />
    </header>
    <div className="glass-overlay-body external-shipping-body">
      <p>One flat rate per brand. $0 means free shipping. External-brand checkout is not yet available.</p>
      {loading && <p role="status">Loading brands…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !brands.length && <p>No verified imported brands yet.</p>}
      {brands.map((brand) => <ShippingBrand key={brand.id} brand={brand} />)}
    </div>
  </section>
}
