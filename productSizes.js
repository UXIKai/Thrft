import { LETTER_SIZES } from './sizeOptions.js'

const SHOE_EN = ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16']
const SHOE_EU = ['36', '37.5', '39', '40.5', '42', '43', '44.5', '46', '47', '48', '49.5', '51', '52']
const APPAREL_EN = ['32', '34', '36', '38', '40', '42', '44', '46']

export function productSizeOptions(product, format = 'original') {
  const footwear = /shoes|sneakers|boots|sandals|slides|loafers/i.test(
    `${product.category || ''} ${product.clothingType || ''}`,
  )
  const sizes = product.sizes?.length ? product.sizes : footwear ? SHOE_EN : LETTER_SIZES
  return sizes.map((size) => {
    const value = String(size)
    const chart = product.sizeConversions?.[value]
    const letterIndex = LETTER_SIZES.indexOf(value)
    const numericIndex = APPAREL_EN.indexOf(value)
    return {
      value,
      letter: chart?.letter || (!footwear && numericIndex >= 0 ? LETTER_SIZES[numericIndex] : value),
      en: format === 'numbers' && !footwear
        ? String(chart?.EN || chart?.en || APPAREL_EN[letterIndex] || value)
        : value,
      eu: String(chart?.EU || chart?.eu || (footwear
        ? SHOE_EU[SHOE_EN.indexOf(value)]
        : letterIndex >= 0 ? Number(APPAREL_EN[letterIndex]) + 10 : numericIndex >= 0 ? Number(value) + 10 : null) || value),
    }
  })
}
