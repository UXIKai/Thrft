import test from 'node:test'
import assert from 'node:assert/strict'
import { removeWhiteBackdrop } from './whiteBackground.js'

function photo(background = 255) {
  const width = 30
  const height = 30
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data.set([background, background, background, 255], i)
  }
  return { data, width, height }
}

function rect(image, x, y, width, height, color) {
  for (let row = y; row < y + height; row++) {
    for (let col = x; col < x + width; col++) {
      image.data.set([...color, 255], (row * image.width + col) * 4)
    }
  }
}

const alpha = (image, x, y) => image.data[(y * image.width + x) * 4 + 3]

test('removes connected white backdrop, not the white logo inside a dark product', () => {
  const image = photo()
  rect(image, 5, 5, 20, 20, [20, 25, 45])
  rect(image, 10, 10, 10, 10, [255, 255, 255])
  assert.equal(removeWhiteBackdrop(image), true)
  assert.equal(alpha(image, 0, 0), 0)
  assert.equal(alpha(image, 29, 29), 0)
  assert.equal(alpha(image, 5, 5), 255)
  assert.equal(alpha(image, 15, 15), 255)
})

test('preserves white fabric enclosed by its shaded outline', () => {
  const image = photo()
  rect(image, 5, 5, 20, 20, [225, 225, 225])
  rect(image, 6, 6, 18, 18, [255, 255, 255])
  rect(image, 12, 12, 6, 6, [0, 0, 0])
  assert.equal(removeWhiteBackdrop(image), true)
  assert.equal(alpha(image, 0, 0), 0)
  assert.equal(alpha(image, 10, 10), 255)
  assert.equal(alpha(image, 14, 14), 255)
})

test('handles near-white JPEG backgrounds and feathers the connected edge', () => {
  const image = photo(250)
  rect(image, 5, 5, 20, 20, [20, 25, 45])
  rect(image, 4, 5, 1, 20, [241, 241, 241])
  assert.equal(removeWhiteBackdrop(image), true)
  assert.equal(alpha(image, 0, 0), 0)
  assert.equal(alpha(image, 4, 10), 128)
  assert.equal(alpha(image, 5, 10), 255)
})

test('declines nonuniform backdrops, white-only images, and products touching the border', () => {
  const blank = photo()
  assert.equal(removeWhiteBackdrop(blank), false)
  assert.equal(alpha(blank, 0, 0), 255)
  const colored = photo()
  rect(colored, 0, 0, 10, 30, [25, 90, 60])
  assert.equal(removeWhiteBackdrop(colored), false)
  const textured = photo()
  rect(textured, 0, 0, 10, 30, [231, 231, 231])
  assert.equal(removeWhiteBackdrop(textured), false)
})
