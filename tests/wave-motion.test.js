import assert from 'node:assert/strict'
import { test } from 'node:test'
import { waveFrame } from '../waveMotion.js'

test('the entire S curve folds into its mirror and returns seamlessly', () => {
  const first = waveFrame(0)
  const inverted = waveFrame(9000)
  for (let i = 0; i < first.points.length; i += 2) {
    assert.equal(inverted.points[i], first.points[i])
    assert.equal(inverted.points[i + 1], 900 - first.points[i + 1])
  }
  for (const endpoint of ['start', 'end']) {
    assert.equal(inverted[endpoint][0], first[endpoint][0])
    assert.equal(inverted[endpoint][1], 900 - first[endpoint][1])
  }
  assert.deepEqual(waveFrame(18000), first)
  assert.deepEqual(waveFrame(36000), first)
  const forward = waveFrame(2250)
  const backward = waveFrame(15750)
  for (const key of ['points', 'start', 'end']) {
    forward[key].forEach((value, i) => assert.ok(Math.abs(value - backward[key][i]) < 1e-9))
  }
})

test('opposing sides cross the center and exchange places without a jump', () => {
  for (const time of [4500, 13500]) {
    const frame = waveFrame(time)
    for (const y of [...frame.points.filter((_, i) => i % 2), frame.start[1], frame.end[1]]) {
      assert.ok(Math.abs(y - 450) < 1e-9)
    }
    const before = waveFrame(time - 1)
    const after = waveFrame(time + 1)
    assert.ok((before.points[1] - 450) * (after.points[1] - 450) < 0)
    assert.ok(Math.abs(before.points[1] - after.points[1]) < .2)
    assert.ok(Math.abs(before.fold - after.fold) < .001)
  }
})
