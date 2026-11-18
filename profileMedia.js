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
