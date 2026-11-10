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

const NIKE_SEED_KEY = 'thrft-closet-nike-seed-v1'

const NIKE_STARTER_ITEMS = [
  ['Tees', 'Nike Sportswear Club Tee', '30'],
  ['Tees', 'Nike Dri-FIT Training Tee', '35'],
  ['Hoodies', 'Nike Sportswear Club Fleece Hoodie', '65'],
  ['Hoodies', 'Nike Tech Fleece Full-Zip Hoodie', '120'],
  ['Pants', 'Nike Tech Fleece Joggers', '110'],
  ['Pants', 'Nike Club Fleece Sweatpants', '60'],
  ['Shorts', 'Nike Dri-FIT Challenger Shorts', '40'],
  ['Shorts', 'Nike Flex Stride Running Shorts', '45'],
  ['Jackets', 'Nike Windrunner Jacket', '100'],
  ['Jackets', 'Nike Sportswear Club Bomber', '90'],
  ['Tanks', 'Nike Dri-FIT Legend Tank', '28'],
  ['Sneakers', 'Nike Air Force 1 07', '115'],
  ['Sneakers', 'Nike Air Max 90', '130'],
  ['Sneakers', 'Nike Dunk Low', '120'],
  ['Hats', 'Nike Heritage86 Cap', '28'],
  ['Bags', 'Nike Brasilia Duffel Bag', '55'],
]

function seedNikeItems() {
  try {
    if (localStorage.getItem(NIKE_SEED_KEY)) return
    localStorage.setItem(NIKE_SEED_KEY, '1')
  } catch {
    return
  }
  const now = Date.now()
  const seeded = NIKE_STARTER_ITEMS.map(([category, title, price], i) => ({
    id: `closet-nike-${i + 1}`,
    brand: 'Nike',
    category,
    title,
    price,
    imageUrl: '',
    scanned: false,
    backgroundRemoved: false,
    createdAt: new Date(now - i * 1000).toISOString(),
  }))
  writeAll([...readAll(), ...seeded])
}

export function fetchClosetItems() {
  seedNikeItems()
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
      color: item.color || '',
      partNumber: item.partNumber || '',
      createdAt: item.createdAt || new Date().toISOString(),
    },
    ...readAll(),
  ]
  writeAll(next)
  if (!readAll().some((stored) => stored.id === next[0].id)) {
    throw new Error('Could not save this item. Your device storage may be full.')
  }
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
    let hasTransparency = false
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (data[(y * w + x) * 4 + 3] > 24) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        } else {
          hasTransparency = true
        }
      }
    }
    if (maxX < 0) throw new Error('No clothing found. Try a clearer photo.')
    if (!hasTransparency) throw new Error('The background could not be separated. Try a clearer photo.')
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

/** Normalize camera orientation before sending pixels to the cutout model. */
async function orientedPhoto(file) {
  const { img, url } = await blobToImage(file)
  try {
    const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare photo')), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Cuts clothing out with the AI model; failures are reported to the scanner. */
export async function removeImageBackground(file) {
  if (!file) throw new Error('No image')
  try {
    const { removeBackground } = await import('@imgly/background-removal')
    const blob = await removeBackground(await orientedPhoto(file))
    return await cropToItem(blob)
  } catch (error) {
    throw new Error(`Could not remove the background. Check your connection and try a clear photo. ${error?.message || ''}`, { cause: error })
  }
}

/** Fit a straightened cutout into its frame without clipping the item. */
export async function scaleCutout(dataUrl, scale, angle = 0) {
  if (!dataUrl || (Math.abs(scale - 1) < 0.01 && angle === 0)) return dataUrl
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Could not read image'))
    i.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const radians = angle * Math.PI / 180
  const rotatedWidth = Math.abs(img.width * Math.cos(radians)) + Math.abs(img.height * Math.sin(radians))
  const rotatedHeight = Math.abs(img.width * Math.sin(radians)) + Math.abs(img.height * Math.cos(radians))
  const fit = Math.min(canvas.width / rotatedWidth, canvas.height / rotatedHeight)
  const zoom = Math.min(1, Math.max(0.4, scale))
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(radians)
  ctx.scale(fit * zoom, fit * zoom)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
  return canvas.toDataURL('image/png')
}
