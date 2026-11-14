import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'

process.env.VITE_SUPABASE_URL = 'https://thrft-test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.PRINTFUL_API_TOKEN = 'test-printful-token'
process.env.STRIPE_SECRET_KEY = 'sk_test_fixture'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture'
process.env.PRINTFUL_WEBHOOK_SECRET = 'printful-test-webhook-token'
process.env.APP_ORIGIN = 'https://thrft.test'

const creatorId = '11111111-1111-4111-8111-111111111111'
const productId = '22222222-2222-4222-8222-222222222222'
const artwork = `https://thrft-test.supabase.co/storage/v1/object/public/Thrft/${creatorId}/art.png`
const address = { name: 'Test Customer', address1: '1 Test Road', address2: '',
  city: 'Test City', state_code: 'CA', country_code: 'US', zip: '90001' }
const realFetch = globalThis.fetch
let provider
globalThis.fetch = (...args) => provider(...args)
after(() => { globalThis.fetch = realFetch })

const { handleCreatorApi, mockupFiles } = await import('../server/creatorApi.js')
const { verifyStripeEvent, resolveCheckoutItems, fulfillPaidCheckout,
  getCheckoutSession } = await import('../stripeCheckout.js')
const { creatorPricing, mapCreatorProduct } = await import('../creatorProducts.js')
const { buildPersonalizedRows } = await import('../forYou.js')
const { checkoutStore } = await import('../server/supabaseStore.js')

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function request(path, { method = 'GET', body, token = 'test-user-token', signature } = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(
    typeof body === 'string' ? body : JSON.stringify(body))])
  req.url = path
  req.method = method
  req.headers = { host: 'thrft.test', ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(signature ? { 'stripe-signature': signature } : {}) }
  let status, result
  const res = {
    writeHead(code) { status = code },
    end(value) { result = JSON.parse(value) },
  }
  assert.equal(await handleCreatorApi(req, res), true)
  return { status, body: result }
}

function fixture() {
  const tables = { creator_mockup_tasks: [], brand_products: [], creator_checkout_orders: [] }
  const calls = []
  let paid = false
  let draft
  let rates = [{ id: 'STANDARD', name: 'Standard', rate: '5.00', currency: 'USD' },
    { id: 'EXPRESS', name: 'Express', rate: '12.00', currency: 'USD' }]
  provider = async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const method = options.method || 'GET'
    const body = typeof options.body === 'string' && options.body.startsWith('{')
      ? JSON.parse(options.body) : options.body
    calls.push({ url, method, body })
    if (url.origin === 'https://thrft-test.supabase.co') {
      if (url.pathname === '/auth/v1/user') {
        const userId = new Headers(options.headers).get('Authorization')?.includes('other-token')
          ? productId : creatorId
        return json({ id: userId, email: 'creator@example.test',
          user_metadata: { username: 'creator', displayName: 'Creator' } })
      }
      if (url.pathname.startsWith('/storage/v1/object/Thrft/')) return json({ Key: url.pathname })
      if (url.pathname === '/rest/v1/rpc/claim_creator_fulfillment') {
        const order = tables.creator_checkout_orders.find((row) => row.stripe_session_id === body.session_id)
        if (!order || ['draft', 'not_required', 'processing'].includes(order.fulfillment_status)) return json([])
        order.fulfillment_status = 'processing'
        return json([order])
      }
      const table = url.pathname.split('/').at(-1)
      if (tables[table]) {
        const matches = (row) => [...url.searchParams].every(([key, value]) =>
          value.startsWith('eq.') ? String(row[key]) === value.slice(3) :
            value.startsWith('neq.') ? String(row[key]) !== value.slice(4) : true)
        if (method === 'POST') {
          const row = { ...(table === 'brand_products' ? { id: productId, status: 'active',
            segment: 'store', mockup_urls: [], created_at: new Date().toISOString() } : {}),
          ...(table === 'creator_checkout_orders' ? {
            id: '33333333-3333-4333-8333-333333333333', payment_status: 'unpaid',
            fulfillment_status: 'pending',
          } : {}), ...body }
          tables[table].push(row)
          return json(row, 201)
        }
        const rows = tables[table].filter(matches)
        if (method === 'PATCH') {
          rows.forEach((row) => Object.assign(row, body))
          return json(rows[0] || null)
        }
        const headers = new Headers(options.headers)
        return json(headers.get('accept')?.includes('object') ? rows[0] || null : rows)
      }
    }
    if (url.origin === 'https://api.printful.com') {
      if (url.pathname === '/shipping/rates') return json({ result: rates })
      if (url.pathname === '/products/71') return json({ result: {
        product: { id: 71, currency: 'USD' }, variants: [
          { id: 4011, size: 'M', color: 'Black', price: '10.00', in_stock: true },
          { id: 4012, size: 'L', color: 'Black', price: '12.00', in_stock: true },
          { id: 4013, size: 'XL', color: 'White', price: '14.00', in_stock: true },
          { id: 4014, size: 'XXL', color: 'Black', price: '15.00', in_stock: false },
        ],
      } })
      if (url.pathname === '/mockup-generator/printfiles/71') return json({ result: {
        printfiles: [{ printfile_id: 1, width: 1800, height: 2400 }],
        variant_printfiles: [4011, 4012, 4013, 4014].map((variant_id) =>
          ({ variant_id, placements: { front: 1 } })),
      } })
      if (url.pathname === '/mockup-generator/create-task/71') return json({ result: { task_key: 'task-1', status: 'pending' } })
      if (url.pathname === '/mockup-generator/task') return json({ result: {
        status: 'completed', mockups: [{ mockup_url: 'https://mockups.printful.test/image.jpg' }],
      } })
      if (url.pathname.startsWith('/orders/@')) return draft ? json({ result: draft })
        : json({ error: { message: 'Order not found' } }, 404)
      if (url.pathname === '/orders/9001' && method === 'GET') return json({ result: draft })
      if (url.pathname === '/orders' && method === 'POST') {
        draft = { id: 9001, status: 'draft', external_id: body.external_id }
        return json({ result: draft })
      }
    }
    if (url.origin === 'https://mockups.printful.test') {
      return new Response(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } })
    }
    if (url.origin === 'https://api.stripe.com') {
      if (url.pathname === '/v1/customers') return json({ id: 'cus_test_1' })
      const snapshot = tables.creator_checkout_orders[0]
      const params = new URLSearchParams(body)
      let requestedAmount = 0
      for (let i = 0; params.has(`line_items[${i}][quantity]`); i++) {
        requestedAmount += Number(params.get(`line_items[${i}][quantity]`)) *
          Number(params.get(`line_items[${i}][price_data][unit_amount]`))
      }
      const amount = snapshot?.amount_total || requestedAmount
      return json({ id: 'cs_test_1', url: 'https://checkout.stripe.test/cs_test_1',
        status: paid ? 'complete' : 'open', payment_status: paid ? 'paid' : 'unpaid',
        amount_total: amount, currency: 'usd', metadata: { customerId: creatorId },
        shipping_details: { name: 'Test Customer', address: {
          line1: '1 Test Road', line2: '', city: 'Test City', state: 'CA', country: 'US', postal_code: '90001',
        } }, customer_details: { email: 'customer@example.test' } })
    }
    throw new Error(`Unexpected provider request: ${method} ${url}`)
  }
  return { tables, calls, markPaid() { paid = true }, setRates(value) { rates = value },
    markShipped(status, shipments) { Object.assign(draft, { status, shipments }) } }
}

function signedEvent(type = 'checkout.session.completed') {
  const body = JSON.stringify({ type, data: { object: { id: 'cs_test_1' } } })
  const time = Math.floor(Date.now() / 1000)
  const hash = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${time}.${body}`).digest('hex')
  return { body, signature: `t=${time},v1=${hash}` }
}

test('Store and brand feeds expose only active Supabase listings with mockups and sizes', async () => {
  const f = fixture()
  const active = { id: productId, creator_id: creatorId, brand: 'Louis Vuitton',
    title: 'Printed tee', status: 'active', price: 25,
    mockup_urls: ['https://images.test/front.jpg', 'https://images.test/back.jpg'],
    printful_variants: [{ variant_id: 4011, size: 'M' }, { variant_id: 4012, size: 'L' }] }
  f.tables.brand_products.push(active, { ...active, id: 'archived', status: 'archived' },
    { ...active, id: 'other-brand', brand: 'Independent Studio' })
  const feed = await request('/api/creator/products', { token: null })
  assert.deepEqual(feed.body.products.map((product) => product.id), [productId, 'other-brand'])
  const brand = await request('/api/creator/products?brand=Louis%20Vuitton', { token: null })
  assert.equal(brand.body.products.length, 1)
  assert.equal(brand.body.products[0].brandId, 'lv')
  assert.deepEqual(brand.body.products[0].mockupUrls, active.mockup_urls)
  assert.deepEqual(brand.body.products[0].sizes, ['M', 'L'])
})

test('Store rows preserve real listing IDs and never synthesize missing brands or empty products', () => {
  const first = mapCreatorProduct({ id: productId, brand: 'Independent Studio', price: 25 })
  const second = mapCreatorProduct({ id: 'nike-product', brand: 'Nike', price: 30 })
  const rows = buildPersonalizedRows({ catalog: [first, second], favoredBrands: ['lv', 'nike'],
    rowCount: 40, productsPerRow: 40 })
  assert.deepEqual(rows.map((row) => row.name), ['Nike', 'Independent Studio'])
  assert.ok(rows[0].products.every((product) => product.id === second.id))
  assert.ok(rows[1].products.every((product) => product.id === first.id))
  assert.deepEqual(buildPersonalizedRows({ catalog: [], favoredBrands: ['lv'] }), [])
})

test('owned artwork → mockups → published product → trusted checkout → one paid Printful draft', async () => {
  const f = fixture()
  const task = await request('/api/printful/mockups', { method: 'POST',
    body: { product_id: 71, variant_id: 4011, artwork_url: artwork } })
  assert.equal(task.status, 202)
  const createTask = f.calls.find((call) => call.url.pathname.includes('create-task'))
  assert.deepEqual(createTask.body.variant_ids, [4011])
  assert.equal(createTask.body.files[0].image_url, artwork)
  assert.equal((await request('/api/printful/mockups/task-1', { token: 'other-token' })).status, 404)
  const completed = await request('/api/printful/mockups/task-1')
  assert.equal(completed.status, 200)
  assert.match(completed.body.mockup_urls[0], /\/public\/Thrft\/.*\/mockups\//)
  const published = await request('/api/creator/products', { method: 'POST', body: {
    title: 'Creator Tee', brand: 'Test Brand', price: 25,
    mockup_task_key: 'task-1', creator_id: 'attacker', printful_variant_id: 999,
  } })
  assert.equal(published.status, 201)
  assert.equal(published.body.product.creator_id, creatorId)
  assert.equal(published.body.product.printful_variant_id, 4011)
  assert.equal(published.body.product.artwork_url, artwork)
  const feed = await request('/api/creator/products', { token: null })
  assert.equal(feed.body.products[0].photoUrl, completed.body.mockup_urls[0])
  const own = await request('/api/creator/me/products')
  assert.equal(own.body.products.length, 1)
  const brand = await request('/api/creator/accounts/creator', { token: null })
  assert.equal(brand.body.products[0].id, productId)
  const checkout = await request('/api/checkout/session', { method: 'POST', body: {
    address,
    items: [{ id: productId, qty: 2, price: 0.01, printfulVariantId: 999,
      artworkUrl: 'https://attacker.test/art.png', selectedSizes: ['M', 'M'] }],
  } })
  assert.equal(checkout.status, 200)
  const stripeCall = f.calls.find((call) => call.url.pathname === '/v1/checkout/sessions' && call.method === 'POST')
  const params = new URLSearchParams(stripeCall.body)
  assert.equal(params.get('line_items[0][price_data][unit_amount]'), '2500')
  assert.equal(params.get('line_items[0][quantity]'), '2')
  assert.equal(params.get('customer'), 'cus_test_1')
  assert.equal(params.get('shipping_address_collection[allowed_countries][0]'), null)
  assert.equal(params.get('line_items[1][price_data][unit_amount]'), '500')
  assert.equal(f.tables.creator_checkout_orders[0].amount_total, 5500)
  assert.deepEqual(f.tables.creator_checkout_orders[0].recipient, address)
  assert.equal(f.tables.creator_checkout_orders[0].shipping_rate.id, 'STANDARD')
  const unpaid = signedEvent()
  assert.equal((await request('/api/webhooks/stripe', { method: 'POST', ...unpaid, token: null })).status, 200)
  assert.equal(f.calls.filter((call) => call.url.pathname === '/orders').length, 0)
  f.markPaid()
  const paid = signedEvent('checkout.session.async_payment_succeeded')
  assert.equal((await request('/api/webhooks/stripe', { method: 'POST', ...paid, token: null })).status, 200)
  assert.equal((await request('/api/webhooks/stripe', { method: 'POST', ...paid, token: null })).status, 200)
  const orders = f.calls.filter((call) => call.url.pathname === '/orders')
  assert.equal(orders.length, 1)
  assert.equal(orders[0].url.searchParams.get('confirm'), 'false')
  assert.equal(orders[0].body.recipient.zip, '90001')
  assert.deepEqual(orders[0].body.items, [{ variant_id: 4011, quantity: 2,
    files: [{ type: 'front', url: artwork }] }])
  assert.equal(f.tables.creator_checkout_orders[0].fulfillment_status, 'draft')
  await assert.rejects(getCheckoutSession('cs_test_1', productId), /another account/)
  const status = await request('/api/checkout/session/cs_test_1')
  assert.equal(status.body.paymentStatus, 'paid')
  assert.equal(status.body.fulfillmentStatus, 'draft')
})

test('creator routes reject anonymous, foreign artwork and unknown variants', async () => {
  fixture()
  assert.equal((await request('/api/printful/mockups', { method: 'POST', token: null, body: {} })).status, 401)
  assert.equal((await request('/api/printful/mockups', { method: 'POST', body: {
    product_id: 71, variant_id: 4011, artwork_url: artwork.replace(creatorId, productId),
  } })).status, 400)
  assert.equal((await request('/api/printful/mockups', { method: 'POST', body: {
    product_id: 71, variant_id: 999, artwork_url: artwork,
  } })).status, 400)
  assert.equal((await request('/api/creator/products', { method: 'POST', body: {
    title: 'Unverified artwork', price: 25, artwork_url: artwork, printful_variant_id: 4011,
  } })).status, 400)
})

test('Stripe signatures reject tampering, missing signatures and replayed events', () => {
  const event = signedEvent()
  assert.equal(verifyStripeEvent(Buffer.from(event.body), event.signature).type, 'checkout.session.completed')
  assert.throws(() => verifyStripeEvent(Buffer.from(`${event.body} `), event.signature), /signature/)
  assert.throws(() => verifyStripeEvent(Buffer.from(event.body), ''), /signature/)
  assert.throws(() => verifyStripeEvent(Buffer.from(event.body), event.signature, 'whsec_fixture',
    Date.now() + 301000), /timestamp/)
})

test('checkout refuses invalid quantities, missing products and unavailable sizes', async () => {
  const store = { getProduct: async () => ({ id: productId, status: 'active', price: 25,
    title: 'Tee', printful_variant_id: 4011, artwork_url: artwork, size: 'M' }) }
  await assert.rejects(resolveCheckoutItems({ items: [{ id: productId, qty: 0 }] }, store), /Quantity/)
  await assert.rejects(resolveCheckoutItems({ items: [{ id: productId, qty: 1.5 }] }, store), /Quantity/)
  await assert.rejects(resolveCheckoutItems({ items: [{ id: productId, selectedSizes: ['L'] }] }, store), /available size/)
  await assert.rejects(resolveCheckoutItems({ items: [{ id: productId }] },
    { getProduct: async () => null }), /no longer available/)
})

test('failed fulfillment is retryable and recovers a previously created draft', async () => {
  const row = { id: productId, amount_total: 2500, currency: 'usd',
    creator_customer_id: creatorId, fulfillment_status: 'pending',
    items: [{ printfulVariantId: 4011, artworkUrl: artwork, quantity: 1, placement: 'front' }] }
  const session = { id: 'cs_retry', payment_status: 'paid', amount_total: 2500,
    currency: 'usd', metadata: { customerId: creatorId } }
  let remoteDraft
  let submissions = 0
  let failSave = true
  const store = {
    getOrder: async () => row,
    claimOrder: async () => ({ ...row }),
    updateOrder: async (_, patch) => {
      if (patch.fulfillment_status === 'draft' && failSave) {
        failSave = false
        throw new Error('Database temporarily unavailable')
      }
      Object.assign(row, patch)
      return row
    },
  }
  const printful = {
    getOrder: async () => {
      if (!remoteDraft) throw Object.assign(new Error('Not found'), { status: 404 })
      return remoteDraft
    },
    createOrder: async () => { submissions++; remoteDraft = { id: 123 }; return remoteDraft },
  }
  session.shipping_details = { name: 'Test', address: {
    line1: '1 Test', city: 'City', country: 'US', postal_code: '90001',
  } }
  await assert.rejects(fulfillPaidCheckout(session, { store, printful }), /Database temporarily/)
  assert.equal(row.fulfillment_status, 'failed')
  await fulfillPaidCheckout(session, { store, printful })
  assert.equal(row.fulfillment_status, 'draft')
  assert.equal(submissions, 1)
})

test('unpaid, mismatched, or concurrently processing checkouts never submit', async () => {
  let claimed = 0
  const store = { getOrder: async () => ({ amount_total: 2500, currency: 'usd',
    creator_customer_id: creatorId }), claimOrder: async () => { claimed++; return null } }
  const session = { id: 'cs_locked', payment_status: 'unpaid', amount_total: 2500,
    currency: 'usd', metadata: { customerId: creatorId } }
  await fulfillPaidCheckout(session, { store })
  assert.equal(claimed, 0)
  session.payment_status = 'paid'
  session.amount_total = 1
  await assert.rejects(fulfillPaidCheckout(session, { store }), /does not match/)
  assert.equal(claimed, 0)
  session.amount_total = 2500
  await assert.rejects(fulfillPaidCheckout(session, { store }), /already processing/)
})

test('mockups reject print placements not present on the selected variant', () => {
  assert.throws(() => mockupFiles({ printfiles: [], variant_printfiles: [] }, 4011,
    'front', artwork), /does not support/)
})

test('mockup artwork preserves aspect ratio and centers within the blank print area', () => {
  const [file] = mockupFiles({
    printfiles: [{ printfile_id: 1, width: 1800, height: 2400 }],
    variant_printfiles: [{ variant_id: 4011, placements: { front: 1 } }],
  }, 4011, 'front', artwork, { width: 1000, height: 1000 })
  assert.deepEqual(file.position, { area_width: 1800, area_height: 2400,
    width: 1800, height: 1800, left: 0, top: 300 })
})

test('mixed carts send only printable items to Printful; ordinary carts need no draft', async () => {
  const row = { id: productId, amount_total: 3500, currency: 'usd',
    creator_customer_id: creatorId, fulfillment_status: 'pending',
    items: [
      { printfulVariantId: 4011, artworkUrl: artwork, quantity: 1, placement: 'front' },
      { printfulVariantId: null, artworkUrl: null, quantity: 1 },
    ] }
  const session = { id: 'cs_mixed', payment_status: 'paid', amount_total: 3500,
    currency: 'usd', metadata: { customerId: creatorId }, shipping_details: {
      name: 'Test', address: { line1: '1 Test', city: 'City', country: 'US', postal_code: '90001' },
    } }
  const store = {
    getOrder: async () => row, claimOrder: async () => row,
    updateOrder: async (_, patch) => Object.assign(row, patch),
  }
  let submitted
  const printful = {
    getOrder: async () => { throw Object.assign(new Error('Not found'), { status: 404 }) },
    createOrder: async (order) => { submitted = order; return { id: 123 } },
  }
  await fulfillPaidCheckout(session, { store, printful })
  assert.equal(submitted.items.length, 1)
  row.items = [row.items[1]]
  row.fulfillment_status = 'pending'
  submitted = null
  await fulfillPaidCheckout(session, { store, printful })
  assert.equal(row.fulfillment_status, 'not_required')
  assert.equal(submitted, null)
})

test('one multi-size listing routes each buyer size to its trusted Printful variant', async () => {
  const f = fixture()
  const task = await request('/api/printful/mockups', { method: 'POST', body: {
    product_id: 71, variant_ids: [4011, 4012], artwork_url: artwork,
  } })
  assert.equal(task.status, 202)
  assert.deepEqual(f.calls.find((call) => call.url.pathname.includes('create-task')).body.variant_ids, [4011, 4012])
  await request('/api/printful/mockups/task-1')
  const published = await request('/api/creator/products', { method: 'POST', body: {
    title: 'Multi-size Tee', brand: 'Creator', price: 25, mockup_task_key: 'task-1',
  } })
  assert.equal(published.status, 201)
  assert.equal(f.tables.brand_products.length, 1)
  assert.deepEqual(published.body.product.sizes, ['M', 'L'])
  assert.equal(published.body.product.size, '')
  assert.deepEqual(published.body.product.printfulVariants.map((variant) => variant.base_price), [10, 12])
  const checkout = await request('/api/checkout/session', { method: 'POST', body: {
    address,
    items: [{ id: productId, qty: 3, selectedSizes: ['M', 'L', 'M'], printfulVariantId: 999 }],
  } })
  assert.equal(checkout.status, 200)
  assert.deepEqual(f.tables.creator_checkout_orders[0].items.map((item) =>
    [item.printfulVariantId, item.quantity]), [[4011, 2], [4012, 1]])
  assert.equal(f.tables.creator_checkout_orders[0].amount_total, 8000)
  f.markPaid()
  assert.equal((await request('/api/webhooks/stripe', {
    method: 'POST', ...signedEvent(), token: null,
  })).status, 200)
  const draft = f.calls.find((call) => call.url.pathname === '/orders')
  assert.deepEqual(draft.body.items.map((item) => [item.variant_id, item.quantity]), [[4011, 2], [4012, 1]])
  assert.equal(draft.body.shipping, 'STANDARD')
  assert.deepEqual(f.calls.find((call) => call.url.pathname === '/shipping/rates').body.items,
    [{ variant_id: 4011, quantity: 2 }, { variant_id: 4012, quantity: 1 }])
})

test('shipping quotes use trusted variants, selected rates, and include shipping in the paid snapshot', async () => {
  const f = fixture()
  f.tables.brand_products.push({ id: productId, status: 'active', title: 'Tee', price: 25,
    printful_variant_id: 4011, artwork_url: artwork, size: 'M' })
  const items = [{ id: productId, qty: 2, size: 'M', printfulVariantId: 999 }]
  const estimate = await request('/api/checkout/estimate', { method: 'POST', body: { items, address } })
  assert.equal(estimate.status, 200)
  assert.equal(estimate.body.subtotal, 5000)
  assert.deepEqual(estimate.body.shippingRates.map((rate) => rate.amount), [500, 1200])
  const rateCall = f.calls.find((call) => call.url.pathname === '/shipping/rates')
  assert.deepEqual(rateCall.body, { recipient: address, currency: 'USD',
    items: [{ variant_id: 4011, quantity: 2 }] })
  const checkout = await request('/api/checkout/session', { method: 'POST',
    body: { items, address, shippingRateId: 'EXPRESS', shippingAmount: 1200 } })
  assert.equal(checkout.status, 200)
  assert.equal(f.tables.creator_checkout_orders[0].amount_total, 6200)
  assert.equal(f.tables.creator_checkout_orders[0].shipping_rate.id, 'EXPRESS')
  f.markPaid()
  await request('/api/webhooks/stripe', { method: 'POST', ...signedEvent(), token: null })
  assert.equal(f.calls.find((call) => call.url.pathname === '/orders').body.shipping, 'EXPRESS')
})

test('invalid addresses, unavailable or changed rates never create a Stripe session', async () => {
  const f = fixture()
  f.tables.brand_products.push({ id: productId, status: 'active', title: 'Tee', price: 25,
    printful_variant_id: 4011, artwork_url: artwork, size: 'M' })
  const body = { items: [{ id: productId, qty: 1, size: 'M' }], address }
  for (const patch of [{ address: 'not structured' }, { address: { ...address, state_code: '' } },
    { shippingRateId: 'fake' }, { shippingRateId: 'STANDARD', shippingAmount: 1 }]) {
    const result = await request('/api/checkout/session', { method: 'POST', body: { ...body, ...patch } })
    assert.ok([400, 409].includes(result.status))
  }
  f.setRates([])
  assert.equal((await request('/api/checkout/session', { method: 'POST', body })).status, 409)
  f.setRates([{ id: 'STANDARD', name: 'Standard', rate: '5', currency: 'EUR' }])
  assert.equal((await request('/api/checkout/session', { method: 'POST', body })).status, 502)
  assert.equal(f.calls.filter((call) => call.url.origin === 'https://api.stripe.com').length, 0)
})

test('ordinary checkout does not quote or charge Printful shipping', async () => {
  const f = fixture()
  f.tables.brand_products.push({ id: productId, status: 'active', title: 'Vintage Tee', price: 25 })
  const checkout = await request('/api/checkout/session', { method: 'POST',
    body: { items: [{ id: productId, qty: 1 }] } })
  assert.equal(checkout.status, 200)
  assert.equal(f.calls.filter((call) => call.url.pathname === '/shipping/rates').length, 0)
  assert.equal(f.tables.creator_checkout_orders[0].amount_total, 2500)
})

test('authenticated Printful shipment events persist provider tracking and never resubmit fulfillment', async () => {
  const f = fixture()
  f.tables.brand_products.push({ id: productId, status: 'active', title: 'Tee', price: 25,
    printful_variant_id: 4011, artwork_url: artwork, size: 'M' })
  await request('/api/checkout/session', { method: 'POST',
    body: { items: [{ id: productId, qty: 1 }], address } })
  f.markPaid()
  await request('/api/webhooks/stripe', { method: 'POST', ...signedEvent(), token: null })
  const body = { type: 'package_shipped', data: { order: { id: 9001 },
    shipment: { id: 1, tracking_number: 'forged-tracking' } } }
  const endpoint = '/api/webhooks/printful?token=printful-test-webhook-token'
  assert.equal((await request('/api/webhooks/printful', { method: 'POST', body, token: null })).status, 401)
  assert.equal((await request(endpoint, { method: 'POST', body, token: null })).status, 409)
  const shipment = { id: 1, tracking_number: 'TRACK-1', tracking_url: 'https://carrier.test/TRACK-1' }
  f.markShipped('partial', [shipment])
  assert.equal((await request(endpoint, { method: 'POST', body, token: null })).status, 200)
  const saved = f.tables.creator_checkout_orders[0]
  assert.equal(saved.fulfillment_status, 'partially_shipped')
  assert.equal(saved.tracking_number, 'TRACK-1')
  f.markShipped('fulfilled', [shipment, { id: 2, tracking_number: 'TRACK-2' }])
  for (let i = 0; i < 2; i++) {
    assert.equal((await request(endpoint, { method: 'POST', body, token: null })).status, 200)
  }
  assert.equal(saved.fulfillment_status, 'shipped')
  assert.equal(saved.shipments.length, 2)
  await checkoutStore.updateShipment(saved.stripe_session_id, {
    fulfillment_status: 'partially_shipped', shipments: [],
  })
  assert.equal(saved.fulfillment_status, 'shipped')
  assert.equal(saved.shipments.length, 2)
  f.markShipped('partial', [shipment])
  await request(endpoint, { method: 'POST', body, token: null })
  assert.equal(saved.shipments.length, 2)
  const status = await request('/api/checkout/session/cs_test_1')
  assert.equal(status.body.fulfillmentStatus, 'shipped')
  assert.equal(status.body.trackingNumber, 'TRACK-1')
  assert.equal(f.calls.filter((call) => call.url.pathname === '/orders').length, 1)
})

test('multi-size mockups reject mixed colors and out-of-stock sizes', async () => {
  fixture()
  for (const ids of [[4011, 4013], [4011, 4014], [], [4011, 4011]]) {
    const result = await request('/api/printful/mockups', { method: 'POST', body: {
      product_id: 71, variant_ids: ids, artwork_url: artwork,
    } })
    assert.equal(result.status, 400)
  }
})

test('multi-size checkout requires one supported size per quantity', async () => {
  const product = { id: productId, title: 'Tee', status: 'active', price: 25, artwork_url: artwork,
    printful_variants: [{ size: 'S', variant_id: 1 }, { size: 'M', variant_id: 2 }] }
  const store = { getProduct: async () => product }
  for (const item of [
    { qty: 2, selectedSizes: ['S'] }, { qty: 1, selectedSizes: [''] },
    { qty: 1, selectedSizes: ['XL'] }, { qty: 1 },
  ]) {
    await assert.rejects(resolveCheckoutItems({ items: [{ id: productId, ...item }] }, store), /size/)
  }
  assert.deepEqual(mapCreatorProduct({ ...product, printful_variant_id: 1, size: 'S' }).sizes, ['S', 'M'])
})

test('pricing shows size-dependent cost and gross-margin ranges, including losses', () => {
  const variants = [{ base_price: 10.99, currency: 'USD' }, { base_price: 14.49, currency: 'USD' }]
  assert.deepEqual(creatorPricing(variants, '25'), {
    baseMin: 10.99, baseMax: 14.49, marginMin: 10.51, marginMax: 14.01,
  })
  assert.equal(creatorPricing(variants, '9.99').marginMin, -4.5)
  assert.equal(creatorPricing(variants, '').marginMin, null)
  assert.equal(creatorPricing([{ base_price: null, currency: 'USD' }], '25'), null)
  assert.equal(creatorPricing([{ base_price: 10, currency: 'EUR' }], '25'), null)
})
