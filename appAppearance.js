/**
 * App-wide Appearance: Container Color + Background Color + Glass (Opaque↔Clear).
 * Tokens land on :root so every liquid-glass surface and the living wash follow live.
 *
 * Top swatch row → Containers: nav bar, pinned boxes, chat rows, fields, chips,
 *   sheets — anything clickable or any box that holds information.
 * Bottom swatch row → Background: the flowing atmosphere wash (default B/W/gray,
 *   but freely tinted by the same color variety as Containers).
 */

/** v2 key so Clear liquid-glass is the fresh default (old 80% frosted prefs discarded). */
export const GLASS_TRANSPARENCY_KEY = 'thrft-glass-pct-v2'
export const APP_COLOR_KEY = 'thrft-app-color'
export const CUSTOM_COLOR_KEY = 'thrft-app-color-hex'
export const BG_COLOR_KEY = 'thrft-bg-color-v1'
export const CUSTOM_BG_COLOR_KEY = 'thrft-bg-color-hex-v1'
export const BG_IMAGE_KEY = 'thrft-bg-image-v2'
/** Three hues that tint the living background atmosphere app-wide. */
export const BG_EFFECT_KEY = 'thrft-bg-effect-colors-v1'
/** Default Clear so the app opens in liquid-glass (not frosted plates). */
export const DEFAULT_BAR_TRANSPARENCY = 100
export const DEFAULT_APP_COLOR = 'none'
export const DEFAULT_BG_COLOR = 'none'
export const DEFAULT_BG_IMAGE = 'atmosphere'
/** Soft grayscale defaults — same feel as the original B/W wash until changed. */
export const DEFAULT_BG_EFFECTS = ['#c8c8c8', '#9a9a9a', '#6e6e6e']
export const BG_EFFECT_COUNT = 3

/** Editable swatch palette: 1 none + 11 replaceable colors (shared by both rows). */
export const PALETTE_KEY = 'thrft-swatch-palette-v1'
export const PALETTE_SIZE = 11
export const DEFAULT_PALETTE_HEXES = [
  '#1e3a5f', // navy
  '#1f4d3a', // forest
  '#1a5c5c', // teal
  '#5a2d5a', // plum
  '#8b2e3a', // cherry
  '#8a4520', // rust
  '#4a5560', // slate
  '#3d4a6b', // indigo
  '#5c4033', // cocoa
  '#2f5d50', // pine
  '#6b3a4a', // wine
]

const NONE_COLOR = {
  id: 'none',
  label: 'None',
  swatch: 'transparent',
  rgb: [255, 255, 255],
}

let paletteHexes = [...DEFAULT_PALETTE_HEXES]
const COLOR_BY_ID = { none: NONE_COLOR }
const BG_COLOR_BY_ID = { none: NONE_COLOR }

let currentColorId = DEFAULT_APP_COLOR
let currentCustomHex = '#6a7a8a'
let currentBgColorId = DEFAULT_BG_COLOR
let currentCustomBgHex = '#6a7a8a'
let currentGlassPct = DEFAULT_BAR_TRANSPARENCY
let currentBg = DEFAULT_BG_IMAGE
let currentBgEffects = [...DEFAULT_BG_EFFECTS]

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return null
  const n = Number.parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function slotId(index) {
  return `c${index}`
}

function rebuildColorMaps() {
  for (const key of Object.keys(COLOR_BY_ID)) {
    if (key !== 'none' && key !== 'custom') delete COLOR_BY_ID[key]
  }
  for (const key of Object.keys(BG_COLOR_BY_ID)) {
    if (key !== 'none' && key !== 'custom' && key !== 'customBg') {
      delete BG_COLOR_BY_ID[key]
    }
  }
  COLOR_BY_ID.none = NONE_COLOR
  BG_COLOR_BY_ID.none = NONE_COLOR
  for (let i = 0; i < PALETTE_SIZE; i += 1) {
    const hex = paletteHexes[i] || DEFAULT_PALETTE_HEXES[i]
    const rgb = hexToRgb(hex) || [100, 100, 100]
    const entry = {
      id: slotId(i),
      label: `Color ${i + 1}`,
      swatch: hex,
      rgb,
    }
    COLOR_BY_ID[entry.id] = entry
    BG_COLOR_BY_ID[entry.id] = entry
  }
}

rebuildColorMaps()

/** Live list: none + 11 palette slots (Containers + Background). */
export function getPaletteColors() {
  return [
    NONE_COLOR,
    ...paletteHexes.map((hex, i) => {
      const id = slotId(i)
      return (
        COLOR_BY_ID[id] || {
          id,
          label: `Color ${i + 1}`,
          swatch: hex,
          rgb: hexToRgb(hex) || [100, 100, 100],
        }
      )
    }),
  ]
}

export function getPaletteHexes() {
  return [...paletteHexes]
}

export function setPaletteSlot(index, hex) {
  const i = Number(index)
  if (!Number.isInteger(i) || i < 0 || i >= PALETTE_SIZE) {
    return getPaletteHexes()
  }
  const rgb = hexToRgb(hex)
  if (!rgb) return getPaletteHexes()
  const next = `#${String(hex).replace(/^#/, '').toLowerCase()}`
  paletteHexes = [...paletteHexes]
  paletteHexes[i] = next
  try {
    localStorage.setItem(PALETTE_KEY, JSON.stringify(paletteHexes))
  } catch {
    /* ignore */
  }
  rebuildColorMaps()
  applyGlassTokens()
  applyBgAtmosphereTokens()
  return getPaletteHexes()
}

export function readPalette() {
  try {
    const raw = localStorage.getItem(PALETTE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length >= PALETTE_SIZE) {
        const next = []
        for (let i = 0; i < PALETTE_SIZE; i += 1) {
          const hex = parsed[i]
          next.push(
            hexToRgb(hex)
              ? `#${String(hex).replace(/^#/, '').toLowerCase()}`
              : DEFAULT_PALETTE_HEXES[i],
          )
        }
        paletteHexes = next
        rebuildColorMaps()
        return getPaletteHexes()
      }
    }
  } catch {
    /* ignore */
  }
  paletteHexes = [...DEFAULT_PALETTE_HEXES]
  rebuildColorMaps()
  return getPaletteHexes()
}

export function resetPalette() {
  paletteHexes = [...DEFAULT_PALETTE_HEXES]
  try {
    localStorage.setItem(PALETTE_KEY, JSON.stringify(paletteHexes))
  } catch {
    /* ignore */
  }
  rebuildColorMaps()
  applyGlassTokens()
  applyBgAtmosphereTokens()
  return getPaletteHexes()
}

/** Prefer getPaletteColors() — snapshot for older static imports. */
export const APP_COLORS = getPaletteColors()
export const BG_COLORS = APP_COLORS
export const BG_FLOW_COLORS = APP_COLORS

function ensureCustomColor(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  currentCustomHex = `#${String(hex).replace(/^#/, '').toLowerCase()}`
  COLOR_BY_ID.custom = {
    id: 'custom',
    label: 'Custom',
    swatch: currentCustomHex,
    rgb,
  }
  return COLOR_BY_ID.custom
}

function ensureCustomBgColor(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  currentCustomBgHex = `#${String(hex).replace(/^#/, '').toLowerCase()}`
  BG_COLOR_BY_ID.custom = {
    id: 'custom',
    label: 'Custom',
    swatch: currentCustomBgHex,
    rgb,
  }
  return BG_COLOR_BY_ID.custom
}

function clampPct(pct) {
  const n = Number(pct)
  if (!Number.isFinite(n)) return DEFAULT_BAR_TRANSPARENCY
  return Math.max(0, Math.min(100, Math.round(n)))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function resolveColor(id) {
  if (id === 'custom') {
    return COLOR_BY_ID.custom || ensureCustomColor(currentCustomHex) || COLOR_BY_ID[DEFAULT_APP_COLOR]
  }
  return COLOR_BY_ID[id] || COLOR_BY_ID[DEFAULT_APP_COLOR]
}

function resolveBgColor(id) {
  if (id === 'custom') {
    return (
      BG_COLOR_BY_ID.custom ||
      ensureCustomBgColor(currentCustomBgHex) ||
      BG_COLOR_BY_ID[DEFAULT_BG_COLOR]
    )
  }
  return BG_COLOR_BY_ID[id] || BG_COLOR_BY_ID[DEFAULT_BG_COLOR]
}

/** Lift midtones toward white for glass rims / specular on dark hues */
function liftRgb([r, g, b], amount) {
  return [
    Math.round(lerp(r, 255, amount)),
    Math.round(lerp(g, 255, amount)),
    Math.round(lerp(b, 255, amount)),
  ]
}

function rgba(rgb, a) {
  const [r, g, b] = rgb
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`
}

/**
 * Recompute all glass CSS vars from current color + slider.
 *
 * Slider label: Opaque (0) → Clear (100).
 * Opaque = frosted charcoal plates.
 * Clear = water / crystal glass — see-through, bright rim, wet sheen (not gray stain).
 */
export function applyGlassTokens() {
  const percent = clampPct(currentGlassPct)
  const clear = percent / 100
  const opaque = 1 - clear
  // Ease harder into the water look near Clear so mid-slider still has body
  const water = clear * clear
  const color = resolveColor(currentColorId)
  const hasColor = color.id !== 'none'

  // Opaque = dense hue frost. Clear = translucent film of the same swatch so
  // nav / pins / chat rows / info boxes all clearly read as Containers.
  const frostBase = hasColor ? color.rgb : [36, 36, 36]
  // Barely lift at Clear — washed pastels made Containers look "broken".
  const waterBase = hasColor ? liftRgb(color.rgb, 0.06) : [255, 255, 255]
  const base = [
    Math.round(lerp(frostBase[0], waterBase[0], water)),
    Math.round(lerp(frostBase[1], waterBase[1], water)),
    Math.round(lerp(frostBase[2], waterBase[2], water)),
  ]
  const frostRim = hasColor ? liftRgb(frostBase, 0.12) : [150, 150, 150]
  const waterRim = hasColor ? liftRgb(color.rgb, 0.28) : [255, 255, 255]
  const rim = [
    Math.round(lerp(frostRim[0], waterRim[0], water)),
    Math.round(lerp(frostRim[1], waterRim[1], water)),
    Math.round(lerp(frostRim[2], waterRim[2], water)),
  ]
  const frostSheen = hasColor ? liftRgb(frostBase, 0.4) : [170, 170, 170]
  const waterSheen = hasColor ? liftRgb(color.rgb, 0.55) : [255, 255, 255]
  const sheen = [
    Math.round(lerp(frostSheen[0], waterSheen[0], water)),
    Math.round(lerp(frostSheen[1], waterSheen[1], water)),
    Math.round(lerp(frostSheen[2], waterSheen[2], water)),
  ]

  // Strong enough at Clear that pinned boxes / tab bar / chat rows obviously change.
  const clearTint = lerp(hasColor ? 0.34 : 0.004, hasColor ? 0.5 : 0.34, opaque)
  const clearTintActive = lerp(hasColor ? 0.46 : 0.018, hasColor ? 0.58 : 0.42, opaque)
  const tint = lerp(hasColor ? 0.36 : 0.01, hasColor ? 0.52 : 0.38, opaque)
  const tintActive = lerp(hasColor ? 0.48 : 0.028, hasColor ? 0.62 : 0.48, opaque)
  const border = lerp(hasColor ? 0.88 : 0.4, hasColor ? 0.28 : 0.1, opaque)

  // Soft lens blur for refraction; stay light at Clear so the wash reads through
  const blur = lerp(1.6, 14, opaque)
  const clearBlur = lerp(1.25, 11, opaque)
  const sat = lerp(1.78, 1.04, opaque)
  const bright = lerp(1.08, 0.9, opaque)
  const clearBright = lerp(1.1, 0.9, opaque)
  // Keep Clear specular as a thin wet lip — high opacity full-pane washes gray
  const specular = lerp(0.38, 0.06, opaque)
  const depthAlpha = lerp(0.1, 0.38, opaque)
  const insetHi = lerp(0.7, 0.06, opaque)
  const insetLo = lerp(0.16, 0.03, opaque)
  // soft-light milks gray on dark; screen gives a wet white glint at Clear
  const specularBlend = water > 0.45 ? 'screen' : 'soft-light'

  const root = document.documentElement
  root.dataset.appColor = color.id
  root.dataset.glass = String(percent)
  root.style.setProperty('--app-color-id', color.id)
  root.style.setProperty('--app-color-swatch', color.swatch === 'transparent' ? '#8c8c8c' : color.swatch)
  root.style.setProperty('--app-color-rgb', frostBase.join(', '))

  root.style.setProperty('--glass-transparency', String(percent))
  root.style.setProperty('--glass-clear-tint', rgba(base, clearTint))
  root.style.setProperty('--glass-clear-tint-active', rgba(base, clearTintActive))
  root.style.setProperty('--glass-tint', rgba(base, tint))
  root.style.setProperty('--glass-tint-active', rgba(base, tintActive))
  root.style.setProperty('--glass-border', rgba(rim, border))
  root.style.setProperty('--glass-blur', `${blur.toFixed(2)}px`)
  root.style.setProperty('--glass-clear-blur', `${clearBlur.toFixed(2)}px`)
  root.style.setProperty('--glass-sat', sat.toFixed(2))
  root.style.setProperty('--glass-bright', bright.toFixed(2))
  root.style.setProperty('--glass-clear-bright', clearBright.toFixed(2))
  root.style.setProperty('--glass-specular-opacity', specular.toFixed(2))
  root.style.setProperty('--glass-specular-blend', specularBlend)
  root.style.setProperty(
    '--glass-specular',
    `linear-gradient(125deg, ${rgba(sheen, lerp(0.5, 0.14, opaque))} 0%, ${rgba(sheen, lerp(0.1, 0.03, opaque))} 16%, transparent 36%)`,
  )
  root.style.setProperty(
    '--glass-clear-specular',
    `linear-gradient(180deg, ${rgba(sheen, lerp(0.55, 0.1, opaque))} 0%, ${rgba(sheen, lerp(0.1, 0.02, opaque))} 10%, transparent 26%)`,
  )
  root.style.setProperty(
    '--glass-depth',
    `0 10px 36px rgba(0, 0, 0, ${depthAlpha.toFixed(2)}),
    inset 0 1px 1px ${rgba(sheen, insetHi)},
    inset 0 -1px 1px ${rgba(sheen, insetLo)},
    inset 1px 0 1px ${rgba(sheen, insetLo * 0.85)},
    inset -1px 0 1px ${rgba(sheen, insetLo * 0.85)}`,
  )
  root.style.setProperty(
    '--glass-clear-depth',
    `0 8px 28px rgba(0, 0, 0, ${(depthAlpha * 0.7).toFixed(2)}),
    inset 0 1px 0 ${rgba(sheen, lerp(0.78, 0.05, opaque))},
    inset 0 -0.5px 0 ${rgba(sheen, lerp(0.16, 0.02, opaque))}`,
  )

  // Settings / full-screen panels stay dense — use frost hue, not the water film
  const panelRgb = hasColor
    ? [
        Math.round(frostBase[0] * 0.18),
        Math.round(frostBase[1] * 0.18),
        Math.round(frostBase[2] * 0.18),
      ]
    : [5, 5, 5]
  root.style.setProperty('--app-panel', rgba(panelRgb, 0.96))
  root.style.setProperty(
    '--app-scrim',
    hasColor ? rgba(frostBase, 0.45) : 'rgba(5, 5, 5, 0.48)',
  )
  root.style.setProperty('--app-scrim-blur', '8px')

  // Home clothing-type chips — same Opaque↔Clear fill curve as glass panes
  // (no backdrop-filter; alpha tracks --glass-tint / border)
  root.style.setProperty('--type-chip-fill', rgba(base, tint))
  root.style.setProperty('--type-chip-fill-active', rgba(base, tintActive))
  root.style.setProperty('--type-chip-border', rgba(rim, border))
  root.style.setProperty(
    '--type-chip-border-active',
    rgba(rim, Math.min(0.85, border + lerp(0.12, 0.04, opaque))),
  )

  // Accent follows container hue; page wash is owned by Background (bottom row).
  const accent = hasColor ? liftRgb(frostBase, 0.55) : [61, 214, 140]
  root.style.setProperty('--settings-accent', `rgb(${accent.join(', ')})`)

  return percent
}

/**
 * Bottom Appearance row — flowing atmosphere behind the app.
 * Default is B/W/gray; any swatch/custom hue tints that wash.
 * Never writes glass / container tokens — those stay on Containers.
 */
export function applyBgAtmosphereTokens() {
  const root = document.documentElement
  const color = resolveBgColor(currentBgColorId)
  const hasColor = color.id !== 'none'
  const base = hasColor ? color.rgb : [36, 36, 36]

  root.dataset.bgColor = color.id
  root.style.setProperty('--bg-color-id', color.id)
  root.style.setProperty(
    '--bg-color-swatch',
    color.swatch === 'transparent' ? '#8c8c8c' : color.swatch,
  )
  root.style.setProperty('--bg-color-rgb', base.join(', '))

  // Deep void keeps the wash readable; hue lives in the flowing clouds.
  const voidRgb = hasColor
    ? [
        Math.round(base[0] * 0.12),
        Math.round(base[1] * 0.12),
        Math.round(base[2] * 0.12),
      ]
    : [5, 5, 5]

  root.style.setProperty('--void', `rgb(${voidRgb.join(', ')})`)
  root.style.setProperty('--atmosphere-base', `rgb(${voidRgb.join(', ')})`)
  root.style.setProperty('--atmosphere-base-rgb', voidRgb.join(', '))
  // Don't paint Settings panes — that looked like Containers stealing Background.
  root.style.setProperty('--settings-wash', 'transparent')

  if (hasColor) {
    const effectA = liftRgb(base, 0.58)
    const effectB = liftRgb(base, 0.3)
    const effectC = liftRgb(base, 0.12)
    currentBgEffects = [
      `#${effectA.map((n) => n.toString(16).padStart(2, '0')).join('')}`,
      `#${effectB.map((n) => n.toString(16).padStart(2, '0')).join('')}`,
      `#${effectC.map((n) => n.toString(16).padStart(2, '0')).join('')}`,
    ]
    ;[
      ['a', effectA],
      ['b', effectB],
      ['c', effectC],
    ].forEach(([key, rgb]) => {
      root.style.setProperty(
        `--atmosphere-effect-${key}`,
        `rgb(${rgb.join(', ')})`,
      )
      root.style.setProperty(
        `--atmosphere-effect-${key}-rgb`,
        rgb.join(', '),
      )
    })
  } else {
    currentBgEffects = [...DEFAULT_BG_EFFECTS]
    currentBgEffects.forEach((hex, i) => {
      const rgb = hexToRgb(hex) || [160, 160, 160]
      const key = String.fromCharCode(97 + i)
      root.style.setProperty(`--atmosphere-effect-${key}`, hex)
      root.style.setProperty(
        `--atmosphere-effect-${key}-rgb`,
        rgb.join(', '),
      )
    })
  }

  return currentBgColorId
}

export function applyBarTransparency(pct) {
  currentGlassPct = clampPct(pct)
  try {
    localStorage.setItem(GLASS_TRANSPARENCY_KEY, String(currentGlassPct))
  } catch {
    /* ignore */
  }
  applyGlassTokens()
  return currentGlassPct
}

export function readBarTransparency() {
  try {
    const raw = localStorage.getItem(GLASS_TRANSPARENCY_KEY)
    if (raw == null) return DEFAULT_BAR_TRANSPARENCY
    return clampPct(raw)
  } catch {
    return DEFAULT_BAR_TRANSPARENCY
  }
}

export function applyAppColor(id) {
  const color = resolveColor(id)
  currentColorId = color.id
  try {
    localStorage.setItem(APP_COLOR_KEY, currentColorId)
  } catch {
    /* ignore */
  }
  applyGlassTokens()
  return currentColorId
}

/** Live color-wheel pick — tints every glass container (buttons + info panes). */
export function applyCustomColor(hex) {
  const color = ensureCustomColor(hex)
  if (!color) return currentColorId
  currentColorId = 'custom'
  try {
    localStorage.setItem(APP_COLOR_KEY, 'custom')
    localStorage.setItem(CUSTOM_COLOR_KEY, currentCustomHex)
  } catch {
    /* ignore */
  }
  applyGlassTokens()
  return currentCustomHex
}

export function readCustomColorHex() {
  try {
    const raw = localStorage.getItem(CUSTOM_COLOR_KEY)
    if (raw && hexToRgb(raw)) {
      currentCustomHex = raw.startsWith('#') ? raw : `#${raw}`
      ensureCustomColor(currentCustomHex)
      return currentCustomHex
    }
  } catch {
    /* ignore */
  }
  return currentCustomHex
}

export function readAppColor() {
  try {
    const raw = localStorage.getItem(APP_COLOR_KEY)
    if (raw == null) return DEFAULT_APP_COLOR
    if (raw === 'custom') {
      readCustomColorHex()
      return 'custom'
    }
    return resolveColor(raw).id
  } catch {
    return DEFAULT_APP_COLOR
  }
}

/** Background effect swatch — living atmosphere only. */
export function applyBgColor(id) {
  const color = resolveBgColor(id)
  currentBgColorId = color.id
  if (color.id === 'none') {
    currentBgEffects = [...DEFAULT_BG_EFFECTS]
  }
  try {
    localStorage.setItem(BG_COLOR_KEY, currentBgColorId)
  } catch {
    /* ignore */
  }
  applyBgAtmosphereTokens()
  return currentBgColorId
}

/** Live color-wheel pick for the background wash. */
export function applyCustomBgColor(hex) {
  const color = ensureCustomBgColor(hex)
  if (!color) return currentBgColorId
  currentBgColorId = 'custom'
  try {
    localStorage.setItem(BG_COLOR_KEY, 'custom')
    localStorage.setItem(CUSTOM_BG_COLOR_KEY, currentCustomBgHex)
  } catch {
    /* ignore */
  }
  applyBgAtmosphereTokens()
  return currentCustomBgHex
}

export function readCustomBgColorHex() {
  try {
    const raw = localStorage.getItem(CUSTOM_BG_COLOR_KEY)
    if (raw && hexToRgb(raw)) {
      currentCustomBgHex = raw.startsWith('#') ? raw : `#${raw}`
      ensureCustomBgColor(currentCustomBgHex)
      return currentCustomBgHex
    }
  } catch {
    /* ignore */
  }
  return currentCustomBgHex
}

export function readBgColor() {
  try {
    const raw = localStorage.getItem(BG_COLOR_KEY)
    if (raw == null) return DEFAULT_BG_COLOR
    if (raw === 'custom') {
      readCustomBgColorHex()
      return 'custom'
    }
    // Ignore retired B/W/G-only ids from the short-lived flow palette.
    if (raw === 'black' || raw === 'gray' || raw === 'white') {
      return DEFAULT_BG_COLOR
    }
    return resolveBgColor(raw).id
  } catch {
    return DEFAULT_BG_COLOR
  }
}

/**
 * Background Image: none = hide living atmosphere; atmosphere = default wash.
 */
export function applyBackgroundImage(mode) {
  currentBg = mode === 'atmosphere' ? 'atmosphere' : 'none'
  const root = document.documentElement
  root.dataset.bgImage = currentBg
  const stage = document.querySelector('.stage')
  if (stage) {
    stage.classList.toggle('is-bg-none', currentBg === 'none')
    stage.classList.toggle('is-bg-atmosphere', currentBg === 'atmosphere')
  }
  try {
    localStorage.setItem(BG_IMAGE_KEY, currentBg)
  } catch {
    /* ignore */
  }
  return currentBg
}

function normalizeBgEffects(list) {
  const next = [...DEFAULT_BG_EFFECTS]
  if (!Array.isArray(list)) return next
  for (let i = 0; i < BG_EFFECT_COUNT; i++) {
    const rgb = hexToRgb(list[i])
    if (rgb) next[i] = `#${String(list[i]).replace(/^#/, '').toLowerCase()}`
  }
  return next
}

/** Push the three atmosphere tint colors onto :root for Home + Getting Started. */
export function applyBgEffectColors(colors = currentBgEffects) {
  currentBgEffects = normalizeBgEffects(colors)
  try {
    localStorage.setItem(BG_EFFECT_KEY, JSON.stringify(currentBgEffects))
  } catch {
    /* ignore */
  }
  // Background Color swatch owns the wash when set — don't overwrite its tint.
  if (currentBgColorId !== 'none') {
    applyBgAtmosphereTokens()
    return [...currentBgEffects]
  }
  applyBgAtmosphereTokens()
  return [...currentBgEffects]
}

export function setBgEffectColor(index, hex) {
  const i = Number(index)
  if (!Number.isInteger(i) || i < 0 || i >= BG_EFFECT_COUNT) {
    return [...currentBgEffects]
  }
  if (!hexToRgb(hex)) return [...currentBgEffects]
  const next = [...currentBgEffects]
  next[i] = `#${String(hex).replace(/^#/, '').toLowerCase()}`
  return applyBgEffectColors(next)
}

/** Restore the default grayscale atmosphere flow colors. */
export function resetBgEffectColors() {
  return applyBgEffectColors([...DEFAULT_BG_EFFECTS])
}

export function bgEffectsAreDefault(colors = currentBgEffects) {
  const list = normalizeBgEffects(colors)
  return DEFAULT_BG_EFFECTS.every(
    (hex, i) => list[i]?.toLowerCase() === hex.toLowerCase(),
  )
}

export function readBgEffectColors() {
  try {
    const raw = localStorage.getItem(BG_EFFECT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      currentBgEffects = normalizeBgEffects(parsed)
      return [...currentBgEffects]
    }
  } catch {
    /* ignore */
  }
  currentBgEffects = [...DEFAULT_BG_EFFECTS]
  return [...currentBgEffects]
}

export function readBackgroundImage() {
  try {
    const raw = localStorage.getItem(BG_IMAGE_KEY)
    if (raw === 'none') return 'none'
    if (raw === 'atmosphere' || raw == null) return 'atmosphere'
    return DEFAULT_BG_IMAGE
  } catch {
    return DEFAULT_BG_IMAGE
  }
}

export function initAppearance() {
  readPalette()
  readCustomColorHex()
  readCustomBgColorHex()
  currentColorId = readAppColor()
  currentBgColorId = readBgColor()
  currentGlassPct = readBarTransparency()
  readBgEffectColors()
  // Flowing B/W/gray wash is the stage look
  currentBg = 'atmosphere'
  applyGlassTokens()
  applyBgAtmosphereTokens()
  const applyBg = () => applyBackgroundImage('atmosphere')
  if (document.querySelector('.stage')) applyBg()
  else queueMicrotask(applyBg)
  return {
    color: currentColorId,
    bgColor: currentBgColorId,
    glass: currentGlassPct,
    background: currentBg,
    bgEffects: [...currentBgEffects],
  }
}

/** @deprecated use initAppearance — kept for older imports */
export function initBarTransparency() {
  return initAppearance().glass
}
