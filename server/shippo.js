/**
 * Prepaid domestic UPS labels for sold Market resale items, purchased through Shippo.
 * The seller supplies the ship-from address and package weight; the buyer's address is the
 * delivery address Stripe collected at checkout.
 */
import { getAdminSupabase } from './supabaseStore.js'

const SHIPPO_API = 'https://api.goshippo.com'

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status })
}

function checked({ data, error }) {
  if (error) throw error
  return data
}

async function shippo(path, body, { fetchImpl = fetch, apiKey = process.env.SHIPPO_API_KEY } = {}) {
  if (!apiKey) fail('Set SHIPPO_API_KEY to enable UPS labels', 503)
  const response = await fetchImpl(`${SHIPPO_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `ShippoToken ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) fail(shippoMessage(data) || 'Shippo request failed', 502)
  return data
}

function shippoMessage(data) {
  const messages = [].concat(data?.messages || [], data?.detail || [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.text)).filter(Boolean)
  return messages.join(' ')
}

function text(value, label, { required = true, max = 100 } = {}) {
  const result = typeof value === 'string' ? value.trim() : ''
  if (required && !result) fail(`Enter the ${label}`)
  if (result.length > max) fail(`The ${label} is too long`)
  return result
}

export function parseFromAddress(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Enter your ship-from address')
  const country = text(input.country || 'US', 'ship-from country', { max: 2 }).toUpperCase()
  if (country !== 'US') fail('UPS labels are available for domestic (US) shipments only')
  const state = text(input.state, 'ship-from state', { max: 2 }).toUpperCase()
  const zip = text(input.zip, 'ship-from ZIP code', { max: 10 })
  if (!/^[A-Z]{2}$/.test(state)) fail('Enter the 2-letter ship-from state')
  if (!/^\d{5}(-\d{4})?$/.test(zip)) fail('Enter a valid ship-from ZIP code')
  return {
    name: text(input.name, 'ship-from name'), street1: text(input.street1, 'ship-from street address'),
    street2: text(input.street2, 'ship-from address line 2', { required: false }),
    city: text(input.city, 'ship-from city'), state, zip, country,
    phone: text(input.phone, 'ship-from phone', { required: false, max: 30 }),
  }
}

export function parseParcel(input = {}) {
  const number = (value, fallback) => {
    const parsed = value === undefined || value === '' ? fallback : Number(value)
    return Number.isFinite(parsed) ? parsed : NaN
  }
  const weight = number(input.weightLb, NaN)
  const length = number(input.lengthIn, 12)
  const width = number(input.widthIn, 10)
  const height = number(input.heightIn, 4)
  if (!(weight > 0 && weight <= 70)) fail('Enter the package weight in pounds (up to 70 lb)')
  for (const size of [length, width, height]) {
    if (!(size > 0 && size <= 108)) fail('Package dimensions must be between 0 and 108 inches')
  }
  return { weight: weight.toFixed(2), mass_unit: 'lb', length: String(length), width: String(width),
    height: String(height), distance_unit: 'in' }
}

function toAddress(recipient) {
  if ((recipient?.country_code || '').toUpperCase() !== 'US') {
    fail('UPS labels are available for domestic (US) shipments only')
  }
  return {
    name: recipient.name, street1: recipient.address1, street2: recipient.address2 || '',
    city: recipient.city, state: recipient.state_code, zip: recipient.zip, country: 'US',
    email: recipient.email || '',
  }
}

export function cheapestUpsRate(rates) {
  const upsRates = (rates || []).filter((rate) => String(rate.provider).toUpperCase() === 'UPS' &&
    Number.isFinite(Number(rate.amount)) && rate.object_id)
  if (!upsRates.length) return null
  const ground = upsRates.filter((rate) => /ground/i.test(rate.servicelevel?.token || rate.servicelevel?.name || ''))
  return (ground.length ? ground : upsRates).sort((a, b) => Number(a.amount) - Number(b.amount))[0]
}

/** Buy (or return the already-bought) UPS label for one Market item the seller sold. */
export async function createUpsLabel(userId, body = {}, {
  db = getAdminSupabase(), request = shippo,
} = {}) {
  const orderId = body.orderId
  const itemIndex = Number(body.itemIndex)
  if (typeof orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(orderId)) fail('Invalid order')
  if (!Number.isInteger(itemIndex) || itemIndex < 1) fail('Invalid order item')
  const order = checked(await db.from('creator_checkout_orders').select('*').eq('id', orderId).maybeSingle())
  const item = order?.items?.[itemIndex - 1]
  if (!order || order.payment_status !== 'paid' || !item || item.source !== 'market') {
    fail('Sold Market order not found', 404)
  }
  let sellerId = item.creatorId
  if (!sellerId) {
    sellerId = checked(await db.from('listings').select('seller_id').eq('id', item.productId).maybeSingle())?.seller_id
  }
  if (!sellerId || sellerId !== userId) fail('Sold Market order not found', 404)
  const productKey = String(item.productId)
  const existing = order.market_labels?.[productKey]
  if (existing?.labelUrl) return { label: existing }
  if (!order.recipient) fail('This order has no delivery address yet', 409)

  const from = parseFromAddress(body.fromAddress)
  const parcel = parseParcel(body.parcel)
  const to = toAddress(order.recipient)

  const reserved = checked(await db.rpc('reserve_market_label', { order_id: order.id, product_key: productKey }))
  if (!reserved) fail('A label is already being created for this item. Try again shortly.', 409)
  let purchased = false
  try {
    const shipment = await request('/shipments/', {
      address_from: { ...from, email: '' }, address_to: to, parcels: [parcel], async: false,
    })
    const rate = cheapestUpsRate(shipment.rates)
    if (!rate) fail(shippoMessage(shipment) || 'UPS has no service available for this address', 409)
    const transaction = await request('/transactions/', {
      rate: rate.object_id, label_file_type: 'PDF', async: false,
    })
    if (transaction.status !== 'SUCCESS' || !transaction.tracking_number ||
        !/^https:\/\//i.test(transaction.label_url || '')) {
      fail(shippoMessage(transaction) || 'UPS did not return a label', 502)
    }
    purchased = true
    const label = {
      trackingNumber: transaction.tracking_number, labelUrl: transaction.label_url,
      trackingUrl: /^https:\/\//i.test(transaction.tracking_url_provider || '') ? transaction.tracking_url_provider : '',
      carrier: 'UPS', service: rate.servicelevel?.name || '', cost: Number(rate.amount),
      transactionId: transaction.object_id, createdAt: new Date().toISOString(),
    }
    checked(await db.rpc('set_market_label', { order_id: order.id, product_key: productKey, label }))
    return { label }
  } catch (error) {
    if (purchased) console.error('[shippo] Label bought but not saved; recover it from Shippo for order', order.id)
    else await db.rpc('set_market_label', { order_id: order.id, product_key: productKey, label: null })
    throw error
  }
}
