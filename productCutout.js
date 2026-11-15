/** Apply only the silhouette alpha; garment colors come from the original photo. */
export function applyProductMask(source, mask) {
  if (source.width !== mask.width || source.height !== mask.height ||
      source.data.length !== mask.data.length) throw new Error('Product mask dimensions do not match')
  const output = new Uint8ClampedArray(source.data)
  for (let i = 0; i < output.length; i += 4) {
    const alpha = mask.data[i + 3]
    // Remove faint background haze, keeping confident fabric fully opaque.
    const coverage = Math.min(1, Math.max(0, (alpha - 16) / (240 - 16)))
    output[i + 3] = Math.round(source.data[i + 3] * coverage)
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
  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read product photo'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally { URL.revokeObjectURL(url) }
}

export async function cutoutProductPhoto(blob, segment) {
  const canvas = await canvasFromBlob(blob)
  const ctx = canvas.getContext('2d')
  const source = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let transparent = 0
  for (let i = 3; i < source.data.length; i += 4) if (source.data[i] === 0) transparent++
  // Do not remask existing transparent product artwork.
  if (transparent / (canvas.width * canvas.height) > 0.03) return canvas.toDataURL('image/png')
  const normalized = await new Promise((resolve, reject) => canvas.toBlob(
    (image) => image ? resolve(image) : reject(new Error('Could not prepare product photo')), 'image/png'))
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
  return canvas.toDataURL('image/png')
}
