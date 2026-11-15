import { randomUUID } from 'node:crypto'
import { getAdminSupabase, requireCreator, requireArtworkUrl } from './supabaseStore.js'
import { mapCreatorProduct, selectCatalogVariants, storedPrintfulVariants } from '../creatorProducts.js'
import {
  getPrintfulConfig, checkPrintfulConnection, listCatalogProducts, getCatalogProduct,
  getPrintfileLayout, createMockupTask, getMockupTask, handlePrintfulWebhook,
} from '../printful.js'
import { createCheckoutSession, estimateCheckout, getCheckoutSession, handleStripeWebhook,
  getStripeCheckoutConfig } from '../stripeCheckout.js'
import { fetchPublicAccount, fetchSocialProfile, saveSocialProfile,
  fetchSocialSaved, saveSocialSaved, fetchLeaderboard } from './socialStore.js'
import { fetchOrders } from './orders.js'
import { collectExternalProducts } from './externalBrands.js'
import { fetchPublicHttps, publicHttpsUrl } from './publicHttps.js'
import { websiteDomain, requireVerifiedDomain, createVerificationChallenge, verifyDomain } from './brandVerification.js'
import { saveShopifyConnection } from './shopifySync.js'

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status })
}

function checked({ data, error }) {
  if (error) throw error
  return data
}

export async function readRawBody(req) {
  const chunks = []
  let length = 0
  for await (const chunk of req) {
    length += chunk.length
    if (length > 1024 * 1024) fail('Request body is too large', 413)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readBody(req) {
  try {
    const body = JSON.parse((await readRawBody(req)).toString('utf8') || '{}')
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Expected a JSON object')
    return body
  } catch (error) {
    if (error instanceof SyntaxError) fail('Invalid JSON')
    throw error
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

function creatorIdentity(user) {
  const meta = user.user_metadata || {}
  const emailLocal = String(user.email || '').split('@')[0]
  const name = meta.displayName || meta.full_name || meta.name || emailLocal
  return { creator_username: String(meta.username || emailLocal || name)
    .toLowerCase().replace(/[^a-z0-9_]+/g, '').slice(0, 24), creator_name: name }
}

export async function importExternalBrand(user, body, db, collect = collectExternalProducts) {
  if (body.brandId !== undefined) {
    if (typeof body.brandId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.brandId)) fail('Invalid brand ID')
    const brand = checked(await db.from('external_brands').select('name,logo_url,site_origin')
      .eq('id', body.brandId).eq('creator_id', user.id).maybeSingle())
    if (!brand) fail('Brand not found', 404)
    body = { brandName: brand.name, logoUrl: brand.logo_url, websiteUrl: brand.site_origin }
  }
  const brandName = typeof body.brandName === 'string' ? body.brandName.trim() : ''
  if (!brandName || brandName.length > 80) fail('Enter a brand name of up to 80 characters')
  const logoUrl = requireArtworkUrl(body.logoUrl, user.id)
  if (typeof body.websiteUrl !== 'string' || body.websiteUrl.length > 2048) fail('Enter a valid website URL')
  const websiteUrl = publicHttpsUrl(body.websiteUrl)
  const domain = websiteDomain(websiteUrl.href)
  await requireVerifiedDomain(db, user.id, domain)
  websiteUrl.hostname = domain
  const catalog = await collect(websiteUrl.href, (url) => fetchPublicHttps(url, { allowedHostname: domain }))
  if (catalog.origin !== `https://${domain}` || catalog.products.some((product) =>
    websiteDomain(product.external_url) !== domain)) fail('Catalog must belong to the verified domain', 403)
  const identity = creatorIdentity(user)
  const count = checked(await db.rpc('sync_external_brand', {
    p_creator_id: user.id, p_creator_username: identity.creator_username, p_creator_name: identity.creator_name,
    p_origin: catalog.origin, p_name: brandName, p_logo_url: logoUrl,
    p_products: catalog.products, p_complete: catalog.complete,
  }))
  return { imported: count, complete: catalog.complete }
}

export async function fetchExternalBrandSettings(user, db) {
  const [brands, claims, connections] = await Promise.all([
    db.from('external_brands').select('id,name,site_origin,flat_shipping_cents')
      .eq('creator_id', user.id).order('name'),
    db.from('brand_domain_claims').select('domain').eq('creator_id', user.id).eq('status', 'verified'),
    db.from('external_brand_shopify').select('brand_id,shop').eq('creator_id', user.id),
  ])
  const verified = new Set(checked(claims).map((claim) => `https://${claim.domain}`))
  const shops = new Map(checked(connections).map((connection) => [connection.brand_id, connection.shop]))
  return checked(brands).filter((brand) => verified.has(brand.site_origin)).map((brand) => ({
    id: brand.id, name: brand.name, domain: new URL(brand.site_origin).hostname,
    flatShippingCents: brand.flat_shipping_cents,
    shopifyConnected: shops.has(brand.id), shopifyShop: shops.get(brand.id) || '',
  }))
}

export async function saveExternalBrandShipping(user, brandId, amount, db) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brandId)) fail('Invalid brand ID')
  if (!Number.isInteger(amount) || amount < 0 || amount > 10000000) fail('Enter a valid shipping amount')
  const result = await db.rpc('set_external_brand_shipping', {
    p_brand_id: brandId, p_creator_id: user.id, p_amount_cents: amount,
  })
  if (result.error?.code === '42501') fail('Verified brand not found', 404)
  checked(result)
  return { flatShippingCents: amount }
}

export function mockupFiles(layout, variantId, placement, artworkUrl, dimensions) {
  const variant = layout.variant_printfiles?.find((entry) => entry.variant_id === variantId)
  const printfile = layout.printfiles?.find((entry) => entry.printfile_id === variant?.placements?.[placement])
  if (!printfile) fail('This blank variant does not support the selected print placement')
  const imageWidth = Number(dimensions?.width ?? printfile.width)
  const imageHeight = Number(dimensions?.height ?? printfile.height)
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) ||
      imageWidth <= 0 || imageHeight <= 0 || imageWidth > 30000 || imageHeight > 30000) {
    fail('Artwork dimensions are invalid')
  }
  const scale = Math.min(printfile.width / imageWidth, printfile.height / imageHeight)
  const width = Math.round(imageWidth * scale)
  const height = Math.round(imageHeight * scale)
  return [{ placement, image_url: artworkUrl, position: {
    area_width: printfile.width, area_height: printfile.height,
    width, height, top: Math.round((printfile.height - height) / 2),
    left: Math.round((printfile.width - width) / 2),
  } }]
}

async function saveMockupImages(db, task, urls) {
  return Promise.all(urls.map(async (url) => {
    if (!/^https:\/\//.test(url)) throw new Error('Printful returned an invalid mockup URL')
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`Could not download Printful mockup (${response.status})`)
    const type = response.headers.get('content-type')?.split(';')[0]
    if (!['image/jpeg', 'image/png'].includes(type)) throw new Error('Printful mockup is not an image')
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > 20 * 1024 * 1024) throw new Error('Printful mockup exceeds 20 MB')
    const path = `${task.creator_id}/mockups/${randomUUID()}.${type === 'image/png' ? 'png' : 'jpg'}`
    const { error } = await db.storage.from('Thrft').upload(path, bytes, { contentType: type })
    if (error) throw error
    return db.storage.from('Thrft').getPublicUrl(path).data.publicUrl
  }))
}

export function isCreatorApiPath(path) {
  return path.startsWith('/api/creator/') || path.startsWith('/api/printful/') ||
    path.startsWith('/api/checkout/') || path.startsWith('/api/brands/') ||
    ['/api/webhooks/stripe', '/api/webhooks/printful'].includes(path)
}

export async function handleCreatorApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname
  if (!isCreatorApiPath(path)) return false
  try {
    if (path === '/api/webhooks/stripe' && req.method === 'POST') {
      send(res, 200, await handleStripeWebhook(await readRawBody(req), req.headers['stripe-signature']))
      return true
    }
    if (path === '/api/webhooks/printful' && req.method === 'POST') {
      send(res, 200, await handlePrintfulWebhook(await readBody(req), url.searchParams.get('token')))
      return true
    }
    if (path === '/api/checkout/config' && req.method === 'GET') {
      send(res, 200, getStripeCheckoutConfig())
      return true
    }
    if (path === '/api/brands/image' && req.method === 'GET') {
      const id = url.searchParams.get('id') || ''
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) fail('Invalid product ID')
      const product = checked(await getAdminSupabase().from('brand_products').select('photo_url,external_brand_id')
        .eq('id', id).eq('status', 'active').maybeSingle())
      if (!product?.external_brand_id || !product.photo_url) fail('Product image not found', 404)
      const image = await fetchPublicHttps(product.photo_url, { maxBytes: 5 * 1024 * 1024 })
      const type = String(image.headers['content-type'] || '').split(';')[0].toLowerCase()
      if (image.status !== 200 || !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(type)) {
        fail('Could not load product image', 502)
      }
      res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=3600' })
      res.end(image.body)
      return true
    }
    if (path === '/api/creator/products' && req.method === 'GET') {
      let query = getAdminSupabase().from('brand_products').select('*').eq('status', 'active')
      const externalBrandId = url.searchParams.get('externalBrandId')
      if (externalBrandId) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(externalBrandId)) fail('Invalid brand ID')
        query = query.eq('external_brand_id', externalBrandId)
      } else if (url.searchParams.get('brand')) query = query.eq('brand', url.searchParams.get('brand'))
      send(res, 200, { products: checked(await query.order('created_at', { ascending: false }).limit(240))
        .map(mapCreatorProduct) })
      return true
    }
    const accountMatch = path.match(/^\/api\/creator\/accounts\/([^/]+)$/)
    if (accountMatch && req.method === 'GET') {
      send(res, 200, await fetchPublicAccount(decodeURIComponent(accountMatch[1])))
      return true
    }
    if (path === '/api/creator/leaderboard' && req.method === 'GET') {
      send(res, 200, { profiles: await fetchLeaderboard() })
      return true
    }
    const user = await requireCreator(req)
    const db = getAdminSupabase()
    if (path === '/api/brands/settings' && req.method === 'GET') {
      send(res, 200, { brands: await fetchExternalBrandSettings(user, db) })
    } else if (/^\/api\/brands\/settings\/[^/]+\/shopify$/.test(path) && req.method === 'PUT') {
      send(res, 200, await saveShopifyConnection(db, user, path.split('/').at(-2), await readBody(req)))
    } else if (/^\/api\/brands\/settings\/[^/]+$/.test(path) && req.method === 'PUT') {
      const body = await readBody(req)
      send(res, 200, await saveExternalBrandShipping(user, path.split('/').at(-1), body.flatShippingCents, db))
    } else if (path === '/api/brands/verify-challenge' && req.method === 'POST') {
      const body = await readBody(req)
      send(res, 200, await createVerificationChallenge(db, user.id, body.domain))
    } else if (path === '/api/brands/verify-domain' && req.method === 'POST') {
      const body = await readBody(req)
      send(res, 200, await verifyDomain(db, user.id, body.domain, body.method))
    } else if (path === '/api/brands/import-url' && req.method === 'POST') {
      send(res, 200, await importExternalBrand(user, await readBody(req), db))
    } else if (path === '/api/creator/me/orders' && req.method === 'GET') {
      send(res, 200, { items: await fetchOrders(user.id, url.searchParams.get('kind')) })
    } else if (path === '/api/creator/me/profile' && req.method === 'GET') {
      send(res, 200, await fetchSocialProfile(user))
    } else if (path === '/api/creator/me/profile' && req.method === 'PUT') {
      send(res, 200, await saveSocialProfile(user, await readBody(req)))
    } else if (path === '/api/creator/me/saved' && req.method === 'GET') {
      send(res, 200, { items: await fetchSocialSaved(user.id) })
    } else if (path === '/api/creator/me/saved' && req.method === 'PUT') {
      send(res, 200, { items: await saveSocialSaved(user.id, (await readBody(req)).items) })
    } else if (path === '/api/printful/status' && req.method === 'GET') {
      send(res, 200, { ...getPrintfulConfig(), ...(await checkPrintfulConnection()) })
    } else if (path === '/api/printful/products' && req.method === 'GET') {
      send(res, 200, { products: await listCatalogProducts() })
    } else if (/^\/api\/printful\/products\/\d+$/.test(path) && req.method === 'GET') {
      send(res, 200, await getCatalogProduct(path.split('/').at(-1)))
    } else if (path === '/api/printful/mockups' && req.method === 'POST') {
      const body = await readBody(req)
      const productId = Number(body.product_id)
      if (!Number.isInteger(productId) || productId < 1) fail('Choose a blank garment')
      const ids = Array.isArray(body.variant_ids) ? body.variant_ids.map(Number) : [Number(body.variant_id)]
      const artworkUrl = requireArtworkUrl(body.artwork_url, user.id)
      const catalog = await getCatalogProduct(productId)
      const variants = selectCatalogVariants(catalog, ids)
      const placement = body.placement || 'front'
      const layout = await getPrintfileLayout(productId)
      const layouts = variants.map((variant) =>
        mockupFiles(layout, variant.variant_id, placement, artworkUrl, body.artwork_dimensions))
      const task = await createMockupTask(productId, { variantIds: ids, files: layouts[0] })
      if (!task?.task_key) throw new Error('Printful did not return a mockup task key')
      checked(await db.from('creator_mockup_tasks').insert({
        task_key: task.task_key, creator_id: user.id, product_id: productId,
        variant_id: variants[0].variant_id, artwork_url: artworkUrl, placement,
        size: variants[0].size, color: variants[0].color, printful_variants: variants,
      }))
      send(res, 202, { task_key: task.task_key, status: task.status || 'pending', variants })
    } else if (path.startsWith('/api/printful/mockups/') && req.method === 'GET') {
      const key = decodeURIComponent(path.split('/').at(-1))
      const task = checked(await db.from('creator_mockup_tasks').select('*')
        .eq('task_key', key).eq('creator_id', user.id).maybeSingle())
      if (!task) fail('Mockup task not found', 404)
      if (task.status === 'completed') {
        send(res, 200, { task_key: key, status: task.status, mockup_urls: task.mockup_urls,
          variants: storedPrintfulVariants(task) })
      } else {
        const result = await getMockupTask(key)
        if (result.status === 'failed') fail(result.error || 'Printful mockup generation failed', 422)
        let mockups = []
        if (result.status === 'completed') {
          const urls = [...new Set((result.mockups || []).flatMap((mockup) =>
            [mockup.mockup_url, ...(mockup.extra || []).map((extra) => extra.url)]).filter(Boolean))]
          if (!urls.length) throw new Error('Printful completed the task without mockup images')
          // Printful task images expire; keep published mockups in Thrft Storage.
          mockups = await saveMockupImages(db, task, urls.slice(0, 8))
          checked(await db.from('creator_mockup_tasks').update({
            status: 'completed', mockup_urls: mockups,
          }).eq('task_key', key).eq('creator_id', user.id))
        }
        send(res, 200, { task_key: key, status: result.status, mockup_urls: mockups,
          variants: storedPrintfulVariants(task) })
      }
    } else if (path === '/api/creator/me/products' && req.method === 'GET') {
      let query = db.from('brand_products').select('*').eq('creator_id', user.id)
      if (url.searchParams.get('status')) query = query.eq('status', url.searchParams.get('status'))
      const rows = checked(await query.order('created_at', { ascending: false }))
      send(res, 200, { products: rows.map(mapCreatorProduct) })
    } else if (path === '/api/creator/products' && req.method === 'POST') {
      const body = await readBody(req)
      const title = String(body.title || '').trim()
      const price = Number(body.price)
      if (!title || title.length > 120 || !Number.isFinite(price) || price < 0.5 || price > 99999999) {
        fail('Add a title and a valid price of at least $0.50')
      }
      let fulfillment = {}
      if (body.mockup_task_key) {
        const task = checked(await db.from('creator_mockup_tasks').select('*')
          .eq('task_key', body.mockup_task_key).eq('creator_id', user.id).maybeSingle())
        if (!task || task.status !== 'completed' || !task.mockup_urls.length) fail('Generate mockups before publishing')
        fulfillment = { printful_product_id: task.product_id, printful_variant_id: task.variant_id,
          printful_placement: task.placement, artwork_url: task.artwork_url,
          mockup_urls: task.mockup_urls, size: task.size, color: task.color,
          printful_variants: storedPrintfulVariants(task) }
      } else if (body.artwork_url || body.printful_variant_id || body.printful_variants) {
        fail('Publish using a completed mockup task')
      }
      const product = checked(await db.from('brand_products').insert({
        creator_id: user.id, ...creatorIdentity(user), title, price: Math.round(price * 100) / 100,
        brand: String(body.brand || '').slice(0, 80), category: String(body.category || '').slice(0, 80),
        description: String(body.description || '').slice(0, 2000),
        materials: String(body.materials || '').slice(0, 2000),
        photo_url: body.photoUrl ? requireArtworkUrl(body.photoUrl, user.id) : '',
        ...fulfillment,
      }).select().single())
      send(res, 201, { product: mapCreatorProduct(product) })
    } else if (/^\/api\/creator\/products\/[^/]+$/.test(path) && req.method === 'PUT') {
      const body = await readBody(req)
      if (!['active', 'sold', 'archived'].includes(body.status)) fail('Invalid product status')
      const row = checked(await db.from('brand_products').update({ status: body.status })
        .eq('id', path.split('/').at(-1)).eq('creator_id', user.id).select().maybeSingle())
      if (!row) fail('Product not found', 404)
      send(res, 200, { product: mapCreatorProduct(row) })
    } else if (path === '/api/checkout/estimate' && req.method === 'POST') {
      send(res, 200, await estimateCheckout(await readBody(req)))
    } else if (['/api/checkout/session', '/api/checkout/create'].includes(path) && req.method === 'POST') {
      send(res, 200, await createCheckoutSession(await readBody(req), { accountKey: user.id }))
    } else if (path.startsWith('/api/checkout/session/') && req.method === 'GET') {
      const session = await getCheckoutSession(decodeURIComponent(path.split('/').at(-1)), user.id)
      if (!session) fail('Checkout not found', 404)
      send(res, 200, session)
    } else {
      fail('API route not found', 404)
    }
  } catch (error) {
    console.error('[creator-api]', error.message)
    if (error.code === '42501' && /[Vv]erify ownership|verified domain|Verification challenge/.test(error.message)) {
      send(res, 403, { message: error.message })
    } else if (['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42703'].includes(error.code) &&
        /sync_external_brand|external_brand|external_shopify|external_shipping|flat_shipping_cents|external_url|external_sizes|external_variants|external_currency|brand_logo_url|external_synced_at|brand_domain|claim_brand_domain/.test(error.message)) {
      send(res, 503, { message: 'Run supabase/external-brands.sql to enable website imports.' })
    } else if (['PGRST205', '42P01'].includes(error.code) && /creator_order_items/.test(error.message)) {
      send(res, 503, { message: 'Run supabase/orders.sql to enable Orders.' })
    } else if (['PGRST205', '42P01'].includes(error.code) && /creator_(profiles|public_profiles|profile_preferences|saved_products|leaderboard)/.test(error.message)) {
      send(res, 503, { message: 'Run supabase/social.sql to enable profiles, Saved, and the Leaderboard.' })
    } else if (error.code === 'PGRST204' && /printful_variants|recipient|shipping_rate|tracking_number|tracking_url|shipments/.test(error.message)) {
      send(res, 503, { message: 'Run supabase/creator-pipeline.sql to update the creator and checkout tables, then retry.' })
    } else {
      send(res, error.status || 500, { message: error.message || 'Creator API request failed' })
    }
  }
  return true
}
