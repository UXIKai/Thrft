/**
 * Printful API client (print-on-demand fulfillment).
 * Requires PRINTFUL_API_TOKEN (a private token from https://developers.printful.com).
 * Set PRINTFUL_STORE_ID too when the token covers more than one store.
 */
const PRINTFUL_BASE = process.env.PRINTFUL_API_BASE || 'https://api.printful.com'
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
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(
      json?.error?.message || json?.result || `Printful request failed (${res.status})`,
    )
    err.status = res.status
    throw err
  }
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
export const createOrder = ({ recipient, items, externalId, confirm = false }) =>
  printful('/orders', {
    method: 'POST',
    body: { external_id: externalId, recipient, items },
    query: { confirm: confirm ? 'true' : '' },
  })

export const getOrder = (id) => printful(`/orders/${id}`)

export const confirmOrder = (id) => printful(`/orders/${id}/confirm`, { method: 'POST' })

export const cancelOrder = (id) => printful(`/orders/${id}`, { method: 'DELETE' })
