import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchExternalBrandSettings, saveExternalBrandShipping } from '../server/creatorApi.js'

const owner = { id: 'owner' }
const id = '11111111-1111-4111-8111-111111111111'

test('settings expose only the account’s verified brands and preserve free shipping', async () => {
  const brands = [
    { id, creator_id: 'owner', name: 'Verified', site_origin: 'https://brand.com', flat_shipping_cents: 0 },
    { id: 'unverified', creator_id: 'owner', name: 'Unverified', site_origin: 'https://other.com', flat_shipping_cents: 100 },
    { id: 'foreign', creator_id: 'other', name: 'Foreign', site_origin: 'https://foreign.com', flat_shipping_cents: 500 },
  ]
  const claims = [
    { domain: 'brand.com', creator_id: 'owner', status: 'verified' },
    { domain: 'other.com', creator_id: 'owner', status: 'pending' },
    { domain: 'foreign.com', creator_id: 'other', status: 'verified' },
  ]
  const db = { from(table) {
    let rows = table === 'external_brands' ? brands : claims
    return {
      select() { return this },
      eq(key, value) { rows = rows.filter((row) => row[key] === value); return this },
      order() { return this },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve) },
    }
  } }
  assert.deepEqual(await fetchExternalBrandSettings(owner, db), [
    { id, name: 'Verified', domain: 'brand.com', flatShippingCents: 0 },
  ])
})

test('shipping changes validate integer cents and use authenticated owner in atomic RPC', async () => {
  const calls = []
  const db = { async rpc(name, args) {
    calls.push({ name, args })
    return args.p_brand_id === id ? { data: {}, error: null } : { error: { code: '42501' } }
  } }
  assert.deepEqual(await saveExternalBrandShipping(owner, id, 1099, db), { flatShippingCents: 1099 })
  assert.deepEqual(calls[0], { name: 'set_external_brand_shipping',
    args: { p_brand_id: id, p_creator_id: 'owner', p_amount_cents: 1099 } })
  for (const amount of [-1, 0.1, '100', 10000001, null]) {
    await assert.rejects(saveExternalBrandShipping(owner, id, amount, db), { status: 400 })
  }
  await assert.rejects(saveExternalBrandShipping(owner, 'invalid', 0, db), { status: 400 })
  await assert.rejects(saveExternalBrandShipping(owner, '22222222-2222-4222-8222-222222222222', 0, db), { status: 404 })
})
