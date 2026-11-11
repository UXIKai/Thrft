import test from 'node:test'
import assert from 'node:assert/strict'

test('black Settings backgrounds disable dark mode, preserve contrast, and survive reload', async () => {
  const saved = new Map()
  const tokens = new Map()
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const root = {
    dataset: {},
    style: {
      setProperty: (key, value) => tokens.set(key, value),
      removeProperty: (key) => tokens.delete(key),
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, String(value)),
      removeItem: (key) => saved.delete(key),
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: root,
      querySelector: () => ({ classList: { toggle() {} } }),
    },
  })
  try {
    const appearance = await import('./appAppearance.js?black-background-test')
    appearance.applyTheme('dark')
    appearance.setPaletteSlot(1, '#000000')
    appearance.applyBgColor('c1')
    assert.equal(appearance.readTheme(), 'light')
    assert.equal(root.dataset.theme, 'light')
    assert.equal(root.style.colorScheme, 'dark', 'white text remains on the black background')
    assert.equal(tokens.get('--void'), 'rgb(0, 0, 0)')

    appearance.applyTheme('dark')
    appearance.applyCustomBgColor('#080808')
    assert.equal(appearance.readTheme(), 'light')
    assert.equal(root.dataset.theme, 'light')
    assert.equal(root.style.colorScheme, 'dark')
    assert.equal(tokens.get('--void'), 'rgb(8, 8, 8)')

    const reloaded = await import('./appAppearance.js?black-background-reload-test')
    reloaded.initAppearance()
    assert.equal(reloaded.readTheme(), 'light')
    assert.equal(root.dataset.theme, 'light')
    assert.equal(root.style.colorScheme, 'dark')
    assert.equal(tokens.get('--void'), 'rgb(8, 8, 8)')

    reloaded.applyBgColor('none')
    assert.equal(root.style.colorScheme, 'light', 'neutral background restores the saved light mode')

    reloaded.applyTheme('dark')
    reloaded.applyCustomBgColor('#000000', { matchColor: true })
    assert.equal(reloaded.readTheme(), 'dark', 'Home search does not change the saved theme')

    reloaded.applyCustomBgColor('#ffffff')
    assert.equal(reloaded.readTheme(), 'dark', 'nonblack Settings colors do not disable dark mode')

    reloaded.applyTheme('dark')
    reloaded.applyCustomBgColor('#080808')
    const originalVoid = tokens.get('--void')
    reloaded.applySearchBackground('#ffffff')
    reloaded.applySearchBackground('#ff0000')
    reloaded.clearSearchBackground()
    assert.equal(tokens.get('--void'), originalVoid, 'clearing search restores the original black background, not neutral light mode')
    assert.equal(root.style.colorScheme, 'dark')
    reloaded.clearSearchBackground()
    assert.equal(tokens.get('--void'), originalVoid, 'clearing an inactive preview does not alter appearance')

    reloaded.applyCustomBgColor('#ffffff', { matchColor: true })
    reloaded.clearSearchBackground()
    assert.equal(tokens.get('--void'), 'rgb(255, 255, 255)', 'confirming without a reset preserves the background')
    reloaded.clearSearchBackground({ restoreDefault: true })
    assert.equal(reloaded.readBgColor(), reloaded.DEFAULT_BG_COLOR, 'explicit reset recovers a legacy white background without a snapshot')
    assert.equal(reloaded.readBackgroundImage(), reloaded.DEFAULT_BG_IMAGE)
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else delete globalThis.localStorage
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
    else delete globalThis.document
  }
})
