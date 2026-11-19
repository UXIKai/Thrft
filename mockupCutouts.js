const CACHE_NAME = 'thrft-mockup-cutouts-v10'
// Only photos that are already PNGs skip removal; a .jpg/.jpeg from any feed is always processed.
function isPngUrl(url) {
  try { return /\.png$/i.test(new URL(url, globalThis.location?.href).pathname) } catch { return false }
}
let worker
let idleTimer

function processInWorker(image) {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return Promise.reject(new Error('Background removal needs browser worker and canvas support; showing original photo'))
  }
  clearTimeout(idleTimer)
  worker ||= new Worker(new URL('./productCutout.worker.js', import.meta.url), { type: 'module' })
  return new Promise((resolve, reject) => {
    const current = worker
    const timeout = setTimeout(() => fail(new Error('Product background removal timed out')), 120000)
    function finish() {
      clearTimeout(timeout)
      current.onmessage = null
      current.onerror = null
      idleTimer = setTimeout(() => { current.terminate(); if (worker === current) worker = null }, 30000)
    }
    function fail(error) {
      finish()
      current.terminate()
      if (worker === current) worker = null
      reject(error)
    }
    current.onerror = () => fail(new Error('Product image worker failed; showing original photo'))
    current.onmessage = ({ data }) => {
      if (data.error) { fail(new Error(data.error)); return }
      if (!(data.image instanceof Blob)) { fail(new Error('Product image worker returned an invalid image')); return }
      finish()
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Could not read product cutout'))
      reader.readAsDataURL(data.image)
    }
    current.postMessage({ image })
  })
}

async function cacheRead(url) {
  if (!globalThis.caches) return null
  const cache = await caches.open(CACHE_NAME)
  const response = await cache.match(url)
  return response ? response.text() : null
}

async function cacheWrite(url, image) {
  if (!globalThis.caches) return
  const cache = await caches.open(CACHE_NAME)
  await cache.put(url, new Response(image, { headers: { 'Content-Type': 'text/plain' } }))
}

// Cross-origin photos (Shopify/Printful CDNs) are fetched through our backend to avoid CORS blocks.
async function fetchMockup(url) {
  const options = { mode: 'cors', signal: AbortSignal.timeout(20000) }
  let remote = false
  try { remote = new URL(url, globalThis.location?.href).origin !== globalThis.location?.origin } catch { /* relative */ }
  if (!remote) return fetch(url, options)
  try {
    const direct = await fetch(url, options)
    if (direct.ok) return direct
    console.warn('Direct photo fetch failed, using proxy:', url, direct.status)
  } catch (error) {
    console.warn('Direct photo fetch blocked (CORS?), using proxy:', url, error)
  }
  return fetch(`/api/brands/proxy?url=${encodeURIComponent(url)}`, { ...options, signal: AbortSignal.timeout(20000) })
}

// Shopify/Printful images are served as native PNGs: pass straight through, no processing.
export function isBypassUrl(url) {
  try {
    const parsed = new URL(url, globalThis.location?.href)
    return parsed.searchParams.get('raw') === '1' ||
      /(^|\.)(shopify\.com|myshopify\.com|shopifycdn\.com|printful\.com)$/.test(parsed.hostname.toLowerCase())
  } catch { return false }
}

async function processMockup(url) {
  if (isPngUrl(url) || isBypassUrl(url)) return url
  const response = await fetchMockup(url)
  if (!response.ok) throw new Error(`Could not load mockup (${response.status})`)
  const image = await response.blob()
  if (!image.type.startsWith('image/')) throw new Error('Mockup is not an image')
  return processInWorker(image)
}

export function createCutoutLoader({ process, read, write }) {
  const pending = new Map()
  const memory = new Map()
  let queue = Promise.resolve()

  function remember(url, image) {
    memory.delete(url)
    memory.set(url, image)
    if (memory.size > 12) memory.delete(memory.keys().next().value)
  }

  return function acquire(url) {
    if (memory.has(url)) {
      const image = memory.get(url)
      remember(url, image)
      return { promise: Promise.resolve(image), release() {} }
    }
    let task = pending.get(url)
    if (!task) {
      task = { users: 0 }
      task.promise = Promise.resolve().then(async () => {
        if (!task.users) return null
        let image
        try {
          image = await read(url)
        } catch (error) {
          console.warn('Could not read cached product cutout:', error)
        }
        if (!image) {
          const processTask = queue.then(async () => {
            if (!task.users) return null
            const result = await process(url)
            try {
              await write(url, result)
            } catch (error) {
              console.warn('Could not cache product cutout:', error)
            }
            return result
          })
          queue = processTask.catch(() => {})
          image = await processTask
        }
        if (image) remember(url, image)
        return image || null
      })
      pending.set(url, task)
      task.promise.then(() => pending.delete(url), () => pending.delete(url))
    }
    task.users++
    let released = false
    return { promise: task.promise, release() {
      if (!released) { released = true; task.users-- }
    } }
  }
}

export const acquireMockupCutout = createCutoutLoader({
  process: processMockup, read: cacheRead, write: cacheWrite,
})

export function hasPrintfulMockup(product) {
  return Boolean(product?.printfulVariantId || product?.printful_variant_id ||
    product?.printfulVariants?.length || product?.printful_variants?.length)
}

export function hasProductCutout(product) {
  return hasPrintfulMockup(product) || Boolean(product?.externalUrl || product?.external_url)
}
