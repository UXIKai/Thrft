import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { BlockList, isIP } from 'node:net'

const blocked = new BlockList()
for (const [address, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(address, bits, 'ipv4')
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
for (const [address, bits] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]]) {
  blocked.addSubnet(address, bits, 'ipv6')
}

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status })
}

export function isPublicAddress(address) {
  const family = isIP(address)
  return family === 4 ? !blocked.check(address, 'ipv4')
    : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
}

export function publicHttpsUrl(value, base) {
  let url
  try { url = new URL(value, base) } catch { fail('Enter a valid public HTTPS URL') }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  if (url.protocol !== 'https:' || url.username || url.password || !host ||
      host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      (isIP(host) && !isPublicAddress(host))) fail('Only public HTTPS URLs are allowed')
  url.hash = ''
  return url
}

async function resolvePublic(host, lookupFn) {
  const literal = isIP(host)
  let timer
  const addresses = literal ? [{ address: host, family: literal }] : await Promise.race([
    lookupFn(host, { all: true, verbatim: true }),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS lookup timed out')), 5000) }),
  ]).finally(() => clearTimeout(timer))
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    fail('Website resolves to a non-public network address')
  }
  return addresses[0]
}

async function fetchOnce(url, maxBytes, lookupFn, requestFn) {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const address = await resolvePublic(host, lookupFn)
  return new Promise((resolve, reject) => {
    const req = requestFn(url, {
      method: 'GET', family: address.family, autoSelectFamily: false,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      headers: { 'User-Agent': 'Thrft-Catalog-Importer/1.0', Accept: '*/*' },
      signal: AbortSignal.timeout(12000),
    }, (res) => {
      const chunks = []
      let size = 0
      res.on('data', (chunk) => {
        size += chunk.length
        if (size > maxBytes) req.destroy(Object.assign(new Error('Website response is too large'), { status: 413 }))
        else chunks.push(chunk)
      })
      res.on('error', reject)
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    req.end()
  })
}

export async function fetchPublicHttps(value, {
  maxBytes = 4 * 1024 * 1024, lookupFn = lookup, requestFn = request, allowedHostname,
} = {}) {
  let url = publicHttpsUrl(value)
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (allowedHostname && (url.hostname.toLowerCase().replace(/\.$/, '') !== allowedHostname || url.port)) {
      fail('Website requests cannot leave the verified domain', 403)
    }
    const response = await fetchOnce(url, maxBytes, lookupFn, requestFn)
    if (![301, 302, 303, 307, 308].includes(response.status)) return { ...response, url: url.href }
    if (!response.headers.location || redirects === 3) fail('Too many website redirects', 422)
    url = publicHttpsUrl(response.headers.location, url)
  }
}
