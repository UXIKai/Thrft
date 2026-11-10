import test from 'node:test'
import assert from 'node:assert/strict'
import { matchCatalogProducts } from './productLookup.js'

const catalog = [
  { brand: 'Nike', partNumber: 'PN-100', orderNumber: 'ON-10', title: 'Shirt', variants: [
    { color: 'Black', imageUrl: 'https://example.com/black.png' },
    { color: 'White', imageUrl: 'https://example.com/white.png' },
  ] },
  { brand: 'Adidas', partNumber: 'PN-100', title: 'Other shirt', variants: [
    { color: 'Blue', imageUrl: 'https://example.com/blue.png' },
  ] },
]

test('matches exact numbers within the chosen brand and returns all colors', () => {
  const [product] = matchCatalogProducts(catalog, { brand: ' nike ', partNumber: 'pn-100' })
  assert.equal(product.title, 'Shirt')
  assert.equal(product.variants.length, 2)
  assert.equal('orderNumber' in product, false)
})

test('both supplied identifiers must match; no partial or cross-brand matches', () => {
  assert.equal(matchCatalogProducts(catalog, { brand: 'Nike', orderNumber: 'on-10' }).length, 1)
  for (const query of [
    { brand: 'Nike', partNumber: 'PN-100', orderNumber: 'wrong' },
    { brand: 'Nike', partNumber: 'PN' },
    { brand: 'Gap', partNumber: 'PN-100' },
  ]) assert.deepEqual(matchCatalogProducts(catalog, query), [])
})

test('rejects missing input and malformed catalog image data', () => {
  assert.throws(() => matchCatalogProducts(catalog, { brand: 'Nike' }))
  assert.throws(() => matchCatalogProducts(null, { brand: 'Nike', partNumber: 'PN' }))
  assert.throws(() => matchCatalogProducts([
    { brand: 'Nike', partNumber: 'PN', title: 'Bad', variants: [{ color: 'Black', imageUrl: 'javascript:bad' }] },
  ], { brand: 'Nike', partNumber: 'PN' }))
})
