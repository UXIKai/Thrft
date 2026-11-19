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

export function productFrame({ data, width, height }) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!data[(y * width + x) * 4 + 3]) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left) throw new Error('Product image has no visible pixels')
  const cropWidth = right - left + 1
  const cropHeight = bottom - top + 1
  const padding = Math.max(2, Math.ceil(Math.max(cropWidth, cropHeight) * 0.06))
  return { left, top, width: cropWidth, height: cropHeight, padding }
}

function framedPng(canvas, pixels) {
  const frame = productFrame(pixels)
  const width = frame.width + frame.padding * 2
  const height = frame.height + frame.padding * 2
  const scale = Math.min(1, 1024 / Math.max(width, height))
  const output = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(Math.ceil(width * scale), Math.ceil(height * scale))
    : Object.assign(document.createElement('canvas'), {
      width: Math.ceil(width * scale), height: Math.ceil(height * scale),
    })
  const ctx = output.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, frame.left, frame.top, frame.width, frame.height,
    frame.padding * scale, frame.padding * scale, frame.width * scale, frame.height * scale)
  return pngBlob(output)
}

/** True when the photo already carries real transparency (a transparent PNG/WebP). */
export function hasTransparency({ data }) {
  let transparent = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transparent++
  return transparent / (data.length / 4) > 0.005
}

/**
 * Returns the original blob untouched when the photo is already transparent. Otherwise the
 * segmentation model's own soft-alpha output is used as is, only cropped to the product.
 */
export async function cutoutProductPhoto(blob, segment) {
  const canvas = await canvasFromBlob(blob)
  const ctx = canvas.getContext('2d')
  if (hasTransparency(ctx.getImageData(0, 0, canvas.width, canvas.height))) return blob
  const cut = await canvasFromBlob(await segment(await pngBlob(canvas)))
  const pixels = cut.getContext('2d').getImageData(0, 0, cut.width, cut.height)
  return framedPng(cut, pixels)
}
