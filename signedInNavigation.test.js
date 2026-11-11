import assert from 'node:assert/strict'
import test from 'node:test'
import { guardSignedInNavigation } from './signedInNavigation.js'

test('back and edge swipes preserve the current page and cleanup removes the guard', () => {
  const entries = [{ auth: true }]
  let index = 0
  let homes = 0
  const listeners = new Map()
  const target = {
    innerWidth: 390,
    location: { pathname: '/', search: '?shop=1', hash: '' },
    history: {
      get state() { return entries[index] },
      replaceState(state, _, url) {
        assert.equal(url, '/?shop=1')
        entries[index] = state
      },
      pushState(state) {
        entries.splice(index + 1)
        entries.push(state)
        index += 1
      },
    },
    addEventListener: (name, callback, options) => {
      if (name === 'touchstart' || name === 'touchmove') {
        assert.deepEqual(options, { passive: false, capture: true })
      }
      listeners.set(name, callback)
    },
    removeEventListener: (name, callback, capture) => {
      if (name.startsWith('touch')) assert.equal(capture, true)
      assert.equal(listeners.get(name), callback)
      listeners.delete(name)
    },
  }
  const stop = guardSignedInNavigation(target, () => { homes += 1 })
  for (let count = 0; count < 3; count += 1) {
    index -= 1
    listeners.get('popstate')()
    assert.equal(entries[index].thrftNavigation, 'app')
    assert.equal(index, 1)
    assert.equal(entries.length, 2)
  }
  assert.equal(homes, 0)
  let prevented = false
  listeners.get('touchstart')({
    touches: [{ clientX: 35, clientY: 200 }],
    cancelable: true,
    preventDefault: () => { prevented = true },
  })
  listeners.get('touchend')({ changedTouches: [{ clientX: 100, clientY: 210 }] })
  assert.equal(prevented, true)
  assert.equal(homes, 0)
  listeners.get('touchstart')({
    touches: [{ clientX: 100, clientY: 200 }],
    cancelable: true,
    preventDefault: () => { throw new Error('Normal swipes must not be blocked') },
  })
  listeners.get('touchend')({ changedTouches: [{ clientX: 200, clientY: 200 }] })
  assert.equal(homes, 0)
  listeners.get('touchstart')({
    touches: [{ clientX: 5, clientY: 200 }],
    cancelable: true,
    preventDefault: () => {},
  })
  listeners.get('touchcancel')()
  listeners.get('touchend')({ changedTouches: [{ clientX: 100, clientY: 200 }] })
  assert.equal(homes, 0)
  prevented = false
  listeners.get('touchstart')({
    touches: [{ clientX: 385, clientY: 200 }],
    cancelable: true,
    preventDefault: () => { prevented = true },
  })
  listeners.get('touchmove')({
    touches: [{ clientX: 300, clientY: 200 }],
    cancelable: true,
    preventDefault: () => {},
  })
  listeners.get('touchend')({ changedTouches: [{ clientX: 280, clientY: 200 }] })
  assert.equal(prevented, true)
  assert.equal(homes, 0)
  stop()
  assert.equal(listeners.size, 0)
})
