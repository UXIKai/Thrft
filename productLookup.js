import { readFile } from 'node:fs/promises'

const normalize = (value) => String(value || '').trim().toLowerCase()

export function matchCatalogProducts(catalog, { brand, partNumber, orderNumber }) {
  if (!normalize(brand) || (!normalize(partNumber) && !normalize(orderNumber))) {
    throw new Error('Choose a brand and enter a P/N or O/N number.')
  }
  if (!Array.isArray(catalog)) throw new Error('Invalid product lookup catalog.')
  return catalog.filter((product) =>
    normalize(product.brand) === normalize(brand) &&
    (!normalize(partNumber) || normalize(product.partNumber) === normalize(partNumber)) &&
    (!normalize(orderNumber) || normalize(product.orderNumber) === normalize(orderNumber)),
  ).map((product) => {
    if (!product.title || !Array.isArray(product.variants) || !product.variants.length ||
      product.variants.some((variant) => !variant.color || !/^https?:\/\//.test(variant.imageUrl || ''))) {
      throw new Error('Matched product is missing color or image data.')
    }
    return {
      title: product.title,
      brand: product.brand,
      category: product.category || '',
      price: product.price || '',
      partNumber: product.partNumber || '',
      variants: product.variants.map(({ color, imageUrl }) => ({ color, imageUrl })),
    }
  })
}

export async function lookupProductNumbers(query) {
  const path = process.env.THRFT_PRODUCT_CATALOG_PATH
  if (!path) {
    const error = new Error('Product-number lookup is not connected yet. Use the camera or gallery to add this item.')
    error.status = 503
    throw error
  }
  return matchCatalogProducts(JSON.parse(await readFile(path, 'utf8')), query)
}
