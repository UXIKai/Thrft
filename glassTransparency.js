/**
 * Back-compat re-exports — appearance lives in appAppearance.js
 * (App Color + Glass Opaque↔Clear + Background Image).
 */
export {
  GLASS_TRANSPARENCY_KEY,
  DEFAULT_BAR_TRANSPARENCY,
  applyBarTransparency,
  readBarTransparency,
  initBarTransparency,
  initAppearance,
} from './appAppearance.js'
