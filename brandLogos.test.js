import assert from 'node:assert/strict'
import test from 'node:test'
import { BRAND_DOMAINS, BRAND_LOGO_TILE_PX, brandLogoBackground, packBrandLogoLanes, squareLogoBackground } from './brandLogos.js'

test('detects arbitrary square backgrounds without tinting transparent or non-square marks', () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels.set([24, 80, 160, 255], i)
  }
  assert.equal(squareLogoBackground(pixels, 8, 8), '#1850a0')
  pixels.set([255, 255, 255, 255], (3 * 8 + 3) * 4)
  assert.equal(squareLogoBackground(pixels, 8, 8), '#1850a0')
  assert.equal(squareLogoBackground(pixels, 8, 4), null)
  pixels[3] = 0
  assert.equal(squareLogoBackground(pixels, 8, 8), null)
  pixels.set([255, 0, 0, 255], 0)
  assert.equal(squareLogoBackground(pixels, 8, 8), null)
})

test('only known solid square logos tint the center', () => {
  assert.equal(brandLogoBackground('Gap'), '#000b3b')
  assert.equal(brandLogoBackground('UGG'), '#909090')
  assert.equal(brandLogoBackground('Uniqlo'), '#ff0000')
  assert.equal(brandLogoBackground('Dr. Martens'), '#000000')
  for (const name of ['Nike', 'Moncler', 'Adidas', 'Custom', '', undefined]) {
    assert.equal(brandLogoBackground(name), '#ffffff')
  }
})

test('logo rings preserve every brand and clear the center and each other', () => {
  for (const count of [0, 1, 2, 7, 24, Object.keys(BRAND_DOMAINS).length, 250]) {
    for (const seat of [44, 59]) {
      const brands = Array.from({ length: count }, (_, id) => ({ id }))
      const { slots, maxR } = packBrandLogoLanes(brands, seat)
      assert.equal(slots.length, count)
      for (let i = 0; i < slots.length; i += 1) {
        const a = slots[i]
        assert.ok(a.r - Math.SQRT2 * BRAND_LOGO_TILE_PX / 2 >= seat + 24 - 1e-8)
        assert.ok(maxR >= a.r)
        for (let j = 0; j < i; j += 1) {
          const b = slots[j]
          const distance = Math.hypot(
            Math.cos(a.lon) * a.r - Math.cos(b.lon) * b.r,
            Math.sin(a.lon) * a.r - Math.sin(b.lon) * b.r,
          )
          // Circumscribed circles also clear at every shared rotation angle.
          assert.ok(distance >= Math.SQRT2 * BRAND_LOGO_TILE_PX + 20 - 1e-8)
        }
      }
    }
  }
})
