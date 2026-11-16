/** Keep uncertain interior fabric opaque instead of tinting it with the page. */
export function applyProductMask(source, mask) {
  if (source.width !== mask.width || source.height !== mask.height ||
      source.data.length !== mask.data.length) throw new Error('Product mask dimensions do not match')
  const output = new Uint8ClampedArray(source.data)
  const { width, height } = source
  const count = width * height
  const silhouette = new Uint8Array(count)
  const visited = new Uint8Array(count)
  const queue = new Uint32Array(count)
  for (let pixel = 0; pixel < count; pixel++) {
    silhouette[pixel] = mask.data[pixel * 4 + 3] >= 96 ? 1 : 0
  }
  const corners = [0, width - 1, count - width, count - 1]
  const whiteBackdrop = corners.every((pixel) => {
    const i = pixel * 4
    return source.data[i + 3] > 250 && Math.min(...source.data.subarray(i, i + 3)) >= 240
  })
  const isBackdrop = (pixel) => {
    const i = pixel * 4
    return whiteBackdrop && corners.every((corner) => {
      const j = corner * 4
      return Math.max(Math.abs(source.data[i] - source.data[j]),
        Math.abs(source.data[i + 1] - source.data[j + 1]),
        Math.abs(source.data[i + 2] - source.data[j + 2])) <= 12
    })
  }
  // Fill mask holes caused by garment texture, but retain clearly identified
  // white background openings (between handles or sleeves, for example).
  for (let pixel = 0; pixel < count; pixel++) {
    if (visited[pixel] || silhouette[pixel]) continue
    let head = 0
    let tail = 1
    let edge = false
    let backdrop = 0
    let confidence = 0
    queue[0] = pixel
    visited[pixel] = 1
    const add = (next) => {
      if (!visited[next] && !silhouette[next]) { visited[next] = 1; queue[tail++] = next }
    }
    while (head < tail) {
      const next = queue[head++]
      const x = next % width
      if (x === 0 || x === width - 1 || next < width || next >= count - width) edge = true
      if (isBackdrop(next)) backdrop++
      confidence += mask.data[next * 4 + 3]
      if (x > 0) add(next - 1)
      if (x < width - 1) add(next + 1)
      if (next >= width) add(next - width)
      if (next < count - width) add(next + width)
    }
    const opening = backdrop / tail > 0.95 && confidence / tail < 32 && tail > 9
    if (!edge && !opening) for (let j = 0; j < tail; j++) silhouette[queue[j]] = 1
  }
  for (let pixel = 0; pixel < count; pixel++) {
    const i = pixel * 4
    output[i + 3] = silhouette[pixel] ? source.data[i + 3] : 0
    if (!silhouette[pixel]) continue
    const x = pixel % width
    const boundary = (x > 0 && !silhouette[pixel - 1]) ||
      (x < width - 1 && !silhouette[pixel + 1]) ||
      (pixel >= width && !silhouette[pixel - width]) ||
      (pixel < count - width && !silhouette[pixel + width])
    if (boundary) {
      const alpha = mask.data[i + 3]
      output[i + 3] = Math.round(source.data[i + 3] * Math.min(1, Math.max(0, (alpha - 32) / 160)))
    }
  }
  // Edge pixels can contain the old white backdrop. Borrow color only from the
  // nearest opaque fabric, never from other translucent edge pixels.
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4
      if (!output[i + 3] || output[i + 3] === 255) continue
      let closest = Infinity
      let donor = -1
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const distance = dx * dx + dy * dy
          if (distance >= closest || x + dx < 0 || x + dx >= source.width ||
              y + dy < 0 || y + dy >= source.height) continue
          const candidate = ((y + dy) * source.width + x + dx) * 4
          if (output[candidate + 3] === 255) { closest = distance; donor = candidate }
        }
      }
      if (donor >= 0) output.set(source.data.subarray(donor, donor + 3), i)
    }
  }
  return output
}

async function canvasFromBlob(blob) {
  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    const image = await createImageBitmap(blob)
    try {
      const scale = Math.min(1, 1024 / Math.max(image.width, image.height))
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(image.width * scale)),
        Math.max(1, Math.round(image.height * scale)))
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      return canvas
    } finally { image.close() }
  }
  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read product photo'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally { URL.revokeObjectURL(url) }
}

function pngBlob(canvas) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: 'image/png' })
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Could not encode product photo')), 'image/png'))
}

export async function cutoutProductPhoto(blob, segment) {
  const canvas = await canvasFromBlob(blob)
  const ctx = canvas.getContext('2d')
  const source = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let transparent = 0
  for (let i = 3; i < source.data.length; i += 4) if (source.data[i] === 0) transparent++
  // Do not remask existing transparent product artwork.
  if (transparent / (canvas.width * canvas.height) > 0.03) return pngBlob(canvas)
  const normalized = await pngBlob(canvas)
  const maskCanvas = await canvasFromBlob(await segment(normalized))
  if (maskCanvas.width !== canvas.width || maskCanvas.height !== canvas.height) {
    throw new Error('Product mask dimensions do not match')
  }
  const mask = maskCanvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  source.data.set(applyProductMask(source, mask))
  let foreground = 0
  for (let i = 3; i < source.data.length; i += 4) if (source.data[i] > 24) foreground++
  if (!foreground || foreground === canvas.width * canvas.height) {
    throw new Error('Could not separate the product from its background')
  }
  ctx.putImageData(source, 0, 0)
  return pngBlob(canvas)
}
