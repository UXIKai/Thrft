import test from 'node:test'
import assert from 'node:assert/strict'
import { hasTransparency, productFrame } from './productCutout.js'

function image(width, height, color) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) data.set(color, i)
  return { width, height, data }
}

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

test('already transparent photos are detected so they skip background removal', () => {
  const photo = image(10, 10, [255, 255, 255, 255])
  assert.equal(hasTransparency(photo), false)
  for (let i = 0; i < 20; i++) photo.data[i * 4 + 3] = 0
  assert.equal(hasTransparency(photo), true)
})
