import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.VITE_SUPABASE_URL = 'https://thrft-test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

const { createUpsLabel, cheapestUpsRate } = await import('../server/shippo.js')

const seller = '11111111-1111-4111-8111-111111111111'
const orderId = '33333333-3333-4333-8333-333333333333'
const from = { name: 'Seller', street1: '1 Main St', city: 'Austin', state: 'tx', zip: '78701' }

function fakeDb(order) {
  const rpcCalls = []
  const query = (table) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
    data: table === 'creator_checkout_orders' ? order : null }) }) }) })
  return { rpcCalls, from: query, async rpc(name, args) {
    rpcCalls.push([name, args])
    if (name === 'reserve_market_label') return { data: true }
    if (name === 'set_market_label' && args.label) order.market_labels[args.product_key] = args.label
    return { data: null }
  } }
}

const baseOrder = () => ({ id: orderId, payment_status: 'paid', market_labels: {},
  recipient: { name: 'Buyer', address1: '2 Oak Ave', address2: '', city: 'Reno', state_code: 'NV',
    zip: '89501', country_code: 'US', email: 'b@example.test' },
  items: [{ productId: 'listing-1', source: 'market', creatorId: seller, title: 'Coat' }] })

const shippoStub = () => {
  const calls = []
  return { calls, request: async (path, body) => {
    calls.push([path, body])
    if (path === '/shipments/') return { rates: [
      { object_id: 'r1', provider: 'USPS', amount: '4.00' },
      { object_id: 'r2', provider: 'UPS', amount: '9.50', servicelevel: { token: 'ups_3_day_select', name: '3 Day' } },
      { object_id: 'r3', provider: 'UPS', amount: '11.00', servicelevel: { token: 'ups_ground', name: 'Ground' } },
    ] }
    return { status: 'SUCCESS', object_id: 'tx1', tracking_number: '1Z999',
      label_url: 'https://shippo.test/label.pdf', tracking_url_provider: 'https://ups.test/1Z999' }
  } }
}

test('seller buys a UPS Ground label and it is saved on the order', async () => {
  const order = baseOrder()
  const db = fakeDb(order)
  const shippo = shippoStub()
  const { label } = await createUpsLabel(seller, { orderId, itemIndex: 1, fromAddress: from,
    parcel: { weightLb: '2' } }, { db, request: shippo.request })
  assert.equal(shippo.calls[0][1].address_to.zip, '89501')
  assert.equal(shippo.calls[0][1].address_from.state, 'TX')
  assert.equal(shippo.calls[1][1].rate, 'r3')
  assert.equal(label.trackingNumber, '1Z999')
  assert.equal(order.market_labels['listing-1'].labelUrl, 'https://shippo.test/label.pdf')
  const again = await createUpsLabel(seller, { orderId, itemIndex: 1, fromAddress: from,
    parcel: { weightLb: 2 } }, { db, request: shippo.request })
  assert.equal(again.label.trackingNumber, '1Z999')
  assert.equal(shippo.calls.length, 2)
})

test('only the seller of a paid Market item can buy a label, domestic only', async () => {
  const shippo = shippoStub()
  await assert.rejects(createUpsLabel('someone-else', { orderId, itemIndex: 1, fromAddress: from,
    parcel: { weightLb: 1 } }, { db: fakeDb(baseOrder()), request: shippo.request }), /not found/)
  const unpaid = { ...baseOrder(), payment_status: 'unpaid' }
  await assert.rejects(createUpsLabel(seller, { orderId, itemIndex: 1, fromAddress: from,
    parcel: { weightLb: 1 } }, { db: fakeDb(unpaid), request: shippo.request }), /not found/)
  const abroad = baseOrder()
  abroad.recipient.country_code = 'CA'
  await assert.rejects(createUpsLabel(seller, { orderId, itemIndex: 1, fromAddress: from,
    parcel: { weightLb: 1 } }, { db: fakeDb(abroad), request: shippo.request }), /domestic/)
  await assert.rejects(createUpsLabel(seller, { orderId, itemIndex: 1, fromAddress: from,
    parcel: { weightLb: 0 } }, { db: fakeDb(baseOrder()), request: shippo.request }), /weight/)
  assert.equal(shippo.calls.length, 0)
})

test('a failed purchase releases the reservation', async () => {
  const db = fakeDb(baseOrder())
  const request = async () => ({ rates: [] })
  await assert.rejects(createUpsLabel(seller, { orderId, itemIndex: 1, fromAddress: from,
    parcel: { weightLb: 1 } }, { db, request }), /no service/i)
  assert.deepEqual(db.rpcCalls.at(-1), ['set_market_label', { order_id: orderId, product_key: 'listing-1', label: null }])
  assert.equal(cheapestUpsRate([{ provider: 'USPS', amount: '1', object_id: 'x' }]), null)
})
