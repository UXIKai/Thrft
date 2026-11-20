import { getAdminSupabase } from './supabaseStore.js'
import { getOrder } from '../printful.js'

const httpsOrNull = (value) => (/^https:\/\//i.test(value || '') ? value : null)

function marketLabelFields(row, item) {
  const label = row.market_labels?.[String(item.productId)]
  return {
    labelOrderId: row.order_id, labelItemIndex: row.item_index,
    upsLabel: label?.labelUrl ? {
      trackingNumber: label.trackingNumber, labelUrl: httpsOrNull(label.labelUrl),
      trackingUrl: httpsOrNull(label.trackingUrl), service: label.service || '',
    } : null,
  }
}

export async function fetchOrders(userId, kind, { db = getAdminSupabase(), fetchPrintful = getOrder } = {}) {
  if (!['purchases', 'sales'].includes(kind)) {
    throw Object.assign(new Error('Choose purchases or sales'), { status: 400 })
  }
  const rows = []
  const pageSize = 200
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from('creator_order_items').select('*')
      .eq(kind === 'purchases' ? 'buyer_id' : 'seller_id', userId)
      .order('created_at', { ascending: false }).order('order_id').order('item_index')
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < pageSize) break
  }
  const printfulIds = [...new Set(rows.filter((row) => row.source === 'store' && row.printful_order_id)
    .map((row) => row.printful_order_id))]
  const statuses = new Map(await Promise.all(printfulIds.map(async (id) => {
    try {
      const order = await fetchPrintful(id)
      if (String(order.id) !== String(id) || typeof order.status !== 'string') throw new Error('Invalid Printful order')
      return [id, order.status]
    } catch (error) {
      console.error('[orders] Could not refresh Printful status:', error.message)
      return [id, null]
    }
  })))
  const externalIds = [...new Set(rows.filter((row) => row.item.externalBrandId).map((row) => row.order_id))]
  const payouts = new Map()
  const syncs = new Map()
  const recipients = new Map()
  if (kind === 'sales' && externalIds.length) {
    const results = await Promise.all([
      db.from('external_brand_payouts').select('*').eq('creator_id', userId).in('order_id', externalIds),
      db.from('external_shopify_orders').select('order_id,brand_id,status,error').in('order_id', externalIds),
      db.from('creator_checkout_orders').select('id,recipient').in('id', externalIds),
    ])
    for (const result of results) if (result.error) throw result.error
    for (const row of results[0].data) payouts.set(`${row.order_id}:${row.brand_id}`, row)
    for (const row of results[1].data) syncs.set(`${row.order_id}:${row.brand_id}`, row)
    for (const row of results[2].data) recipients.set(row.id, row.recipient)
  }
  const shownPayouts = new Set()
  return rows.map((row) => {
    const item = row.item
    const key = `${row.order_id}:${item.externalBrandId}`
    const payout = payouts.get(key)
    const showPayout = payout && !shownPayouts.has(key)
    if (showPayout) shownPayouts.add(key)
    const sync = syncs.get(key)
    const printable = row.source === 'store' && item.printfulVariantId
    const tracking = printable ? (row.shipments?.length ? row.shipments : [{
      tracking_number: row.tracking_number, tracking_url: row.tracking_url,
    }]).filter((shipment) => shipment.tracking_number).map((shipment) => ({
      number: shipment.tracking_number,
      url: /^https:\/\//i.test(shipment.tracking_url || '') ? shipment.tracking_url : null,
      carrier: shipment.carrier || '',
    })) : []
    return {
      id: `${row.order_id}:${row.item_index}`, createdAt: row.created_at, source: row.source,
      title: item.title, photoUrl: item.photoUrl, size: item.size, quantity: item.quantity,
      unitAmount: item.unitAmount,
      status: printable ? (row.printful_order_id ? statuses.get(row.printful_order_id) || 'status unavailable'
        : row.fulfillment_status) : 'awaiting shipment',
      tracking,
      margin: kind === 'sales' && printable && Number.isInteger(item.baseAmount)
        ? (item.unitAmount - item.baseAmount) * item.quantity : null,
      ...(kind === 'sales' && row.source === 'market' ? marketLabelFields(row, item) : {}),
      ...(kind === 'sales' && item.externalBrandId ? {
        externalOrderId: row.order_id,
        recipient: recipients.get(row.order_id),
        payout: showPayout ? { net: Number(payout.net_payout), status: payout.status,
          shipping: Number(payout.shipping_amount), platformFee: Number(payout.platform_fee),
          processingFee: Number(payout.stripe_processing_fee) } : null,
        shopifySync: sync ? { status: sync.status, error: sync.error } : null,
      } : {}),
    }
  })
}
