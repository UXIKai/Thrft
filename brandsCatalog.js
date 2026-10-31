/** 10 brands × 20 product placeholders for the Home feed. */

import { SIZE_GARMENTS, brandById, sizesForCategory } from './sizeOptions.js'

const FALLBACK_TYPES = SIZE_GARMENTS.map((g) => g.id)

function typeCycleForBrand(brandId) {
  const brand = brandById(brandId)
  return brand?.garments?.length ? brand.garments : FALLBACK_TYPES
}

function makeProducts(prefix, brandName, brandId, basePrice) {
  const types = typeCycleForBrand(brandId)
  return Array.from({ length: 20 }, (_, i) => {
    const n = i + 1
    const price = (basePrice + i * 7.37 + (i % 3) * 2.11).toFixed(2)
    const clothingType = types[i % types.length]
    const sizes = sizesForCategory(clothingType)
    const size = sizes[i % sizes.length]
    return {
      id: `${prefix}-${n}`,
      code: `${prefix}${n}`,
      title: `${brandName} Item ${n}`,
      price: `$${price}`,
      description: `Authentic ${brandName} piece in excellent condition. Limited mock listing #${n}.`,
      brandId,
      brandName,
      clothingType,
      size,
      tone: i % 2 === 0 ? 'charcoal' : 'olive',
    }
  })
}

export const BRAND_ROWS = [
  {
    id: 'lv',
    name: 'Louis Vuitton',
    category: 'Luxury Fashion',
    prefix: 'LO',
    products: makeProducts('LO', 'Louis Vuitton', 'lv', 120),
  },
  {
    id: 'nike',
    name: 'Nike',
    category: 'Sportswear & Performance',
    prefix: 'NI',
    products: makeProducts('NI', 'Nike', 'nike', 48),
  },
  {
    id: 'adidas',
    name: 'Adidas',
    category: 'Sportswear',
    prefix: 'AD',
    products: makeProducts('AD', 'Adidas', 'adidas', 42),
  },
  {
    id: 'chanel',
    name: 'Chanel',
    category: 'Luxury Fashion',
    prefix: 'CH',
    products: makeProducts('CH', 'Chanel', 'chanel', 160),
  },
  {
    id: 'gucci',
    name: 'Gucci',
    category: 'Luxury Fashion',
    prefix: 'GU',
    products: makeProducts('GU', 'Gucci', 'gucci', 135),
  },
  {
    id: 'prada',
    name: 'Prada',
    category: 'Luxury Fashion',
    prefix: 'PR',
    products: makeProducts('PR', 'Prada', 'prada', 128),
  },
  {
    id: 'gap',
    name: 'Gap',
    category: 'Casual Apparel',
    prefix: 'GA',
    products: makeProducts('GA', 'Gap', 'gap', 28),
  },
  {
    id: 'northface',
    name: 'The North Face',
    category: 'Outdoor',
    prefix: 'TN',
    products: makeProducts('TN', 'The North Face', 'northface', 64),
  },
  {
    id: 'puma',
    name: 'Puma',
    category: 'Sportswear',
    prefix: 'PU',
    products: makeProducts('PU', 'Puma', 'puma', 36),
  },
  {
    id: 'guess',
    name: 'Guess',
    category: 'Contemporary Fashion',
    prefix: 'GS',
    products: makeProducts('GS', 'Guess', 'guess', 52),
  },
]

export function findProductById(productId) {
  for (const brand of BRAND_ROWS) {
    const hit = brand.products.find((p) => p.id === productId)
    if (hit) return { product: hit, brand }
  }
  return null
}

export function findBrandById(brandId) {
  return BRAND_ROWS.find((b) => b.id === brandId) || null
}
