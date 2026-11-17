import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSync } from 'esbuild'
import { mapCreatorProduct } from '../creatorProducts.js'

const bundle = buildSync({
  entryPoints: ['listings.js'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  define: { 'import.meta.env': '{}' },
  write: false,
}).outputFiles[0].text
const { formatListingPrice, isValidListingPrice, mapListing } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle).toString('base64')}`)

test('legacy listings keep real data without presenting missing photos or prices as real', () => {
  const listing = mapListing({ id: 'one', title: 'Jacket', image_url: 'placeholder', price: null })
  assert.equal(listing.title, 'Jacket')
  assert.equal(listing.photoUrl, '')
  assert.equal(listing.price, 'Price unavailable')
  assert.equal(listing.priceRaw, null)
  assert.equal(formatListingPrice(0), '$0.00')
  assert.equal(mapCreatorProduct({ id: 'one', price: null }).price, 'Price unavailable')
})

test('listing prices must be explicit, valid nonnegative amounts', () => {
  for (const price of ['', ' ', '$', '-10', 'free', '1.234', '1e3']) {
    assert.equal(isValidListingPrice(price), false, price)
  }
  for (const price of ['0', '22.00', '$1,250.50']) {
    assert.equal(isValidListingPrice(price), true, price)
  }
})
