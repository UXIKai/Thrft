/**
 * Stripe Checkout for product purchases.
 * Requires STRIPE_SECRET_KEY — no local demo checkout.
 */
import { getProduct, saveCheckoutOrder, getCheckoutOrder } from './db.js'

const APP_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173'
const API_ORIGIN = process.env.API_ORIGIN || `http://127.0.0.1:${process.env.THRFT_API_PORT || 8787}`
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''

export function getStripeCheckoutConfig() {
  return {
    configured: Boolean(STRIPE_SECRET),
    mode: STRIPE_SECRET ? 'live' : 'unconfigured',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  }
}

function parsePriceToCents(price) {
  if (typeof price === 'number' && Number.isFinite(price)) {
    return Math.max(50, Math.round(price * 100))
  }
  const raw = String(price || '').replace(/[^0-9.]/g, '')
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) return 2000
  return Math.max(50, Math.round(n * 100))
}

async function resolveListing(body = {}) {
  const productId = String(body.productId || body.id || '')
  let title = String(body.title || '').trim()
  let price = body.price
  let brandName = String(body.brandName || body.brand || '').trim()
  let description = String(body.description || '').trim()
  let photoUrl = String(body.photoUrl || body.image || '').trim()

  if (productId) {
    const listing = await getProduct(productId)
    if (listing) {
      title = title || listing.title
      price = price || listing.price
      brandName = brandName || listing.brand || listing.brandName || ''
      description = description || listing.description || ''
      photoUrl = photoUrl || listing.photoUrl || ''
    }
  }

  if (!title) title = 'Thrft listing'
  const unitAmount = parsePriceToCents(price)
  return {
    productId: productId || `custom_${Date.now()}`,
    title,
    brandName,
    description,
    photoUrl,
    unitAmount,
    currency: String(body.currency || 'usd').toLowerCase(),
    quantity: Math.min(10, Math.max(1, Number(body.quantity) || 1)),
  }
}

async function createLiveCheckout(listing, { successUrl, cancelUrl, accountKey }) {
  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('success_url', successUrl)
  params.set('cancel_url', cancelUrl)
  params.set('client_reference_id', listing.productId)
  params.set('metadata[productId]', listing.productId)
  params.set('metadata[accountKey]', accountKey || '')
  params.set('line_items[0][quantity]', String(listing.quantity))
  params.set('line_items[0][price_data][currency]', listing.currency)
  params.set('line_items[0][price_data][unit_amount]', String(listing.unitAmount))
  params.set('line_items[0][price_data][product_data][name]', listing.title)
  if (listing.description) {
    params.set(
      'line_items[0][price_data][product_data][description]',
      listing.description.slice(0, 400),
    )
  }
  if (listing.photoUrl) {
    params.set('line_items[0][price_data][product_data][images][0]', listing.photoUrl)
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error?.message || 'Stripe Checkout failed')
    err.code = data.error?.code || 'stripe_error'
    err.status = res.status
    throw err
  }
  return {
    id: data.id,
    url: data.url,
    mode: 'live',
    status: data.status || 'open',
    productId: listing.productId,
    amountTotal: data.amount_total ?? listing.unitAmount * listing.quantity,
    currency: data.currency || listing.currency,
  }
}

export async function createCheckoutSession(body = {}, { accountKey } = {}) {
  if (!STRIPE_SECRET) {
    const err = new Error('Set STRIPE_SECRET_KEY to enable checkout')
    err.code = 'stripe_not_configured'
    err.status = 503
    throw err
  }

  const listing = await resolveListing(body)
  const successUrl =
    body.successUrl ||
    `${APP_ORIGIN}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = body.cancelUrl || `${APP_ORIGIN}/?checkout=cancel`

  const session = await createLiveCheckout(listing, {
    successUrl,
    cancelUrl,
    accountKey,
  })

  await saveCheckoutOrder({
    id: session.id,
    accountKey: accountKey || '',
    productId: listing.productId,
    title: listing.title,
    amountTotal: session.amountTotal,
    currency: session.currency,
    status: session.status || 'open',
    mode: session.mode,
  })

  return session
}

export async function getCheckoutSession(sessionId) {
  if (!sessionId) return null
  const order = await getCheckoutOrder(sessionId)
  if (!order) return null
  return {
    id: order.id,
    mode: order.mode,
    status: order.status,
    productId: order.productId,
    title: order.title,
    amountTotal: order.amountTotal,
    currency: order.currency,
  }
}

export async function retrieveLiveCheckout(sessionId) {
  if (!STRIPE_SECRET) return null
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${STRIPE_SECRET}` } },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return null
  return {
    id: data.id,
    mode: 'live',
    status: data.status,
    paymentStatus: data.payment_status,
    productId: data.metadata?.productId || data.client_reference_id || '',
    amountTotal: data.amount_total,
    currency: data.currency,
    url: data.url,
  }
}

export function stripeWebhookConfigured() {
  return Boolean(STRIPE_SECRET && STRIPE_WEBHOOK_SECRET)
}

export { API_ORIGIN, APP_ORIGIN }
