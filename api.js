/**
 * Client for Thrft APIs.
 * Auth → Supabase (browser) or local PostgreSQL API (:8787).
 * Checkout estimate/session → backend :8790.
 */

import { getSupabase, isSupabaseConfigured } from './supabase.js'
import {
  getAuthSession,
  signInWithPassword as sbSignIn,
  signUpWithPassword as sbSignUp,
  signInWithOAuthProvider,
  signOut as sbSignOut,
} from './auth.js'

const PROFILE_KEY = 'thrft-user-profile-v1'
const SAVED_KEY = 'thrft-saved-items-v1'
const SESSION_KEY = 'thrft-session-v1'

export function readSessionToken() {
  try {
    return localStorage.getItem(SESSION_KEY) || ''
  } catch {
    return ''
  }
}

export function writeSessionToken(token) {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  return token || ''
}

const DEFAULT_CONNECTIONS = {
  shopify: { connected: false, shop: '', connectedAt: '' },
  stripe: { connected: false, accountId: '', connectedAt: '' },
  bank: { connected: false, last4: '', bankName: '', connectedAt: '' },
}

const DEFAULT_PROFILE = {
  email: '',
  displayName: '',
  joined: '',
  identityStatus: 'unverified',
  identityProvider: '',
  identityRef: '',
  legalName: '',
  profileLinks: [],
  socialHandles: {
    tiktok: '',
    x: '',
    instagram: '',
    snapchat: '',
    rednote: '',
  },
  suppliers: [],
  avatarUrl: '',
  clothingSizes: {},
  favoredBrands: [],
  brandSizes: {},
  shippingAddress: '',
  storeApiKey: '',
  connections: { ...DEFAULT_CONNECTIONS },
}

async function refreshBearer() {
  const supabase = getSupabase()
  if (!supabase) return readSessionToken()
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token || ''
    writeSessionToken(token)
    return token
  } catch {
    return readSessionToken()
  }
}

async function api(path, options) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  }
  const isCredentialPost =
    typeof path === 'string' &&
    (/^\/api\/auth\/(login|signup|oauth)\b/.test(path) ||
      path.includes('/api/auth/login') ||
      path.includes('/api/auth/signup') ||
      path.includes('/api/auth/oauth'))
  if (!isCredentialPost) {
    const token = (await refreshBearer()) || readSessionToken()
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`
    }
  }
  const res = await fetch(path, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data.message || data.error || `api ${res.status}`)
    err.status = res.status
    err.payload = data
    throw err
  }
  return res.json()
}

function applyAuthResult(result) {
  if (result?.token) writeSessionToken(result.token)
  if (result?.profile) writeLocalProfile({ ...DEFAULT_PROFILE, ...result.profile })
  return result
}

export async function fetchAuthConfig() {
  if (isSupabaseConfigured()) {
    return {
      google: { configured: true },
      apple: { configured: true },
      supabase: { configured: true },
    }
  }
  try {
    return await api('/api/auth/config')
  } catch {
    return {
      google: { configured: false },
      apple: { configured: false },
      supabase: { configured: false },
    }
  }
}

export async function fetchSession() {
  if (isSupabaseConfigured()) {
    const session = await getAuthSession()
    if (session?.profile) writeLocalProfile({ ...DEFAULT_PROFILE, ...session.profile })
    return session
  }
  return null
}

export async function signupWithEmail({ email, password, displayName } = {}) {
  const result = await sbSignUp({ email, password, displayName })
  if (result?.profile) writeLocalProfile({ ...DEFAULT_PROFILE, ...result.profile })
  return applyAuthResult(result)
}

export async function loginWithEmail({ email, password } = {}) {
  const result = await sbSignIn({ email, password })
  if (result?.profile) writeLocalProfile({ ...DEFAULT_PROFILE, ...result.profile })
  return applyAuthResult(result)
}

/** Google / Apple via Supabase Auth. */
export async function loginWithOAuth(provider) {
  return signInWithOAuthProvider(provider)
}

export async function logoutSession() {
  await sbSignOut()
}

function readLocalProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE }
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

function writeLocalProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    /* ignore */
  }
  return profile
}

function readLocalSaved() {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeLocalSaved(items) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
  return items
}

export async function fetchProfile() {
  try {
    const profile = await api('/api/profile')
    writeLocalProfile(profile)
    return profile
  } catch {
    return readLocalProfile()
  }
}

export async function saveProfile(patch) {
  const base = readLocalProfile()
  try {
    const profile = await api('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(patch),
    })
    // Keep client-only fields (sizes, etc.) if the API omits them
    const merged = { ...base, ...profile, ...patch }
    writeLocalProfile(merged)
    return { profile: merged, source: 'database' }
  } catch {
    const next = writeLocalProfile({ ...base, ...patch })
    return { profile: next, source: 'local' }
  }
}

export async function connectProvider(provider, action = 'connect', extras = {}) {
  const result = await api('/api/connect', {
    method: 'POST',
    body: JSON.stringify({ provider, action, ...extras }),
  })
  if (result?.profile) writeLocalProfile({ ...DEFAULT_PROFILE, ...result.profile })
  return result
}

export async function fetchSaved() {
  try {
    const data = await api('/api/saved')
    const items = Array.isArray(data.items) ? data.items : []
    writeLocalSaved(items)
    return items
  } catch {
    return readLocalSaved()
  }
}

export async function saveSavedItems(items) {
  const list = Array.isArray(items) ? items : []
  try {
    const data = await api('/api/saved', {
      method: 'PUT',
      body: JSON.stringify({ items: list }),
    })
    const next = Array.isArray(data.items) ? data.items : list
    writeLocalSaved(next)
    return { items: next, source: 'database' }
  } catch {
    return { items: writeLocalSaved(list), source: 'local' }
  }
}

export function initialsFromName(name, fallback = 'WI') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return fallback
  return parts
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

export async function fetchIdmeConfig() {
  try {
    return await api('/api/idme/config')
  } catch {
    return { configured: false, verification: null }
  }
}

export async function startIdmeAuthorize() {
  const res = await fetch('/api/idme/authorize', {
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || `api ${res.status}`)
    err.status = res.status
    err.payload = data
    throw err
  }
  return data
}

export async function fetchIdmeStatus() {
  try {
    return await api('/api/idme/status')
  } catch {
    return null
  }
}

export async function fetchAccountPage(username) {
  return api(`/api/accounts/${encodeURIComponent(username)}`)
}

export async function fetchMyAccount() {
  return api('/api/me/account')
}

export async function fetchMyProducts({ status = '', segment = '' } = {}) {
  const q = new URLSearchParams()
  if (status) q.set('status', status)
  if (segment) q.set('segment', segment)
  const suffix = q.toString() ? `?${q}` : ''
  const data = await api(`/api/me/products${suffix}`)
  return Array.isArray(data.products) ? data.products : []
}

export async function createListingProduct(payload) {
  const data = await api('/api/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.product
}

export async function updateListingProduct(id, patch) {
  const data = await api(`/api/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
  return data.product
}

/** Record like / search / view for the For You algorithm. */
export async function recordInterest(payload) {
  try {
    return await api('/api/interest', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch {
    return { ok: false, local: true }
  }
}

export async function fetchForYou({ limit = 16 } = {}) {
  try {
    const data = await api(`/api/for-you?limit=${encodeURIComponent(limit)}`)
    return {
      products: Array.isArray(data.products) ? data.products : [],
      meta: data.meta || null,
      source: 'database',
    }
  } catch {
    return { products: [], meta: null, source: 'local' }
  }
}

/** @deprecated Prefer createCheckoutSession with cart items */
export async function createCheckout(payload) {
  const items = payload?.items || [
    {
      id: payload?.productId || payload?.id,
      title: payload?.title,
      price: payload?.price,
      brandName: payload?.brandName,
      description: payload?.description,
      photoUrl: payload?.photoUrl,
      qty: payload?.quantity || 1,
      printfulVariantId: payload?.printfulVariantId,
    },
  ]
  return createCheckoutSession({
    items,
    address: payload?.address || payload?.shippingAddress,
    successUrl: payload?.successUrl,
    cancelUrl: payload?.cancelUrl,
  })
}

/** Authenticated Stripe Checkout Session — returns { data: { url } }. */
export async function createCheckoutSession({
  items,
  address,
  shippingAddress,
  successUrl,
  cancelUrl,
} = {}) {
  return api('/api/checkout/session', {
    method: 'POST',
    body: JSON.stringify({
      items: items || [],
      address: address || shippingAddress || undefined,
      successUrl,
      cancelUrl,
    }),
  })
}

export async function estimateCheckout({ items, address, shippingAddress } = {}) {
  return api('/api/checkout/estimate', {
    method: 'POST',
    body: JSON.stringify({
      items: items || [],
      address: address || shippingAddress || undefined,
    }),
  })
}

export async function fetchCheckoutSession(sessionId) {
  return api(`/api/checkout/session/${encodeURIComponent(sessionId)}`)
}
