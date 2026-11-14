/**
 * Printful API client (print-on-demand fulfillment).
 * Requires PRINTFUL_API_TOKEN (a private token from https://developers.printful.com).
 * Set PRINTFUL_STORE_ID too when the token covers more than one store.
 */
import { timingSafeEqual } from 'node:crypto'
import { checkoutStore } from './server/supabaseStore.js'

const PRINTFUL_BASE = 'https://api.printful.com'
const PRINTFUL_TOKEN = process.env.PRINTFUL_API_TOKEN || ''
const PRINTFUL_STORE_ID = process.env.PRINTFUL_STORE_ID || ''
const TIMEOUT_MS = 15000

export function getPrintfulConfig() {
  return {
    configured: Boolean(PRINTFUL_TOKEN),
    storeId: PRINTFUL_STORE_ID || null,
  }
}

async function printful(path, { method = 'GET', body, query } = {}) {
  if (!PRINTFUL_TOKEN) {
    const err = new Error('Printful is not configured (set PRINTFUL_API_TOKEN)')
    err.status = 503
    throw err
  }
  const url = new URL(path, PRINTFUL_BASE)
  for (const [k, v] of Object.entries(query || {})) {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  }
  const headers = {
    Authorization: `Bearer ${PRINTFUL_TOKEN}`,
    'Content-Type': 'application/json',
  }
  if (PRINTFUL_STORE_ID) headers['X-PF-Store-Id'] = PRINTFUL_STORE_ID

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const json = await res.json()
  if (!res.ok) {
    const err = new Error(
      json?.error?.message || (typeof json?.result === 'string' ? json.result : '') ||
        `Printful request failed (${res.status})`,
    )
    err.status = res.status
    throw err
  }
  if (!Object.hasOwn(json, 'result')) throw new Error('Invalid Printful API response')
  return json.result
}

/** Connectivity check — resolves with the stores the token can access. */
export async function checkPrintfulConnection() {
  const stores = await printful('/stores')
  return {
    connected: true,
    stores: (stores || []).map((s) => ({ id: s.id, name: s.name, type: s.type })),
  }
}

export const listCatalogProducts = (categoryId) =>
  printful('/products', { query: { category_id: categoryId } })

export const getCatalogProduct = (productId) => printful(`/products/${productId}`)

export const listSyncProducts = () => printful('/store/products')

export const getSyncProduct = (id) => printful(`/store/products/${id}`)

/** Shipping rates for { recipient, items: [{ variant_id, quantity }] }. */
export const getShippingRates = ({ recipient, items, currency = 'USD' }) =>
  printful('/shipping/rates', { method: 'POST', body: { recipient, items, currency } })

/** Cost estimate for an order without creating it. */
export const estimateOrderCosts = ({ recipient, items }) =>
  printful('/orders/estimate-costs', { method: 'POST', body: { recipient, items } })

/**
 * Create an order. Pass `confirm: true` to submit it for fulfillment immediately;
 * otherwise it stays a draft.
 */
export const createOrder = ({ recipient, items, externalId, shipping, confirm = false }) =>
  printful('/orders', {
    method: 'POST',
    body: { external_id: externalId, recipient, items, ...(shipping ? { shipping } : {}) },
    query: { confirm: String(confirm) },
  })

export const getOrder = (id) => printful(`/orders/${id}`)

export const confirmOrder = (id) => printful(`/orders/${id}/confirm`, { method: 'POST' })

export const cancelOrder = (id) => printful(`/orders/${id}`, { method: 'DELETE' })

export const getPrintfileLayout = (productId) =>
  printful(`/mockup-generator/printfiles/${encodeURIComponent(productId)}`)

export const createMockupTask = (productId, { variantIds, files }) =>
  printful(`/mockup-generator/create-task/${encodeURIComponent(productId)}`, {
    method: 'POST',
    body: { variant_ids: variantIds, format: 'jpg', files },
  })

export const getMockupTask = (taskKey) =>
  printful('/mockup-generator/task', { query: { task_key: taskKey } })

export async function handlePrintfulWebhook(event, token, {
  store = checkoutStore, secret = process.env.PRINTFUL_WEBHOOK_SECRET, fetchOrder = getOrder,
} = {}) {
  if (!secret) throw Object.assign(new Error('Set PRINTFUL_WEBHOOK_SECRET to receive shipment updates'), { status: 503 })
  const supplied = Buffer.from(typeof token === 'string' ? token : '')
  const expected = Buffer.from(secret)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw Object.assign(new Error('Invalid Printful webhook token'), { status: 401 })
  }
  if (event.type !== 'package_shipped') return { received: true }
  const id = event.data?.order?.id
  const shipmentId = event.data?.shipment?.id
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(shipmentId) || shipmentId < 1) {
    throw Object.assign(new Error('Invalid Printful shipment event'), { status: 400 })
  }
  const saved = await store.getOrderByPrintfulId(id)
  if (!saved) return { received: true, ignored: true }
  if (saved.fulfillment_status === 'shipped') return { received: true }
  // V1 webhooks have no Stripe-style signature; verify shipment details with the provider.
  const order = await fetchOrder(id)
  const shipment = order.shipments?.find((entry) => entry.id === shipmentId)
  if (order.id !== id || order.external_id !== saved.id.replaceAll('-', '') ||
      !['partial', 'fulfilled', 'inprocess'].includes(order.status) ||
      !shipment) {
    throw Object.assign(new Error('Printful shipment could not be verified; retry later'), { status: 409 })
  }
  await store.updateShipment(saved.stripe_session_id, {
    fulfillment_status: order.status === 'fulfilled' ? 'shipped' : 'partially_shipped',
    tracking_number: shipment.tracking_number || null, tracking_url: shipment.tracking_url || null,
    shipments: order.shipments.map((entry) => ({
      id: entry.id, carrier: entry.carrier, service: entry.service,
      tracking_number: entry.tracking_number, tracking_url: entry.tracking_url,
    })),
  })
  return { received: true }
}
