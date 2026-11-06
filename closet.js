/**
 * Local digital closet — scanned cutouts organized by brand + type.
 * Items can later be posted to the Market from Profile → Closet.
 */

const CLOSET_KEY = 'thrft-closet-items-v1'

function readAll() {
  try {
    const raw = localStorage.getItem(CLOSET_KEY)
    const list = JSON.parse(raw || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeAll(items) {
  try {
    localStorage.setItem(CLOSET_KEY, JSON.stringify(items))
  } catch {
    /* ignore quota */
  }
  return items
}

export function fetchClosetItems() {
  return readAll()
}

export function saveClosetItems(items) {
  return writeAll(Array.isArray(items) ? items : [])
}

export function addClosetItem(item) {
  const next = [
    {
      id: item.id || `closet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      brand: item.brand || '',
      category: item.category || '',
      title: item.title || '',
      price: String(item.price || '').trim(),
      imageUrl: item.imageUrl || '',
      scanned: Boolean(item.scanned),
      backgroundRemoved: Boolean(item.backgroundRemoved),
      createdAt: item.createdAt || new Date().toISOString(),
    },
    ...readAll(),
  ]
  writeAll(next)
  return next[0]
}

/** Sum of closet item prices (digits / decimals only). */
export function closetTotalWorth(items = readAll()) {
  return (items || []).reduce((sum, item) => {
    const n = parseFloat(String(item?.price || '').replace(/[^0-9.]/g, ''))
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

export function removeClosetItem(id) {
  const next = readAll().filter((item) => item.id !== id)
  writeAll(next)
  return next
}

export function filterClosetItems(items, { brand = '', category = '' } = {}) {
  return (items || []).filter((item) => {
    if (brand && brand !== 'All' && item.brand !== brand) return false
    if (category && category !== 'All' && item.category !== category) return false
    return true
  })
}

/**
 * Rough background removal: sample corner color and punch out similar pixels.
 * Prototype stand-in until a real cutout API is wired.
 */
function removeBackgroundSimple(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No image'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const max = 720
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)
        const { data } = imageData
        const sample = (x, y) => {
          const i = (y * w + x) * 4
          return [data[i], data[i + 1], data[i + 2]]
        }
        const corners = [
          sample(2, 2),
          sample(w - 3, 2),
          sample(2, h - 3),
          sample(w - 3, h - 3),
        ]
        const avg = corners
          .reduce(
            (acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]],
            [0, 0, 0],
          )
          .map((n) => n / corners.length)
        const threshold = 48
        for (let i = 0; i < data.length; i += 4) {
          const dr = data[i] - avg[0]
          const dg = data[i + 1] - avg[1]
          const db = data[i + 2] - avg[2]
          const dist = Math.sqrt(dr * dr + dg * dg + db * db)
          if (dist < threshold) data[i + 3] = 0
        }
        ctx.putImageData(imageData, 0, 0)
        const out = canvas.toDataURL('image/png')
        URL.revokeObjectURL(url)
        resolve(out)
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}

// Crop transparent margins so the item fills the image
async function cropToItem(blob) {
  const { img, url } = await blobToImage(blob)
  try {
    const max = 1024
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    let minX = w
    let minY = h
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (data[(y * w + x) * 4 + 3] > 24) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return canvas.toDataURL('image/png')
    const pad = Math.round(Math.max(w, h) * 0.02)
    const sx = Math.max(0, minX - pad)
    const sy = Math.max(0, minY - pad)
    const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2)
    const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2)
    const out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
    return out.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Cuts the clothing out of a photo (AI model, falls back to color keying). */
export async function removeImageBackground(file) {
  if (!file) throw new Error('No image')
  try {
    const { removeBackground } = await import('@imgly/background-removal')
    const blob = await removeBackground(file)
    return await cropToItem(blob)
  } catch {
    return removeBackgroundSimple(file)
  }
}
