/**
 * Detailed garment size charts + brand-specific sizing (e.g. Nike shoes).
 * Home clothing strip still uses clothingTypes.js; this drives Settings → Size.
 */

/** Letter sizes used by knits / outer layers */
export const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']

/** US men's shoe sizes including halves */
export const SHOE_SIZES_US = [
  '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5',
  '10', '10.5', '11', '11.5', '12', '12.5', '13', '14',
]

/** Dress shirt: neck / sleeve */
export const DRESS_SHIRT_SIZES = [
  '14 / 32',
  '14.5 / 32',
  '14.5 / 33',
  '15 / 33',
  '15 / 34',
  '15.5 / 33',
  '15.5 / 34',
  '15.5 / 35',
  '16 / 34',
  '16 / 35',
  '16.5 / 34',
  '16.5 / 35',
  '16.5 / 36',
  '17 / 35',
  '17 / 36',
  '17.5 / 36',
  '18 / 36',
]

/** Pants: waist × inseam */
export const PANT_SIZES = [
  '28x28', '28x30', '28x32',
  '29x30', '29x32',
  '30x30', '30x32', '30x34',
  '31x30', '31x32', '31x34',
  '32x30', '32x32', '32x34',
  '33x30', '33x32', '33x34',
  '34x30', '34x32', '34x34',
  '36x30', '36x32', '36x34',
  '38x30', '38x32', '38x34',
  '40x32', '40x34',
]

/** Shorts: waist only */
export const SHORT_SIZES = ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40']

/** Casual / sport tops that run lettered */
export const TOP_SIZES = LETTER_SIZES

export const SIZE_GARMENTS = [
  {
    id: 'dress-shirts',
    label: 'Dress shirts',
    hint: 'Neck / sleeve',
    sizes: DRESS_SHIRT_SIZES,
  },
  {
    id: 't-shirts',
    label: 'T-shirts',
    hint: 'Chest fit',
    sizes: TOP_SIZES,
  },
  {
    id: 'polos',
    label: 'Polos',
    hint: 'Chest fit',
    sizes: TOP_SIZES,
  },
  {
    id: 'pants',
    label: 'Pants',
    hint: 'Waist × inseam',
    sizes: PANT_SIZES,
  },
  {
    id: 'shorts',
    label: 'Shorts',
    hint: 'Waist',
    sizes: SHORT_SIZES,
  },
  {
    id: 'jeans',
    label: 'Jeans',
    hint: 'Waist × inseam',
    sizes: PANT_SIZES,
  },
  {
    id: 'sweaters',
    label: 'Sweaters',
    hint: 'Chest fit',
    sizes: TOP_SIZES,
  },
  {
    id: 'hoodies',
    label: 'Hoodies',
    hint: 'Chest fit',
    sizes: TOP_SIZES,
  },
  {
    id: 'jackets',
    label: 'Jackets',
    hint: 'Chest / outer layer',
    sizes: TOP_SIZES,
  },
  {
    id: 'coats',
    label: 'Coats',
    hint: 'Outer layer',
    sizes: TOP_SIZES,
  },
  {
    id: 'shoes',
    label: 'Shoes',
    hint: 'US size',
    sizes: SHOE_SIZES_US,
  },
  {
    id: 'sneakers',
    label: 'Sneakers',
    hint: 'US size',
    sizes: SHOE_SIZES_US,
  },
]

/** Brands you can mark as favored and set brand-specific sizes for */
export const SIZE_BRANDS = [
  {
    id: 'nike',
    name: 'Nike',
    garments: ['sneakers', 'shoes', 'hoodies', 't-shirts', 'shorts', 'jackets'],
  },
  {
    id: 'adidas',
    name: 'Adidas',
    garments: ['sneakers', 'shoes', 'hoodies', 't-shirts', 'shorts', 'jackets'],
  },
  {
    id: 'puma',
    name: 'Puma',
    garments: ['sneakers', 'shoes', 'hoodies', 't-shirts', 'shorts'],
  },
  {
    id: 'northface',
    name: 'The North Face',
    garments: ['jackets', 'coats', 'hoodies', 'pants'],
  },
  {
    id: 'gap',
    name: 'Gap',
    garments: ['t-shirts', 'jeans', 'pants', 'shorts', 'sweaters', 'hoodies'],
  },
  {
    id: 'levis',
    name: "Levi's",
    garments: ['jeans', 'pants', 'shorts', 'jackets'],
  },
  {
    id: 'lv',
    name: 'Louis Vuitton',
    garments: ['sneakers', 'shoes', 't-shirts', 'hoodies', 'jackets'],
  },
  {
    id: 'gucci',
    name: 'Gucci',
    garments: ['sneakers', 'shoes', 't-shirts', 'sweaters', 'jackets'],
  },
  {
    id: 'prada',
    name: 'Prada',
    garments: ['sneakers', 'shoes', 't-shirts', 'jackets'],
  },
  {
    id: 'chanel',
    name: 'Chanel',
    garments: ['shoes', 'jackets', 'coats'],
  },
  {
    id: 'guess',
    name: 'Guess',
    garments: ['jeans', 't-shirts', 'hoodies', 'jackets'],
  },
]

const GARMENT_BY_ID = Object.fromEntries(SIZE_GARMENTS.map((g) => [g.id, g]))

export function sizesForCategory(categoryId) {
  return GARMENT_BY_ID[categoryId]?.sizes || LETTER_SIZES
}

export function garmentLabel(categoryId) {
  return GARMENT_BY_ID[categoryId]?.label || categoryId
}

/** Map coarse home strip ids → detailed garments for catalog/For You */
export const HOME_TYPE_TO_GARMENTS = {
  tops: ['t-shirts', 'polos', 'dress-shirts'],
  bottoms: ['pants', 'shorts', 'jeans'],
  outerwear: ['jackets', 'coats'],
  dresses: ['dress-shirts'],
  shoes: ['shoes', 'sneakers'],
  bags: [],
  accessories: [],
  activewear: ['t-shirts', 'shorts', 'hoodies'],
  denim: ['jeans'],
  knitwear: ['sweaters', 'hoodies'],
  vintage: ['t-shirts', 'jeans', 'jackets'],
}

/** @deprecated alias — Settings size sheet uses SIZE_GARMENTS */
export const SIZE_CATEGORIES = SIZE_GARMENTS

export function brandById(brandId) {
  return SIZE_BRANDS.find((b) => b.id === brandId) || null
}

/** Human label for a brand id (SIZE_BRANDS or title-cased slug). */
export function brandDisplayName(brandId) {
  const known = brandById(brandId)
  if (known) return known.name
  const raw = String(brandId || '').trim()
  if (!raw) return 'Brand'
  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Garment defs a brand supports (for brand drill-down sheets). */
export function garmentsForBrand(brandId) {
  const brand = brandById(brandId)
  const ids = brand?.garments?.length
    ? brand.garments
    : SIZE_GARMENTS.map((g) => g.id)
  return ids.map((id) => GARMENT_BY_ID[id]).filter(Boolean)
}

/** Sizes for a garment, optionally brand-tuned (same chart; brand label for UI). */
export function sizesForBrandGarment(brandId, garmentId) {
  return sizesForCategory(garmentId)
}
