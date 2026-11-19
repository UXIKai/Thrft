import { cutoutProductPhoto } from './productCutout.js'

// Prefer model files hosted on our own origin (public/imgly); otherwise use imgly's default CDN.
async function imglyPublicPath() {
  const local = `${self.location.origin}/imgly/`
  try {
    const res = await fetch(`${local}resources.json`)
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) return local
  } catch { /* fall through */ }
  console.warn('public/imgly missing; loading background-removal model from staticimgly.com')
  return undefined
}

self.onmessage = async ({ data: { image } }) => {
  try {
    const cutout = await cutoutProductPhoto(image, async (photo) => {
      const { segmentForeground } = await import('@imgly/background-removal')
      const publicPath = await imglyPublicPath()
      return segmentForeground(photo, {
        ...(publicPath ? { publicPath } : {}), model: 'medium',
        output: { format: 'image/png', quality: 1 },
        progress: (key, current, total) => { if (current === total) console.debug('imgly loaded', key) },
      })
    })
    self.postMessage({ image: cutout })
  } catch (error) {
    console.error('Background removal failed:', error)
    self.postMessage({ error: error?.message || String(error) || 'Could not separate the product background' })
  }
}
