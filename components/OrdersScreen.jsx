import { useEffect, useState } from 'react'
import { fetchOrders } from '../api.js'
import './OrdersScreen.css'

const money = (amount) => new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'USD',
}).format(amount / 100)

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
            {item.tracking.map((tracking) => <p key={tracking.number}>
              {tracking.url ? <a href={tracking.url} target="_blank" rel="noopener noreferrer">
                {tracking.carrier || 'Tracking'}: {tracking.number}
              </a> : <span>{tracking.carrier || 'Tracking'}: {tracking.number}</span>}
            </p>)}
            {tab === 'sales' && item.source === 'market' && <p>UPS label generation is not available yet.</p>}
          </div>
        </li>)}
      </ul>
    </div>
  </section>
}
