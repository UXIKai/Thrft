import test from 'node:test'
import assert from 'node:assert/strict'
import { isCreateStepFilled } from './createWalkthrough.js'

const empty = {
  isCloset: false, scanPreview: '', marketPhotos: [], title: '', brand: '',
  category: '', price: '', condition: '', description: '', materials: '',
  dateM: 0, dateD: 0, dateY: 0,
}

test('Create steps only advance when their current field or selection is filled', () => {
  for (const step of ['photo', 'title', 'details', 'price', 'condition', 'description', 'materials', 'date', 'destination']) {
    assert.equal(isCreateStepFilled(step, empty), false, step)
  }
  for (const step of ['title', 'price', 'condition', 'description', 'materials']) {
    assert.equal(isCreateStepFilled(step, { ...empty, [step]: '  ' }), false, step)
    assert.equal(isCreateStepFilled(step, { ...empty, [step]: 'value' }), true, step)
  }
  assert.equal(isCreateStepFilled('details', { ...empty, brand: 'Nike' }), false)
  assert.equal(isCreateStepFilled('details', { ...empty, brand: 'Nike', category: 'Tees' }), true)
  assert.equal(isCreateStepFilled('photo', { ...empty, marketPhotos: ['data:image/png;base64,abc'] }), true)
  assert.equal(isCreateStepFilled('photo', { ...empty, isCloset: true, marketPhotos: ['photo'] }), false)
  assert.equal(isCreateStepFilled('photo', { ...empty, isCloset: true, scanPreview: 'cutout' }), true)
  assert.equal(isCreateStepFilled('date', { ...empty, dateM: 1, dateD: 1, dateY: 2026 }), true)
})
