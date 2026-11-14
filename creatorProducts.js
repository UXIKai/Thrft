import { STORE_BRAND_ROWS } from './brandsCatalog.js'

const usdPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function isAvailablePrintfulVariant(variant) {
  if (variant.in_stock === false) return false
  const status = variant.availability_status
  if (Array.isArray(status) && status.length) return status.some((entry) => entry.status === 'in_stock')
  return !['discontinued', 'out_of_stock', 'not_available'].includes(status)
}

export function selectCatalogVariants(catalog, ids) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 ||
      ids.some((id) => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
    throw Object.assign(new Error('Choose one or more available sizes'), { status: 400 })
  }
  const selected = ids.map((id) => catalog.variants?.find((variant) => variant.id === id))
  if (selected.some((variant) => !variant || !isAvailablePrintfulVariant(variant))) {
    throw Object.assign(new Error('Blank variant is not available'), { status: 400 })
  }
  if (new Set(selected.map((variant) => variant.color)).size !== 1 ||
      new Set(selected.map((variant) => variant.size)).size !== selected.length) {
    throw Object.assign(new Error('Choose different sizes of one garment color'), { status: 400 })
  }
  return selected.map((variant) => {
    const raw = variant.price
    const price = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN
    return { variant_id: variant.id, size: variant.size || '', color: variant.color || '',
      base_price: Number.isFinite(price) && price > 0 ? price : null,
      currency: variant.currency || catalog.product?.currency || catalog.currency || 'USD' }
  })
}

export function storedPrintfulVariants(row) {
  if (Array.isArray(row.printful_variants) && row.printful_variants.length) return row.printful_variants
  const id = row.printful_variant_id || row.variant_id
  return id ? [{ variant_id: id, size: row.size || '', color: row.color || '',
    base_price: null, currency: 'USD' }] : []
}

export function creatorPricing(variants, retailPrice) {
  if (!variants?.length || variants.some((variant) => variant.base_price == null ||
      !Number.isFinite(Number(variant.base_price)) || Number(variant.base_price) <= 0 ||
      variant.currency !== 'USD')) return null
  const costs = variants.map((variant) => Math.round(Number(variant.base_price) * 100))
  const raw = String(retailPrice ?? '').trim()
  const retail = raw && Number.isFinite(Number(raw)) ? Math.round(Number(raw) * 100) : null
  const min = Math.min(...costs)
  const max = Math.max(...costs)
  return { baseMin: min / 100, baseMax: max / 100,
    marginMin: retail === null ? null : (retail - max) / 100,
    marginMax: retail === null ? null : (retail - min) / 100 }
}

export const formatCreatorPrice = (price) => usdPrice.format(price)

export function mapCreatorProduct(row) {
  const variants = storedPrintfulVariants(row)
  const brand = STORE_BRAND_ROWS.find((entry) =>
    entry.name.toLowerCase() === String(row.brand || '').trim().toLowerCase())
  return {
    ...row,
    accountId: row.creator_id,
    creatorId: row.creator_id,
    brandName: row.brand,
    brandId: brand?.id || String(row.brand || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    clothingType: String(row.category || '').toLowerCase(),
    priceRaw: row.price,
    price: usdPrice.format(Number(row.price)),
    photoUrl: row.mockup_urls?.[0] || row.photo_url || '',
    image_url: row.mockup_urls?.[0] || row.photo_url || '',
    printfulVariantId: row.printful_variant_id,
    printfulVariants: variants,
    sizes: variants.length ? variants.map((variant) => variant.size) : undefined,
    size: variants.length === 1 ? variants[0].size : '',
    artworkUrl: row.artwork_url,
    mockupUrls: row.mockup_urls || [],
    createdAt: row.created_at,
    sellerUsername: row.creator_username,
    sellerName: row.creator_name,
  }
}
