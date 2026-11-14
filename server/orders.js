import { getAdminSupabase } from './supabaseStore.js'
import { getOrder } from '../printful.js'

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
  return rows.map((row) => {
    const item = row.item
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
    }
  })
}
