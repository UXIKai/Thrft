import { externalProductVariants, isExternalProduct } from './creatorProducts.js'

/** Local marketplace bag — listings only (not subscriptions). */

const CART_KEY = 'thrft-cart-v1'

function parsePrice(price) {
  if (typeof price === 'number' && Number.isFinite(price)) return price
  const n = Number.parseFloat(String(price || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function formatMoney(amount) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  } catch {
    return `$${Number(amount || 0).toFixed(2)}`
  }
}

export function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function writeCart(items) {
  const list = Array.isArray(items) ? items : []
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
  return list
}

export function cartCount(items = readCart()) {
  return items.reduce((n, row) => n + (row.qty || 1), 0)
}

export function cartTotal(items = readCart()) {
  return items.reduce(
    (sum, row) => sum + cartLineTotal(row),
    0,
  )
}

export function selectedExternalVariants(row) {
  const variants = externalProductVariants(row)
  const qty = row.qty || 1
  const ids = Array.isArray(row.selectedVariantIds) ? row.selectedVariantIds :
    Object.hasOwn(row, 'externalVariantId') ? Array(qty).fill(row.externalVariantId) : []
  if (ids.length !== qty) return null
  const selected = ids.map((id) => variants.find((variant) => variant.id === id))
  return selected.every(Boolean) ? selected : null
}

export function cartLineTotal(row) {
  if (isExternalProduct(row)) {
    const variants = selectedExternalVariants(row)
    return variants ? variants.reduce((sum, variant) => sum + Math.round(variant.price * 100), 0) / 100 : 0
  }
  return parsePrice(row.price) * (row.qty || 1)
}

export function resizeCartItem(row, qty) {
  const next = {
    ...row, qty,
    selectedSizes: Array.from({ length: qty }, (_, index) =>
      row.selectedSizes?.[index] || row.size || ''),
  }
  if (isExternalProduct(row)) {
    const selected = selectedExternalVariants(row)
    if (!selected?.length) return {
      ...next,
      ...(Array.isArray(row.selectedVariantIds) ? { selectedVariantIds: row.selectedVariantIds.slice(0, qty) } : {}),
    }
    next.selectedVariantIds = Array.from({ length: qty }, (_, index) =>
      (selected[index] || selected[selected.length - 1]).id)
    next.selectedSizes = Array.from({ length: qty }, (_, index) =>
      (selected[index] || selected[selected.length - 1]).size || '')
  }
  return next
}

export function addToCart(product) {
  if (!product?.id) return readCart()
  const cur = readCart()
  const external = isExternalProduct(product)
  const variant = external ? externalProductVariants(product)
    .find((entry) => entry.id === product.externalVariantId) : null
  if (external && !variant) return cur
  const idx = cur.findIndex((row) => row.id === product.id)
  if (idx >= 0) {
    const row = cur[idx]
    if (external) {
      const selected = selectedExternalVariants({ ...row,
        externalVariants: product.externalVariants ?? product.external_variants,
        externalCurrency: product.externalCurrency ?? product.external_currency })
      if (!selected || (row.qty || 1) >= 10) return cur
      cur[idx] = { ...row,
        externalVariants: product.externalVariants ?? product.external_variants,
        externalCurrency: product.externalCurrency ?? product.external_currency,
        qty: (row.qty || 1) + 1,
        selectedVariantIds: [...selected.map((entry) => entry.id), variant.id],
        selectedSizes: [...selected.map((entry) => entry.size || ''), variant.size || ''],
      }
      return writeCart(cur)
    }
    const sizes = Array.from({ length: row.qty || 1 }, (_, index) =>
      row.selectedSizes?.[index] || row.size || '',
    )
    cur[idx] = { ...row, qty: (row.qty || 1) + 1, selectedSizes: [...sizes, product.size || row.size || ''] }
  } else {
    cur.unshift({
      id: product.id,
      title: product.title || 'Listing',
      price:
        product.priceRaw != null
          ? product.priceRaw
          : product.price || '',
      brandName: product.brandName || product.brand || '',
      brandId: product.brandId || '',
      code: product.code || '',
      clothingType: product.clothingType || product.category || '',
      photoUrl: product.photoUrl || product.image_url || '',
      detailVariant: product.detailVariant,
      mockupUrls: product.mockupUrls || product.mockup_urls || [],
      description: product.description || '',
      printfulVariantId:
        product.printfulVariantId ||
        product.catalogVariantId ||
        product.catalog_variant_id ||
        null,
      printfulVariants: product.printfulVariants || product.printful_variants || [],
      sizes: product.sizes || [],
      placements: product.placements || null,
      size: product.size || '',
      selectedSizes: [product.size || ''],
      ...(external ? {
        externalUrl: product.externalUrl || product.external_url || '',
        externalBrandId: product.externalBrandId || product.external_brand_id || '',
        externalCurrency: product.externalCurrency ?? product.external_currency,
        externalVariants: product.externalVariants ?? product.external_variants,
        externalVariantId: variant.id,
        selectedVariantIds: [variant.id],
        status: product.status,
        price: variant.price,
        size: variant.size || '',
        selectedSizes: [variant.size || ''],
      } : {}),
      qty: 1,
    })
  }
  return writeCart(cur)
}

export function removeFromCart(productId) {
  return writeCart(readCart().filter((row) => row.id !== productId))
}

export function clearCart() {
  return writeCart([])
}
