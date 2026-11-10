import { LETTER_SIZES } from './sizeOptions.js'

const SHOE_EN = ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16']
const SHOE_EU = ['36', '37.5', '39', '40.5', '42', '43', '44.5', '46', '47', '48', '49.5', '51', '52']

export function productSizeOptions(product) {
  const footwear = /shoes|sneakers|boots|sandals|slides|loafers/i.test(
    `${product.category || ''} ${product.clothingType || ''}`,
  )
  const sizes = product.sizes?.length ? product.sizes : footwear ? SHOE_EN : LETTER_SIZES
  return sizes.map((size) => {
    const value = String(size)
    const chart = product.sizeConversions?.[value]
    return {
      value,
      en: value,
      eu: chart?.EU || chart?.eu || (footwear ? SHOE_EU[SHOE_EN.indexOf(value)] : null) || value,
    }
  })
}
