import test from 'node:test'
import assert from 'node:assert/strict'
import { websiteDomain, hasVerificationMeta, createVerificationChallenge, verifyDomain } from '../server/brandVerification.js'
import { importExternalBrand } from '../server/creatorApi.js'
import { fetchPublicHttps } from '../server/publicHttps.js'

function fixture() {
  const challenges = []
  const claims = []
  const db = {
    from(table) {
      const rows = table === 'brand_domain_claims' ? claims : challenges
      const filters = []
      return {
        select() { return this },
        eq(key, value) { filters.push((row) => row[key] === value); return this },
        async upsert(row) {
          if (!rows.some((item) => item.domain === row.domain && item.creator_id === row.creator_id)) {
            rows.push({ ...row, status: 'pending' })
          }
          return { data: null, error: null }
        },
        async maybeSingle() { return { data: rows.find((row) => filters.every((filter) => filter(row))) || null, error: null } },
        single() { return this.maybeSingle() },
      }
    },
    async rpc(name, args) {
      assert.equal(name, 'claim_brand_domain')
      if (claims.some((claim) => claim.domain === args.p_domain && claim.creator_id !== args.p_creator_id)) {
        return { error: { code: '23505' } }
      }
      claims.push({ domain: args.p_domain, creator_id: args.p_creator_id, status: 'verified' })
      challenges.find((row) => row.domain === args.p_domain && row.creator_id === args.p_creator_id).status = 'verified'
      return { data: null, error: null }
    },
  }
  return { db, claims, challenges }
}

test('domain normalization preserves exact hostnames and rejects IPs, credentials and nonstandard ports', () => {
  assert.equal(websiteDomain('Brand.COM.'), 'brand.com')
  assert.equal(websiteDomain('https://www.Brand.com/products/hat'), 'www.brand.com')
  for (const value of ['https://brand.com:8443', 'http://brand.com', 'https://user@brand.com',
    'https://8.8.8.8', 'https://[::1]', 'localhost', 'https://bad_label.com']) {
    assert.throws(() => websiteDomain(value), undefined, value)
  }
})

test('HTML proofs must be real meta tags in the head with the exact challenge', () => {
  const tag = '<meta name="thrft-verification" content="thrft-verify-token">'
  assert.equal(hasVerificationMeta(`<html><head>${tag}</head></html>`, 'thrft-verify-token'), true)
  for (const html of [`<html><body>${tag}</body></html>`, `<head><!-- ${tag} --></head>`,
    `<head><script>${tag}</script></head>`, `<head><template>${tag}</template></head>`]) {
    assert.equal(hasVerificationMeta(html, 'thrft-verify-token'), false)
  }
  assert.equal(hasVerificationMeta(`<head>${tag}</head>`, 'other'), false)
})

test('challenges are random, stable and account scoped; a verified domain is exclusively claimed', async () => {
  const f = fixture()
  const first = await createVerificationChallenge(f.db, 'owner', 'brand.com')
  const retry = await createVerificationChallenge(f.db, 'owner', 'https://brand.com/')
  const other = await createVerificationChallenge(f.db, 'other', 'brand.com')
  assert.match(first.token, /^thrft-verify-[0-9a-f]{64}$/)
  assert.equal(first.token, retry.token)
  assert.notEqual(first.token, other.token)
  await verifyDomain(f.db, 'owner', 'brand.com', 'dns', { txt: async () => [['thrft-verification=', first.token]] })
  await assert.rejects(createVerificationChallenge(f.db, 'other', 'brand.com'), { status: 409 })
  await assert.rejects(verifyDomain(f.db, 'other', 'brand.com', 'dns', {
    txt: async () => [[other.dnsTxt]],
  }), { status: 409 })
})

test('verification rejects absent, foreign and wrong proofs and reports DNS failures', async () => {
  const f = fixture()
  const challenge = await createVerificationChallenge(f.db, 'owner', 'brand.com')
  await assert.rejects(verifyDomain(f.db, 'other', 'brand.com', 'dns'), { status: 404 })
  await assert.rejects(verifyDomain(f.db, 'owner', 'brand.com', 'dns', { txt: async () => [['wrong']] }), { status: 422 })
  await assert.rejects(verifyDomain(f.db, 'owner', 'brand.com', 'dns', {
    txt: async () => { throw Object.assign(new Error('No data'), { code: 'ENODATA' }) },
  }), { status: 422 })
  await assert.rejects(verifyDomain(f.db, 'owner', 'brand.com', 'dns', {
    txt: async () => { throw new Error('DNS unavailable') },
  }), { status: 502 })
  await assert.rejects(verifyDomain(f.db, 'owner', 'brand.com', 'html', {
    get: async () => ({ status: 200, url: 'https://other.com/', body: Buffer.from(challenge.metaTag) }),
  }), { status: 422 })
  assert.equal(f.claims.length, 0)
  await verifyDomain(f.db, 'owner', 'brand.com', 'html', {
    get: async (url, options) => {
      assert.equal(url, 'https://brand.com/')
      assert.equal(options.allowedHostname, 'brand.com')
      return { status: 200, url, body: Buffer.from(`<head>${challenge.metaTag}</head>`) }
    },
  })
  assert.equal(f.claims[0].creator_id, 'owner')
})

test('imports are blocked before catalog access for unverified and foreign domains', async () => {
  const previous = process.env.SUPABASE_URL
  process.env.SUPABASE_URL = 'https://storage.example'
  try {
    const f = fixture()
    const user = { id: 'owner' }
    const body = { brandName: 'Brand', logoUrl: 'https://storage.example/storage/v1/object/public/Thrft/owner/logo.png',
      websiteUrl: 'https://brand.com' }
    let fetched = false
    const collect = async () => { fetched = true; return { origin: 'https://other.com', products: [] } }
    await assert.rejects(importExternalBrand(user, body, f.db, collect), { status: 403 })
    f.claims.push({ domain: 'brand.com', creator_id: 'other', status: 'verified' })
    await assert.rejects(importExternalBrand(user, body, f.db, collect), { status: 403 })
    assert.equal(fetched, false)
    f.claims[0].creator_id = 'owner'
    await assert.rejects(importExternalBrand(user, body, f.db, collect), { status: 403 })
    assert.equal(fetched, true)
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = previous
  }
})

test('a verified-domain fetch refuses other hosts before DNS or HTTP access', async () => {
  await assert.rejects(fetchPublicHttps('https://other.com/', {
    allowedHostname: 'brand.com', lookupFn: () => { throw new Error('Must not resolve') },
  }), { status: 403 })
})
