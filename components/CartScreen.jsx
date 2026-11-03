import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { createCheckoutSession } from '../api.js'
import { useBag } from '../BagContext.jsx'
import './GlassOverlay.css'
import './CartScreen.css'

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

/**
 * Marketplace bag — glass overlay, no nested cards.
 * Checkout pays for listed items (never Thrft Premium).
 */
export default function CartScreen({
  items: itemsProp,
  onClose,
  onChange,
  onOpenProduct,
  shippingAddress = '',
}) {
  const bag = useBag()
  const items = itemsProp ?? bag.items
  const [stageEl, setStageEl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setStageEl(document.querySelector('.stage'))
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-overlay-open')
    return () => stage?.classList.remove('is-overlay-open')
  }, [])

  const total = bag.total
  const totalLabel = bag.formatMoney(total)

  function remove(id) {
    bag.removeItem(id)
  }

  async function pay() {
    if (!items.length || busy) return
    setBusy(true)
    setError('')
    try {
      const session = await createCheckoutSession({
        items,
        address: shippingAddress || undefined,
      })
      const url = session?.data?.url || session?.url
      if (url) {
        window.location.assign(url)
        return
      }
      setError('Unavailable')
    } catch (err) {
      const status = err?.status
      setError(status === 401 ? 'Sign in' : 'Unavailable')
    } finally {
      setBusy(false)
    }
  }

  if (!stageEl) return null

  return createPortal(
    <div className="glass-overlay cart-screen" role="dialog" aria-modal="true" aria-label="Bag">
      <div className="glass-overlay-body cart-body">
        {items.length === 0 ? (
          <p className="cart-empty">Your bag is empty</p>
        ) : (
          <ul className="cart-list">
            {items.map((item) => (
              <li key={item.id} className="cart-line">
                <button
                  type="button"
                  className="cart-line-main"
                  onClick={() => onOpenProduct?.(item)}
                >
                  <span className="cart-line-title">
                    {item.title}
                    {item.qty > 1 ? ` ×${item.qty}` : ''}
                  </span>
                  <span className="cart-line-meta">
                    {[item.brandName, item.price].filter(Boolean).join(' · ')}
                  </span>
                </button>
                <button
                  type="button"
                  className="cart-line-remove"
                  aria-label={`Remove ${item.title}`}
                  onClick={() => remove(item.id)}
                  disabled={busy}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 ? (
          <div className="cart-footer">
            <p className="cart-total">
              <span>Total</span>
              <strong>{totalLabel}</strong>
            </p>
            <button
              type="button"
              className="cart-pay"
              disabled={busy}
              onClick={pay}
            >
              {busy ? '…' : 'Pay'}
            </button>
            {error ? (
              <p className="cart-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="cart-bottom-dock">
        <button
          type="button"
          className="cart-dock-back"
          aria-label="Back"
          onClick={onClose}
          disabled={busy}
        >
          <BackIcon />
        </button>
      </div>
    </div>,
    stageEl,
  )
}
