import { uploadProductPhoto } from './artworkStorage.js'
import { isSupabaseConfigured } from './supabase.js'

const key = (owner, kind) => `thrft-profile-${kind}:${owner || 'me'}`

export function readProfileMedia(owner) {
  try {
    const photos = JSON.parse(localStorage.getItem(key(owner, 'photos')) || '[]')
    return {
      photos: Array.isArray(photos) ? photos.filter((p) => typeof p === 'string') : [],
      banner: localStorage.getItem(key(owner, 'banner')) || '',
      bio: localStorage.getItem(key(owner, 'bio')) || '',
    }
  } catch {
    return { photos: [], banner: '', bio: '' }
  }
}

export function writeProfileMedia(owner, kind, value) {
  try {
    localStorage.setItem(key(owner, kind), kind === 'photos' ? JSON.stringify(value) : value)
  } catch {
    throw new Error('Not enough storage to save that photo')
  }
}

// Uploads to storage when configured; otherwise keeps the compressed data URL.
export async function storeImage(dataUrl) {
  return isSupabaseConfigured() ? uploadProductPhoto(dataUrl) : dataUrl
}

export function compressImage(file, maxSize = 600, square = false) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const scale = Math.min(1, maxSize / (square ? side : Math.max(img.width, img.height)))
      const canvas = document.createElement('canvas')
      if (square) {
        canvas.width = canvas.height = Math.max(1, Math.round(side * scale))
        canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
      } else {
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      }
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image_load_failed'))
    }
    img.src = url
  })
}

export function readCaptions(owner) {
  try {
    const map = JSON.parse(localStorage.getItem(key(owner, 'captions')) || '{}')
    return map && typeof map === 'object' ? map : {}
  } catch {
    return {}
  }
}

export function writeCaption(owner, url, caption) {
  const map = readCaptions(owner)
  if (caption) map[url] = caption
  else delete map[url]
  try {
    localStorage.setItem(key(owner, 'captions'), JSON.stringify(map))
  } catch {
    // The photo is saved; only its caption is lost.
  }
}
