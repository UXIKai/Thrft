import assert from 'node:assert/strict'
import { test } from 'node:test'
import { waveFrame } from '../waveMotion.js'

test('the S keeps its bend and only sways gently', () => {
  const rest = waveFrame(0)
  for (let time = 0; time < 26000; time += 250) {
    const { points, start, end } = waveFrame(time)
    const across = [start[1], points[1], points[3], points[5], points[7], end[1]]
    assert.ok(Math.max(...across) - Math.min(...across) > 300)
    points.forEach((value, i) => assert.ok(Math.abs(value - rest.points[i]) < 200))
  }
})

test('the sway is smooth and loops seamlessly', () => {
  waveFrame(26000).points.forEach((value, i) => assert.ok(Math.abs(value - waveFrame(0).points[i]) < 1e-6))
  let previous = waveFrame(0)
  for (let time = 50; time <= 26000; time += 50) {
    const frame = waveFrame(time)
    frame.points.forEach((value, i) => assert.ok(Math.abs(value - previous.points[i]) < 4))
    previous = frame
  }
})
