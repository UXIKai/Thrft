/** Shopify / Stripe / bank connection helpers — persist real credentials only. */

export const CONNECT_PROVIDERS = ['shopify', 'stripe', 'bank']

export function defaultConnections() {
  return {
    shopify: { connected: false, shop: '', connectedAt: '' },
    stripe: { connected: false, accountId: '', connectedAt: '' },
    bank: { connected: false, last4: '', bankName: '', connectedAt: '' },
  }
}

export function normalizeConnections(raw) {
  const base = defaultConnections()
  if (!raw || typeof raw !== 'object') return base
  for (const key of CONNECT_PROVIDERS) {
    const row = raw[key]
    if (!row || typeof row !== 'object') continue
    base[key] = {
      ...base[key],
      connected: Boolean(row.connected),
      connectedAt: typeof row.connectedAt === 'string' ? row.connectedAt : '',
      ...(key === 'shopify'
        ? { shop: typeof row.shop === 'string' ? row.shop.slice(0, 80) : '' }
        : {}),
      ...(key === 'stripe'
        ? {
            accountId:
              typeof row.accountId === 'string' ? row.accountId.slice(0, 40) : '',
          }
        : {}),
      ...(key === 'bank'
        ? {
            last4: typeof row.last4 === 'string' ? row.last4.slice(0, 4) : '',
            bankName:
              typeof row.bankName === 'string' ? row.bankName.slice(0, 48) : '',
          }
        : {}),
    }
  }
  return base
}

/**
 * @param {object} current
 * @param {string} provider
 * @param {string} action
 * @param {object} [extras] Real shop / Stripe account / bank details from the client or OAuth callback.
 */
export function applyConnectAction(current, provider, action, extras = {}) {
  if (!CONNECT_PROVIDERS.includes(provider)) {
    const err = new Error('Unknown provider')
    err.code = 'unknown_provider'
    throw err
  }
  const next = normalizeConnections(current)
  const now = new Date().toISOString()

  if (action === 'disconnect') {
    next[provider] = { ...defaultConnections()[provider] }
    return next
  }

  if (action !== 'connect') {
    const err = new Error('Unknown action')
    err.code = 'unknown_action'
    throw err
  }

  if (provider === 'shopify') {
    const shop = String(extras.shop || '').trim().slice(0, 80)
    if (!shop) {
      const err = new Error('Shopify shop domain is required')
      err.code = 'credentials_required'
      throw err
    }
    next.shopify = {
      connected: true,
      shop,
      connectedAt: now,
    }
  } else if (provider === 'stripe') {
    const accountId = String(extras.accountId || '').trim().slice(0, 40)
    if (!accountId) {
      const err = new Error('Stripe account id is required')
      err.code = 'credentials_required'
      throw err
    }
    next.stripe = {
      connected: true,
      accountId,
      connectedAt: now,
    }
  } else if (provider === 'bank') {
    const last4 = String(extras.last4 || '').replace(/\D/g, '').slice(-4)
    const bankName = String(extras.bankName || '').trim().slice(0, 48)
    if (last4.length !== 4 || !bankName) {
      const err = new Error('Bank name and last 4 digits are required')
      err.code = 'credentials_required'
      throw err
    }
    next.bank = {
      connected: true,
      last4,
      bankName,
      connectedAt: now,
    }
  }

  return next
}
