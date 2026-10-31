import { HOME_TYPE_TO_GARMENTS } from './sizeOptions.js'
import { BRAND_ROWS, findBrandById } from './brandsCatalog.js'

const INTEREST_KEY = 'thrft-product-interest-v1'
const SEARCH_KEY = 'thrft-search-history-v1'

const ROW_COUNT = 10
const PRODUCTS_PER_ROW = 20
const SEARCH_LIMIT = 40

function readInterest() {
  try {
    const raw = localStorage.getItem(INTEREST_KEY)
    if (!raw) return { brands: {}, types: {}, products: {} }
    const parsed = JSON.parse(raw)
    return {
      brands: parsed.brands || {},
      types: parsed.types || {},
      products: parsed.products || {},
    }
  } catch {
    return { brands: {}, types: {}, products: {} }
  }
}

function writeInterest(next) {
  try {
    localStorage.setItem(INTEREST_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

/** Record a view / like so For You can learn. */
export function recordProductInterest(product, weight = 1) {
  if (!product?.id) return readInterest()
  const cur = readInterest()
  cur.products[product.id] = (cur.products[product.id] || 0) + weight
  if (product.brandId) {
    cur.brands[product.brandId] = (cur.brands[product.brandId] || 0) + weight
  }
  if (product.clothingType) {
    cur.types[product.clothingType] = (cur.types[product.clothingType] || 0) + weight
  }
  return writeInterest(cur)
}

/** Local search / browse history that drives personalized home rows. */
export function readSearchHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function recordSearchHistory(entry = {}) {
  const brandId = entry.brandId ? String(entry.brandId) : ''
  const clothingType =
    entry.clothingType && entry.clothingType !== 'all'
      ? String(entry.clothingType)
      : ''
  const query = String(entry.query || '').trim()
  if (!brandId && !clothingType && !query) return readSearchHistory()

  const nextEntry = {
    at: Date.now(),
    kind: entry.kind || 'search',
    brandId,
    brandName: String(entry.brandName || entry.query || brandId || ''),
    clothingType,
    query,
  }

  const prev = readSearchHistory().filter((item) => {
    if (brandId && item.brandId === brandId) return false
    if (!brandId && clothingType && item.clothingType === clothingType && !item.brandId)
      return false
    return true
  })
  const next = [nextEntry, ...prev].slice(0, SEARCH_LIMIT)
  try {
    localStorage.setItem(SEARCH_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }

  // Mirror into interest weights so ranking stays in sync.
  const interest = readInterest()
  if (brandId) interest.brands[brandId] = (interest.brands[brandId] || 0) + 2
  if (clothingType) interest.types[clothingType] = (interest.types[clothingType] || 0) + 2
  writeInterest(interest)

  return next
}

function garmentMatchesHomeType(garmentId, homeType) {
  if (!homeType || !garmentId) return false
  if (garmentId === homeType) return true
  return (HOME_TYPE_TO_GARMENTS[homeType] || []).includes(garmentId)
}

function scoreProduct(product, ctx) {
  const {
    interest,
    saved,
    favored,
    clothingSizes = {},
    brandSizes = {},
    themeBrandId = '',
    themeType = '',
  } = ctx
  let score = 0
  const brandScore = interest.brands[product.brandId] || 0
  const typeScore = interest.types[product.clothingType] || 0
  const productScore = interest.products[product.id] || 0
  score += brandScore * 3
  score += typeScore * 2
  score += productScore * 4
  if (saved.has(product.id)) score += 8
  if (favored.has(product.brandId)) score += 5
  if (themeBrandId && product.brandId === themeBrandId) score += 12
  if (themeType && garmentMatchesHomeType(product.clothingType, themeType)) score += 9

  const brandChart = brandSizes?.[product.brandId] || {}
  const brandPreferred = brandChart[product.clothingType]
  if (brandPreferred && product.size === brandPreferred) score += 10
  else if (brandPreferred && product.size) score += 1.5

  const preferred = clothingSizes?.[product.clothingType]
  if (preferred && product.size === preferred) score += 5
  else if (preferred && product.size) score += 0.5

  for (const [homeType, size] of Object.entries(clothingSizes || {})) {
    if (!size || homeType === product.clothingType) continue
    if (
      garmentMatchesHomeType(product.clothingType, homeType) &&
      product.size === size
    ) {
      score += 3
    }
  }

  score += 0.1 + ((product.code?.charCodeAt?.(1) || 0) % 7) / 100
  return score
}

/**
 * Rank real listing products for For You from sizes, favored brands, and affinity.
 */
export function buildForYouFeed({
  catalog = [],
  clothingSizes = {},
  brandSizes = {},
  favoredBrands = [],
  savedProductIds = [],
  limit = 16,
} = {}) {
  const interest = readInterest()
  const saved = new Set(savedProductIds)
  const favored = new Set(favoredBrands)
  const products = Array.isArray(catalog) ? catalog : []
  if (!products.length) return []

  const scored = products.map((product) => ({
    product,
    score: scoreProduct(product, {
      interest,
      saved,
      favored,
      clothingSizes,
      brandSizes,
    }),
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.product)
}

function labelForType(typeId) {
  if (!typeId) return 'Category'
  return String(typeId)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function padProducts(list, count, pool) {
  if (!count) return []
  const source = list.length ? list : pool
  if (!source.length) {
    return Array.from({ length: count }, (_, i) => ({
      id: `empty-${i}`,
      code: `E${i + 1}`,
      title: '',
      price: '',
      brandId: '',
      brandName: '',
      clothingType: '',
      tone: i % 2 === 0 ? 'charcoal' : 'olive',
    }))
  }
  const out = []
  for (let i = 0; i < count; i += 1) {
    const base = source[i % source.length]
    out.push({
      ...base,
      id: `${base.id || 'p'}-r${i}`,
      code: base.code || `P${i + 1}`,
    })
  }
  return out
}

function pickForTheme(catalog, theme, ctx, count) {
  const scored = catalog
    .map((product) => ({
      product,
      score: scoreProduct(product, {
        ...ctx,
        themeBrandId: theme.brandId || '',
        themeType: theme.clothingType || '',
      }),
    }))
    .sort((a, b) => b.score - a.score)

  let picked = scored.map((s) => s.product)
  if (theme.brandId) {
    const brandHits = picked.filter((p) => p.brandId === theme.brandId)
    if (brandHits.length) picked = [...brandHits, ...picked.filter((p) => p.brandId !== theme.brandId)]
  }
  if (theme.clothingType) {
    const typeHits = picked.filter((p) =>
      garmentMatchesHomeType(p.clothingType, theme.clothingType),
    )
    if (typeHits.length) {
      picked = [
        ...typeHits,
        ...picked.filter((p) => !garmentMatchesHomeType(p.clothingType, theme.clothingType)),
      ]
    }
  }
  return padProducts(picked.slice(0, count), count, catalog)
}

/**
 * Build exactly `rowCount` home marquee rows (default 10) with `productsPerRow`
 * boxes each, seeded from search history + likes + interest, then catalog brands.
 */
export function buildPersonalizedRows({
  catalog = [],
  favoredBrands = [],
  savedProducts = [],
  savedProductIds = [],
  clothingSizes = {},
  brandSizes = {},
  rowCount = ROW_COUNT,
  productsPerRow = PRODUCTS_PER_ROW,
} = {}) {
  const interest = readInterest()
  const history = readSearchHistory()
  const savedIds = new Set([
    ...savedProductIds,
    ...(Array.isArray(savedProducts) ? savedProducts.map((p) => p.id).filter(Boolean) : []),
  ])
  const favored = new Set(favoredBrands)
  const ctx = {
    interest,
    saved: savedIds,
    favored,
    clothingSizes,
    brandSizes,
  }

  const pool =
    Array.isArray(catalog) && catalog.length
      ? catalog
      : BRAND_ROWS.flatMap((b) => b.products)

  const themes = []
  const seen = new Set()

  function pushTheme(theme) {
    if (!theme?.id || seen.has(theme.id) || themes.length >= rowCount) return
    seen.add(theme.id)
    themes.push(theme)
  }

  // Likes first — saved products as a dedicated row, then favored brands.
  if (savedIds.size) {
    pushTheme({
      id: 'liked-items',
      name: 'Liked',
      category: 'From your likes',
      brandId: '',
      clothingType: '',
      preferSaved: true,
    })
  }
  for (const brandId of favoredBrands) {
    const meta = findBrandById(brandId)
    pushTheme({
      id: `like-${brandId}`,
      name: meta?.name || brandId,
      category: 'Liked brand',
      brandId,
      clothingType: '',
    })
  }

  // Search history (brands + categories).
  for (const entry of history) {
    if (entry.brandId) {
      const meta = findBrandById(entry.brandId)
      pushTheme({
        id: `search-brand-${entry.brandId}`,
        name: entry.brandName || meta?.name || entry.brandId,
        category: 'From your search',
        brandId: entry.brandId,
        clothingType: '',
      })
    } else if (entry.clothingType) {
      pushTheme({
        id: `search-type-${entry.clothingType}`,
        name: labelForType(entry.clothingType),
        category: 'From your search',
        brandId: '',
        clothingType: entry.clothingType,
      })
    }
  }

  // Brands pulled from liked product payloads.
  for (const item of savedProducts || []) {
    if (!item?.brandId) continue
    pushTheme({
      id: `saved-brand-${item.brandId}`,
      name: item.brandName || findBrandById(item.brandId)?.name || item.brandId,
      category: 'From your likes',
      brandId: item.brandId,
      clothingType: item.clothingType || '',
    })
  }

  // Top affinity brands / types from interest weights.
  const brandRank = Object.entries(interest.brands).sort((a, b) => b[1] - a[1])
  for (const [brandId] of brandRank) {
    const meta = findBrandById(brandId)
    pushTheme({
      id: `affinity-${brandId}`,
      name: meta?.name || brandId,
      category: 'For you',
      brandId,
      clothingType: '',
    })
  }
  const typeRank = Object.entries(interest.types).sort((a, b) => b[1] - a[1])
  for (const [clothingType] of typeRank) {
    pushTheme({
      id: `affinity-type-${clothingType}`,
      name: labelForType(clothingType),
      category: 'For you',
      brandId: '',
      clothingType,
    })
  }

  // Fill remaining slots from the default 10 brand rows.
  for (const brand of BRAND_ROWS) {
    pushTheme({
      id: `brand-${brand.id}`,
      name: brand.name,
      category: brand.category,
      brandId: brand.id,
      clothingType: '',
    })
  }

  while (themes.length < rowCount) {
    const brand = BRAND_ROWS[themes.length % BRAND_ROWS.length]
    pushTheme({
      id: `pad-${themes.length}-${brand.id}`,
      name: brand.name,
      category: brand.category,
      brandId: brand.id,
      clothingType: '',
    })
  }

  return themes.slice(0, rowCount).map((theme) => {
    let products
    if (theme.preferSaved) {
      const liked = (savedProducts || []).filter((p) => p && p.id)
      const rankedLiked = liked.length
        ? liked
        : pool.filter((p) => savedIds.has(p.id))
      products = padProducts(
        buildForYouFeed({
          catalog: rankedLiked.length ? rankedLiked : pool,
          clothingSizes,
          brandSizes,
          favoredBrands,
          savedProductIds: [...savedIds],
          limit: productsPerRow,
        }),
        productsPerRow,
        pool,
      )
    } else {
      products = pickForTheme(pool, theme, ctx, productsPerRow)
    }
    return {
      id: theme.id,
      name: theme.name,
      category: theme.category,
      products,
    }
  })
}

export const PERSONALIZED_ROW_COUNT = ROW_COUNT
export const PERSONALIZED_PRODUCTS_PER_ROW = PRODUCTS_PER_ROW
