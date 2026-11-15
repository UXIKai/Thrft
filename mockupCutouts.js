import { cutoutProductPhoto } from './productCutout.js'

const CACHE_NAME = 'thrft-mockup-cutouts-v3'

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

async function processMockup(url) {
  const response = await fetch(url, { mode: 'cors' })
  if (!response.ok) throw new Error(`Could not load mockup (${response.status})`)
  const image = await response.blob()
  if (!image.type.startsWith('image/')) throw new Error('Mockup is not an image')
  return cutoutProductPhoto(image, async (photo) => {
    const { segmentForeground } = await import('@imgly/background-removal')
    return segmentForeground(photo, { model: 'medium', output: { format: 'image/png', quality: 1 } })
  })
}

export function createCutoutLoader({ process, read, write }) {
  const pending = new Map()
  const memory = new Map()
  let queue = Promise.resolve()

  function remember(url, image) {
    memory.delete(url)
    memory.set(url, image)
    if (memory.size > 24) memory.delete(memory.keys().next().value)
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
      task.promise = queue.then(async () => {
        if (!task.users) return null
        let image
        try {
          image = await read(url)
        } catch (error) {
          console.warn('Could not read cached product cutout:', error)
        }
        if (!image && task.users) {
          image = await process(url)
          try {
            await write(url, image)
          } catch (error) {
            console.warn('Could not cache product cutout:', error)
          }
        }
        if (image) remember(url, image)
        return image || null
      })
      queue = task.promise.catch(() => {})
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
