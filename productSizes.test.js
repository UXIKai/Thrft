import assert from 'node:assert/strict'
import test from 'node:test'
import { productSizeOptions } from './productSizes.js'

test('footwear converts display labels without changing selected values', () => {
  const options = productSizeOptions({ category: 'Shoes' })
  assert.deepEqual(options[0], { value: '4', letter: '4', en: '4', eu: '36' })
  assert.deepEqual(options.at(-1), { value: '16', letter: '16', en: '16', eu: '52' })
})

test('product-specific charts take precedence and unconverted sizes stay intact', () => {
  assert.deepEqual(productSizeOptions({ category: 'Shoes', sizes: ['8', '8.5'], sizeConversions: { '8': { EU: '41' } } }), [
    { value: '8', letter: '8', en: '8', eu: '41' },
    { value: '8.5', letter: '8.5', en: '8.5', eu: '8.5' },
  ])
  assert.equal(productSizeOptions({ sizes: ['One size'] })[0].eu, 'One size')
})

test('letter and numeric apparel labels retain the original cart size', () => {
  const [option] = productSizeOptions({ sizes: ['M'] }, 'numbers')
  assert.deepEqual(option, { value: 'M', letter: 'M', en: '38', eu: '48' })
  assert.equal(productSizeOptions({ sizes: ['38'] })[0].letter, 'M')
  assert.equal(productSizeOptions({ sizes: ['M'], sizeConversions: { M: { EN: '40', EU: '50' } } }, 'numbers')[0].en, '40')
})
