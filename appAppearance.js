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
const BG_MATCH_KEY = 'thrft-bg-match-color-v1'
export const THEME_KEY = 'thrft-theme-v1'
export const USER_THEME_KEY = 'thrft-user-theme-v1'
export const MOONLIGHT_KEY = 'thrft-moonlight-v1'
// v2: light mode used to save 50 here, which left a black dim over every page, light or dark
export const BRIGHTNESS_KEY = 'thrft-brightness-v2'
export const DEFAULT_BRIGHTNESS = 100

export function readBrightness() {
  try {
    const raw = localStorage.getItem(BRIGHTNESS_KEY)
    if (raw === null) return DEFAULT_BRIGHTNESS
    const value = Number(raw)
    return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : DEFAULT_BRIGHTNESS
  } catch (error) {
    console.warn('Unable to read app brightness.', error)
    return DEFAULT_BRIGHTNESS
  }
}

// Dimmed far enough, even a white page reads as dark, so ink turns white.
const DARKENS_PAGE_AT_DIM = 0.5
let dimOpacity = 0

export function applyBrightness(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error('Brightness must be a number.')
  const brightness = Math.min(100, Math.max(0, Math.round(number)))
  dimOpacity = (1 - brightness / 100) * 0.65
  document.documentElement.style.setProperty('--app-dim-opacity', String(dimOpacity))
  syncColorScheme()
  try {
    localStorage.setItem(BRIGHTNESS_KEY, String(brightness))
  } catch (error) {
    console.warn('Unable to save app brightness.', error)
  }
  return brightness
}
export const UI_SCALE_KEY = 'thrft-ui-scale-v1'
export const DEFAULT_UI_SCALE = 100
export const BG_PHOTO_KEY = 'thrft-bg-photo-v1'
/** Three hues that tint the living background atmosphere app-wide. */
export const BG_EFFECT_KEY = 'thrft-bg-effect-colors-v1'
/** Default Clear so the app opens in liquid-glass (not frosted plates). */
export const DEFAULT_BAR_TRANSPARENCY = 20
export const DEFAULT_APP_COLOR = 'none'
export const DEFAULT_BG_COLOR = 'none'
export const DEFAULT_BG_IMAGE = 'atmosphere'
/** Soft grayscale defaults — same feel as the original B/W wash until changed. */
export const DEFAULT_BG_EFFECTS = ['#c8c8c8', '#9a9a9a', '#6e6e6e']
export const BG_EFFECT_COUNT = 3

/** Editable swatch palette: 1 none + 11 replaceable colors (shared by both rows). */
export const PALETTE_KEY = 'thrft-swatch-palette-v1'
export const PALETTE_SIZE = 11
export const RECENT_COLORS_KEY = 'thrft-recent-colors-v1'
export const RECENT_COLOR_COUNT = 8
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
let currentTheme = 'dark'
let pageIsDark = false
let matchBackgroundColor = false
// Moonlight: the moon button's black page + inverted containers look.
let moonlightOn = false

export function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch (error) {
    console.warn('Unable to read display mode.', error)
    return 'dark'
  }
}

/** Mode the user picked with the moon button; a black background may override it temporarily. */
export function readUserTheme() {
  try {
    const raw = localStorage.getItem(USER_THEME_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    /* ignore */
  }
  return readTheme()
}

function saveUserTheme(theme) {
  try {
    localStorage.setItem(USER_THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function colorSchemeForHex(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) throw new Error('Contrast color must be a six-digit hex color.')
  return relativeLuminance(rgb) > 0.179 ? 'light' : 'dark'
}

/** Bright matched backgrounds get black text; dark ones get white. Otherwise the chosen theme. */
function syncColorScheme() {
  const root = document.documentElement
  let scheme = currentTheme
  if (matchBackgroundColor) {
    const color = resolveBgColor(currentBgColorId)
    if (color.id !== 'none') {
      // WCAG: black text has more contrast than white above ~0.179 luminance.
      scheme = relativeLuminance(color.rgb) > 0.179 ? 'light' : 'dark'
    }
  }
  if (!moonlightOn && !pageIsDark) {
    // A bright chosen background or container color needs dark ink, effect on or off.
    for (const color of [resolveBgColor(currentBgColorId), resolveColor(currentColorId)]) {
      if (color.id !== 'none' && relativeLuminance(color.rgb) > 0.4) scheme = 'light'
    }
  }
  if (dimOpacity >= DARKENS_PAGE_AT_DIM) scheme = 'dark'
  root.style.colorScheme = scheme
  root.dataset.scheme = scheme
}

export function applyTheme(theme) {
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error('Display mode must be dark or light.')
  }
  currentTheme = theme
  document.documentElement.dataset.theme = theme
  applyGlassTokens()
  applyBgAtmosphereTokens()
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch (error) {
    console.warn('Unable to save display mode.', error)
  }
  return theme
}

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

export function readRecentColors() {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const next = []
    for (const hex of parsed) {
      const rgb = hexToRgb(hex)
      if (!rgb) continue
      const normalized = `#${String(hex).replace(/^#/, '').toLowerCase()}`
      if (!next.includes(normalized)) next.push(normalized)
      if (next.length === RECENT_COLOR_COUNT) break
    }
    return next
  } catch {
    return []
  }
}

/** Newest first. Drops duplicates and keeps the last 8 choices. */
export function rememberRecentColor(hex) {
  const rgb = hexToRgb(hex)
  const prev = readRecentColors()
  if (!rgb) return prev
  const normalized = `#${String(hex).replace(/^#/, '').toLowerCase()}`
  const next = [normalized, ...prev.filter((c) => c !== normalized)].slice(
    0,
    RECENT_COLOR_COUNT,
  )
  try {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
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
 * Opaque = frosted glass plate. Clear = see-through crystal.
 * Linear with the thumb so pulling toward Clear actually clears the glass.
 */
export function applyGlassTokens() {
  const percent = currentGlassPct
  const clear = percent / 100
  const opaque = 1 - clear
  const color = resolveColor(currentColorId)
  const hasColor = color.id !== 'none'

  // Colored glass, not a painted plate. The swatch hue stays in the film,
  // lifted just enough that a dark swatch still reads through the pane.
  // Alpha stays low so the atmosphere shows through. None is the only colorless state.
  const neutral = currentTheme === 'light' ? [20, 20, 20] : [255, 255, 255]
  const frostBase = hasColor ? color.rgb : neutral
  const base = hasColor ? liftRgb(frostBase, 0.42) : neutral
  const rim = hasColor ? liftRgb(frostBase, 0.28) : neutral
  const sheen = hasColor ? liftRgb(frostBase, 0.7) : neutral

  const clearTint = hasColor ? lerp(0.16, 0.34, opaque) : lerp(0, 0.22, opaque)
  const clearTintActive = hasColor ? lerp(0.22, 0.42, opaque) : lerp(0, 0.3, opaque)
  const tint = hasColor ? lerp(0.2, 0.4, opaque) : lerp(0, 0.28, opaque)
  const tintActive = hasColor ? lerp(0.26, 0.48, opaque) : lerp(0, 0.36, opaque)
  const border = 0.9

  const blur = hasColor ? lerp(12, 22, opaque) : lerp(0, 16, opaque)
  const clearBlur = hasColor ? lerp(10, 18, opaque) : lerp(0, 12, opaque)
  const sat = lerp(1.7, 1.3, opaque)
  const bright = 1
  const clearBright = 1
  const specular = lerp(0.26, 0.1, opaque)
  const depthAlpha = lerp(0.04, 0.34, opaque)
  const insetHi = lerp(0.72, 0.16, opaque)
  const insetLo = lerp(0.22, 0.05, opaque)
  const specularBlend = clear > 0.35 ? 'screen' : 'soft-light'

  const root = document.documentElement
  root.dataset.appColor = color.id
  syncColorScheme()
  root.dataset.glass = String(percent)
  root.style.setProperty('--app-color-id', color.id)
  root.style.setProperty('--app-color-swatch', color.swatch === 'transparent' ? '#8c8c8c' : color.swatch)
  root.style.setProperty('--app-color-rgb', frostBase.join(', '))

  root.style.setProperty('--glass-transparency', String(percent))
  // Slider only drives button/container fill; 20 (default) = 20% opaque, 0 = 80%, 100 = clear
  const fill = percent <= 20 ? 0.8 - percent * 0.03 : (0.2 * (100 - percent)) / 80
  root.style.setProperty('--glass-clear-tint', rgba(base, fill))
  root.style.setProperty('--glass-clear-tint-active', rgba(base, Math.min(1, fill + 0.06)))
  root.style.setProperty('--glass-tint', rgba(base, fill))
  root.style.setProperty('--glass-tint-active', rgba(base, Math.min(1, fill + 0.06)))
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
    `linear-gradient(125deg, ${rgba(sheen, lerp(0.55, 0.16, opaque))} 0%, ${rgba(sheen, lerp(0.08, 0.04, opaque))} 12%, transparent 28%)`,
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

  // Panels use the same container color, only denser — never a black plate.
  root.style.setProperty(
    '--app-panel',
    rgba(base, hasColor ? lerp(0.2, 0.4, opaque) : lerp(0, 0.28, opaque)),
  )
  root.style.setProperty(
    '--app-scrim',
    rgba(frostBase, hasColor ? lerp(0.12, 0.28, opaque) : lerp(0, 0.24, opaque)),
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
  root.dataset.moonlight = moonlightOn ? 'on' : 'off'
  root.style.setProperty('--bg-color-id', color.id)
  root.style.setProperty(
    '--bg-color-swatch',
    color.swatch === 'transparent' ? '#8c8c8c' : color.swatch,
  )
  root.style.setProperty('--bg-color-rgb', base.join(', '))

  // Deep void keeps the wash readable; hue lives in the flowing clouds.
  const voidRgb = matchBackgroundColor && hasColor ? base : currentTheme === 'light'
    ? (hasColor ? base.map((channel) => Math.round(238 + channel * 0.06)) : [250, 250, 250])
    : hasColor
    ? [
        Math.round(base[0] * 0.12),
        Math.round(base[1] * 0.12),
        Math.round(base[2] * 0.12),
      ]
    : [5, 5, 5]

  pageIsDark = relativeLuminance(voidRgb) < 0.2
  root.style.setProperty('--void', `rgb(${voidRgb.join(', ')})`)
  root.style.setProperty('--atmosphere-base', `rgb(${voidRgb.join(', ')})`)
  root.style.setProperty('--atmosphere-base-rgb', voidRgb.join(', '))
  // Don't paint Settings panes — that looked like Containers stealing Background.
  root.style.setProperty('--settings-wash', 'transparent')
  syncColorScheme()

  if (hasColor) {
    const effectA = matchBackgroundColor ? base.map((channel) => Math.round(channel * 0.6)) : liftRgb(base, 0.58)
    const effectB = liftRgb(base, 0.3)
    const effectC = matchBackgroundColor ? base.map((channel) => Math.round(channel * 0.35)) : liftRgb(base, 0.12)
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
  matchBackgroundColor = false
  const color = resolveBgColor(id)
  currentBgColorId = color.id
  const isBlackBackground = color.id !== 'none' && relativeLuminance(color.rgb) <= 0.02
  if (isBlackBackground) matchBackgroundColor = true
  if (color.id === 'none') {
    currentBgEffects = [...DEFAULT_BG_EFFECTS]
  }
  try {
    localStorage.setItem(BG_COLOR_KEY, currentBgColorId)
    if (matchBackgroundColor) localStorage.setItem(BG_MATCH_KEY, 'on')
    else localStorage.removeItem(BG_MATCH_KEY)
  } catch {
    /* ignore */
  }
  const wanted = isBlackBackground ? 'light' : readUserTheme()
  if (wanted !== currentTheme) applyTheme(wanted)
  else applyBgAtmosphereTokens()
  return currentBgColorId
}

/** Live color-wheel pick for the background wash. */
export function applyCustomBgColor(hex, { matchColor = false } = {}) {
  const color = ensureCustomBgColor(hex)
  if (!color) return currentBgColorId
  currentBgColorId = 'custom'
  const isBlackBackground = !matchColor && relativeLuminance(color.rgb) <= 0.02
  matchBackgroundColor = matchColor || isBlackBackground
  try {
    if (matchBackgroundColor) localStorage.setItem(BG_MATCH_KEY, 'on')
    else localStorage.removeItem(BG_MATCH_KEY)
    localStorage.setItem(BG_COLOR_KEY, 'custom')
    localStorage.setItem(CUSTOM_BG_COLOR_KEY, currentCustomBgHex)
  } catch {
    /* ignore */
  }
  const wanted = isBlackBackground ? 'light' : readUserTheme()
  if (wanted !== currentTheme) applyTheme(wanted)
  else applyBgAtmosphereTokens()
  return currentCustomBgHex
}

let searchBackgroundSnapshot = null

export function readMoonlight() {
  try {
    return localStorage.getItem(MOONLIGHT_KEY) === 'on'
  } catch {
    return false
  }
}

function saveMoonlight(on) {
  moonlightOn = on
  try {
    localStorage.setItem(MOONLIGHT_KEY, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
}

/** True for a palette colour bright enough to need dark ink. */
export function isBrightColorId(id) {
  for (const color of [resolveBgColor(id), resolveColor(id)]) {
    if (color && color.id === id && color.id !== 'none' && color.rgb && relativeLuminance(color.rgb) > 0.4) return true
  }
  return false
}

/** Leave moonlight and return the app to its normal dark look. */
export function exitMoonlight() {
  if (!moonlightOn) return false
  saveMoonlight(false)
  saveUserTheme('dark')
  applyTheme('dark')
  return true
}

export function applyDisplayMode(theme) {
  if (theme !== 'dark' && theme !== 'light') {
    throw new Error('Display mode must be dark or light.')
  }
  saveMoonlight(true)
  applyBackgroundImage('none')
  clearSearchBackground()
  applyAppColor(DEFAULT_APP_COLOR)
  saveUserTheme(theme)
  applyBgColor(DEFAULT_BG_COLOR)
  return applyTheme(theme)
}

export function clearSearchBackground({ restoreDefault = false } = {}) {
  if (!searchBackgroundSnapshot) {
    if (restoreDefault) {
      applyBgColor(DEFAULT_BG_COLOR)
      applyBackgroundImage(DEFAULT_BG_IMAGE)
    }
    return
  }
  const saved = searchBackgroundSnapshot
  searchBackgroundSnapshot = null
  currentBgColorId = saved.color
  ensureCustomBgColor(saved.custom)
  currentBgEffects = saved.effects
  matchBackgroundColor = saved.match
  try {
    localStorage.setItem(BG_COLOR_KEY, currentBgColorId)
    localStorage.setItem(CUSTOM_BG_COLOR_KEY, currentCustomBgHex)
    if (matchBackgroundColor) localStorage.setItem(BG_MATCH_KEY, 'on')
    else localStorage.removeItem(BG_MATCH_KEY)
  } catch (error) {
    console.warn('Unable to restore the background after search.', error)
  }
  applyBgAtmosphereTokens()
  applyBackgroundPhoto(saved.photo)
  applyBackgroundImage(saved.image)
}

export function applySearchBackground(hex) {
  if (!searchBackgroundSnapshot) {
    searchBackgroundSnapshot = {
      color: currentBgColorId,
      custom: currentCustomBgHex,
      effects: [...currentBgEffects],
      match: matchBackgroundColor,
      photo: readBackgroundPhoto(),
      image: currentBg,
    }
  }
  applyCustomBgColor(hex, { matchColor: true })
  applyBackgroundPhoto(null)
  applyBackgroundImage('atmosphere')
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
  syncColorScheme()
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

/** Custom photo wallpaper (data URL); pass null to go back to the flowing wash. */
export function applyBackgroundPhoto(dataUrl) {
  const root = document.documentElement
  if (dataUrl) {
    root.style.setProperty('--bg-photo', `url("${dataUrl}")`)
    root.dataset.bgPhoto = 'on'
  } else {
    root.style.removeProperty('--bg-photo')
    delete root.dataset.bgPhoto
  }
  try {
    if (dataUrl) localStorage.setItem(BG_PHOTO_KEY, dataUrl)
    else localStorage.removeItem(BG_PHOTO_KEY)
  } catch {
    return false
  }
  return true
}

export function readBackgroundPhoto() {
  try {
    return localStorage.getItem(BG_PHOTO_KEY) || null
  } catch {
    return null
  }
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

export function readUiScale() {
  try {
    const n = Number(localStorage.getItem(UI_SCALE_KEY))
    if (!n) return DEFAULT_UI_SCALE
    return Math.min(130, Math.max(85, Math.round(n)))
  } catch {
    return DEFAULT_UI_SCALE
  }
}

// Text follows the root font size; icon buttons follow --ui-scale.
export function applyUiScale(pct) {
  const v = Math.min(130, Math.max(85, Math.round(Number(pct) || DEFAULT_UI_SCALE)))
  const root = document.documentElement
  root.style.fontSize = `${(16 * v) / 100}px`
  root.style.setProperty('--ui-scale', String(v / 100))
  try {
    localStorage.setItem(UI_SCALE_KEY, String(v))
  } catch {
    /* ignore */
  }
  return v
}

const EDGE_KEY = 'thrft-container-edge'
const DEFAULT_EDGE = 0

export function readContainerEdge() {
  try {
    const raw = localStorage.getItem(EDGE_KEY)
    if (raw == null) return DEFAULT_EDGE
    const n = Number(raw)
    return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : DEFAULT_EDGE
  } catch {
    return DEFAULT_EDGE
  }
}

// 0 = short (original) containers, 100 = tall containers.
export function applyContainerEdge(pct) {
  const v = Math.min(100, Math.max(0, Math.round(Number(pct) || 0)))
  document.documentElement.style.setProperty('--container-edge', String(v / 100))
  try {
    localStorage.setItem(EDGE_KEY, String(v))
  } catch {
    /* ignore */
  }
  return v
}

export function initAppearance() {
  try {
    matchBackgroundColor = localStorage.getItem(BG_MATCH_KEY) === 'on'
  } catch (error) {
    console.warn('Unable to read background color matching.', error)
  }
  moonlightOn = readMoonlight()
  currentTheme = readTheme()
  document.documentElement.dataset.theme = currentTheme
  document.documentElement.style.colorScheme = currentTheme
  applyUiScale(readUiScale())
  applyContainerEdge(readContainerEdge())
  applyBrightness(readBrightness())
  readPalette()
  readCustomColorHex()
  readCustomBgColorHex()
  currentColorId = readAppColor()
  currentBgColorId = readBgColor()
  currentGlassPct = readBarTransparency()
  readBgEffectColors()
  applyBackgroundPhoto(readBackgroundPhoto())
  // Flowing B/W/gray wash is the stage look
  currentBg = readBackgroundImage()
  applyGlassTokens()
  applyBgAtmosphereTokens()
  const applyBg = () => applyBackgroundImage(currentBg)
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
