import test from 'node:test'
import assert from 'node:assert/strict'
import { applyProductMask, productFrame } from './productCutout.js'

function image(width, height, color) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) data.set(color, i)
  return { width, height, data }
}

test('silhouette mask preserves white fabric, colored prints and texture without whitening or grayscale', () => {
  const source = image(5, 1, [255, 255, 255, 255])
  source.data.set([248, 247, 244, 255], 4)
  source.data.set([180, 30, 70, 255], 8)
  source.data.set([55, 91, 122, 255], 12)
  const mask = image(5, 1, [255, 255, 255, 255])
  mask.data[3] = 0
  mask.data[19] = 10
  const result = applyProductMask(source, mask)
  assert.equal(result[3], 0)
  assert.deepEqual([...result.slice(4, 16)], [...source.data.slice(4, 16)])
  assert.equal(result[19], 0)
  assert.equal(source.data[3], 255)
})

test('removes white edge contamination using adjacent fabric color without changing interior pixels', () => {
  const source = image(3, 1, [255, 255, 255, 255])
  source.data.set([220, 180, 190, 255], 4)
  source.data.set([140, 20, 60, 255], 8)
  const mask = image(3, 1, [255, 255, 255, 255])
  mask.data[3] = 0
  mask.data[7] = 128
  const result = applyProductMask(source, mask)
  assert.deepEqual([...result.slice(4, 7)], [140, 20, 60])
  assert.equal(result[7], 153)
  assert.deepEqual([...result.slice(8, 12)], [140, 20, 60, 255])
})

test('rejects mismatched masks instead of generating corrupted clothing', () => {
  assert.throws(() => applyProductMask(image(2, 1, [0, 0, 0, 255]),
    image(1, 1, [255, 255, 255, 255])), /dimensions/)
})

test('preserves low-confidence thin garment edges rather than clipping them away', () => {
  const source = image(3, 1, [30, 60, 120, 255])
  const mask = image(3, 1, [255, 255, 255, 255])
  mask.data[3] = 0
  mask.data[7] = 80
  const result = applyProductMask(source, mask)
  assert.equal(result[3], 0)
  assert.deepEqual([...result.slice(4, 8)], [30, 60, 120, 77])
  assert.deepEqual([...result.slice(8, 12)], [30, 60, 120, 255])
})

test('frames all visible product pixels, including faint tips, with transparent breathing room', () => {
  const source = image(100, 120, [0, 0, 0, 0])
  source.data.set([180, 30, 70, 255], (20 * 100 + 30) * 4)
  source.data.set([180, 30, 70, 1], (100 * 100 + 75) * 4)
  assert.deepEqual(productFrame(source), { left: 30, top: 20, width: 46, height: 81, padding: 5 })
  assert.equal(source.data[(100 * 100 + 75) * 4 + 3], 1)
})

test('adds padding even when the garment already touches every edge and rejects empty cutouts', () => {
  assert.deepEqual(productFrame(image(50, 100, [30, 60, 120, 255])),
    { left: 0, top: 0, width: 50, height: 100, padding: 6 })
  assert.throws(() => productFrame(image(2, 2, [0, 0, 0, 0])), /no visible pixels/)
})

test('uncertain interior fabric stays opaque and mask holes cannot turn prints into the page color', () => {
  const source = image(9, 9, [255, 255, 255, 255])
  const mask = image(9, 9, [255, 255, 255, 0])
  for (let y = 1; y < 8; y++) {
    for (let x = 1; x < 8; x++) {
      const i = (y * 9 + x) * 4
      source.data.set([30 + x, 60 + y, 120, 255], i)
      mask.data[i + 3] = 140
    }
  }
  const center = (4 * 9 + 4) * 4
  mask.data[center + 3] = 0
  const result = applyProductMask(source, mask)
  assert.deepEqual([...result.slice(center, center + 4)], [...source.data.slice(center, center + 4)])
  const interior = (3 * 9 + 3) * 4
  assert.deepEqual([...result.slice(interior, interior + 4)], [...source.data.slice(interior, interior + 4)])
  assert.equal(result[3], 0)
})

test('removes white background openings inside handles without removing enclosed fabric texture', () => {
  const source = image(10, 10, [255, 255, 255, 255])
  const mask = image(10, 10, [255, 255, 255, 0])
  for (let y = 1; y < 9; y++) {
    for (let x = 1; x < 9; x++) {
      if (x >= 3 && x <= 6 && y >= 3 && y <= 6) continue
      const i = (y * 10 + x) * 4
      source.data.set([25, 30, 45, 255], i)
      mask.data[i + 3] = 255
    }
  }
  const result = applyProductMask(source, mask)
  assert.equal(result[(4 * 10 + 4) * 4 + 3], 0)
  assert.equal(result[(2 * 10 + 2) * 4 + 3], 255)
})
