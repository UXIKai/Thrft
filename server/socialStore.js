import { getAdminSupabase } from './supabaseStore.js'
import { mapCreatorProduct } from '../creatorProducts.js'

function checked({ data, error }) {
  if (error) throw error
  return data
}

async function productRows(table, ids, columns = '*') {
  const requests = []
  for (let i = 0; i < ids.length; i += 100) {
    requests.push(getAdminSupabase().from(table).select(columns).in('id', ids.slice(i, i + 100)))
  }
  return (await Promise.all(requests)).flatMap(checked)
}

function accountFromRow(row) {
  return { id: row.id, username: row.username, displayName: row.display_name,
    avatarUrl: row.avatar_url, bio: row.bio,
    joined: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    followingCount: Number(row.following_count), followerCount: Number(row.follower_count) }
}

async function followedIds(viewerId, ids) {
  if (!viewerId || !ids.length) return new Set()
  const rows = checked(await getAdminSupabase().from('creator_follows').select('followed_id')
    .eq('follower_id', viewerId).in('followed_id', ids))
  return new Set(rows.map((row) => row.followed_id))
}

export async function searchPublicAccounts(query, viewerId) {
  const term = String(query || '').trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_ ]/g, '').slice(0, 64)
  if (!term) return []
  let request = getAdminSupabase().from('creator_public_profiles')
    .select('id, username, display_name, avatar_url')
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
  if (viewerId) request = request.neq('id', viewerId)
  const rows = checked(await request.order('username').limit(36))
  const following = await followedIds(viewerId, rows.map((row) => row.id))
  return rows.map((row) => ({ username: row.username, displayName: row.display_name,
    avatarUrl: row.avatar_url, following: following.has(row.id) }))
}

export async function fetchPublicAccount(username, viewerId) {
  const db = getAdminSupabase()
  const row = checked(await db.from('creator_public_profiles').select('*')
    .eq('username', username.toLowerCase().replace(/^@/, '')).maybeSingle())
  if (!row) throw Object.assign(new Error('Account not found'), { status: 404 })
  const products = checked(await db.from('brand_products').select('*')
    .eq('creator_id', row.id).eq('status', 'active').order('created_at', { ascending: false }))
  return { account: { ...accountFromRow(row), isSelf: row.id === viewerId,
    following: (await followedIds(viewerId, [row.id])).has(row.id) },
  products: products.map(mapCreatorProduct) }
}

async function profileByUsername(username) {
  const row = checked(await getAdminSupabase().from('creator_profiles').select('id')
    .eq('username', String(username || '').toLowerCase().replace(/^@/, '')).maybeSingle())
  if (!row) throw Object.assign(new Error('Account not found'), { status: 404 })
  return row.id
}

export async function setFollowing(user, username, follow) {
  const targetId = await profileByUsername(username)
  if (targetId === user.id) throw Object.assign(new Error('You cannot follow yourself'), { status: 400 })
  const table = getAdminSupabase().from('creator_follows')
  if (follow) {
    checked(await table.upsert({ follower_id: user.id, followed_id: targetId },
      { onConflict: 'follower_id,followed_id', ignoreDuplicates: true }))
  } else {
    checked(await table.delete().eq('follower_id', user.id).eq('followed_id', targetId))
  }
  const row = checked(await getAdminSupabase().from('creator_public_profiles')
    .select('following_count, follower_count').eq('id', targetId).maybeSingle())
  return { following: follow, followerCount: Number(row?.follower_count || 0) }
}

export async function fetchFollowing(userId) {
  const db = getAdminSupabase()
  const links = checked(await db.from('creator_follows').select('followed_id')
    .eq('follower_id', userId).order('created_at', { ascending: false }).limit(500))
  if (!links.length) return []
  const rows = checked(await db.from('creator_profiles').select('username, display_name, avatar_url')
    .in('id', links.map((link) => link.followed_id)))
  return rows.map((row) => ({ username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url }))
}

export async function listFollows(username, type, viewerId) {
  const db = getAdminSupabase()
  const id = await profileByUsername(username)
  const isSelf = id === viewerId
  if (type === 'following' && !isSelf) {
    const prefs = checked(await db.from('creator_profile_preferences').select('preferences')
      .eq('user_id', id).maybeSingle())
    if (prefs?.preferences?.followingPrivate) return { private: true, accounts: [] }
  }
  const [column, other] = type === 'followers' ? ['followed_id', 'follower_id'] : ['follower_id', 'followed_id']
  const links = checked(await db.from('creator_follows').select(`${other}, created_at`).eq(column, id)
    .order('created_at', { ascending: false }).limit(500))
  if (!links.length) return { private: false, accounts: [] }
  const rows = checked(await db.from('creator_profiles').select('id, username, display_name, avatar_url')
    .in('id', links.map((link) => link[other])))
  const byId = new Map(rows.map((row) => [row.id, row]))
  const following = await followedIds(viewerId, rows.map((row) => row.id))
  const accounts = links.flatMap((link) => {
    const row = byId.get(link[other])
    return row ? [{ username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url,
      followedAt: link.created_at, isSelf: row.id === viewerId, following: following.has(row.id) }] : []
  })
  return { private: false, accounts }
}

export async function fetchSocialProfile(user) {
  const db = getAdminSupabase()
  const [identity, settings] = await Promise.all([
    db.from('creator_public_profiles').select('*').eq('id', user.id).maybeSingle(),
    db.from('creator_profile_preferences').select('preferences').eq('user_id', user.id).maybeSingle(),
  ])
  const row = checked(identity)
  if (!row) throw Object.assign(new Error('Run supabase/social.sql to initialize member profiles'), { status: 503 })
  return { ...checked(settings)?.preferences, ...accountFromRow(row), email: user.email,
    identityStatus: 'unverified' }
}

export async function saveSocialProfile(user, patch) {
  if (patch.favoredBrands !== undefined && (!Array.isArray(patch.favoredBrands) ||
      patch.favoredBrands.length > 200 || patch.favoredBrands.some((id) =>
        typeof id !== 'string' || !id || id.length > 80))) {
    throw Object.assign(new Error('Favorite brands are invalid'), { status: 400 })
  }
  const db = getAdminSupabase()
  const existing = checked(await db.from('creator_profile_preferences').select('preferences')
    .eq('user_id', user.id).maybeSingle())
  const preferences = { ...existing?.preferences, ...patch }
  for (const key of ['id', 'email', 'username', 'displayName', 'avatarUrl', 'joined',
    'identityStatus', 'identityProvider', 'identityRef', 'legalName', 'followingCount', 'followerCount']) {
    delete preferences[key]
  }
  checked(await db.from('creator_profile_preferences')
    .upsert({ user_id: user.id, preferences }, { onConflict: 'user_id' }))
  return fetchSocialProfile(user)
}

async function savedProducts(rows, userId) {
  const sources = await Promise.all(['store', 'market'].map(async (source) => {
    const ids = rows.filter((row) => row.source === source).map((row) => row.product_id)
    if (!ids.length) return []
    const products = await productRows(source === 'store' ? 'brand_products' : 'listings', ids)
    return products.filter((row) => source === 'store'
      ? row.status === 'active' || row.creator_id === userId
      : row.status === 'available' || row.seller_id === userId)
      .map((row) => ({ ...mapCreatorProduct(source === 'store' ? row : {
      ...row, creator_id: row.seller_id, photo_url: row.image_url,
    }), detailVariant: source }))
  }))
  const products = new Map(sources.flat().map((product) => [product.id, product]))
  return rows.map((row) => products.get(row.product_id)).filter(Boolean)
}

export async function fetchSocialSaved(userId) {
  const rows = checked(await getAdminSupabase().from('creator_saved_products').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false }))
  return savedProducts(rows, userId)
}

export async function saveSocialSaved(userId, items) {
  if (!Array.isArray(items) || items.length > 1000 || items.some((item) =>
    typeof item?.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id))) {
    throw Object.assign(new Error('Saved products must reference real listing IDs'), { status: 400 })
  }
  const ids = [...new Set(items.map((item) => item.id))]
  const db = getAdminSupabase()
  const storeRows = await productRows('brand_products', ids, 'id,status,creator_id')
  const storeIds = new Set(storeRows.filter((row) => row.status === 'active' || row.creator_id === userId)
    .map((row) => row.id))
  if (storeRows.some((row) => !storeIds.has(row.id))) {
    throw Object.assign(new Error('A saved product is no longer available'), { status: 409 })
  }
  const remaining = ids.filter((id) => !storeIds.has(id))
  const marketRows = await productRows('listings', remaining, 'id,status,seller_id')
  const marketIds = new Set(marketRows.filter((row) => row.status === 'available' || row.seller_id === userId)
    .map((row) => row.id))
  if (remaining.some((id) => !marketIds.has(id))) {
    throw Object.assign(new Error('A saved product no longer exists'), { status: 409 })
  }
  checked(await db.rpc('replace_creator_saved_products', { owner_id: userId,
    products: ids.map((product_id) => ({ product_id, source: storeIds.has(product_id) ? 'store' : 'market' })) }))
  return fetchSocialSaved(userId)
}

export async function fetchLeaderboard() {
  const rows = checked(await getAdminSupabase().from('creator_leaderboard').select('*')
    .order('profit', { ascending: false }).order('id').limit(10))
  return rows.map((row) => ({ id: row.id, username: row.username,
    label: row.display_name || row.username, avatarUrl: row.avatar_url, profit: Number(row.profit) }))
}
