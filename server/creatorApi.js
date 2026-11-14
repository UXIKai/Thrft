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
    path.startsWith('/api/checkout/') || ['/api/webhooks/stripe', '/api/webhooks/printful'].includes(path)
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
    if (path === '/api/creator/products' && req.method === 'GET') {
      let query = getAdminSupabase().from('brand_products').select('*').eq('status', 'active')
      if (url.searchParams.get('brand')) query = query.eq('brand', url.searchParams.get('brand'))
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
    if (path === '/api/creator/me/orders' && req.method === 'GET') {
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
    if (['PGRST205', '42P01'].includes(error.code) && /creator_order_items/.test(error.message)) {
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
