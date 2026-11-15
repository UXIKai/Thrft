import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { isPublicAddress, publicHttpsUrl, fetchPublicHttps } from '../server/publicHttps.js'
import { collectExternalProducts, parseProductPage } from '../server/externalBrands.js'
import { mapCreatorProduct } from '../creatorProducts.js'
import { resolveCheckoutItems } from '../stripeCheckout.js'
import { importExternalBrand } from '../server/creatorApi.js'

const response = (body, status = 200, url = 'https://brand.example/') =>
  ({ status, body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)), headers: {}, url })

test('only public HTTPS targets and public network addresses are permitted', () => {
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://localhost.',
    'https://127.1', 'https://192.168.1.1', 'https://[::1]', 'https://[::ffff:127.0.0.1]']) {
    assert.throws(() => publicHttpsUrl(url))
  }
  for (const ip of ['0.0.0.0', '10.0.0.1', '100.64.0.1', '169.254.169.254', '172.16.0.1',
    '192.168.1.1', '198.18.0.1', '224.0.0.1', '::1', 'fc00::1', 'fe80::1',
    '::ffff:8.8.8.8', '2001:db8::1', '2002:0808:0808::1']) {
    assert.equal(isPublicAddress(ip), false, ip)
  }
  assert.equal(isPublicAddress('8.8.8.8'), true)
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true)
})

test('network requests pin verified DNS and reject private DNS answers and redirects', async () => {
  let requests = 0
  const lookupFn = async (host) => host === 'mixed.example'
    ? [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]
    : [{ address: '8.8.8.8', family: 4 }]
  const requestFn = (url, options, callback) => {
    requests++
    options.lookup(url.hostname, {}, (error, ip, family) => {
      assert.ifError(error)
      assert.equal(ip, '8.8.8.8')
      assert.equal(family, 4)
    })
    const req = new EventEmitter()
    req.end = () => {
      const res = Readable.from([Buffer.from('ok')])
      res.statusCode = ['/redirect', '/cross-domain'].includes(url.pathname) ? 302 : 200
      res.headers = url.pathname === '/redirect' ? { location: 'https://127.0.0.1/private' }
        : url.pathname === '/cross-domain' ? { location: 'https://other.example/catalog' } : {}
      callback(res)
    }
    req.destroy = (error) => req.emit('error', error)
    return req
  }
  assert.equal((await fetchPublicHttps('https://brand.example/', { lookupFn, requestFn })).body.toString(), 'ok')
  await assert.rejects(fetchPublicHttps('https://mixed.example/', { lookupFn, requestFn }), /non-public/)
  await assert.rejects(fetchPublicHttps('https://brand.example/redirect', { lookupFn, requestFn }), /public HTTPS/)
  await assert.rejects(fetchPublicHttps('https://brand.example/cross-domain', {
    lookupFn, requestFn, allowedHostname: 'brand.example',
  }), /verified domain/)
  assert.equal(requests, 3)
})

test('Shopify catalogs import available variants, prices, sizes, images and direct links', async () => {
  const calls = []
  const get = async (url) => {
    calls.push(url)
    if (url.endsWith('/cart.js')) return response({ currency: 'CAD' }, 200, url)
    return response({ products: [
      { title: 'Sweater', handle: 'sweater', options: [{ name: 'Color' }, { name: 'Size' }],
        images: [{ src: 'https://cdn.example/sweater.png' }],
        variants: [{ id: 101, title: 'Black / M', price: '30.50', available: true, option1: 'Black', option2: 'M' },
          { id: 102, title: 'Black / L', price: '35.00', available: true, option1: 'Black', option2: 'L' },
          { id: 103, price: '20', available: false, option2: 'S' }] },
      { title: 'Sold out', handle: 'sold', variants: [{ price: '10', available: false }] },
    ] }, 200, url)
  }
  const result = await collectExternalProducts('https://brand.example/', get)
  assert.deepEqual(result, { origin: 'https://brand.example', complete: true, products: [{
    title: 'Sweater', price: 30.5, currency: 'CAD', photo_url: 'https://cdn.example/sweater.png',
    external_url: 'https://brand.example/products/sweater', sizes: ['M', 'L'],
    available: true, variants: [
      { id: '101', title: 'Black / M', size: 'M', options: [{ name: 'Color', value: 'Black' }, { name: 'Size', value: 'M' }], price: 30.5, available: true },
      { id: '102', title: 'Black / L', size: 'L', options: [{ name: 'Color', value: 'Black' }, { name: 'Size', value: 'L' }], price: 35, available: true },
      { id: '103', title: '', size: 'S', options: [{ name: 'Color', value: '' }, { name: 'Size', value: 'S' }], price: 20, available: false },
    ],
  }, { title: 'Sold out', price: 10, currency: 'CAD', photo_url: '',
    external_url: 'https://brand.example/products/sold', sizes: [], available: false,
    variants: [{ id: null, title: '', size: '', options: [], price: 10, available: false }] }] })
  assert.equal(calls.length, 2)
  await assert.rejects(collectExternalProducts('https://brand.example/', async (url) =>
    url.endsWith('/cart.js') ? response({}) : get(url)), /currency/)
})

test('a complete Shopify sync paginates without silently truncating the catalog', async () => {
  const get = async (url) => {
    if (url.endsWith('/cart.js')) return response({ currency: 'USD' }, 200, url)
    const page = Number(new URL(url).searchParams.get('page'))
    return response({ products: page === 1 ? Array.from({ length: 250 }, (_, i) => ({
      title: `Item ${i}`, handle: `item-${i}`, variants: [{ price: '10', available: true }],
    })) : [{ title: 'Last', handle: 'last', variants: [{ price: '12', available: true }] }] }, 200, url)
  }
  const result = await collectExternalProducts('https://brand.example', get)
  assert.equal(result.products.length, 251)
  assert.equal(result.products.at(-1).external_url, 'https://brand.example/products/last')
})

test('Shopify variant snapshots never invent IDs and retain unavailable variants with stock flags', async () => {
  const get = async (url) => url.endsWith('/cart.js')
    ? response({ currency: 'USD' }, 200, url)
    : response({ products: [{ title: 'Hat', handle: 'hat', options: [{ name: 'Size' }],
      variants: [
        { id: '9007199254740993', price: '12', option1: 'M', available: true },
        { id: 9007199254740992, price: '14', option1: 'L', available: true },
        { id: 12, price: '9', option1: 'S', available: false },
      ] }] }, 200, url)
  const { products } = await collectExternalProducts('https://brand.example', get)
  assert.deepEqual(products[0].variants.map(({ id, size, price }) => ({ id, size, price })), [
    { id: '9007199254740993', size: 'M', price: 12 },
    { id: null, size: 'L', price: 14 },
    { id: '12', size: 'S', price: 9 },
  ])
  assert.deepEqual(products[0].variants.map((variant) => variant.available), [true, true, false])
  assert.deepEqual(products[0].sizes, ['M', 'L'])
})

test('Schema.org fallback imports product page metadata and does not claim a complete catalog', async () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@graph': [{ '@type': 'Product', name: 'Hat',
      image: ['/hat.png'], size: 'M', offers: { '@type': 'Offer', price: '19.99', priceCurrency: 'USD' } }],
  })}</script>`
  const get = async (url) => url.includes('products.json') ? response('', 404, url) : response(html, 200, url)
  const result = await collectExternalProducts('https://brand.example/product/hat', get)
  assert.equal(result.complete, false)
  assert.deepEqual(result.products[0], { title: 'Hat', price: 19.99, currency: 'USD',
    photo_url: 'https://brand.example/hat.png', external_url: 'https://brand.example/product/hat', sizes: ['M'], variants: [] })
  assert.throws(() => parseProductPage(html.replace('"priceCurrency":"USD"', '"priceCurrency":""'),
    'https://brand.example/product/hat', 'https://brand.example'), /currency/)
  assert.throws(() => parseProductPage(html.replace('"name":"Hat"', '"name":"Hat","url":"https://other.example/x"'),
    'https://brand.example/product/hat', 'https://brand.example'), /connected website/)
})

test('fallback discovers linked product pages and follows a canonical website redirect', async () => {
  const html = `<script type="application/ld+json">{"@type":"Product","name":"Cap",
    "image":"https://cdn.example/cap.png","offers":{"price":15,"priceCurrency":"USD"}}</script>`
  const get = async (url) => {
    if (url.includes('/products.json')) return response('<html>Not a catalog</html>', 200, url)
    if (url.endsWith('/products/cap')) return response(html, 200, url)
    return response('<a href="/products/cap">Cap</a>', 200, 'https://www.brand.example/')
  }
  const result = await collectExternalProducts('https://brand.example', get)
  assert.equal(result.origin, 'https://www.brand.example')
  assert.equal(result.complete, false)
  assert.equal(result.products[0].external_url, 'https://www.brand.example/products/cap')
})

test('external products keep their identity and require variant snapshots for checkout', async () => {
  const id = 'c0d0e0f0-1234-4321-8765-123456789abc'
  const row = { id, creator_id: 'owner', brand: 'Brand', title: 'Hat', price: 20,
    external_brand_id: '1234', external_url: 'https://brand.example/products/hat',
    external_currency: 'USD', external_sizes: ['M'], brand_logo_url: 'https://storage.example/logo.png',
    external_synced_at: '2026-01-01T00:00:00Z', photo_url: 'https://cdn.example/hat.png', status: 'active' }
  const product = mapCreatorProduct(row)
  assert.equal(product.brandId, 'external-1234')
  assert.match(product.photoUrl, /^\/api\/brands\/image\?id=/)
  assert.deepEqual(product.sizes, ['M'])
  assert.equal(product.externalUrl, row.external_url)
  assert.equal(product.brandLogoUrl, row.brand_logo_url)
  await assert.rejects(resolveCheckoutItems({ items: [{ id, qty: 1 }] },
    { getProduct: async () => row }), /Reimport/)
})

test('an import uses the authenticated owner, owned logo, and atomic sync only after collection succeeds', async () => {
  const previous = process.env.SUPABASE_URL
  process.env.SUPABASE_URL = 'https://storage.example'
  try {
    const user = { id: 'owner', email: 'creator@example.com', user_metadata: { username: 'creator' } }
    const logoUrl = 'https://storage.example/storage/v1/object/public/Thrft/owner/logo.png'
    const body = { brandName: '  Studio  ', logoUrl, websiteUrl: 'https://brand.example' }
    const catalog = { origin: 'https://brand.example', complete: true,
      products: [{ title: 'Hat', external_url: 'https://brand.example/products/hat' }] }
    const calls = []
    const db = {
      from() { return { select() { return this }, eq() { return this },
        async maybeSingle() { return { data: { creator_id: 'owner', status: 'verified' }, error: null } } } },
      rpc: async (name, args) => { calls.push({ name, args }); return { data: 1, error: null } },
    }
    assert.deepEqual(await importExternalBrand(user, body, db, async () => catalog), { imported: 1, complete: true })
    assert.equal(calls[0].name, 'sync_external_brand')
    assert.equal(calls[0].args.p_creator_id, 'owner')
    assert.equal(calls[0].args.p_name, 'Studio')
    assert.equal(calls[0].args.p_logo_url, logoUrl)
    assert.deepEqual(calls[0].args.p_products, catalog.products)
    await assert.rejects(importExternalBrand(user, { ...body, logoUrl: logoUrl.replace('/owner/', '/other/') },
      db, async () => catalog), /uploaded/)
    await assert.rejects(importExternalBrand(user, body, db, async () => { throw new Error('Website failed') }),
      /Website failed/)
    assert.equal(calls.length, 1)
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = previous
  }
})

test('brand-ID reimport reloads trusted settings and refuses foreign or unverified brands before catalog access', async () => {
  const previous = process.env.SUPABASE_URL
  process.env.SUPABASE_URL = 'https://storage.example'
  try {
    const user = { id: 'owner' }
    const brandId = '11111111-1111-4111-8111-111111111111'
    let brand = { name: 'Saved brand', logo_url: 'https://storage.example/storage/v1/object/public/Thrft/owner/logo.png',
      site_origin: 'https://brand.example' }
    let claim = { creator_id: 'owner', status: 'verified' }
    const calls = []
    let fetches = 0
    const db = { from(table) {
      return { select() { return this }, eq(key, value) { calls.push([table, key, value]); return this },
        async maybeSingle() { return { data: table === 'external_brands' ? brand : claim } } }
    }, async rpc(name, args) { calls.push([name, args]); return { data: args.p_products.length } } }
    const collect = async (url) => {
      fetches++
      assert.equal(url, 'https://brand.example/')
      return { origin: 'https://brand.example', complete: true, products: [] }
    }
    assert.deepEqual(await importExternalBrand(user, { brandId, websiteUrl: 'https://evil.example', brandName: 'Fake' },
      db, collect), { imported: 0, complete: true })
    assert.ok(calls.some(([table, key, value]) => table === 'external_brands' && key === 'creator_id' && value === 'owner'))
    assert.equal(calls.at(-1)[1].p_name, 'Saved brand')
    claim = { creator_id: 'other', status: 'verified' }
    await assert.rejects(importExternalBrand(user, { brandId }, db, collect), { status: 403 })
    brand = null
    await assert.rejects(importExternalBrand(user, { brandId }, db, collect), { status: 404 })
    assert.equal(fetches, 1)
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = previous
  }
})
