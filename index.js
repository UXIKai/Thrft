import http from 'node:http'
import {
  getProfile,
  updateProfile,
  listSaved,
  replaceSaved,
  dbFilePath,
  listAccounts,
  getPublicAccount,
  listProductsForAccount,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  findAccountByUsername,
  updateAccount,
} from './db.js'
import { applyConnectAction, CONNECT_PROVIDERS } from './connect.js'
import {
  accountKeyFromSession,
  recordInterest,
  buildForYouFeed,
} from './forYou.js'
import {
  getStripeCheckoutConfig,
  createCheckoutSession,
  getCheckoutSession,
  retrieveLiveCheckout,
} from './stripeCheckout.js'
import {
  getIdmeConfig,
  createAuthorizeRequest,
  consumeState,
  exchangeCodeForToken,
  fetchAttributes,
  attributesToProfilePatch,
} from './idme.js'
import {
  getAuthConfig,
  signupWithEmail,
  loginWithEmail,
  loginWithOAuthProvider,
  sessionFromToken,
  logout,
  createGoogleAuthorizeUrl,
  completeGoogleOAuth,
  createAppleAuthorizeUrl,
  completeAppleOAuth,
  createAppleQrSession,
  pollAppleQrSession,
  completeAppleQrSession,
  cancelAppleQrSession,
  bearerToken,
} from './auth.js'
import { assertDatabase } from './prisma.js'

const PORT = Number(process.env.THRFT_API_PORT || 8787)

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(payload)
}

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    'Access-Control-Allow-Origin': '*',
  })
  res.end()
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      if (!chunks.length) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

async function completeIdmeWithCode(code, state) {
  if (!consumeState(state)) {
    const err = new Error('Invalid or expired OAuth state')
    err.code = 'invalid_state'
    throw err
  }
  const token = await exchangeCodeForToken(code)
  const attrs = await fetchAttributes(token.access_token)
  const patch = attributesToProfilePatch(attrs, token.scope)
  return updateProfile(patch)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const { pathname } = url

  if (req.method === 'OPTIONS') {
    send(res, 204, {})
    return
  }

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      const idme = getIdmeConfig()
      const auth = getAuthConfig()
      const accounts = await listAccounts()
      send(res, 200, {
        ok: true,
        db: dbFilePath(),
        accounts: accounts.length,
        idme: { configured: idme.configured, scope: idme.scope },
        auth: {
          google: auth.google.configured,
          apple: auth.apple.configured,
        },
      })
      return
    }

    /* ——— Auth (email + Google + Apple) ——— */

    if (req.method === 'GET' && pathname === '/api/auth/config') {
      const auth = getAuthConfig()
      send(res, 200, {
        google: { configured: auth.google.configured },
        apple: { configured: auth.apple.configured },
      })
      return
    }

    if (req.method === 'POST' && pathname === '/api/auth/signup') {
      const body = await readJson(req)
      try {
        send(res, 201, await signupWithEmail(body))
      } catch (err) {
        send(res, err.code === 'email_taken' ? 409 : 400, {
          error: err.code || 'signup_failed',
          message: String(err.message || err),
        })
      }
      return
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJson(req)
      try {
        send(res, 200, await loginWithEmail(body))
      } catch (err) {
        send(res, 401, {
          error: err.code || 'login_failed',
          message: String(err.message || err),
        })
      }
      return
    }

    if (req.method === 'GET' && pathname === '/api/auth/session') {
      const token = bearerToken(req) || url.searchParams.get('token') || ''
      const session = await sessionFromToken(token)
      if (!session) {
        send(res, 401, { error: 'no_session' })
        return
      }
      send(res, 200, session)
      return
    }

    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      const body = await readJson(req)
      const token = bearerToken(req) || body.token || ''
      send(res, 200, await logout(token))
      return
    }

    if (req.method === 'POST' && pathname === '/api/auth/oauth') {
      const body = await readJson(req)
      const provider = body.provider === 'apple' ? 'apple' : 'google'
      const auth = getAuthConfig()
      try {
        if (!auth[provider]?.configured) {
          send(res, 503, {
            error: `${provider}_not_configured`,
            message: `Set ${
              provider === 'google'
                ? 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET'
                : 'APPLE_CLIENT_ID'
            } for live ${provider} sign-in.`,
          })
          return
        }
        if (body.idToken || body.id_token || (body.sub && body.email)) {
          const result = await loginWithOAuthProvider(provider, {
            email: body.email,
            displayName: body.displayName,
            sub: body.sub,
          })
          send(res, 200, result)
          return
        }
        if (provider === 'google') {
          send(res, 200, { redirect: true, url: createGoogleAuthorizeUrl().url })
          return
        }
        if (provider === 'apple') {
          send(res, 200, { redirect: true, url: createAppleAuthorizeUrl().url })
          return
        }
        send(res, 400, {
          error: 'oauth_required',
          message: 'Complete OAuth with the configured provider.',
        })
      } catch (err) {
        send(res, 400, {
          error: err.code || 'oauth_failed',
          message: String(err.message || err),
        })
      }
      return
    }

    if (req.method === 'GET' && pathname === '/api/auth/google/start') {
      const auth = getAuthConfig()
      if (!auth.google.configured) {
        send(res, 503, { error: 'google_not_configured' })
        return
      }
      try {
        send(res, 200, createGoogleAuthorizeUrl())
      } catch (err) {
        send(res, 503, { error: err.code || 'google_start_failed', message: String(err.message) })
      }
      return
    }

    if (req.method === 'GET' && pathname === '/api/auth/google/callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const oauthError = url.searchParams.get('error')
      const back = new URL('/oauth/callback.html', getAuthConfig().appOrigin)
      if (oauthError) {
        back.searchParams.set('auth', 'error')
        back.searchParams.set('provider', 'google')
        back.searchParams.set('reason', oauthError)
        redirect(res, back.toString())
        return
      }
      try {
        const session = await completeGoogleOAuth({ code, state })
        back.searchParams.set('auth', 'ok')
        back.searchParams.set('provider', 'google')
        back.searchParams.set('token', session.token)
        redirect(res, back.toString())
      } catch (err) {
        back.searchParams.set('auth', 'error')
        back.searchParams.set('provider', 'google')
        back.searchParams.set('reason', err.code || 'callback_failed')
        redirect(res, back.toString())
      }
      return
    }

    if (req.method === 'GET' && pathname === '/api/auth/apple/start') {
      const auth = getAuthConfig()
      if (!auth.apple.configured) {
        send(res, 503, { error: 'apple_not_configured' })
        return
      }
      try {
        send(res, 200, createAppleAuthorizeUrl())
      } catch (err) {
        send(res, 503, { error: err.code || 'apple_start_failed', message: String(err.message) })
      }
      return
    }

    if (req.method === 'POST' && pathname === '/api/auth/apple/callback') {
      const body = await readJson(req).catch(() => ({}))
      const back = new URL('/oauth/callback.html', getAuthConfig().appOrigin)
      try {
        const session = await completeAppleOAuth({
          code: body.code || url.searchParams.get('code'),
          state: body.state || url.searchParams.get('state'),
          idToken: body.id_token || body.idToken,
          user: body.user,
        })
        back.searchParams.set('auth', 'ok')
        back.searchParams.set('provider', 'apple')
        back.searchParams.set('token', session.token)
        redirect(res, back.toString())
      } catch (err) {
        back.searchParams.set('auth', 'error')
        back.searchParams.set('provider', 'apple')
        back.searchParams.set('reason', err.code || 'callback_failed')
        redirect(res, back.toString())
      }
      return
    }

    /* ——— Apple Sign In: iPhone QR scan ——— */

    if (req.method === 'POST' && pathname === '/api/auth/apple/qr/start') {
      try {
        const body = await readJson(req).catch(() => ({}))
        const origin =
          body.origin ||
          req.headers.origin ||
          getAuthConfig().appOrigin
        send(res, 200, await createAppleQrSession({ origin }))
      } catch (err) {
        send(res, 500, { error: 'qr_start_failed', message: String(err.message || err) })
      }
      return
    }

    if (req.method === 'GET' && pathname === '/api/auth/apple/qr/status') {
      const id = url.searchParams.get('id') || ''
      const pollSecret = url.searchParams.get('pollSecret') || ''
      send(res, 200, pollAppleQrSession(id, pollSecret))
      return
    }

    if (req.method === 'POST' && pathname === '/api/auth/apple/qr/complete') {
      const body = await readJson(req)
      try {
        send(res, 200, await completeAppleQrSession(body.id || body.sid, body))
      } catch (err) {
        const status =
          err.code === 'qr_not_found' || err.code === 'qr_expired'
            ? 410
            : 400
        send(res, status, {
          error: err.code || 'qr_complete_failed',
          message: String(err.message || err),
        })
      }
      return
    }

    if (req.method === 'POST' && pathname === '/api/auth/apple/qr/cancel') {
      const body = await readJson(req)
      send(res, 200, cancelAppleQrSession(body.id, body.pollSecret))
      return
    }

    if (req.method === 'GET' && pathname === '/api/profile') {
      const token = bearerToken(req)
      const session = token ? await sessionFromToken(token) : null
      send(res, 200, await getProfile(session?.account?.id ?? null))
      return
    }

    if (req.method === 'PUT' && pathname === '/api/profile') {
      const body = await readJson(req)
      const token = bearerToken(req)
      const session = token ? await sessionFromToken(token) : null
      const accountId = session?.account?.id ?? null
      const profile = await updateProfile(body, accountId)
      if (accountId && (body.displayName || body.username || body.bio || body.avatarUrl)) {
        try {
          await updateAccount(accountId, {
            displayName: body.displayName,
            username: body.username,
            bio: body.bio,
            avatarUrl: body.avatarUrl,
          })
        } catch (err) {
          if (err.code === 'username_taken') {
            send(res, 409, { error: 'username_taken', message: err.message })
            return
          }
        }
      }
      const fresh = token ? await sessionFromToken(token) : null
      send(res, 200, {
        ...profile,
        account: fresh?.account || session?.account || null,
      })
      return
    }

    if (req.method === 'GET' && pathname === '/api/me/account') {
      const token = bearerToken(req)
      const session = token ? await sessionFromToken(token) : null
      if (!session?.account) {
        send(res, 401, { error: 'unauthorized', message: 'Sign in required' })
        return
      }
      const products = await listProductsForAccount(session.account.id)
      send(res, 200, {
        account: session.account,
        products,
        profile: session.profile,
      })
      return
    }

    if (req.method === 'GET' && pathname === '/api/me/products') {
      const token = bearerToken(req)
      const session = token ? await sessionFromToken(token) : null
      if (!session?.account) {
        send(res, 401, { error: 'unauthorized', message: 'Sign in required' })
        return
      }
      const status = url.searchParams.get('status') || ''
      const segment = url.searchParams.get('segment') || ''
      send(res, 200, {
        products: await listProductsForAccount(session.account.id, { status, segment }),
      })
      return
    }

    const accountMatch = pathname.match(/^\/api\/accounts\/([^/]+)\/?$/)
    if (req.method === 'GET' && accountMatch) {
      const username = decodeURIComponent(accountMatch[1])
      const account = await getPublicAccount(username)
      if (!account) {
        send(res, 404, { error: 'not_found', message: 'Account not found' })
        return
      }
      const products = await listProductsForAccount(account.id, {
        status: 'active',
        segment: 'store',
      })
      send(res, 200, { account, products })
      return
    }

    const accountProductsMatch = pathname.match(
      /^\/api\/accounts\/([^/]+)\/products\/?$/,
    )
    if (req.method === 'GET' && accountProductsMatch) {
      const username = decodeURIComponent(accountProductsMatch[1])
      const row = await findAccountByUsername(username)
      if (!row) {
        send(res, 404, { error: 'not_found', message: 'Account not found' })
        return
      }
      const status = url.searchParams.get('status') || 'active'
      const segment = url.searchParams.get('segment') || 'store'
      send(res, 200, {
        products: await listProductsForAccount(row.id, { status, segment }),
      })
      return
    }

    if (req.method === 'POST' && pathname === '/api/products') {
      const token = bearerToken(req)
      const session = token ? await sessionFromToken(token) : null
      if (!session?.account) {
        send(res, 401, { error: 'unauthorized', message: 'Sign in required' })
        return
      }
      try {
        const body = await readJson(req)
        const product = await createProduct(session.account.id, body)
        send(res, 201, { product })
      } catch (err) {
        send(res, 400, {
          error: err.code || 'create_failed',
          message: err.message || 'Could not create product',
        })
      }
      return
    }

    const productMatch = pathname.match(/^\/api\/products\/([^/]+)\/?$/)
    if (productMatch) {
      const productId = decodeURIComponent(productMatch[1])
      if (req.method === 'GET') {
        const product = await getProduct(productId)
        if (!product) {
          send(res, 404, { error: 'not_found', message: 'Product not found' })
          return
        }
        send(res, 200, { product })
        return
      }
      const token = bearerToken(req)
      const session = token ? await sessionFromToken(token) : null
      if (!session?.account) {
        send(res, 401, { error: 'unauthorized', message: 'Sign in required' })
        return
      }
      if (req.method === 'PUT' || req.method === 'PATCH') {
        const body = await readJson(req)
        const product = await updateProduct(productId, session.account.id, body)
        if (!product) {
          send(res, 404, { error: 'not_found', message: 'Product not found' })
          return
        }
        send(res, 200, { product })
        return
      }
      if (req.method === 'DELETE') {
        const ok = await deleteProduct(productId, session.account.id)
        if (!ok) {
          send(res, 404, { error: 'not_found', message: 'Product not found' })
          return
        }
        send(res, 200, { ok: true })
        return
      }
    }

    if (req.method === 'GET' && pathname === '/api/connect') {
      const token = bearerToken(req)
      const session = token ? await sessionFromToken(token) : null
      const profile = await getProfile(session?.account?.id ?? null)
      send(res, 200, { connections: profile.connections })
      return
    }

    if (req.method === 'POST' && pathname === '/api/connect') {
      const body = await readJson(req)
      const provider = String(body.provider || '').toLowerCase()
      const action = String(body.action || 'connect').toLowerCase()
      if (!CONNECT_PROVIDERS.includes(provider)) {
        send(res, 400, { error: 'unknown_provider', message: 'Unknown provider' })
        return
      }
      try {
        const token = bearerToken(req)
        const session = token ? await sessionFromToken(token) : null
        const accountId = session?.account?.id ?? null
        const current = await getProfile(accountId)
        const connections = applyConnectAction(
          current.connections,
          provider,
          action,
          body,
        )
        const profile = await updateProfile({ connections }, accountId)
        send(res, 200, { connections: profile.connections, profile })
      } catch (err) {
        send(res, err.code === 'credentials_required' ? 400 : 400, {
          error: err.code || 'connect_failed',
          message: err.message || 'Connect failed',
        })
      }
      return
    }

    if (req.method === 'GET' && pathname === '/api/saved') {
      send(res, 200, { items: await listSaved() })
      return
    }

    if (req.method === 'PUT' && pathname === '/api/saved') {
      const body = await readJson(req)
      const prev = await listSaved()
      const prevIds = new Set(prev.map((i) => i?.id).filter(Boolean))
      const items = await replaceSaved(body.items)
      try {
        const token = bearerToken(req)
        const session = token ? await sessionFromToken(token) : null
        const key = accountKeyFromSession(session)
        for (const item of items) {
          if (!item?.id || prevIds.has(item.id)) continue
          await recordInterest(key, {
            kind: 'like',
            productId: item.id,
            brandId: item.brandId,
            clothingType: item.clothingType,
          })
        }
      } catch {
        /* ignore interest side-effects */
      }
      send(res, 200, { items })
      return
    }

    /* ——— For You (likes + searches) ——— */

    if (req.method === 'POST' && pathname === '/api/interest') {
      const body = await readJson(req)
      const token = bearerToken(req)
      const session = token ? await sessionFromToken(token) : null
      const key = accountKeyFromSession(session)
      try {
        send(res, 200, await recordInterest(key, body))
      } catch (err) {
        send(res, 400, {
          error: err.code || 'interest_failed',
          message: String(err.message || err),
        })
      }
      return
    }

    if (req.method === 'GET' && pathname === '/api/for-you') {
      const token = bearerToken(req)
      const session = token ? await sessionFromToken(token) : null
      const key = accountKeyFromSession(session)
      const limit = Math.min(40, Math.max(4, Number(url.searchParams.get('limit')) || 16))
      const profile = await getProfile(session?.account?.id ?? null)
      const feed = await buildForYouFeed(key, profile, { limit })
      send(res, 200, feed)
      return
    }

    /* ——— Stripe Checkout ——— */

    if (req.method === 'GET' && pathname === '/api/checkout/config') {
      send(res, 200, getStripeCheckoutConfig())
      return
    }

    if (req.method === 'POST' && pathname === '/api/checkout/create') {
      const body = await readJson(req)
      const token = bearerToken(req)
      const session = token ? await sessionFromToken(token) : null
      const key = accountKeyFromSession(session)
      try {
        const checkout = await createCheckoutSession(body, { accountKey: key })
        send(res, 200, checkout)
      } catch (err) {
        send(res, err.status || 400, {
          error: err.code || 'checkout_failed',
          message: String(err.message || err),
        })
      }
      return
    }

    if (req.method === 'GET' && pathname.startsWith('/api/checkout/session/')) {
      const sessionId = decodeURIComponent(pathname.slice('/api/checkout/session/'.length))
      let data = await getCheckoutSession(sessionId)
      if (!data && getStripeCheckoutConfig().configured) {
        data = await retrieveLiveCheckout(sessionId)
      }
      if (!data) {
        send(res, 404, { error: 'not_found', message: 'Checkout session not found' })
        return
      }
      send(res, 200, data)
      return
    }

    /* ——— ID.me OAuth ——— */

    if (req.method === 'GET' && pathname === '/api/idme/config') {
      const cfg = getIdmeConfig()
      send(res, 200, {
        configured: cfg.configured,
        clientId: cfg.configured ? cfg.clientId : '',
        redirectUri: cfg.redirectUri,
        scope: cfg.scope,
        authUrl: cfg.authUrl,
        attributesUrl: cfg.attributesUrl,
        responseType: cfg.responseType,
        grantType: cfg.grantType,
        verification: cfg.verification,
      })
      return
    }

    if (req.method === 'GET' && pathname === '/api/idme/authorize') {
      try {
        const auth = createAuthorizeRequest()
        send(res, 200, auth)
      } catch (err) {
        if (err.code === 'idme_not_configured') {
          send(res, 503, {
            error: 'idme_not_configured',
            message:
              'Set IDME_CLIENT_ID and IDME_CLIENT_SECRET (see .env.example) to enable live ID.me OAuth.',
            verification: getIdmeConfig().verification,
          })
          return
        }
        throw err
      }
      return
    }

    if (req.method === 'GET' && pathname === '/api/idme/callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const oauthError = url.searchParams.get('error')
      const cfg = getIdmeConfig()
      const back = new URL(cfg.appOrigin)

      if (oauthError) {
        back.searchParams.set('idme', 'error')
        back.searchParams.set('reason', oauthError)
        redirect(res, back.toString())
        return
      }

      try {
        await completeIdmeWithCode(code, state)
        back.searchParams.set('idme', 'verified')
        redirect(res, back.toString())
      } catch (err) {
        back.searchParams.set('idme', 'error')
        back.searchParams.set('reason', err.code || 'callback_failed')
        redirect(res, back.toString())
      }
      return
    }

    if (req.method === 'POST' && pathname === '/api/idme/callback') {
      const body = await readJson(req)
      try {
        const profile = await completeIdmeWithCode(body.code, body.state)
        send(res, 200, { ok: true, profile })
      } catch (err) {
        send(res, err.code === 'invalid_state' ? 400 : 502, {
          error: err.code || 'callback_failed',
          message: String(err.message || err),
        })
      }
      return
    }

    if (req.method === 'GET' && pathname === '/api/idme/status') {
      const token = bearerToken(req)
      const session = token ? await sessionFromToken(token) : null
      const p = await getProfile(session?.account?.id ?? null)
      send(res, 200, {
        identityStatus: p.identityStatus,
        identityProvider: p.identityProvider,
        identityRef: p.identityRef,
        legalName: p.legalName,
        identityEmail: p.identityEmail,
        identityScope: p.identityScope,
        identityVerifiedAt: p.identityVerifiedAt,
        identityGroups: p.identityGroups,
        verification: getIdmeConfig().verification,
        configured: getIdmeConfig().configured,
      })
      return
    }

    send(res, 404, { error: 'not_found' })
  } catch (err) {
    send(res, 500, { error: 'server_error', message: String(err?.message || err) })
  }
})

assertDatabase()
  .then(() => {
    server.listen(PORT, '127.0.0.1', () => {
      const cfg = getIdmeConfig()
      const auth = getAuthConfig()
      console.log(`[thrft-api] PostgreSQL ready (${dbFilePath()})`)
      console.log(`[thrft-api] listening on http://127.0.0.1:${PORT}`)
      console.log(
        `[thrft-api] ID.me ${cfg.configured ? 'configured' : 'NOT configured'} · scope=${cfg.scope}`,
      )
      console.log(`[thrft-api] ID.me redirect_uri=${cfg.redirectUri}`)
      console.log(
        `[thrft-api] Auth google=${auth.google.configured ? 'live' : 'off'} apple=${auth.apple.configured ? 'live' : 'off'}`,
      )
      const checkout = getStripeCheckoutConfig()
      console.log(
        `[thrft-api] Stripe checkout=${checkout.mode}${checkout.configured ? ' (STRIPE_SECRET_KEY)' : ' (set STRIPE_SECRET_KEY)'}`,
      )
    })
  })
  .catch((err) => {
    console.error('[thrft-api] Database unavailable:', err?.message || err)
    console.error('[thrft-api] Set DATABASE_URL to a PostgreSQL connection string.')
    process.exit(1)
  })
