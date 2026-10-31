/**
 * Supabase-backed marketplace listings (no mock product arrays).
 */
import { clothingTypeById } from './clothingTypes.js'
import { getSupabase, isSupabaseConfigured } from './supabase.js'

const PLACEHOLDER_IMAGE = 'placeholder'

/**
 * Map home clothing-type chips → listing category labels.
 * Exact types match Create categories; legacy long labels still resolve.
 */
export const TYPE_TO_CATEGORIES = {
  all: null,
  tops: ['Tees', 'Shirts', 'Polos', 'Tanks', 'Hoodies', 'Sweaters'],
  bottoms: ['Pants', 'Jeans', 'Shorts', 'Skirts'],
  outerwear: ['Jackets', 'Coats', 'Blazers'],
  dresses: ['Dresses', 'Rompers'],
  shoes: ['Shoes', 'Sneakers', 'Boots'],
  bags: ['Bags'],
  accessories: ['Hats', 'Belts', 'Jewelry', 'Accessories'],
  activewear: ['Active', 'Tees', 'Shorts', 'Hoodies', 'Tanks'],
  denim: ['Jeans', 'Pants', 'Shorts', 'Jackets'],
  knitwear: ['Sweaters', 'Hoodies'],
  vintage: null,
  tees: ['Tees', 'T-Shirts'],
  't-shirts': ['Tees', 'T-Shirts'],
  shirts: ['Shirts', 'Shirts & Button-Downs'],
  'shirts-and-button-downs': ['Shirts', 'Shirts & Button-Downs'],
  polos: ['Polos'],
  tanks: ['Tanks', 'Tank Tops'],
  'tank-tops': ['Tanks', 'Tank Tops'],
  hoodies: ['Hoodies'],
  sweaters: ['Sweaters'],
  jackets: ['Jackets'],
  coats: ['Coats'],
  blazers: ['Blazers'],
  pants: ['Pants'],
  jeans: ['Jeans'],
  shorts: ['Shorts'],
  skirts: ['Skirts'],
  rompers: ['Rompers', 'Jumpsuits'],
  jumpsuits: ['Rompers', 'Jumpsuits'],
  sneakers: ['Sneakers'],
  boots: ['Boots'],
  hats: ['Hats'],
  belts: ['Belts', 'Accessories'],
  jewelry: ['Jewelry'],
  active: ['Active', 'Activewear'],
  swim: ['Swim', 'Swimwear'],
  swimwear: ['Swim', 'Swimwear'],
  lounge: ['Lounge', 'Loungewear'],
  loungewear: ['Lounge', 'Loungewear'],
}

function slugBrand(brand) {
  return String(brand || 'other')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'other'
}

function toneFromId(id) {
  const s = String(id || '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return String((h % 6) + 1)
}

function makeCode(row) {
  const brand = String(row.brand || row.title || 'XX')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase()
  const tail = String(row.id || '')
    .replace(/-/g, '')
    .slice(0, 2)
    .toUpperCase()
  return `${brand || 'XX'}${tail || '00'}`
}

export function formatListingPrice(price) {
  const n =
    typeof price === 'number'
      ? price
      : Number.parseFloat(String(price || '').replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n)) return '$0.00'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
    }).format(n)
  } catch {
    return `$${n.toFixed(2)}`
  }
}

export function parseListingPrice(price) {
  if (typeof price === 'number' && Number.isFinite(price)) return Math.max(0, price)
  const n = Number.parseFloat(String(price || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

/** Normalize a DB row into the shape used by ProductRows / bag / detail. */
export function mapListing(row) {
  if (!row) return null
  const brand = row.brand || ''
  return {
    id: row.id,
    title: row.title || 'Listing',
    brand,
    brandName: brand || 'Brand',
    brandId: slugBrand(brand),
    category: row.category || '',
    clothingType: row.category || '',
    price: formatListingPrice(row.price),
    priceRaw: parseListingPrice(row.price),
    condition: row.condition || '',
    description: row.description || '',
    photoUrl: row.image_url || PLACEHOLDER_IMAGE,
    image_url: row.image_url || PLACEHOLDER_IMAGE,
    status: row.status || 'available',
    sellerId: row.seller_id,
    code: makeCode(row),
    tone: toneFromId(row.id),
    createdAt: row.created_at,
  }
}

async function requireClient() {
  if (!isSupabaseConfigured()) {
    const err = new Error('Supabase is not configured')
    err.code = 'supabase_unconfigured'
    throw err
  }
  const supabase = getSupabase()
  if (!supabase) {
    const err = new Error('Supabase is not configured')
    err.code = 'supabase_unconfigured'
    throw err
  }
  return supabase
}

export async function getAuthUserId() {
  const supabase = await requireClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) {
    const err = new Error('Sign in required')
    err.code = 'unauthorized'
    throw err
  }
  return data.user.id
}

/**
 * Insert a listing for the current auth user.
 * status defaults to `available`; image_url is a placeholder until uploads land.
 */
export async function createListing({
  title,
  brand = '',
  category = '',
  price = '',
  condition = '',
  description = '',
  imageUrl = PLACEHOLDER_IMAGE,
} = {}) {
  const supabase = await requireClient()
  const sellerId = await getAuthUserId()
  const cleanTitle = String(title || '').trim()
  if (!cleanTitle) {
    const err = new Error('Add a title before posting.')
    err.code = 'validation'
    throw err
  }

  const payload = {
    seller_id: sellerId,
    title: cleanTitle.slice(0, 120),
    brand: String(brand || '').trim().slice(0, 80),
    category: String(category || '').trim().slice(0, 80),
    price: parseListingPrice(price),
    condition: String(condition || '').trim().slice(0, 40),
    description: String(description || '').trim().slice(0, 2000),
    image_url: String(imageUrl || PLACEHOLDER_IMAGE).slice(0, 2000),
    status: 'available',
  }

  const { data, error } = await supabase
    .from('listings')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    const err = new Error(error.message || 'Could not post listing')
    err.code = error.code || 'insert_failed'
    err.details = error
    throw err
  }
  return mapListing(data)
}

/** Fetch available listings, newest first. */
export async function fetchAvailableListings({ limit = 120 } = {}) {
  const supabase = await requireClient()
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'available')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    const err = new Error(error.message || 'Could not load listings')
    err.code = error.code || 'fetch_failed'
    throw err
  }
  return (data || []).map(mapListing)
}

/**
 * Available listings for one brand (by slug id and/or display name).
 */
export async function fetchListingsForBrand({
  brandId = '',
  brandName = '',
  limit = 80,
} = {}) {
  const all = await fetchAvailableListings({ limit: Math.max(limit, 120) })
  const id = String(brandId || '').toLowerCase()
  const name = String(brandName || '').toLowerCase()
  const filtered = all.filter((item) => {
    if (id && item.brandId === id) return true
    if (name && String(item.brandName || item.brand || '').toLowerCase() === name) {
      return true
    }
    return false
  })
  return filtered.slice(0, limit)
}

/**
 * Group listings into brand rows for the home feed.
 * @returns {{ id: string, name: string, category: string, products: object[] }[]}
 */
export function groupListingsByBrand(listings = []) {
  const order = []
  const byBrand = new Map()
  for (const item of listings) {
    const key = item.brandId || 'other'
    if (!byBrand.has(key)) {
      byBrand.set(key, {
        id: key,
        name: item.brandName || item.brand || 'Other',
        category: item.category || '',
        products: [],
      })
      order.push(key)
    }
    const row = byBrand.get(key)
    row.products.push(item)
    if (!row.category && item.category) row.category = item.category
  }
  return order.map((k) => byBrand.get(k)).filter((r) => r.products.length)
}

export function filterListingsByClothingType(listings, typeId = 'all') {
  if (!typeId || typeId === 'all') return listings
  const meta = clothingTypeById(typeId)
  if (meta?.category) {
    const want = meta.category.toLowerCase()
    return listings.filter(
      (item) => String(item.category || '').toLowerCase() === want,
    )
  }
  const cats = TYPE_TO_CATEGORIES[typeId]
  if (!cats) return listings
  const set = new Set(cats.map((c) => c.toLowerCase()))
  return listings.filter((item) =>
    set.has(String(item.category || '').toLowerCase()),
  )
}

/** Filter home feed to one brand (by slug id and/or display name). */
export function filterListingsByBrand(
  listings = [],
  { brandId = '', brandName = '' } = {},
) {
  const id = String(brandId || '').toLowerCase()
  const name = String(brandName || '').toLowerCase()
  if (!id && !name) return listings
  return listings.filter((item) => {
    if (id && item.brandId === id) return true
    if (
      name &&
      String(item.brandName || item.brand || '').toLowerCase() === name
    ) {
      return true
    }
    return false
  })
}

/** Sales dashboard stats for the signed-in seller. */
export async function fetchSellerSalesStats(sellerId) {
  const supabase = await requireClient()
  const uid = sellerId || (await getAuthUserId())

  const { data, error } = await supabase
    .from('listings')
    .select('status, price')
    .eq('seller_id', uid)

  if (error) {
    const err = new Error(error.message || 'Could not load sales')
    err.code = error.code || 'sales_failed'
    throw err
  }

  let active = 0
  let sold = 0
  let gross = 0
  for (const row of data || []) {
    if (row.status === 'available') active += 1
    if (row.status === 'sold') {
      sold += 1
      gross += parseListingPrice(row.price)
    }
  }
  return {
    active,
    sold,
    gross,
    net: gross,
  }
}
