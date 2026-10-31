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
    (sum, row) => sum + parsePrice(row.price) * (row.qty || 1),
    0,
  )
}

export function addToCart(product) {
  if (!product?.id) return readCart()
  const cur = readCart()
  const idx = cur.findIndex((row) => row.id === product.id)
  if (idx >= 0) {
    cur[idx] = { ...cur[idx], qty: (cur[idx].qty || 1) + 1 }
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
      description: product.description || '',
      printfulVariantId:
        product.printfulVariantId ||
        product.catalogVariantId ||
        product.catalog_variant_id ||
        null,
      placements: product.placements || null,
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
