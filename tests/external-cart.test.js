import test from 'node:test'
import assert from 'node:assert/strict'
import { addToCart, readCart, cartTotal, resizeCartItem, selectedExternalVariants } from '../cart.js'
import { mapCreatorProduct } from '../creatorProducts.js'
import { fetchOrders } from '../server/orders.js'

test('external cart persists each selected variant, totals its saved price, and repeats the last variant on quantity increases', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const storage = new Map()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value),
  } })
  try {
    const product = mapCreatorProduct({ id: 'product', title: 'Shirt', price: 20, status: 'active',
      external_brand_id: 'brand', external_currency: 'USD', external_url: 'https://brand.com/products/shirt',
      external_variants: [{ id: '10', title: 'Blue / M', size: 'M', price: 20 },
        { id: '20', title: 'Red / L', size: 'L', price: 29.99 }] })
    addToCart({ ...product, externalVariantId: '10' })
    addToCart({ ...product, externalVariantId: '20' })
    const [row] = readCart()
    assert.deepEqual(row.selectedVariantIds, ['10', '20'])
    assert.equal(cartTotal([row]), 49.99)
    const increased = resizeCartItem(row, 3)
    assert.deepEqual(increased.selectedVariantIds, ['10', '20', '20'])
    assert.equal(cartTotal([increased]), 79.98)
    assert.deepEqual(resizeCartItem(increased, 1).selectedVariantIds, ['10'])
    assert.equal(selectedExternalVariants({ ...row, externalCurrency: 'EUR' }), null)
    assert.equal(selectedExternalVariants({ ...row, selectedVariantIds: ['10'] }), null)
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  }
})

test('external Sales include manual fulfillment, payout once per brand order and Shopify failures, not credentials', async () => {
  const item = { externalBrandId: 'brand', title: 'Shirt', unitAmount: 1000, quantity: 1 }
  const base = { order_id: 'order', seller_id: 'seller', buyer_id: 'buyer', source: 'store', item }
  const tables = {
    creator_order_items: [{ ...base, item_index: 1 }, { ...base, item_index: 2 },
      { ...base, order_id: 'foreign', seller_id: 'other', buyer_id: 'other', item_index: 1 }],
    external_brand_payouts: [{ order_id: 'order', brand_id: 'brand', creator_id: 'seller', net_payout: '1712',
      platform_fee: '200', stripe_processing_fee: '88', shipping_amount: '0', status: 'owed' }],
    external_shopify_orders: [{ order_id: 'order', brand_id: 'brand', status: 'failed', error: 'Shopify rejected the order (HTTP 422)' }],
    creator_checkout_orders: [{ id: 'order', recipient: { name: 'Buyer', address1: '1 Main' }, items: ['private'] }],
  }
  const db = { from(table) {
    let rows = tables[table]
    return {
      select() { return this },
      eq(key, value) { rows = rows.filter((row) => row[key] === value); return this },
      in(key, values) { rows = rows.filter((row) => values.includes(row[key])); return this },
      order() { return this },
      range() { return this },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve) },
    }
  } }
  const sales = await fetchOrders('seller', 'sales', { db })
  assert.equal(sales.length, 2)
  assert.equal(sales[0].recipient.address1, '1 Main')
  assert.equal(sales[0].payout.net, 1712)
  assert.equal(sales[1].payout, null)
  assert.equal(sales[0].shopifySync.status, 'failed')
  assert.equal(sales[0].status, 'awaiting shipment')
  const purchases = await fetchOrders('buyer', 'purchases', { db })
  assert.equal(purchases.length, 2)
  assert.equal(purchases[0].payout, undefined)
  assert.equal(purchases[0].recipient, undefined)
})
