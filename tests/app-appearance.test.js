import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyBackgroundImage, applyBackgroundPhoto, applyCustomBgColor,
  applySearchBackground, backgroundEffectStyle, clearSearchBackground,
  BG_COLOR_KEY, CUSTOM_BG_COLOR_KEY,
} from '../appAppearance.js'

test('Home search changes only effect colors and restores the previous wallpaper and contrast', () => {
  const previous = Object.fromEntries(['document', 'localStorage'].map((key) =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const tokens = new Map()
  const storage = new Map()
  const root = { dataset: {}, style: {
    setProperty: (key, value) => tokens.set(key, value),
    removeProperty: (key) => tokens.delete(key),
  } }
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    documentElement: root, querySelector: () => null,
  } })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } })
  try {
    applyCustomBgColor('#18222c', { matchColor: true })
    applyBackgroundPhoto('data:image/png;base64,photo')
    applyBackgroundImage('none')
    const base = tokens.get('--atmosphere-base')
    const effect = tokens.get('--atmosphere-effect-b')
    const scheme = root.dataset.scheme
    const preference = storage.get(CUSTOM_BG_COLOR_KEY)
    for (const color of ['#dc143c', '#ffffff', '#00ffff']) {
      applySearchBackground(color)
      assert.equal(tokens.get('--atmosphere-base'), base)
      assert.equal(root.dataset.scheme, scheme)
      assert.equal(root.style.colorScheme, scheme)
      assert.equal(storage.get(BG_COLOR_KEY), 'custom')
      assert.equal(storage.get(CUSTOM_BG_COLOR_KEY), preference)
      assert.equal(tokens.get('--atmosphere-effect-b'), backgroundEffectStyle(color)['--atmosphere-effect-b'])
      assert.equal(root.dataset.bgImage, 'atmosphere')
      assert.equal(root.dataset.bgPhoto, undefined)
    }
    clearSearchBackground()
    assert.equal(tokens.get('--atmosphere-base'), base)
    assert.equal(tokens.get('--atmosphere-effect-b'), effect)
    assert.equal(root.dataset.bgImage, 'none')
    assert.equal(root.dataset.bgPhoto, 'on')
    assert.equal(root.dataset.scheme, scheme)
  } finally {
    clearSearchBackground()
    for (const key of Object.keys(previous)) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
      else delete globalThis[key]
    }
  }
})
