import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createWaveRenderer } from '../waveRenderer.js'

function canvasFixture({ compile = true } = {}) {
  const deleted = []
  const gl = {
    MAX_TEXTURE_SIZE: 'texture-size', MAX_RENDERBUFFER_SIZE: 'buffer-size',
    createProgram: () => ({}), createTexture: () => ({}), createShader: () => ({}),
    shaderSource() {}, compileShader() {}, attachShader() {}, linkProgram() {},
    getShaderParameter: () => compile, getShaderInfoLog: () => 'Shader failed',
    getProgramParameter: () => true, useProgram() {}, bindTexture() {}, texParameteri() {},
    getUniformLocation: () => ({}), getParameter: () => 8192,
    viewport() {}, uniform2f() {}, uniform1i() {}, texImage2D() {},
    deleteTexture: (value) => deleted.push(value),
    deleteProgram: (value) => deleted.push(value),
    deleteShader: (value) => deleted.push(value),
  }
  return { canvas: { getContext: () => gl }, deleted }
}

test('renders 4K portrait and landscape without stretching or exceeding UHD bounds', () => {
  const { canvas } = canvasFixture()
  const renderer = createWaveRenderer(canvas)
  for (const [width, height] of [[390, 844], [844, 390], [3840, 2160], [2160, 3840], [1440, 900]]) {
    const profile = renderer.resize(width, height)
    assert.ok(Math.max(canvas.width, canvas.height) === 3840 || Math.min(canvas.width, canvas.height) === 2160)
    assert.ok(Math.max(canvas.width, canvas.height) <= 3840)
    assert.ok(Math.min(canvas.width, canvas.height) <= 2160)
    assert.ok(Math.abs(canvas.width / canvas.height - width / height) < .001)
    assert.equal(profile.length, Math.max(canvas.width, canvas.height) * 8)
  }
  renderer.dispose()
})

test('reports graphics failures and releases resources after shader compilation fails', () => {
  assert.throws(() => createWaveRenderer({ getContext: () => null }), /requires WebGL 2/)
  const { canvas, deleted } = canvasFixture({ compile: false })
  assert.throws(() => createWaveRenderer(canvas), /Shader failed/)
  assert.equal(deleted.length, 3)
})
