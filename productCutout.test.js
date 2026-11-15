import test from 'node:test'
import assert from 'node:assert/strict'
import { applyProductMask } from './productCutout.js'

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
  assert.equal(result[7], 128)
  assert.deepEqual([...result.slice(8, 12)], [140, 20, 60, 255])
})

test('rejects mismatched masks instead of generating corrupted clothing', () => {
  assert.throws(() => applyProductMask(image(2, 1, [0, 0, 0, 255]),
    image(1, 1, [255, 255, 255, 255])), /dimensions/)
})
