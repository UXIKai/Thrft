import test, { after } from 'node:test'
import assert from 'node:assert/strict'

process.env.STRIPE_SECRET_KEY = 'sk_test_external'
process.env.PRINTFUL_API_TOKEN = 'test_printful_external'
const { resolveCheckoutItems, createCheckoutSession, estimateCheckout, fulfillPaidCheckout } = await import('../stripeCheckout.js')
const { fetchLiveCatalog } = await import('../server/externalCheckout.js')
const realFetch = globalThis.fetch
after(() => { globalThis.fetch = realFetch })

const id = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'
const address = { name: 'Buyer', address1: '1 Main St', city: 'Town', state_code: 'CA', country_code: 'US', zip: '90210' }
const product = { id, status: 'active', creator_id: 'seller', title: 'Shirt', price: 1,
  external_brand_id: 'brand', external_currency: 'USD', external_url: 'https://brand.com/products/shirt',
  external_variants: [{ id: '10', title: 'Blue M', size: 'M', price: 25.99 },
    { id: '20', title: 'Red L', size: 'L', price: 30 }] }

function fixture() {
  const state = { product: structuredClone(product), brand: { id: 'brand', name: 'Brand',
    site_origin: 'https://brand.com', flat_shipping_cents: 500 },
  live: [{ handle: 'shirt', variants: [{ id: 10, available: true, price: '999.00' },
    { id: '20', available: true }] }], fetches: 0 }
  const store = {
    async getProduct(productId) { return { ...state.product, id: productId } },
    async getExternalBrand() { return state.brand },
    async getLiveExternalCatalog() { state.fetches++; return state.live },
    async saveOrder(order) { state.order = order; return order },
  }
  return { state, store }
}
const item = (extra = {}) => ({ id, qty: 2, selectedVariantIds: ['10', '20'], ...extra })

test('external checkout resolves trusted saved variant prices and checks inventory once per brand', async () => {
  const { state, store } = fixture()
  const items = await resolveCheckoutItems({ items: [item(), item({ id: secondId })] }, store)
  assert.deepEqual(items.map((entry) => entry.unitAmount), [2599, 3000, 2599, 3000])
  assert.deepEqual(items.map((entry) => entry.externalVariantId), ['10', '20', '10', '20'])
  assert.equal(state.fetches, 1)
  assert.equal(items[0].creatorId, 'seller')
})

test('external checkout rejects missing, sold-out, unknown, non-USD and unverified variants', async () => {
  for (const change of [
    ({ state }) => { state.live[0].variants[0].available = false },
    ({ state }) => { delete state.live[0].variants[0].available },
    ({ state }) => { state.live[0].variants = [] },
    ({ state }) => { state.live = [] },
    ({ state }) => { state.product.external_currency = 'EUR' },
    ({ state }) => { state.product.external_variants[0].price = 0 },
    ({ state }) => { state.brand = null },
    ({ state }) => { state.brand.site_origin = 'https://foreign.com' },
  ]) {
    const f = fixture()
    change(f)
    await assert.rejects(resolveCheckoutItems({ items: [item()] }, f.store), { status: 409 })
  }
  const { store } = fixture()
  await assert.rejects(resolveCheckoutItems({ items: [item({ selectedVariantIds: ['10'] })] }, store), /every external/)
  await assert.rejects(resolveCheckoutItems({ items: [item({ selectedVariantIds: ['10', '999'] })] }, store), /unavailable/)
})

test('flat shipping is charged once per external brand and free shipping remains an explicit quote', async () => {
  const { state, store } = fixture()
  let quote = await estimateCheckout({ items: [item(), item({ id: secondId })], address }, { store })
  assert.equal(quote.subtotal, 11198)
  assert.equal(quote.shippingRates[0].amount, 500)
  state.brand.flat_shipping_cents = 0
  quote = await estimateCheckout({ items: [item()], address }, { store })
  assert.equal(quote.shippingRates[0].amount, 0)
  await assert.rejects(estimateCheckout({ items: [item()] }, { store }), /shipping address/)
})

test('mixed carts add brand shipping to live Printful rates without changing the fulfillment service ID', async () => {
  const { store } = fixture()
  const getProduct = store.getProduct
  store.getProduct = async (productId) => productId === id ? getProduct(productId) : ({
    id: secondId, title: 'Print', status: 'active', price: 20, creator_id: 'printer',
    artwork_url: 'https://storage.example/art.png',
    printful_variants: [{ variant_id: 123, size: 'M', currency: 'USD', base_price: 10 }],
  })
  globalThis.fetch = async (url) => {
    assert.equal(String(url), 'https://api.printful.com/shipping/rates')
    return Response.json({ result: [{ id: 'STANDARD', name: 'Standard', rate: '7.00', currency: 'USD' }] })
  }
  const quote = await estimateCheckout({ address, items: [item(), { id: secondId, qty: 1, selectedSizes: ['M'] }] }, { store })
  assert.equal(quote.subtotal, 7599)
  assert.equal(quote.shippingRates[0].amount, 1200)
  assert.equal(quote.shippingRates[0].id, 'STANDARD')
})

test('Stripe receives saved prices, combined total and one shipping line, with immutable shipping snapshot', async () => {
  const { state, store } = fixture()
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url, params: new URLSearchParams(options.body) })
    return Response.json(url.endsWith('/customers') ? { id: 'cus_external' } : { id: 'cs_external', url: 'https://checkout.stripe.test', status: 'open' })
  }
  await createCheckoutSession({ items: [item()], address, shippingAmount: 500 }, { accountKey: 'buyer', store })
  assert.equal(state.order.amount_total, 6099)
  assert.deepEqual(state.order.external_shipping, [{ brandId: 'brand', amount: 500, name: 'Brand' }])
  const params = requests[1].params
  assert.equal(params.get('line_items[0][price_data][unit_amount]'), '2599')
  assert.equal(params.get('line_items[2][price_data][unit_amount]'), '500')
  state.brand.flat_shipping_cents = 600
  await assert.rejects(createCheckoutSession({ items: [item()], address, shippingAmount: 500 },
    { accountKey: 'buyer', store }), /Shipping price changed/)
  assert.equal(requests.length, 2)
})

test('paid external snapshots are recorded before optional sync, including terminal replay; mismatches never sync', async () => {
  const { store } = fixture()
  const items = await resolveCheckoutItems({ items: [item()] }, store)
  let saved = { id: secondId, items, creator_customer_id: 'buyer', amount_total: 6099,
    currency: 'usd', recipient: address, fulfillment_status: 'not_required' }
  const updates = []
  store.getOrder = async () => saved
  store.updateOrder = async (_id, patch) => { updates.push(patch); saved = { ...saved, ...patch }; return saved }
  const session = { id: 'cs', payment_status: 'paid', amount_total: 6099, currency: 'usd', metadata: { customerId: 'buyer' } }
  let syncs = 0
  const shopifySync = async (order) => { assert.equal(order.payment_status, 'paid'); syncs++ }
  await fulfillPaidCheckout({ ...session, payment_status: 'unpaid' }, { store, shopifySync })
  await assert.rejects(fulfillPaidCheckout({ ...session, amount_total: 1 }, { store, shopifySync }), /does not match/)
  assert.equal(syncs, 0)
  await fulfillPaidCheckout(session, { store, shopifySync })
  await fulfillPaidCheckout(session, { store, shopifySync })
  assert.equal(syncs, 2)
  assert.equal(updates.length, 2)
  await fulfillPaidCheckout(session, { store, shopifySync: async () => { throw new Error('Shopify is down') } })
})

test('external fulfillment uses the saved quoted recipient without requiring Stripe to recollect delivery', async () => {
  const { store } = fixture()
  const items = await resolveCheckoutItems({ items: [item()] }, store)
  let order = { id: secondId, items, creator_customer_id: 'buyer', amount_total: 6099,
    currency: 'usd', recipient: address, fulfillment_status: 'pending' }
  store.getOrder = async () => order
  store.claimOrder = async () => ({ ...order, fulfillment_status: 'processing' })
  store.updateOrder = async (_id, patch) => { order = { ...order, ...patch }; return order }
  const result = await fulfillPaidCheckout({ id: 'cs', payment_status: 'paid', amount_total: 6099,
    currency: 'usd', metadata: { customerId: 'buyer' } }, { store, shopifySync: async () => {} })
  assert.equal(result.fulfillment_status, 'not_required')
  assert.equal(result.recipient.address1, address.address1)
})

test('live products.json retrieval uses verified host, paginates, and fails closed on malformed inventory', async () => {
  const calls = []
  const get = async (url, options) => {
    calls.push({ url, options })
    const page = new URL(url).searchParams.get('page')
    return { status: 200, url, body: Buffer.from(JSON.stringify({
      products: page === '1' ? Array.from({ length: 250 }, () => ({ handle: 'first' })) : [{ handle: 'last' }],
    })) }
  }
  const products = await fetchLiveCatalog('https://brand.com', get)
  assert.equal(products.length, 251)
  assert.equal(calls[0].options.allowedHostname, 'brand.com')
  assert.match(calls[1].url, /page=2/)
  await assert.rejects(fetchLiveCatalog('https://brand.com', async (url) => ({ status: 200, url, body: Buffer.from('bad') })), /invalid/)
  await assert.rejects(fetchLiveCatalog('https://brand.com', async (url) => ({ status: 503, url })), /Could not verify/)
})
