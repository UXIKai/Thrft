import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { saveShopifyConnection, syncExternalShopifyOrders, encryptShopifyToken } from '../server/shopifySync.js'

const env = { SHOPIFY_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') }
const brandId = '11111111-1111-4111-8111-111111111111'
const otherBrand = '22222222-2222-4222-8222-222222222222'
const owner = { id: 'owner' }
const shop = 'brand-store.myshopify.com'
const token = 'test-shopify-admin-token-not-real'

const UNIQUE = { external_shopify_orders: ['order_id', 'brand_id'], external_brand_shopify: ['brand_id'] }

function mockDb(seed = {}) {
  const tables = { external_brands: [], brand_domain_claims: [], external_brand_shopify: [],
    external_shopify_orders: [], ...structuredClone(seed) }
  const calls = []
  return { tables, calls, from(table) {
    const rows = (tables[table] ||= [])
    const filters = []
    let op = 'select'
    let payload
    const match = (row) => filters.every(([k, v]) => row[k] === v)
    const q = {
      select() { return q },
      eq(k, v) { filters.push([k, v]); return q },
      insert(value) { op = 'insert'; payload = value; return q },
      update(value) { op = 'update'; payload = value; return q },
      upsert(value) { op = 'upsert'; payload = value; return q },
      delete() { op = 'delete'; return q },
      async maybeSingle() { const { data, error } = run(); return { data: Array.isArray(data) ? data[0] ?? null : data, error } },
      async single() { return q.maybeSingle() },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject) },
    }
    function run() {
      calls.push({ table, op, payload, filters: [...filters] })
      const keys = UNIQUE[table] || []
      const dup = (value) => keys.length && rows.find((row) => keys.every((k) => row[k] === value[k]))
      if (op === 'insert') {
        if (dup(payload)) return { data: null, error: { code: '23505', message: 'duplicate' } }
        rows.push({ ...payload }); return { data: null, error: null }
      }
      if (op === 'upsert') {
        const existing = dup(payload)
        if (existing) Object.assign(existing, payload); else rows.push({ ...payload })
        return { data: null, error: null }
      }
      if (op === 'update') {
        const hit = rows.filter(match); hit.forEach((row) => Object.assign(row, payload)); return { data: hit, error: null }
      }
      if (op === 'delete') {
        for (const row of rows.filter(match)) rows.splice(rows.indexOf(row), 1)
        return { data: null, error: null }
      }
      return { data: rows.filter(match).map((row) => ({ ...row })), error: null }
    }
    return q
  } }
}

function json(status, body) {
  return { status, async text() { return typeof body === 'string' ? body : JSON.stringify(body) } }
}

function shopifyFetch({ shopInfo = { myshopify_domain: shop, domain: 'brand.com' },
  scopes = ['read_orders', 'write_orders'], order = () => json(201, { order: { id: 5001, admin_graphql_api_id: 'gid://shopify/Order/5001' } }) } = {}) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init })
    if (url.endsWith('/shop.json')) return typeof shopInfo === 'function' ? shopInfo() : json(200, { shop: shopInfo })
    if (url.endsWith('/access_scopes.json')) return json(200, { access_scopes: scopes.map((handle) => ({ handle })) })
    if (url.endsWith('/orders.json')) return order(init)
    throw new Error('unexpected')
  }
  impl.calls = calls
  return impl
}

const brandSeed = {
  external_brands: [{ id: brandId, creator_id: 'owner', site_origin: 'https://brand.com' },
    { id: otherBrand, creator_id: 'other', site_origin: 'https://other.com' }],
  brand_domain_claims: [{ domain: 'brand.com', creator_id: 'owner', status: 'verified' },
    { domain: 'other.com', creator_id: 'other', status: 'verified' }],
}

test('connect validates shop, ownership, domain and scopes and stores only an encrypted token', async () => {
  const db = mockDb(brandSeed)
  const fetchImpl = shopifyFetch()
  const result = await saveShopifyConnection(db, owner, brandId, { shop: `https://${shop.toUpperCase()}/`, token }, { fetchImpl, env })
  assert.deepEqual(result, { shopifyConnected: true, shopifyShop: shop })
  assert.equal(JSON.stringify(result).includes(token), false)
  const [row] = db.tables.external_brand_shopify
  assert.equal(row.creator_id, 'owner')
  assert.equal(typeof row.encrypted_token, 'string')
  assert.equal(row.encrypted_token.includes(token), false)
  assert.equal(fetchImpl.calls[0].url, `https://${shop}/admin/api/2026-01/shop.json`)
  assert.equal(fetchImpl.calls[0].init.redirect, 'manual')
  assert.ok(fetchImpl.calls[0].init.signal)
  assert.equal(fetchImpl.calls[1].url, `https://${shop}/admin/oauth/access_scopes.json`)

  // Blank token re-validates the saved token for the same shop only.
  assert.deepEqual(await saveShopifyConnection(db, owner, brandId, { shop }, { fetchImpl, env }),
    { shopifyConnected: true, shopifyShop: shop })
  await assert.rejects(saveShopifyConnection(db, owner, brandId, { shop: 'other.myshopify.com' }, { fetchImpl, env }), { status: 400 })

  assert.deepEqual(await saveShopifyConnection(db, owner, brandId, { disconnect: true }, { fetchImpl, env }),
    { shopifyConnected: false, shopifyShop: null })
  assert.equal(db.tables.external_brand_shopify.length, 0)
})

test('connect rejects bad shops, foreign brands, unverified domains, mismatched stores and missing scopes', async () => {
  const fetchImpl = shopifyFetch()
  for (const bad of ['brand.com', 'x.myshopify.com:443', 'x.myshopify.com/admin', 'evil.com/.myshopify.com', 'a.b.myshopify.com', 7]) {
    await assert.rejects(saveShopifyConnection(mockDb(brandSeed), owner, brandId, { shop: bad, token }, { fetchImpl, env }), { status: 400 })
  }
  await assert.rejects(saveShopifyConnection(mockDb(brandSeed), owner, otherBrand, { shop, token }, { fetchImpl, env }), { status: 404 })
  await assert.rejects(saveShopifyConnection(mockDb(brandSeed), owner, 'nope', { shop, token }, { fetchImpl, env }), { status: 400 })
  await assert.rejects(saveShopifyConnection(mockDb(brandSeed), owner, otherBrand, { disconnect: true }, { fetchImpl, env }), { status: 404 })
  const unverified = mockDb({ ...brandSeed, brand_domain_claims: [{ domain: 'brand.com', creator_id: 'owner', status: 'pending' }] })
  await assert.rejects(saveShopifyConnection(unverified, owner, brandId, { shop, token }, { fetchImpl, env }), { status: 403 })
  assert.equal(fetchImpl.calls.length, 0)

  const crossDomain = shopifyFetch({ shopInfo: { myshopify_domain: shop, domain: 'evil.com', primary_domain: { host: 'www.brand.com' } } })
  await assert.rejects(saveShopifyConnection(mockDb(brandSeed), owner, brandId, { shop, token }, { fetchImpl: crossDomain, env }), { status: 403 })
  const otherShop = shopifyFetch({ shopInfo: { myshopify_domain: 'other.myshopify.com', domain: 'brand.com' } })
  await assert.rejects(saveShopifyConnection(mockDb(brandSeed), owner, brandId, { shop, token }, { fetchImpl: otherShop, env }), { status: 422 })
  const primary = shopifyFetch({ shopInfo: { myshopify_domain: shop, domain: 'x.com', primary_domain: { host: 'brand.com' } } })
  assert.equal((await saveShopifyConnection(mockDb(brandSeed), owner, brandId, { shop, token }, { fetchImpl: primary, env })).shopifyConnected, true)
  const readOnly = shopifyFetch({ scopes: ['read_orders'] })
  const db = mockDb(brandSeed)
  await assert.rejects(saveShopifyConnection(db, owner, brandId, { shop, token }, { fetchImpl: readOnly, env }), { status: 422 })
  assert.equal(db.tables.external_brand_shopify.length, 0)
  await assert.rejects(saveShopifyConnection(mockDb(brandSeed), owner, brandId, { shop, token }, { fetchImpl, env: {} }), { status: 503 })
})

test('provider errors never echo bodies or tokens', async () => {
  const leaky = shopifyFetch({ shopInfo: () => json(401, `{"errors":"bad token ${token}"}`) })
  await assert.rejects(saveShopifyConnection(mockDb(brandSeed), owner, brandId, { shop, token }, { fetchImpl: leaky, env }),
    (error) => error.status === 422 && !error.message.includes(token) && !error.message.includes('bad token'))
  const throwing = async () => { throw new Error(`connect failed ${token}`) }
  await assert.rejects(saveShopifyConnection(mockDb(brandSeed), owner, brandId, { shop, token }, { fetchImpl: throwing, env }),
    (error) => error.status === 502 && !error.message.includes(token))
  const redirect = shopifyFetch({ shopInfo: () => json(302, '') })
  await assert.rejects(saveShopifyConnection(mockDb(brandSeed), owner, brandId, { shop, token }, { fetchImpl: redirect, env }), { status: 502 })
})

function connectedSeed(extra = {}) {
  return { ...brandSeed, external_brand_shopify: [{ brand_id: brandId, creator_id: 'owner', shop,
    encrypted_token: encryptShopifyToken(token, brandId, shop, env) }], ...extra }
}

const paidOrder = {
  id: 'order_123', stripe_session_id: 'cs_1', payment_status: 'paid', currency: 'usd', created_at: '2026-11-15',
  recipient: { name: 'Ada Lovelace', address1: '1 Main', address2: '', city: 'Austin', state_code: 'TX',
    country_code: 'US', zip: '78701', email: 'ada@example.com' },
  external_shipping: [{ brandId, amount: 500 }],
  items: [
    { externalBrandId: brandId, externalVariantId: '4444', creatorId: 'owner', unitAmount: 2500, quantity: 2, title: 'Tee', size: 'M', externalShippingCents: 500 },
    { externalBrandId: brandId, externalVariantId: '5555', creatorId: 'owner', unitAmount: 1099, quantity: 1, title: 'Hat', size: '', externalShippingCents: 500 },
    { title: 'Printful item', unitAmount: 3000, quantity: 1 },
  ],
}

test('paid orders sync once per brand with trusted prices, shipping and a manual paid transaction', async () => {
  const db = mockDb(connectedSeed())
  const fetchImpl = shopifyFetch()
  const result = await syncExternalShopifyOrders(paidOrder, { db, fetchImpl, env })
  assert.deepEqual(result.results, [{ brandId, status: 'synced', shopifyOrderId: '5001' }])
  assert.equal(fetchImpl.calls.length, 1)
  const { url, init } = fetchImpl.calls[0]
  assert.equal(url, `https://${shop}/admin/api/2026-01/orders.json`)
  assert.equal(init.method, 'POST')
  assert.equal(init.headers['X-Shopify-Access-Token'], token)
  const { order } = JSON.parse(init.body)
  assert.deepEqual(order.line_items, [{ variant_id: 4444, quantity: 2, price: '25.00' }, { variant_id: 5555, quantity: 1, price: '10.99' }])
  assert.deepEqual(order.shipping_lines, [{ title: 'Shipping', code: 'thrft-flat', price: '5.00' }])
  assert.deepEqual(order.transactions, [{ kind: 'sale', status: 'success', gateway: 'manual', amount: '65.99', currency: 'USD' }])
  assert.equal(order.financial_status, 'paid')
  assert.equal(order.currency, 'USD')
  assert.equal(order.shipping_address.province_code, 'TX')
  assert.match(order.tags, /thrft-order-order_123/)
  assert.deepEqual(order.note_attributes, [{ name: 'thrft_order_id', value: 'order_123' }])
  assert.deepEqual(db.tables.external_shopify_orders, [{ order_id: 'order_123', brand_id: brandId, shop,
    status: 'synced', shopify_order_id: '5001', error: null }])

  // Webhook redelivery is suppressed by the durable claim.
  const again = await syncExternalShopifyOrders(paidOrder, { db, fetchImpl, env })
  assert.equal(again.results[0].status, 'synced')
  assert.equal(again.results[0].duplicate, true)
  assert.equal(fetchImpl.calls.length, 1)
})

test('unpaid, unconnected, and non-external orders do nothing', async () => {
  const fetchImpl = shopifyFetch()
  const db = mockDb(connectedSeed())
  assert.deepEqual((await syncExternalShopifyOrders({ ...paidOrder, payment_status: 'unpaid' }, { db, fetchImpl, env })).results, [])
  assert.deepEqual((await syncExternalShopifyOrders(paidOrder, { db: mockDb(brandSeed), fetchImpl, env })).results,
    [{ brandId, status: 'not_connected' }])
  assert.deepEqual((await syncExternalShopifyOrders({ ...paidOrder, items: [paidOrder.items[2]] }, { db, fetchImpl, env })).results, [])
  assert.equal(fetchImpl.calls.length, 0)
  assert.equal(db.tables.external_shopify_orders.length, 0)
})

test('ambiguous POST outcomes need review and are never re-sent', async () => {
  const outcomes = [
    async () => { throw new Error(`timeout ${token}`) },
    () => json(503, `oops ${token}`),
    () => json(201, { order: { id: '9007199254740993' } }),
    () => json(200, 'not json'),
    () => json(301, ''),
  ]
  for (const order of outcomes) {
    const db = mockDb(connectedSeed())
    const fetchImpl = shopifyFetch({ order })
    const [result] = (await syncExternalShopifyOrders(paidOrder, { db, fetchImpl, env })).results
    assert.equal(result.status, 'needs_review')
    assert.equal(result.error.includes(token), false)
    assert.equal(db.tables.external_shopify_orders[0].status, 'needs_review')
    await syncExternalShopifyOrders(paidOrder, { db, fetchImpl, env })
    assert.equal(fetchImpl.calls.length, 1)
  }
})

test('in-flight claims block concurrent sends', async () => {
  const db = mockDb(connectedSeed({ external_shopify_orders: [{ order_id: 'order_123', brand_id: brandId, shop,
    status: 'sending', shopify_order_id: null, error: null }] }))
  const fetchImpl = shopifyFetch()
  const [result] = (await syncExternalShopifyOrders(paidOrder, { db, fetchImpl, env })).results
  assert.equal(result.status, 'sending')
  assert.equal(fetchImpl.calls.length, 0)
})

test('explicit rejections fail cleanly and retry only against the same shop', async () => {
  const db = mockDb(connectedSeed())
  let reject = true
  const fetchImpl = shopifyFetch({ order: () => reject ? json(422, `{"errors":"${token}"}`)
    : json(201, { order: { id: 77 } }) })
  const [failed] = (await syncExternalShopifyOrders(paidOrder, { db, fetchImpl, env })).results
  assert.deepEqual(failed, { brandId, status: 'failed', error: 'Shopify rejected the order (HTTP 422)' })
  reject = false
  const [retried] = (await syncExternalShopifyOrders(paidOrder, { db, fetchImpl, env })).results
  assert.deepEqual(retried, { brandId, status: 'synced', shopifyOrderId: '77' })

  const moved = mockDb(connectedSeed({ external_shopify_orders: [{ order_id: 'order_123', brand_id: brandId,
    shop: 'old-store.myshopify.com', status: 'failed', shopify_order_id: null, error: 'x' }] }))
  const fresh = shopifyFetch()
  const [blocked] = (await syncExternalShopifyOrders(paidOrder, { db: moved, fetchImpl: fresh, env })).results
  assert.equal(blocked.status, 'failed')
  assert.equal(fresh.calls.length, 0)
})

test('unsafe IDs, owner mismatches, bad currency and unreadable tokens fail before any POST', async () => {
  const cases = [
    { ...paidOrder, items: [{ ...paidOrder.items[0], externalVariantId: '9007199254740993' }] },
    { ...paidOrder, items: [{ ...paidOrder.items[0], creatorId: 'other' }] },
    { ...paidOrder, currency: 'eur' },
    { ...paidOrder, items: [{ ...paidOrder.items[0], unitAmount: 12.5 }] },
  ]
  for (const order of cases) {
    const db = mockDb(connectedSeed())
    const fetchImpl = shopifyFetch()
    const [result] = (await syncExternalShopifyOrders(order, { db, fetchImpl, env })).results
    assert.equal(result.status, 'failed')
    assert.equal(fetchImpl.calls.length, 0)
    assert.equal(db.tables.external_shopify_orders[0].status, 'failed')
  }
  const db = mockDb(connectedSeed())
  const fetchImpl = shopifyFetch()
  const [result] = (await syncExternalShopifyOrders(paidOrder, { db, fetchImpl,
    env: { SHOPIFY_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') } })).results
  assert.equal(result.status, 'failed')
  assert.match(result.error, /reconnect/)
  assert.equal(fetchImpl.calls.length, 0)
})

test('database errors surface to the caller', async () => {
  const db = mockDb(connectedSeed())
  const from = db.from.bind(db)
  db.from = (table) => {
    const q = from(table)
    if (table !== 'external_shopify_orders') return q
    return { insert: () => ({ then: (resolve) => resolve({ error: { code: '42P01', message: 'missing table' } }) }) }
  }
  await assert.rejects(syncExternalShopifyOrders(paidOrder, { db, fetchImpl: shopifyFetch(), env }), { code: '42P01' })
})
