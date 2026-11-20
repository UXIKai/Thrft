import { useEffect, useState } from 'react'
import { createUpsLabel, fetchOrders } from '../api.js'
import './OrdersScreen.css'

const money = (amount) => new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'USD',
}).format(amount / 100)

const FROM_KEY = 'thrft-ship-from'
const loadFrom = () => {
  try { return JSON.parse(localStorage.getItem(FROM_KEY)) || {} } catch { return {} }
}
const FROM_FIELDS = [['name', 'Full name'], ['street1', 'Street address'], ['street2', 'Apt / suite (optional)'],
  ['city', 'City'], ['state', 'State (e.g. TX)'], ['zip', 'ZIP code'], ['phone', 'Phone (optional)']]

function UpsLabel({ item, onLabel }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(loadFrom)
  const [weight, setWeight] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const label = item.upsLabel
  if (label) return <div className="orders-label">
    <a href={label.labelUrl} target="_blank" rel="noopener noreferrer">UPS label (PDF)</a>
    {label.trackingUrl ? <a href={label.trackingUrl} target="_blank" rel="noopener noreferrer">
      Tracking: {label.trackingNumber}</a> : <span>Tracking: {label.trackingNumber}</span>}
  </div>
  if (!item.labelOrderId) return null
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const created = await createUpsLabel({ orderId: item.labelOrderId, itemIndex: item.labelItemIndex,
        fromAddress: from, parcel: { weightLb: Number(weight) } })
      try { localStorage.setItem(FROM_KEY, JSON.stringify(from)) } catch { /* ignore */ }
      onLabel(created)
    } catch (err) {
      setError(err.message || 'Could not create label')
    } finally {
      setBusy(false)
    }
  }
  if (!open) return <button type="button" className="orders-label-btn" onClick={() => setOpen(true)}>Generate UPS Label</button>
  return <form className="orders-label-form" onSubmit={submit}>
    {FROM_FIELDS.map(([key, text]) => <input key={key} value={from[key] || ''} placeholder={text}
      aria-label={text} required={!text.includes('optional')}
      onChange={(e) => setFrom({ ...from, [key]: e.target.value })} />)}
    <input type="number" min="0.1" step="0.1" required value={weight} placeholder="Package weight (lb)"
      aria-label="Package weight in pounds" onChange={(e) => setWeight(e.target.value)} />
    {error && <p role="alert">{error}</p>}
    <button type="submit" className="orders-label-btn" disabled={busy}>{busy ? 'Buying label...' : 'Buy UPS label'}</button>
  </form>
}

export default function OrdersScreen({ onBack }) {
  const [tab, setTab] = useState('purchases')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setItems([])
    fetchOrders(tab).then((rows) => {
      if (active) setItems(rows)
    }).catch((err) => {
      if (active) setError(err.message || 'Could not load orders')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [tab])

  return <section className="glass-overlay orders-screen" role="dialog" aria-modal="true" aria-label="Orders">
    <header className="glass-overlay-top">
      <button type="button" className="glass-overlay-back is-bare" aria-label="Back to Settings" onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5.5 8.5 12 15 18.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h1 className="glass-overlay-title">Orders</h1>
      <span className="glass-overlay-spacer" aria-hidden="true" />
    </header>
    <div className="orders-tabs" role="tablist" aria-label="Orders">
      {['purchases', 'sales'].map((value) => <button key={value} type="button" role="tab"
        aria-selected={tab === value} onClick={() => setTab(value)}>
        {value === 'purchases' ? 'Purchases' : 'Sales'}
      </button>)}
    </div>
    <div className="glass-overlay-body orders-body" role="tabpanel">
      {loading && <p role="status">Loading orders...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !items.length && <p>No paid {tab} yet.</p>}
      <ul className="orders-list">
        {items.map((item) => <li className="orders-item" key={item.id}>
          <div className="orders-photo">{item.photoUrl && <img src={item.photoUrl} alt="" />}</div>
          <div className="orders-info">
            <h2>{item.title}</h2>
            <p>{item.size ? `Size ${item.size} · ` : ''}{item.quantity} × {money(item.unitAmount)}</p>
            <p>{item.source === 'store' ? 'Store' : item.source === 'market' ? 'Market' : 'Order'} · {item.status.replaceAll('_', ' ')}</p>
            {item.margin !== null && <p>Estimated product margin: {money(item.margin)}</p>}
            {item.externalOrderId && <p>Order {item.externalOrderId}</p>}
            {item.payout && <p>Brand order payout: {money(item.payout.net)} ({item.payout.status}) · Shipping {money(item.payout.shipping)} · Thrft fee {money(item.payout.platformFee)} · Processing {money(item.payout.processingFee)}</p>}
            {item.shopifySync && <p>Shopify: {item.shopifySync.status.replaceAll('_', ' ')}{item.shopifySync.error ? ` · ${item.shopifySync.error}` : ''}</p>}
            {item.recipient && <p>Ship to: {[item.recipient.name, item.recipient.address1, item.recipient.address2,
              item.recipient.city, item.recipient.state_code, item.recipient.zip, item.recipient.country_code]
              .filter(Boolean).join(', ')}</p>}
            {item.tracking.map((tracking) => <p key={tracking.number}>
              {tracking.url ? <a href={tracking.url} target="_blank" rel="noopener noreferrer">
                {tracking.carrier || 'Tracking'}: {tracking.number}
              </a> : <span>{tracking.carrier || 'Tracking'}: {tracking.number}</span>}
            </p>)}
            {tab === 'sales' && item.source === 'market' && <UpsLabel item={item}
              onLabel={(upsLabel) => setItems((rows) => rows.map((row) => row.id === item.id ? { ...row, upsLabel } : row))} />}
          </div>
        </li>)}
      </ul>
    </div>
  </section>
}
