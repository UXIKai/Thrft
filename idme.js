import crypto from 'node:crypto'

/** Short-lived OAuth state store (CSRF protection for authorize → callback) */
const memoryStates = new Map()

const AUTH_URL =
  process.env.IDME_AUTH_URL || 'https://api.id.me/oauth/authorize'
const TOKEN_URL = process.env.IDME_TOKEN_URL || 'https://api.id.me/oauth/token'
const ATTRIBUTES_URL =
  process.env.IDME_ATTRIBUTES_URL ||
  'https://api.id.me/api/public/v3/attributes.json'

/**
 * Real ID.me verification parameters used by Thrft.
 * Scope defaults to fortified_identity (two pieces of evidence / ID proofing).
 * Partners can override via IDME_SCOPE (e.g. kba_replacement, military, http://idmanagement.gov).
 */
export function getIdmeConfig() {
  const clientId = (process.env.IDME_CLIENT_ID || '').trim()
  const clientSecret = (process.env.IDME_CLIENT_SECRET || '').trim()
  const redirectUri = (
    process.env.IDME_REDIRECT_URI ||
    `http://127.0.0.1:${process.env.THRFT_API_PORT || 8787}/api/idme/callback`
  ).trim()
  const scope = (process.env.IDME_SCOPE || 'fortified_identity').trim()
  const appOrigin = (
    process.env.APP_ORIGIN ||
    process.env.THRFT_APP_ORIGIN ||
    'http://127.0.0.1:5173'
  ).trim()
  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    hasSecret: Boolean(clientSecret),
    redirectUri,
    scope,
    authUrl: AUTH_URL,
    tokenUrl: TOKEN_URL,
    attributesUrl: ATTRIBUTES_URL,
    appOrigin,
    responseType: 'code',
    grantType: 'authorization_code',
    /** Documented verification parameters Thrft requests from ID.me */
    verification: {
      provider: 'id.me',
      protocol: 'OAuth 2.0 authorization code',
      responseType: 'code',
      grantType: 'authorization_code',
      scope,
      assurance: scope.includes('idmanagement.gov')
        ? 'NIST IAL2/AAL2'
        : scope === 'fortified_identity'
          ? 'Fortified identity (two pieces of evidence)'
          : scope === 'kba_replacement'
            ? 'Identity proofing (one piece of evidence)'
            : `Community / policy scope: ${scope}`,
      attributesEndpoint: ATTRIBUTES_URL,
      requiredHandles: ['uuid', 'fname', 'lname', 'email'],
      stores: [
        'identity_status',
        'identity_provider',
        'identity_ref (uuid)',
        'legal_name',
        'identity_email',
        'identity_scope',
        'identity_verified_at',
      ],
    },
  }
}

export function createAuthorizeRequest() {
  const cfg = getIdmeConfig()
  if (!cfg.configured) {
    const err = new Error('ID.me is not configured')
    err.code = 'idme_not_configured'
    throw err
  }

  const state = crypto.randomBytes(24).toString('hex')
  const expiresAt = Date.now() + 10 * 60 * 1000
  memoryStates.set(state, { expiresAt, createdAt: Date.now() })

  const params = new URLSearchParams({
    client_id: cfg.clientId || 'MISSING_CLIENT_ID',
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: cfg.scope,
    state,
  })

  return {
    state,
    url: `${cfg.authUrl}?${params.toString()}`,
    expiresAt,
    parameters: {
      client_id: cfg.clientId ? '[set]' : '[missing]',
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: cfg.scope,
      state,
    },
  }
}

export function consumeState(state) {
  if (!state) return false
  const row = memoryStates.get(state)
  memoryStates.delete(state)
  if (!row) return false
  if (Date.now() > row.expiresAt) return false
  return true
}

async function postForm(url, fields) {
  const body = new URLSearchParams(fields)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const err = new Error(json.error_description || json.error || `token_http_${res.status}`)
    err.status = res.status
    err.payload = json
    throw err
  }
  return json
}

export async function exchangeCodeForToken(code) {
  const cfg = getIdmeConfig()
  if (!cfg.configured) {
    const err = new Error('ID.me is not configured')
    err.code = 'idme_not_configured'
    throw err
  }
  return postForm(cfg.tokenUrl, {
    code,
    client_id: cfg.clientId,
    client_secret: process.env.IDME_CLIENT_SECRET,
    redirect_uri: cfg.redirectUri,
    grant_type: 'authorization_code',
  })
}

export async function fetchAttributes(accessToken) {
  const cfg = getIdmeConfig()
  const url = new URL(cfg.attributesUrl)
  url.searchParams.set('access_token', accessToken)
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.error || `attributes_http_${res.status}`)
    err.status = res.status
    err.payload = json
    throw err
  }
  return json
}

export function attributesToProfilePatch(payload, scope) {
  const attrs = Array.isArray(payload?.attributes) ? payload.attributes : []
  const byHandle = Object.fromEntries(
    attrs.filter((a) => a?.handle).map((a) => [a.handle, a.value]),
  )
  const statuses = Array.isArray(payload?.status) ? payload.status : []
  const anyVerified = statuses.some((s) => s?.verified === true) || Boolean(byHandle.uuid)

  const first = String(byHandle.fname || '').trim()
  const last = String(byHandle.lname || '').trim()
  const legalName = [first, last].filter(Boolean).join(' ').trim()
  const uuid = String(byHandle.uuid || '').trim()
  const email = String(byHandle.email || '').trim()

  return {
    identityStatus: anyVerified ? 'verified' : 'pending',
    identityProvider: 'id.me',
    identityRef: uuid || `IDME-${Date.now().toString(36).toUpperCase()}`,
    legalName: legalName || undefined,
    identityEmail: email || undefined,
    identityScope: scope || getIdmeConfig().scope,
    identityVerifiedAt: anyVerified ? new Date().toISOString() : '',
    identityAttributes: attrs.map((a) => ({
      handle: a.handle,
      name: a.name,
      // Do not persist highly sensitive handles if present
      value: ['ssn', 'social', 'birth_date'].includes(a.handle) ? '[redacted]' : a.value,
    })),
    identityGroups: statuses,
  }
}
