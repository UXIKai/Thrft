import test from 'node:test'
import assert from 'node:assert/strict'
import { createCutoutLoader, hasPrintfulMockup } from './mockupCutouts.js'

test('visible mockups share work, reuse cached cutouts and process serially', async () => {
  const calls = []
  const cache = new Map([['cached', 'cached-image']])
  let unblock
  const loader = createCutoutLoader({
    read: async (url) => cache.get(url),
    write: async (url, image) => cache.set(url, image),
    process: async (url) => {
      calls.push(url)
      if (url === 'first') await new Promise((resolve) => { unblock = resolve })
      return `cutout:${url}`
    },
  })
  const first = loader('first')
  const duplicate = loader('first')
  const second = loader('second')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(calls, ['first'])
  unblock()
  assert.equal(await first.promise, 'cutout:first')
  assert.equal(await duplicate.promise, 'cutout:first')
  assert.equal(await second.promise, 'cutout:second')
  assert.deepEqual(calls, ['first', 'second'])
  assert.equal(await loader('first').promise, 'cutout:first')
  assert.equal(await loader('cached').promise, 'cached-image')
  assert.deepEqual(calls, ['first', 'second'])
  first.release(); duplicate.release(); second.release()
})

test('offscreen queued work is skipped and failures can be retried', async () => {
  const calls = []
  let unblock
  const loader = createCutoutLoader({
    read: async () => null,
    write: async () => {},
    process: async (url) => {
      calls.push(url)
      if (url === 'slow') await new Promise((resolve) => { unblock = resolve })
      if (url === 'fail' && calls.filter((entry) => entry === 'fail').length === 1) throw new Error('model failed')
      return url
    },
  })
  const slow = loader('slow')
  const skipped = loader('offscreen')
  skipped.release()
  await new Promise((resolve) => setTimeout(resolve, 0))
  unblock()
  assert.equal(await skipped.promise, null)
  await assert.rejects(loader('fail').promise, /model failed/)
  assert.equal(await loader('fail').promise, 'fail')
  assert.deepEqual(calls, ['slow', 'fail', 'fail'])
  slow.release()
})

test('only Printful mockups are selected for automatic background removal', () => {
  assert.equal(hasPrintfulMockup({ printfulVariants: [{ variant_id: 1 }] }), true)
  assert.equal(hasPrintfulMockup({ printful_variant_id: 1 }), true)
  assert.equal(hasPrintfulMockup({ detailVariant: 'market', photoUrl: 'photo.jpg' }), false)
})
