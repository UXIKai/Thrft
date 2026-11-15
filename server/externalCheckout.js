import { fetchPublicHttps, publicHttpsUrl } from './publicHttps.js'

function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status })
}

export async function fetchLiveCatalog(origin, get = fetchPublicHttps) {
  const domain = new URL(origin).hostname
  const products = []
  for (let page = 1; page <= 5; page++) {
    const response = await get(`${origin}/products.json?limit=250&page=${page}`, { allowedHostname: domain })
    if (response.status !== 200 || new URL(response.url).origin !== origin) {
      fail('Could not verify live Shopify inventory. Please retry.', 502)
    }
    let data
    try { data = JSON.parse(response.body.toString('utf8')) } catch {
      fail('Shopify returned invalid inventory data', 502)
    }
    if (!Array.isArray(data.products)) fail('Shopify inventory is unavailable', 502)
    products.push(...data.products)
    if (data.products.length < 250) return products
  }
  fail('Shopify inventory exceeds the supported catalog size', 502)
}

export async function resolveExternalItems(product, input, quantity, store, catalogs) {
  if (!product.external_brand_id || !product.external_url || product.external_currency !== 'USD') {
    fail('External checkout requires an imported USD variant catalog')
  }
  const variants = product.external_variants
  if (!Array.isArray(variants) || !variants.length) fail('Reimport this product before checkout to load its variants')
  const brand = await store.getExternalBrand(product.external_brand_id, product.creator_id)
  if (!brand) fail('This brand no longer has verified domain ownership')
  const origin = publicHttpsUrl(product.external_url).origin
  if (origin !== brand.site_origin) fail('Product does not belong to the verified brand')
  const ids = input.selectedVariantIds || Array.from({ length: quantity }, () => input.externalVariantId)
  if (!Array.isArray(ids) || ids.length !== quantity || ids.some((id) => typeof id !== 'string')) {
    fail('Choose a variant for every external item', 400)
  }
  if (!catalogs.has(origin)) catalogs.set(origin, store.getLiveExternalCatalog(origin))
  const live = await catalogs.get(origin)
  const url = new URL(product.external_url)
  const handle = url.pathname.match(/^\/products\/([^/]+)\/?$/)?.[1]
  const liveProduct = live.find((row) => row.handle === handle)
  if (!liveProduct || !Array.isArray(liveProduct.variants)) fail(`${product.title} is no longer available`)
  const grouped = new Map()
  for (const id of ids) {
    const variant = variants.find((entry) => entry.id === id)
    const available = liveProduct.variants.find((entry) =>
      (typeof entry.id === 'string' || Number.isSafeInteger(entry.id)) && String(entry.id) === id)
    if (!variant || !available || available.available !== true) fail(`The selected ${product.title} variant is sold out or unavailable`)
    const amount = Math.round(Number(variant.price) * 100)
    if (!Number.isSafeInteger(amount) || amount < 50 || amount > 9999999900) fail('Saved variant price is invalid')
    const group = grouped.get(id) || { variant, amount, quantity: 0 }
    group.quantity++
    grouped.set(id, group)
  }
  if (!Number.isInteger(brand.flat_shipping_cents) || brand.flat_shipping_cents < 0) fail('Brand shipping is invalid')
  return [...grouped].map(([id, group]) => ({
    productId: product.id, title: `${product.title}${group.variant.title ? ` (${group.variant.title})` : ''}`,
    unitAmount: group.amount, quantity: group.quantity, size: group.variant.size || '',
    photoUrl: product.photo_url || '', source: 'store', creatorId: product.creator_id,
    printfulVariantId: null, artworkUrl: null, baseAmount: null,
    externalBrandId: brand.id, externalVariantId: id,
    externalShippingCents: brand.flat_shipping_cents, externalBrandName: brand.name,
  }))
}

export function externalShipping(items) {
  const brands = new Map()
  for (const item of items) {
    if (item.externalBrandId) brands.set(item.externalBrandId, {
      brandId: item.externalBrandId, amount: item.externalShippingCents, name: item.externalBrandName,
    })
  }
  return [...brands.values()]
}
