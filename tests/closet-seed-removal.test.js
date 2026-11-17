import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchClosetItems } from '../closet.js'

test('removes only untouched generated Closet entries and never adds new ones', () => {
  const data = new Map()
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  }
  const fake = { id: 'closet-nike-1', brand: 'Nike', category: 'Tees',
    title: 'Nike Sportswear Club Tee', price: '30', imageUrl: '', scanned: false, backgroundRemoved: false }
  const real = { ...fake, id: 'closet-user-1', imageUrl: 'data:image/png;base64,abc', scanned: true }
  const modified = { ...fake, imageUrl: 'data:image/png;base64,abc', scanned: true }
  data.set('thrft-closet-items-v1', JSON.stringify([fake, real, modified]))
  assert.deepEqual(fetchClosetItems(), [real, modified])
  assert.deepEqual(JSON.parse(data.get('thrft-closet-items-v1')), [real, modified])
  data.clear()
  assert.deepEqual(fetchClosetItems(), [])
  delete globalThis.localStorage
})
