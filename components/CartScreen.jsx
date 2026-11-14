import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import HomeRadialMenu, { moveKnob, radialAt } from './HomeRadialMenu.jsx'
import { createCheckoutSession, estimateCheckout } from '../api.js'
import { useBag } from '../BagContext.jsx'
import './GlassOverlay.css'
import './CartScreen.css'
import NavButtonGlyph from './NavButtonGlyph.jsx'

function BagIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 8h14l-1 12H6L5 8zM9 8V6.5a3 3 0 0 1 6 0V8"
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
  onShowNav,
  onChange,
  onOpenProduct,
  shippingAddress = '',
  onMenuPick,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const holdRef = useRef(0)
  const bag = useBag()
  const items = itemsProp ?? bag.items
  const [stageEl, setStageEl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [shippingOpen, setShippingOpen] = useState(false)
  const [recipient, setRecipient] = useState(() => ({
    name: '', address1: typeof shippingAddress === 'string' ? shippingAddress : '',
    address2: '', city: '', state_code: '', zip: '', country_code: 'US',
    ...(shippingAddress && typeof shippingAddress === 'object' ? shippingAddress : {}),
  }))
  const [quote, setQuote] = useState(null)
  const [shippingRateId, setShippingRateId] = useState('')
  const shippingForm = useRef(null)
  const printable = items.some((item) => item.printfulVariants?.length || item.printfulVariantId)
  const quoteKey = JSON.stringify({ items, recipient })
  const currentQuote = quote?.key === quoteKey ? quote : null
  const selectedRate = currentQuote?.shippingRates.find((rate) => rate.id === shippingRateId)

  useEffect(() => {
    setStageEl(document.querySelector('.stage'))
    const stage = document.querySelector('.stage')
    stage?.classList.add('is-overlay-open')
    return () => stage?.classList.remove('is-overlay-open')
  }, [])

  const total = (currentQuote ? currentQuote.subtotal / 100 : bag.total) + (selectedRate?.amount || 0) / 100
  const totalLabel = bag.formatMoney(total)

  function setQty(item, qty) {
    bag.replaceItems(
      items.map((it) => (it.id === item.id ? {
        ...it,
        qty,
        selectedSizes: Array.from({ length: qty }, (_, index) =>
          it.selectedSizes?.[index] || it.size || '',
        ),
      } : it)),
    )
  }

  function remove(id) {
    bag.removeItem(id)
  }

  async function pay() {
    if (!items.length || busy) return
    if (printable && !shippingOpen) {
      setShippingOpen(true)
      return
    }
    if (printable && !shippingForm.current?.reportValidity()) return
    setBusy(true)
    setError('')
    try {
      if (printable && !currentQuote) {
        const result = await estimateCheckout({ items, address: recipient })
        if (!result.shippingRates?.length) throw new Error('No shipping service is available for this address')
        setQuote({ ...result, key: quoteKey })
        setShippingRateId(result.shippingRates[0].id)
        return
      }
      const session = await createCheckoutSession({
        items,
        address: printable ? recipient : shippingAddress || undefined,
        shippingRateId: selectedRate?.id,
        shippingAmount: selectedRate?.amount,
      })
      const url = session?.data?.url || session?.url
      if (url) {
        window.location.assign(url)
        return
      }
      setError('Unavailable')
    } catch (err) {
      if (err.status === 409) setQuote(null)
      const status = err?.status
      setError(status === 401 ? 'Sign in' : err.message || 'Checkout unavailable')
    } finally {
      setBusy(false)
    }
  }

  const swipeRef = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    let el = e.target
    let scrolled = false
    for (; el && el !== e.currentTarget; el = el.parentElement) {
      if (el.scrollTop > 0) scrolled = true
    }
    swipeRef.current = e.touches.length === 1 && !scrolled ? { x: t.clientX, y: t.clientY } : null
  }
  const onTouchMove = (e) => {
    const s = swipeRef.current
    if (!s || busy) return
    const t = e.touches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (dy > 90 && dy > Math.abs(dx) * 1.5) {
      swipeRef.current = null
      onClose?.()
    }
  }

  // Holding the button opens the menu; moving rotates a choice into the middle and letting go picks it
  const heldRef = useRef(false)
  const pickMenu = (id) => {
    setMenuOpen(false)
    if (id !== 'cart') onMenuPick?.(id)
  }
  const onHoldDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    clearTimeout(holdRef.current)
    heldRef.current = false
    holdRef.current = setTimeout(() => {
      heldRef.current = true
      setMenuOpen(true)
    }, 420)
  }
  const cancelHold = () => clearTimeout(holdRef.current)
  useEffect(() => {
    if (!menuOpen) return undefined
    const onMove = (e) => moveKnob(e.clientX, e.clientY)
    const onUp = () => {
      const hit = radialAt()
      if (hit) pickMenu(hit.dataset.radial)
      else setMenuOpen(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen])
  useEffect(() => () => clearTimeout(holdRef.current), [])

  if (!stageEl) return null

  return createPortal(
    <div
      className="glass-overlay cart-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Bag"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => { swipeRef.current = null }}
    >
      <button
        type="button"
        className="cart-chevron is-bare"
        aria-label="Show navigation"
        style={{ touchAction: 'none' }}
        onPointerDown={onHoldDown}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (heldRef.current) {
            heldRef.current = false
            return
          }
          onShowNav?.()
        }}
      >
        <NavButtonGlyph icon={<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2.4l2.1 11h9.6l1.9-8H6.2" /><circle cx="9" cy="19" r="1.2" /><circle cx="16.5" cy="19" r="1.2" /></g></svg>} />
      </button>
      {menuOpen && (
        <HomeRadialMenu
          bagCount={items.length}
          onClose={() => setMenuOpen(false)}
          onPick={pickMenu}
        />
      )}
      <div className="glass-overlay-body cart-body">
        {items.length === 0 ? (
          <p className="cart-empty">Your bag is empty</p>
        ) : shippingOpen && printable ? (
          <form className="cart-shipping-form" ref={shippingForm}
            onSubmit={(event) => { event.preventDefault(); pay() }}>
            <h2>Shipping address</h2>
            <fieldset disabled={busy}>
              {[
                ['name', 'Full name', 'name'], ['address1', 'Street address', 'address-line1'],
                ['address2', 'Apartment / unit (optional)', 'address-line2'],
                ['city', 'City', 'address-level2'], ['state_code', 'State / province', 'address-level1'],
                ['zip', 'Postal code', 'postal-code'], ['country_code', 'Country code (e.g. US)', 'country'],
              ].map(([field, label, autoComplete]) => <label key={field}>
                <span>{label}</span>
                <input value={recipient[field]} autoComplete={autoComplete}
                  required={!['address2', 'state_code'].includes(field)}
                  maxLength={field === 'country_code' ? 2 : 200}
                  onChange={(event) => {
                    setRecipient({ ...recipient, [field]: event.target.value })
                    setQuote(null)
                    setError('')
                  }} />
              </label>)}
              {currentQuote && <label>
                <span>Shipping service</span>
                <select value={shippingRateId} onChange={(event) => setShippingRateId(event.target.value)}>
                  {currentQuote.shippingRates.map((rate) => <option key={rate.id} value={rate.id}>
                    {rate.name} - {bag.formatMoney(rate.amount / 100)}
                  </option>)}
                </select>
              </label>}
            </fieldset>
            <p>Delivery uses this address. Billing details are entered in Stripe.</p>
            <button type="button" className="is-bare" disabled={busy}
              onClick={() => setShippingOpen(false)}>Back to bag</button>
          </form>
        ) : (
          <ul className="cart-list">
            {items.map((item) => (
              <li key={item.id} className="cart-line">
                <div className="cart-line-head">
                  <button
                    type="button"
                    className="cart-line-main"
                    onClick={() => onOpenProduct?.(item)}
                  >
                    <span className="cart-line-title">
                      {item.title}
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  className="cart-line-photo is-bare"
                  aria-label={item.title}
                  onClick={() => onOpenProduct?.(item)}
                >
                  {item.photoUrl ? <img src={item.photoUrl} alt="" /> : null}
                </button>
                <span className="cart-line-price">
                  {typeof item.price === 'number'
                    ? bag.formatMoney(item.price)
                    : item.price}
                </span>
                {true ? (
                  <div className="cart-line-qty">
                    <button type="button" className="cart-line-act is-bare" aria-label="Fewer" onClick={() => (item.qty <= 1 ? remove(item.id) : setQty(item, item.qty - 1))}>
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M6 12h12" /></svg>
                    </button>
                    <button type="button" className="cart-line-count cart-line-act is-bare" aria-label={`View ${item.qty} selected ${item.title || 'products'}`} onClick={() => onOpenProduct?.(item, { quantity: true })}>{item.qty}</button>
                    <button type="button" className="cart-line-act is-bare" aria-label="More" onClick={() => setQty(item, item.qty + 1)}>
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
                    </button>
                  </div>
                ) : (
                <div className="cart-line-actions">
                  {confirmId === item.id ? (
                    <>
                      <button type="button" className="cart-line-act is-bare" aria-label="Keep" onClick={() => setConfirmId(null)}>
                        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                      <svg className="cart-line-trash" width="26" height="26" viewBox="0 0 24 24" aria-hidden><path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /></svg>
                      <button type="button" className="cart-line-act is-bare" aria-label="Remove" disabled={busy} onClick={() => { setConfirmId(null); remove(item.id) }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      </button>
                    </>
                  ) : (
                    <button type="button" className="cart-line-act is-bare" aria-label={`Remove ${item.title}`} onClick={() => setConfirmId(item.id)}>
                      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M6 12h12" /></svg>
                    </button>
                  )}
                </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 ? (
        <div className="cart-pay-dock">
          <div className="cart-pay-block">
            <p className="cart-total">
              <strong>{totalLabel}</strong>
            </p>
            <div className="cart-pay-actions">
              <button
                type="button"
                className="cart-pay"
                aria-label={shippingOpen && printable && !currentQuote ? 'Get shipping rates' : 'Pay'}
                disabled={busy}
                onClick={pay}
              >
                {busy ? '…' : shippingOpen && printable && !currentQuote ? 'Get rates' : <BagIcon />}
              </button>
            </div>
          </div>
          {error ? (
            <p className="cart-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        null
      )}
    </div>,
    stageEl,
  )
}
