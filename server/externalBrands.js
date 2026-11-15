import { parse } from 'parse5'
import { fetchPublicHttps, publicHttpsUrl } from './publicHttps.js'

function fail(message, status = 422) {
  throw Object.assign(new Error(message), { status })
}

function json(response, label) {
  if (response.status !== 200) fail(`${label} returned HTTP ${response.status}`)
  try { return JSON.parse(response.body.toString('utf8')) } catch { fail(`${label} returned invalid JSON`) }
}

function currencyCode(value) {
  const code = String(value || '').toUpperCase()
  try {
    if (!/^[A-Z]{3}$/.test(code)) throw new Error()
    new Intl.NumberFormat('en', { style: 'currency', currency: code }).format(1)
  } catch { fail('The website did not provide a valid product currency') }
  return code
}

function productUrl(value, base) {
  const url = publicHttpsUrl(value, base)
  if (url.origin !== new URL(base).origin) fail('Product links must stay on the connected website')
  return url.href
}

function imageUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return ''
  return publicHttpsUrl(value, base).href
}

function priceValue(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0.5 || number > 99999999) fail('A product has an invalid price')
  return Math.round(number * 100) / 100
}

function titleValue(value) {
  const title = String(value || '').trim()
  if (!title || title.length > 120) fail('A product has an invalid title')
  return title
}

function sizesValue(values) {
  return [...new Set(values.filter((value) => typeof value === 'string')
    .map((value) => value.trim()).filter((value) => value && value.length <= 80))].slice(0, 100)
}

function shopifyProduct(product, base, currency) {
  if (!product || !Array.isArray(product.variants) || !product.variants.length) fail('Invalid product in website catalog')
  const available = product.variants.filter((variant) => variant.available !== false)
  if (!available.length) return null
  const sizeOption = (product.options || []).findIndex((option) => /^size$/i.test(String(option.name || '').trim()))
  const sizes = sizeOption < 0 ? [] : sizesValue(available.map((variant) => variant[`option${sizeOption + 1}`]))
  if (typeof product.handle !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(product.handle)) {
    fail('A product has an invalid website handle')
  }
  return {
    title: titleValue(product.title),
    price: Math.min(...available.map((variant) => priceValue(variant.price))),
    currency,
    photo_url: imageUrl(product.images?.[0]?.src || product.image?.src, base),
    external_url: productUrl(`/products/${product.handle}`, base),
    sizes,
  }
}

function walk(node, fn) {
  fn(node)
  for (const child of node.childNodes || []) walk(child, fn)
  if (node.content) walk(node.content, fn)
}

function attribute(node, name) {
  return node.attrs?.find((item) => item.name.toLowerCase() === name)?.value || ''
}

function schemaNodes(value, output = []) {
  if (Array.isArray(value)) value.forEach((item) => schemaNodes(item, output))
  else if (value && typeof value === 'object') {
    const type = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
    if (type.some((item) => typeof item === 'string' && /(?:^|[/#])Product$/i.test(item))) output.push(value)
    if (value['@graph']) schemaNodes(value['@graph'], output)
    if (value.hasVariant) schemaNodes(value.hasVariant, output)
  }
  return output
}

export function parseProductPage(html, pageUrl, base) {
  const document = parse(html)
  const products = []
  const links = new Set()
  walk(document, (node) => {
    if (node.tagName === 'script' && attribute(node, 'type').split(';')[0].trim().toLowerCase() === 'application/ld+json') {
      try { products.push(...schemaNodes(JSON.parse(node.childNodes?.[0]?.value || ''))) }
      catch (error) {
        if (!(error instanceof SyntaxError)) throw error
      }
    }
    if (node.tagName === 'a') {
      try {
        const url = publicHttpsUrl(attribute(node, 'href'), pageUrl)
        if (url.origin === new URL(base).origin && /\/products?\//i.test(url.pathname)) links.add(url.href)
      } catch { /* Ignore unrelated links on the website. */ }
    }
  })
  const mapped = products.map((product) => {
    const offers = Array.isArray(product.offers) ? product.offers : [product.offers]
    const offer = offers.find((item) => item && !/OutOfStock|SoldOut|Discontinued/i.test(item.availability || ''))
    if (!offer) return null
    const images = Array.isArray(product.image) ? product.image : [product.image]
    const first = images[0]
    return {
      title: titleValue(product.name),
      price: priceValue(offer.price ?? offer.lowPrice),
      currency: currencyCode(offer.priceCurrency),
      photo_url: imageUrl(typeof first === 'object' ? first?.url : first, pageUrl),
      external_url: productUrl(product.url || offer.url || pageUrl, base),
      sizes: sizesValue([product.size, ...(Array.isArray(product.hasVariant) ? product.hasVariant.map((v) => v.size) : [])]),
    }
  }).filter(Boolean)
  return { products: mapped, links: [...links] }
}

export async function collectExternalProducts(websiteUrl, get = fetchPublicHttps) {
  const input = publicHttpsUrl(websiteUrl)
  const first = await get(`${input.origin}/products.json?limit=250&page=1`)
  let firstPage
  if (first.status === 200) {
    try { firstPage = JSON.parse(first.body.toString('utf8')) } catch { /* May be an HTML fallback page. */ }
  }
  if (Array.isArray(firstPage?.products)) {
    const base = publicHttpsUrl(first.url).origin
    const cart = json(await get(`${base}/cart.js`), 'Store currency')
    const currency = currencyCode(cart.currency)
    const products = []
    let page = firstPage.products
    for (let index = 1; ; index++) {
      products.push(...page.map((product) => shopifyProduct(product, base, currency)).filter(Boolean))
      if (page.length < 250) break
      const next = json(await get(`${base}/products.json?limit=250&page=${index + 1}`), 'Product catalog')
      if (!Array.isArray(next.products)) fail('Product catalog response is invalid')
      if (index >= 4 && next.products.length) fail('Catalog exceeds the 1,000-product import limit')
      page = next.products
    }
    if (!products.length) fail('No available products were found')
    if (new Set(products.map((product) => product.external_url)).size !== products.length) fail('Catalog contains duplicate product URLs')
    return { products, complete: true, origin: base }
  }
  if (![200, 403, 404, 405, 410].includes(first.status)) fail(`Product catalog returned HTTP ${first.status}`)
  const page = await get(input.href)
  if (page.status !== 200) fail(`Website returned HTTP ${page.status}`)
  const base = publicHttpsUrl(page.url).origin
  const parsed = parseProductPage(page.body.toString('utf8'), page.url, base)
  const products = [...parsed.products]
  if (!products.length) {
    const links = parsed.links.slice(0, 12)
    for (let index = 0; index < links.length; index += 4) {
      const responses = await Promise.all(links.slice(index, index + 4).map((link) => get(link)))
      for (const response of responses) {
        if (response.status !== 200) fail(`Product page returned HTTP ${response.status}`)
        products.push(...parseProductPage(response.body.toString('utf8'), response.url, base).products)
      }
    }
  }
  if (!products.length) fail('No products found. Enter a product page with Schema.org product metadata.')
  return { products: [...new Map(products.map((product) => [product.external_url, product])).values()],
    complete: false, origin: base }
}
