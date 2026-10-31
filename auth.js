/**
 * Auth helpers for the Thrft marketplace.
 * Prefer Supabase when VITE_SUPABASE_* is set; otherwise use the local API
 * so the app is not permanently locked without .env.local.
 */
import { getSupabase, isSupabaseConfigured, supabaseConfigError } from './supabase.js'

export { isSupabaseConfigured }

const SESSION_KEY = 'thrft-session-v1'

function writeSessionToken(token) {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

function readSessionToken() {
  try {
    return localStorage.getItem(SESSION_KEY) || ''
  } catch {
    return ''
  }
}

function accountFromUser(user) {
  if (!user) return null
  const meta = user.user_metadata || {}
  const email = user.email || ''
  const emailLocal = email.includes('@') ? email.split('@')[0] : ''
  // Display name can match across Google accounts (same person, two emails).
  // Prefer a username keyed off the email so handles stay unique.
  const displayName =
    meta.displayName || meta.full_name || meta.name || emailLocal || ''
  const username =
    meta.username ||
    String(emailLocal || displayName || 'member')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '')
      .slice(0, 24)
  return {
    id: user.id,
    email,
    displayName,
    username,
    provider: user.app_metadata?.provider || 'email',
  }
}

function profileFromUser(user) {
  const account = accountFromUser(user)
  return {
    email: account?.email || '',
    displayName: account?.displayName || '',
    username: account?.username || '',
    joined: user?.created_at
      ? new Date(user.created_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : '',
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
    avatarUrl: metaAvatar(user),
    clothingSizes: {},
    favoredBrands: [],
    brandSizes: {},
    shippingAddress: '',
    connections: {
      shopify: { connected: false, shop: '', connectedAt: '' },
      stripe: { connected: false, accountId: '', connectedAt: '' },
      bank: { connected: false, last4: '', bankName: '', connectedAt: '' },
    },
  }
}

function metaAvatar(user) {
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || ''
}

function sessionPayload(session) {
  if (!session?.access_token || !session.user) return null
  writeSessionToken(session.access_token)
  return {
    token: session.access_token,
    expiresAt: session.expires_at,
    account: accountFromUser(session.user),
    profile: profileFromUser(session.user),
    user: session.user,
    session,
  }
}

async function localApi(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(readSessionToken()
        ? { Authorization: `Bearer ${readSessionToken()}` }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Could not sign in')
    err.status = res.status
    throw err
  }
  return data
}

function normalizeLocalSession(result) {
  if (!result?.token) return null
  writeSessionToken(result.token)
  return {
    token: result.token,
    expiresAt: result.expiresAt,
    account: result.account || null,
    profile: result.profile || null,
    user: result.account
      ? { id: result.account.id, email: result.account.email }
      : null,
  }
}

/** Current session (Supabase or local API). */
export async function getAuthSession() {
  const supabase = getSupabase()
  if (supabase) {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data?.session) {
      writeSessionToken('')
      return null
    }
    return sessionPayload(data.session)
  }

  const token = readSessionToken()
  if (!token) return null
  try {
    const session = await localApi('/api/auth/session')
    return normalizeLocalSession(session)
  } catch {
    writeSessionToken('')
    return null
  }
}

/** Validate session with the auth provider. */
export async function requireAuthSession() {
  const supabase = getSupabase()
  if (supabase) {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) {
      writeSessionToken('')
      return null
    }
    const { data: sess } = await supabase.auth.getSession()
    if (!sess?.session) {
      writeSessionToken('')
      return null
    }
    return sessionPayload(sess.session)
  }
  return getAuthSession()
}

export async function signInWithPassword({ email, password } = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail.includes('@')) throw new Error('Enter a valid email')
  if (!password) throw new Error('Enter your password')

  const supabase = getSupabase()
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: String(password),
    })
    if (error) throw new Error(error.message || 'Could not sign in')
    if (!data.session) throw new Error('Could not sign in')
    return sessionPayload(data.session)
  }

  const result = await localApi('/api/auth/login', {
    email: cleanEmail,
    password: String(password),
  })
  return normalizeLocalSession(result)
}

export async function signUpWithPassword({ email, password, displayName } = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail.includes('@')) throw new Error('Enter a valid email')
  if (!password || String(password).length < 6) {
    throw new Error('Enter your password')
  }

  const supabase = getSupabase()
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: String(password),
      options: {
        data: {
          displayName: displayName || cleanEmail.split('@')[0],
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    if (error) throw new Error(error.message || 'Could not sign up')
    if (!data.session) {
      const err = new Error('Verify email')
      err.code = 'verify_email'
      throw err
    }
    return sessionPayload(data.session)
  }

  const result = await localApi('/api/auth/signup', {
    email: cleanEmail,
    password: String(password),
    displayName: displayName || cleanEmail.split('@')[0],
  })
  return normalizeLocalSession(result)
}

export async function signInWithOAuthProvider(provider) {
  if (provider !== 'google' && provider !== 'apple') {
    throw new Error('Unsupported provider')
  }

  const supabase = getSupabase()
  if (supabase) {
    // Always show the provider account / email picker — never silently
    // reuse the last signed-in identity.
    const queryParams =
      provider === 'google'
        ? { prompt: 'select_account', access_type: 'online' }
        : { prompt: 'login' }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
        skipBrowserRedirect: false,
        queryParams,
      },
    })
    if (error) throw new Error(error.message || 'Unavailable')
    return { redirecting: true, url: data?.url || '' }
  }

  const startPath =
    provider === 'google' ? '/api/auth/google/start' : '/api/auth/apple/start'
  const res = await fetch(startPath)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.url) {
    throw new Error(
      data.message ||
        data.error ||
        `${provider === 'google' ? 'Google' : 'Apple'} sign-in is not configured`,
    )
  }
  window.location.assign(data.url)
  return { redirecting: true, url: data.url }
}

export async function signOut() {
  const supabase = getSupabase()
  const token = readSessionToken()
  try {
    if (supabase) await supabase.auth.signOut({ scope: 'global' })
    else if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch(() => {})
    }
  } catch {
    /* ignore */
  }
  writeSessionToken('')
}

/** Subscribe to auth changes; returns unsubscribe. */
export function onAuthChange(callback) {
  const supabase = getSupabase()
  if (!supabase) {
    return () => {}
  }
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ? sessionPayload(session) : null)
  })
  return () => subscription.unsubscribe()
}

export { supabaseConfigError }
