import assert from 'node:assert/strict'
import { test } from 'node:test'
import { waveFrame } from '../waveMotion.js'

test('the S keeps a constant bend as it turns, so it is never a straight line', () => {
  for (let time = 0; time < 18000; time += 250) {
    const { points, start, end } = waveFrame(time)
    const across = [start[1], points[1], points[3], points[5], points[7], end[1]]
    assert.ok(Math.max(...across) - Math.min(...across) > 300)
    assert.ok(Math.abs(points[5] - 450) <= 330 + 1e-9)
  }
})

test('the curve turns continuously through a full revolution and loops seamlessly', () => {
  assert.deepEqual(waveFrame(18000), waveFrame(0))
  assert.deepEqual(waveFrame(36000), waveFrame(0))
  let previous = waveFrame(0)
  for (let time = 50; time <= 18000; time += 50) {
    const frame = waveFrame(time)
    frame.points.forEach((value, i) => assert.ok(Math.abs(value - previous.points[i]) < 15))
    previous = frame
  }
  assert.notDeepEqual(waveFrame(9000).points, waveFrame(0).points)
})
