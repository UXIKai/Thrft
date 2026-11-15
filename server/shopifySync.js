import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { requireVerifiedDomain } from './brandVerification.js'
import { getAdminSupabase } from './supabaseStore.js'

const API_VERSION = '2026-01'
const TIMEOUT_MS = 10000
const MAX_RESPONSE_CHARS = 1_000_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHOP = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/
const TOKEN = /^[A-Za-z0-9_-]{16,255}$/
const ORDER_ID = /^[A-Za-z0-9_-]{1,100}$/
// Rows in these states may already have produced a Shopify order, so they are never re-sent.
const LOCKED = new Set(['sending', 'needs_review', 'synced'])

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status })
}

function checked({ data, error }) {
  if (error) throw error
  return data
}

function encryptionKey(env) {
  const raw = env.SHOPIFY_TOKEN_ENCRYPTION_KEY
  const key = typeof raw === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(raw.trim())
    ? Buffer.from(raw.trim(), 'base64') : null
  if (!key || key.length !== 32) fail('Shopify sync is not configured', 503)
  return key
}

function aad(brandId, shop) {
  return Buffer.from(`thrft-shopify:v1:${brandId}:${shop}`)
}

export function encryptShopifyToken(token, brandId, shop, env = process.env) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(env), iv)
  cipher.setAAD(aad(brandId, shop))
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`
}

export function decryptShopifyToken(value, brandId, shop, env = process.env) {
  const key = encryptionKey(env)
  try {
    if (typeof value !== 'string' || !value.startsWith('v1:')) throw new Error('format')
    const raw = Buffer.from(value.slice(3), 'base64')
    if (raw.length < 29) throw new Error('format')
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))
    decipher.setAAD(aad(brandId, shop))
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
  } catch {
    fail('Saved Shopify connection could not be read; reconnect Shopify', 409)
  }
}

export function normalizeShop(value) {
  if (typeof value !== 'string' || value.length > 300) fail('Enter your store’s .myshopify.com domain')
  let text = value.trim().toLowerCase()
  if (text.startsWith('https://')) text = text.slice(8).replace(/\/$/, '')
  if (!SHOP.test(text)) fail('Enter your store’s .myshopify.com domain without a port or path')
  return text
}

function siteHostname(origin) {
  try {
    const url = new URL(origin)
    if (url.protocol !== 'https:' || url.port) throw new Error('origin')
    return url.hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    fail('Brand website is invalid', 409)
  }
}

function hostOf(value) {
  if (value && typeof value === 'object') value = value.host
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\.$/, '') : ''
}

// Never surfaces provider bodies or network error text, which could echo request data.
async function shopifyRequest(fetchImpl, shop, path, token, { method = 'GET', body } = {}) {
  let response
  let text
  try {
    response = await fetchImpl(`https://${shop}/admin${path}`, {
      method, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'X-Shopify-Access-Token': token, Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    text = await response.text()
  } catch {
    return { ok: false, status: 0, json: null }
  }
  let json = null
  if (typeof text === 'string' && text.length <= MAX_RESPONSE_CHARS) {
    try { json = JSON.parse(text) } catch { json = null }
  }
  const status = Number(response.status) || 0
  return { ok: status >= 200 && status < 300, status, json }
}

function providerFailure(result, action) {
  if (result.status === 401 || result.status === 403) fail('Shopify rejected the access token', 422)
  if (!result.status) fail(`Could not reach Shopify to ${action}`, 502)
  fail(`Shopify could not ${action} (HTTP ${result.status})`, 502)
}

export async function saveShopifyConnection(db, user, brandId, body, {
  fetchImpl = fetch, env = process.env,
} = {}) {
  if (typeof brandId !== 'string' || !UUID.test(brandId)) fail('Invalid brand ID')
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Invalid Shopify settings')
  const disconnect = body.disconnect === true
  if (!disconnect && body.disconnect !== undefined) fail('Invalid Shopify settings')
  const brand = checked(await db.from('external_brands').select('id,creator_id,site_origin')
    .eq('id', brandId).eq('creator_id', user.id).maybeSingle())
  if (!brand || brand.creator_id !== user.id) fail('Brand not found', 404)
  if (disconnect) {
    checked(await db.from('external_brand_shopify').delete().eq('brand_id', brandId).eq('creator_id', user.id))
    return { shopifyConnected: false, shopifyShop: null }
  }
  const shop = normalizeShop(body.shop)
  encryptionKey(env)
  const hostname = siteHostname(brand.site_origin)
  await requireVerifiedDomain(db, user.id, hostname)
  let token
  if (body.token === undefined || body.token === null || body.token === '') {
    // A blank token re-validates the saved connection; it can never move the token to another shop.
    const saved = checked(await db.from('external_brand_shopify').select('creator_id,shop,encrypted_token')
      .eq('brand_id', brandId).eq('creator_id', user.id).maybeSingle())
    if (!saved || saved.shop !== shop) fail('Enter a Shopify Admin API access token')
    token = decryptShopifyToken(saved.encrypted_token, brandId, shop, env)
  } else {
    token = typeof body.token === 'string' ? body.token.trim() : ''
    if (!TOKEN.test(token)) fail('Enter a valid Shopify Admin API access token')
  }

  const shopResult = await shopifyRequest(fetchImpl, shop, `/api/${API_VERSION}/shop.json`, token)
  if (!shopResult.ok) providerFailure(shopResult, 'verify this store')
  const info = shopResult.json?.shop
  if (!info || typeof info !== 'object') fail('Shopify returned an invalid store response', 502)
  if (hostOf(info.myshopify_domain) !== shop) fail('Access token does not belong to this Shopify store', 422)
  if (![hostOf(info.domain), hostOf(info.primary_domain), hostOf(info.myshopify_domain)].includes(hostname)) {
    fail('This Shopify store does not match the brand’s verified website', 403)
  }
  const scopeResult = await shopifyRequest(fetchImpl, shop, '/oauth/access_scopes.json', token)
  if (!scopeResult.ok) providerFailure(scopeResult, 'read access scopes')
  const scopes = Array.isArray(scopeResult.json?.access_scopes)
    ? new Set(scopeResult.json.access_scopes.map((scope) => scope?.handle)) : null
  if (!scopes) fail('Shopify returned an invalid scopes response', 502)
  // Shopify write scopes imply the matching read scope.
  if (!scopes.has('write_orders')) fail('Shopify token needs read_orders and write_orders access', 422)

  checked(await db.from('external_brand_shopify').upsert({
    brand_id: brandId, creator_id: user.id, shop,
    encrypted_token: encryptShopifyToken(token, brandId, shop, env),
  }, { onConflict: 'brand_id' }))
  return { shopifyConnected: true, shopifyShop: shop }
}

function money(cents) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

function variantId(value) {
  if (Number.isSafeInteger(value) && value > 0) return value
  const digits = typeof value === 'string'
    ? value.trim().match(/^(?:gid:\/\/shopify\/ProductVariant\/)?(\d{1,30})$/)?.[1] : null
  const id = digits ? Number(digits) : NaN
  if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== digits.replace(/^0+/, '')) {
    fail('Shopify variant ID cannot be synced safely')
  }
  return id
}

function centsValue(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 9999999900) fail(`${label} is invalid`)
  return value
}

function parseShipping(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return [] }
  }
  return Array.isArray(value) ? value : []
}

function shippingAddress(recipient) {
  if (!recipient || typeof recipient !== 'object') fail('Order has no shipping address')
  const text = (key, max = 255) => typeof recipient[key] === 'string' ? recipient[key].trim().slice(0, max) : ''
  const name = text('name')
  const country = text('country_code', 2).toUpperCase()
  if (!name || !text('address1') || !text('city') || !text('zip') || !/^[A-Z]{2}$/.test(country)) {
    fail('Order shipping address is incomplete')
  }
  const [first, ...rest] = name.split(/\s+/)
  return { name, first_name: first, last_name: rest.join(' '), address1: text('address1'),
    address2: text('address2'), city: text('city'), province_code: text('state_code', 10),
    country_code: country, zip: text('zip', 20), ...(text('phone') ? { phone: text('phone', 40) } : {}) }
}

export function buildShopifyOrder(order, brandId, items, connection) {
  if (String(order.currency || '').toLowerCase() !== 'usd') fail('Only USD orders can be synced')
  let revenue = 0
  const lineItems = items.map((item) => {
    if (item.creatorId !== connection.creator_id) fail('Order item does not belong to this brand owner')
    const quantity = item.quantity
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) fail('Order item quantity is invalid')
    const unit = centsValue(item.unitAmount, 'Order item price')
    revenue += unit * quantity
    return { variant_id: variantId(item.externalVariantId), quantity, price: money(unit) }
  })
  const listed = parseShipping(order.external_shipping).find((entry) => entry?.brandId === brandId)
  const shipping = centsValue(listed ? listed.amount : (items[0].externalShippingCents ?? 0), 'Brand shipping')
  const total = revenue + shipping
  if (!Number.isSafeInteger(total)) fail('Order total is invalid')
  const recipient = order.recipient
  const email = typeof recipient?.email === 'string' && /^[^\s@]{1,64}@[^\s@]{1,190}$/.test(recipient.email.trim())
    ? recipient.email.trim() : null
  return { order: {
    line_items: lineItems,
    ...(shipping > 0 ? { shipping_lines: [{ title: 'Shipping', code: 'thrft-flat', price: money(shipping) }] } : {}),
    shipping_address: shippingAddress(recipient),
    ...(email ? { email } : {}),
    financial_status: 'paid', currency: 'USD',
    transactions: [{ kind: 'sale', status: 'success', gateway: 'manual', amount: money(total), currency: 'USD' }],
    tags: `thrft, thrft-order-${order.id}`,
    note: `Thrft order ${order.id} (paid on Thrft)`,
    note_attributes: [{ name: 'thrft_order_id', value: String(order.id) }],
    send_receipt: false, send_fulfillment_receipt: false, inventory_behaviour: 'decrement_obeying_policy',
  } }
}

function shopifyOrderId(json) {
  const order = json?.order
  const gid = typeof order?.admin_graphql_api_id === 'string'
    ? order.admin_graphql_api_id.match(/^gid:\/\/shopify\/Order\/(\d{1,30})$/)?.[1] : null
  if (gid) return gid
  return Number.isSafeInteger(order?.id) && order.id > 0 ? String(order.id) : null
}

// Inserts the one row allowed per order+brand. Returns the row we own, or the existing row.
async function claim(db, orderId, brandId, shop, status, error = null) {
  const table = () => db.from('external_shopify_orders')
  const { error: insertError } = await table().insert({
    order_id: orderId, brand_id: brandId, shop, status, shopify_order_id: null, error,
  })
  if (!insertError) return { claimed: true }
  if (insertError.code !== '23505') throw insertError
  const existing = checked(await table().select('status,shop,shopify_order_id,error')
    .eq('order_id', orderId).eq('brand_id', brandId).maybeSingle())
  if (!existing) throw Object.assign(new Error('Shopify sync state is unavailable'), { status: 500 })
  // Only explicit rejections may be retried, and only against the same shop.
  if (status === 'sending' && !LOCKED.has(existing.status) && existing.status === 'failed' && existing.shop === shop) {
    const row = checked(await table().update({ status: 'sending', error: null })
      .eq('order_id', orderId).eq('brand_id', brandId).eq('status', 'failed').eq('shop', shop)
      .select('status').maybeSingle())
    if (row) return { claimed: true }
  }
  return { claimed: false, existing }
}

async function finish(db, orderId, brandId, status, fields = {}) {
  checked(await db.from('external_shopify_orders').update({ status, error: null, ...fields })
    .eq('order_id', orderId).eq('brand_id', brandId).eq('status', 'sending'))
}

function existingResult(brandId, existing) {
  return { brandId, status: existing.status, ...(existing.shopify_order_id ? { shopifyOrderId: existing.shopify_order_id } : {}),
    ...(existing.error ? { error: existing.error } : {}), duplicate: true }
}

async function syncBrand(db, order, brandId, items, { fetchImpl, env }) {
  const connection = checked(await db.from('external_brand_shopify')
    .select('brand_id,creator_id,shop,encrypted_token').eq('brand_id', brandId).maybeSingle())
  if (!connection) return { brandId, status: 'not_connected' }
  const shop = connection.shop
  let payload
  let token
  try {
    if (typeof shop !== 'string' || !SHOP.test(shop)) fail('Saved Shopify store is invalid; reconnect Shopify')
    const brand = checked(await db.from('external_brands').select('id,creator_id')
      .eq('id', brandId).maybeSingle())
    if (!brand || brand.creator_id !== connection.creator_id) fail('Shopify connection no longer matches the brand owner')
    payload = buildShopifyOrder(order, brandId, items, connection)
    token = decryptShopifyToken(connection.encrypted_token, brandId, shop, env)
  } catch (error) {
    if (!error.status || error.status >= 500 && error.status !== 503) throw error
    const message = error.message
    const result = await claim(db, order.id, brandId, shop, 'failed', message)
    return result.claimed ? { brandId, status: 'failed', error: message } : existingResult(brandId, result.existing)
  }

  const result = await claim(db, order.id, brandId, shop, 'sending')
  if (!result.claimed) return existingResult(brandId, result.existing)

  const response = await shopifyRequest(fetchImpl, shop, `/api/${API_VERSION}/orders.json`, token,
    { method: 'POST', body: payload })
  const id = response.ok ? shopifyOrderId(response.json) : null
  if (id) {
    await finish(db, order.id, brandId, 'synced', { shopify_order_id: id })
    return { brandId, status: 'synced', shopifyOrderId: id }
  }
  if (response.status >= 400 && response.status < 500) {
    const error = response.status === 401 || response.status === 403
      ? 'Shopify rejected the access token; reconnect Shopify'
      : `Shopify rejected the order (HTTP ${response.status})`
    await finish(db, order.id, brandId, 'failed', { error })
    return { brandId, status: 'failed', error }
  }
  const error = response.ok ? 'Shopify returned an unrecognized response; check Shopify before retrying'
    : response.status ? `Shopify returned HTTP ${response.status}; check Shopify before retrying`
      : 'Shopify did not respond; check Shopify before retrying'
  await finish(db, order.id, brandId, 'needs_review', { error })
  return { brandId, status: 'needs_review', error }
}

export async function syncExternalShopifyOrders(order, {
  db = getAdminSupabase(), fetchImpl = fetch, env = process.env,
} = {}) {
  if (!order || order.payment_status !== 'paid') return { synced: false, reason: 'unpaid', results: [] }
  if (typeof order.id !== 'string' || !ORDER_ID.test(order.id)) {
    return { synced: false, reason: 'invalid_order', results: [] }
  }
  const byBrand = new Map()
  for (const item of Array.isArray(order.items) ? order.items : []) {
    if (typeof item?.externalBrandId !== 'string' || !UUID.test(item.externalBrandId)) continue
    if (!byBrand.has(item.externalBrandId)) byBrand.set(item.externalBrandId, [])
    byBrand.get(item.externalBrandId).push(item)
  }
  const results = []
  for (const [brandId, items] of byBrand) {
    results.push(await syncBrand(db, order, brandId, items, { fetchImpl, env }))
  }
  return { synced: results.some((result) => result.status === 'synced'), results }
}
