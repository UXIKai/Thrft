/**
 * Home clothing-type chips — one button per garment type, plus All.
 * Labels stay in sync with Create listing categories (+ user customs).
 */
import { getCustomCategories } from './customCatalog.js'
import { LISTING_CATEGORIES } from './listingCatalog.js'

function slugType(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildClothingTypes() {
  const customs = typeof window !== 'undefined' ? getCustomCategories() : []
  const seen = new Set()
  const list = [{ id: 'all', label: 'All', category: null }]
  for (const label of [...LISTING_CATEGORIES, ...customs]) {
    const key = String(label || '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    list.push({
      id: slugType(label),
      label,
      category: label,
    })
  }
  return list
}

/** @type {{ id: string, label: string, category: string | null }[]} */
export const CLOTHING_TYPES = buildClothingTypes()

export function getClothingTypes() {
  return buildClothingTypes()
}

export function clothingTypeById(id) {
  return getClothingTypes().find((t) => t.id === id) || null
}

export function clothingTypeLabel(id) {
  return clothingTypeById(id)?.label || 'All'
}
