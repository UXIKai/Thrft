import { createClient } from '@supabase/supabase-js'

let client
export function getAdminSupabase() {
  if (client) return client
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw Object.assign(new Error('Supabase server credentials are not configured'), { status: 503 })
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

function checked({ data, error }) {
  if (error) throw error
  return data
}

export async function requireCreator(req) {
  const token = String(req.headers.authorization || '').match(/^Bearer (.+)$/i)?.[1]
  if (!token) throw Object.assign(new Error('Sign in required'), { status: 401 })
  const { data, error } = await getAdminSupabase().auth.getUser(token)
  if (error || !data.user) throw Object.assign(new Error('Invalid or expired session'), { status: 401 })
  return data.user
}

export function requireArtworkUrl(value, creatorId) {
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const prefix = `${base}/storage/v1/object/public/Thrft/`
  if (typeof value !== 'string' || !value.startsWith(`${prefix}${creatorId}/`) ||
      /[?#]/.test(value) || value.includes('..') || value.includes('%')) {
    throw Object.assign(new Error('Use artwork uploaded to your Thrft Storage folder'), { status: 400 })
  }
  return value
}

export const checkoutStore = {
  async getProduct(id) {
    const db = getAdminSupabase()
    const product = checked(await db.from('brand_products').select('*').eq('id', id).maybeSingle())
    if (product) return product
    const listing = checked(await db.from('listings').select('*').eq('id', id).maybeSingle())
    if (!listing) return null
    return { ...listing, status: listing.status === 'available' ? 'active' : listing.status,
      photo_url: listing.image_url }
  },
  async saveOrder(row) {
    return checked(await getAdminSupabase().from('creator_checkout_orders').insert(row).select().single())
  },
  async getOrder(id) {
    return checked(await getAdminSupabase().from('creator_checkout_orders')
      .select('*').eq('stripe_session_id', id).maybeSingle())
  },
  async getOrderByPrintfulId(id) {
    return checked(await getAdminSupabase().from('creator_checkout_orders')
      .select('*').eq('printful_order_id', id).maybeSingle())
  },
  async updateShipment(id, patch) {
    let query = getAdminSupabase().from('creator_checkout_orders')
      .update(patch).eq('stripe_session_id', id)
    if (patch.fulfillment_status === 'partially_shipped') query = query.neq('fulfillment_status', 'shipped')
    return checked(await query.select().maybeSingle())
  },
  async claimOrder(id) {
    const rows = checked(await getAdminSupabase().rpc('claim_creator_fulfillment', { session_id: id }))
    return rows?.[0] || null
  },
  async updateOrder(id, patch) {
    return checked(await getAdminSupabase().from('creator_checkout_orders')
      .update(patch).eq('stripe_session_id', id).select().single())
  },
}
