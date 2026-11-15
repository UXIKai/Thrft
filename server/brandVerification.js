import { randomBytes } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import { isIP } from 'node:net'
import { parse } from 'parse5'
import { publicHttpsUrl, fetchPublicHttps } from './publicHttps.js'

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status })
}

function checked({ data, error }) {
  if (error) throw error
  return data
}

export function websiteDomain(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) fail('Enter a website domain')
  const url = publicHttpsUrl(value.includes('://') ? value.trim() : `https://${value.trim()}`)
  const domain = url.hostname.toLowerCase().replace(/\.$/, '')
  if (url.port || isIP(domain.replace(/^\[|\]$/g, '')) || domain.length > 253 ||
      !domain.includes('.') || domain.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    fail('Enter a public website domain without a custom port')
  }
  return domain
}

export async function requireVerifiedDomain(db, creatorId, domain) {
  const claim = checked(await db.from('brand_domain_claims').select('creator_id,status')
    .eq('domain', domain).maybeSingle())
  if (!claim || claim.creator_id !== creatorId || claim.status !== 'verified') {
    fail('Verify ownership of this website domain before importing products', 403)
  }
}

function challengeResult(row) {
  return { domain: row.domain, token: row.token, status: row.status,
    metaTag: `<meta name="thrft-verification" content="${row.token}">`,
    dnsTxt: `thrft-verification=${row.token}` }
}

export async function createVerificationChallenge(db, creatorId, value) {
  const domain = websiteDomain(value)
  const claim = checked(await db.from('brand_domain_claims').select('creator_id,status')
    .eq('domain', domain).maybeSingle())
  if (claim && claim.creator_id !== creatorId) fail('This domain is already claimed by another account', 409)
  // Keep the same token across retries so publishing a proof is not invalidated.
  checked(await db.from('brand_domain_challenges').upsert({
    domain, creator_id: creatorId, token: `thrft-verify-${randomBytes(32).toString('hex')}`,
  }, { onConflict: 'domain,creator_id', ignoreDuplicates: true }))
  const challenge = checked(await db.from('brand_domain_challenges').select('domain,token,status')
    .eq('domain', domain).eq('creator_id', creatorId).single())
  return challengeResult(challenge)
}

export function hasVerificationMeta(html, token) {
  const document = parse(html)
  const head = document.childNodes.find((node) => node.tagName === 'html')?.childNodes
    .find((node) => node.tagName === 'head')
  return Boolean(head?.childNodes.some((node) => node.tagName === 'meta' &&
    node.attrs?.some((attr) => attr.name === 'name' && attr.value === 'thrft-verification') &&
    node.attrs?.some((attr) => attr.name === 'content' && attr.value === token)))
}

export async function verifyDomain(db, creatorId, value, method, {
  get = fetchPublicHttps, txt = resolveTxt,
} = {}) {
  const domain = websiteDomain(value)
  if (!['html', 'dns'].includes(method)) fail('Choose HTML or DNS verification')
  const challenge = checked(await db.from('brand_domain_challenges').select('token')
    .eq('domain', domain).eq('creator_id', creatorId).maybeSingle())
  if (!challenge) fail('Create a verification challenge for this domain first', 404)
  let matches = false
  if (method === 'html') {
    const response = await get(`https://${domain}/`, { allowedHostname: domain })
    if (response.status !== 200) fail(`Website returned HTTP ${response.status}`, 422)
    if (websiteDomain(response.url) !== domain) fail('Verification cannot redirect to a different domain', 422)
    matches = hasVerificationMeta(response.body.toString('utf8'), challenge.token)
  } else {
    let timer
    try {
      const records = await Promise.race([
        txt(domain),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS verification timed out')), 5000) }),
      ])
      matches = records.some((parts) => parts.join('') === `thrft-verification=${challenge.token}`)
    } catch (error) {
      if (!['ENODATA', 'ENOTFOUND'].includes(error.code)) {
        fail(`Could not check DNS verification: ${error.message}`, 502)
      }
    } finally { clearTimeout(timer) }
  }
  if (!matches) fail('Verification proof not found. Publish the exact meta tag or TXT record and retry.', 422)
  const result = await db.rpc('claim_brand_domain', {
    p_domain: domain, p_creator_id: creatorId, p_token: challenge.token,
  })
  if (result.error?.code === '23505') fail('This domain is already claimed by another account', 409)
  checked(result)
  return { domain, status: 'verified' }
}
