import test from 'node:test'
import assert from 'node:assert/strict'
import { processCreatePhotos } from './createPhotoProcessing.js'

test('processes every selected photo in order as a cutout', async () => {
  const processed = await processCreatePhotos(['front', 'back'], async (file) => `cutout:${file}`)
  assert.deepEqual(processed, ['cutout:front', 'cutout:back'])
})

test('reports background removal failures rather than accepting original photos', async () => {
  await assert.rejects(
    processCreatePhotos(['front', 'back'], async (file) => {
      if (file === 'back') throw new Error('Could not remove background')
      return `cutout:${file}`
    }),
    /Could not remove background/,
  )
})
