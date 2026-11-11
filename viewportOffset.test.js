import assert from 'node:assert/strict'
import test from 'node:test'
import { viewportOffset } from './viewportOffset.js'

test('Home ignores leftover keyboard and browser gesture offsets', () => {
  assert.equal(viewportOffset({ editing: false, keyboardHeight: 0, offsetTop: 80, keyboardShift: 160 }), 0)
  assert.equal(viewportOffset({ editing: false, keyboardHeight: 300, offsetTop: 80, keyboardShift: 160 }), 0)
  assert.equal(viewportOffset({ editing: true, keyboardHeight: 0, offsetTop: 80, keyboardShift: 160 }), 0)
})

test('active keyboard editing retains its field visibility correction', () => {
  assert.equal(viewportOffset({ editing: true, keyboardHeight: 300, offsetTop: 80, keyboardShift: 160 }), -80)
})
