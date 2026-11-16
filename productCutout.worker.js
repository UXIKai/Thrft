import { cutoutProductPhoto } from './productCutout.js'

self.onmessage = async ({ data: { image } }) => {
  try {
    const cutout = await cutoutProductPhoto(image, async (photo) => {
      const { segmentForeground } = await import('@imgly/background-removal')
      return segmentForeground(photo, { model: 'medium', output: { format: 'image/png', quality: 1 } })
    })
    self.postMessage({ image: cutout })
  } catch (error) {
    self.postMessage({ error: error.message || 'Could not separate the product background' })
  }
}
