import { getSupabase } from './supabase.js'

export async function uploadCreatorArtwork(file) {
  const db = getSupabase()
  if (!db) throw new Error('Supabase Storage is not configured')
  if (!file || !['image/png', 'image/jpeg'].includes(file.type) || file.size > 20 * 1024 * 1024) {
    throw new Error('Choose a PNG or JPEG artwork file up to 20 MB')
  }

  const { data, error: authError } = await db.auth.getUser()
  if (authError) throw authError
  if (!data.user) throw new Error('Sign in before uploading artwork')
  const path = `${data.user.id}/${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`
  const { error } = await db.storage.from('Thrft').upload(path, file, {
    contentType: file.type, upsert: false,
  })
  if (error) throw error
  return db.storage.from('Thrft').getPublicUrl(path).data.publicUrl
}

export async function uploadProductPhoto(source) {
  if (typeof source !== 'string' || !source.startsWith('data:image/')) {
    throw new Error('Choose a product photo before posting.')
  }
  const response = await fetch(source)
  if (!response.ok) throw new Error('Could not read the product photo.')
  const blob = await response.blob()
  return uploadCreatorArtwork(new File([blob], 'product.png', { type: blob.type }))
}
