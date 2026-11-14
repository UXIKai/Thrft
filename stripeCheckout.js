/**
 * Stripe Checkout uses server-side product prices and a durable fulfillment snapshot.
 * Only signed, paid Checkout events (or a Stripe-verified status check) create drafts.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { checkoutStore } from './server/supabaseStore.js'
import { createOrder, getOrder } from './printful.js'

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || ''
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''
export const APP_ORIGIN = process.env.APP_ORIGIN ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` :
    'http://127.0.0.1:5173')
export const API_ORIGIN = process.env.API_ORIGIN || APP_ORIGIN

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status })
}

export function getStripeCheckoutConfig() {
  return { configured: Boolean(STRIPE_SECRET), mode: STRIPE_SECRET ? 'live' : 'unconfigured',
    webhookConfigured: Boolean(STRIPE_WEBHOOK_SECRET) }
}

async function stripe(path, params) {
  if (!STRIPE_SECRET) fail('Set STRIPE_SECRET_KEY to enable checkout', 503)
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${STRIPE_SECRET}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params?.toString(),
    signal: AbortSignal.timeout(15000),
  })
  const data = await response.json()
  if (!response.ok) fail(data.error?.message || 'Stripe request failed', response.status)
  return data
}

export async function resolveCheckoutItems(body, store = checkoutStore) {
  const input = body.items || [{ id: body.productId || body.id, qty: body.quantity || 1 }]
  if (!Array.isArray(input) || !input.length || input.length > 50) fail('Choose 1 to 50 cart items')
  const items = []
  for (const item of input) {
    const id = item?.id || item?.productId
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) fail('Invalid product ID')
    const quantity = Number(item.qty ?? item.quantity ?? 1)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) fail('Quantity must be 1 to 10')
    const product = await store.getProduct(id)
    if (!product || product.status !== 'active') fail('A cart product is no longer available', 409)
    const unitAmount = Math.round(Number(product.price) * 100)
    if (!Number.isSafeInteger(unitAmount) || unitAmount < 50) fail('Product price is invalid', 409)
    if (product.artwork_url && !product.printful_variant_id) fail('Product fulfillment variant is missing', 409)
    if (product.printful_variant_id && !product.artwork_url) fail('Product fulfillment artwork is missing', 409)
    // A published product represents one specific size/color; do not silently ship another size.
    if (product.printful_variant_id && Array.isArray(item.selectedSizes) &&
        item.selectedSizes.some((size) => size && size !== product.size)) {
      fail(`Choose the published size (${product.size}) for ${product.title}`)
    }
    items.push({
      productId: product.id, title: product.title, unitAmount, quantity,
      photoUrl: product.mockup_urls?.[0] || product.photo_url || product.image_url || '',
      printfulVariantId: product.printful_variant_id || null,
      artworkUrl: product.artwork_url || null,
      placement: product.printful_placement || 'front',
    })
  }
  return items
}

function redirectUrl(value, fallback) {
  const url = new URL(value || fallback, APP_ORIGIN)
  if (url.origin !== new URL(APP_ORIGIN).origin) fail('Checkout redirects must use the app origin')
  return url.href.replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}')
}

export async function createCheckoutSession(body = {}, { accountKey, store = checkoutStore } = {}) {
  if (!accountKey) fail('Sign in before checkout', 401)
  const items = await resolveCheckoutItems(body, store)
  const params = new URLSearchParams({
    mode: 'payment',
    success_url: redirectUrl(body.successUrl, '/?checkout=success&session_id={CHECKOUT_SESSION_ID}'),
    cancel_url: redirectUrl(body.cancelUrl, '/?checkout=cancel'),
    client_reference_id: accountKey,
    'metadata[customerId]': accountKey,
  })
  // Printful needs structured recipient data, collected directly by Stripe.
  for (const [i, country] of ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'IE', 'NZ'].entries()) {
    params.set(`shipping_address_collection[allowed_countries][${i}]`, country)
  }
  items.forEach((item, i) => {
    const prefix = `line_items[${i}]`
    params.set(`${prefix}[quantity]`, String(item.quantity))
    params.set(`${prefix}[price_data][currency]`, 'usd')
    params.set(`${prefix}[price_data][unit_amount]`, String(item.unitAmount))
    params.set(`${prefix}[price_data][product_data][name]`, item.title)
    if (/^https:\/\//.test(item.photoUrl)) {
      params.set(`${prefix}[price_data][product_data][images][0]`, item.photoUrl)
    }
  })
  const session = await stripe('checkout/sessions', params)
  await store.saveOrder({
    stripe_session_id: session.id, creator_customer_id: accountKey, items,
    amount_total: items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0),
    currency: 'usd',
  })
  return { id: session.id, url: session.url, status: session.status, mode: 'live' }
}

export function verifyStripeEvent(rawBody, signature, secret = STRIPE_WEBHOOK_SECRET, now = Date.now()) {
  if (!secret) fail('Set STRIPE_WEBHOOK_SECRET to receive Stripe payments', 503)
  const entries = String(signature || '').split(',').map((part) => part.split('='))
  const timestamp = entries.find(([key]) => key === 't')?.[1]
  if (!timestamp || !Number.isFinite(Number(timestamp)) ||
      Math.abs(now / 1000 - Number(timestamp)) > 300) fail('Invalid Stripe signature timestamp')
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest()
  const valid = entries.some(([key, value]) => {
    if (key !== 'v1' || !/^[a-f0-9]{64}$/i.test(value || '')) return false
    return timingSafeEqual(expected, Buffer.from(value, 'hex'))
  })
  if (!valid) fail('Invalid Stripe signature')
  return JSON.parse(rawBody.toString('utf8'))
}

function recipientFromSession(session) {
  const shipping = session.collected_information?.shipping_details || session.shipping_details
  const address = shipping?.address
  if (!shipping?.name || !address?.line1 || !address.city || !address.country || !address.postal_code) {
    fail('Paid checkout is missing a complete shipping address', 409)
  }
  return {
    name: shipping.name, address1: address.line1, address2: address.line2 || '',
    city: address.city, state_code: address.state || '', country_code: address.country,
    zip: address.postal_code, email: session.customer_details?.email || '',
  }
}

export async function fulfillPaidCheckout(session, {
  store = checkoutStore, printful = { createOrder, getOrder },
} = {}) {
  if (session.payment_status !== 'paid') return { fulfilled: false, paymentStatus: session.payment_status }
  const saved = await store.getOrder(session.id)
  if (!saved) fail('Checkout order snapshot is missing', 409)
  if (session.amount_total !== saved.amount_total || session.currency !== saved.currency ||
      session.metadata?.customerId !== saved.creator_customer_id) {
    fail('Paid checkout does not match its saved order', 409)
  }
  if (['draft', 'not_required'].includes(saved.fulfillment_status)) return saved
  const order = await store.claimOrder(session.id)
  if (!order) fail('Order fulfillment is already processing; retry shortly', 409)
  try {
    const printable = order.items.filter((item) => item.printfulVariantId && item.artworkUrl)
    if (!printable.length) {
      return await store.updateOrder(session.id, {
        payment_status: 'paid', fulfillment_status: 'not_required', claim_until: null,
      })
    }
    const externalId = order.id.replaceAll('-', '')
    let draft
    try {
      // Recover a previous successful submission if saving its ID failed.
      draft = await printful.getOrder(`@${externalId}`)
    } catch (error) {
      if (error.status !== 404) throw error
    }
    if (!draft) {
      draft = await printful.createOrder({
        externalId, confirm: false, recipient: recipientFromSession(session),
        items: printable.map((item) => ({
          variant_id: item.printfulVariantId, quantity: item.quantity,
          files: [{ type: item.placement, url: item.artworkUrl }],
        })),
      })
    }
    if (!draft.id) throw new Error('Printful did not return a draft order ID')
    return await store.updateOrder(session.id, {
      payment_status: 'paid', fulfillment_status: 'draft', printful_order_id: draft.id,
      fulfillment_error: null, claim_until: null,
    })
  } catch (error) {
    await store.updateOrder(session.id, {
      payment_status: 'paid', fulfillment_status: 'failed',
      fulfillment_error: String(error.message), claim_until: null,
    })
    throw error
  }
}

export async function handleStripeWebhook(rawBody, signature) {
  const event = verifyStripeEvent(rawBody, signature)
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    // Retrieve from Stripe rather than trusting a browser return URL.
    const session = await stripe(`checkout/sessions/${encodeURIComponent(event.data.object.id)}`)
    await fulfillPaidCheckout(session)
  }
  return { received: true }
}

export async function getCheckoutSession(sessionId, accountKey) {
  const order = await checkoutStore.getOrder(sessionId)
  if (!order) return null
  if (order.creator_customer_id !== accountKey) fail('Checkout belongs to another account', 403)
  const session = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`)
  const fulfillment = await fulfillPaidCheckout(session)
  return { id: session.id, status: session.status, paymentStatus: session.payment_status,
    fulfillmentStatus: fulfillment.fulfillment_status || order.fulfillment_status,
    amountTotal: session.amount_total, currency: session.currency }
}

// Kept for existing callers; ownership is still required.
export const retrieveLiveCheckout = getCheckoutSession
export function stripeWebhookConfigured() {
  return Boolean(STRIPE_SECRET && STRIPE_WEBHOOK_SECRET)
}
