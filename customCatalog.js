/**
 * User-added brands / categories for Create + home / closet wheels.
 */

const CATEGORIES_KEY = 'thrft-custom-categories-v1'
const BRANDS_KEY = 'thrft-custom-brands-v1'

function readList(key) {
  try {
    const raw = localStorage.getItem(key)
    const list = JSON.parse(raw || '[]')
    return Array.isArray(list)
      ? list.map((s) => String(s || '').trim()).filter(Boolean)
      : []
  } catch {
    return []
  }
}

function writeList(key, list) {
  const clean = [...new Set(list.map((s) => String(s || '').trim()).filter(Boolean))]
  try {
    localStorage.setItem(key, JSON.stringify(clean))
  } catch {
    /* ignore */
  }
  return clean
}

export function getCustomCategories() {
  return readList(CATEGORIES_KEY)
}

export function addCustomCategory(label) {
  const name = String(label || '').trim().slice(0, 32)
  if (!name) return getCustomCategories()
  return writeList(CATEGORIES_KEY, [...getCustomCategories(), name])
}

export function getCustomBrands() {
  return readList(BRANDS_KEY)
}

export function addCustomBrand(label) {
  const name = String(label || '').trim().slice(0, 32)
  if (!name) return getCustomBrands()
  return writeList(BRANDS_KEY, [...getCustomBrands(), name])
}
