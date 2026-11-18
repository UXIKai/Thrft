import { useEffect, useRef, useState } from 'react'

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec3 base;
uniform vec3 tintA;
uniform vec3 tintB;
uniform vec3 tintC;
out vec4 color;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
    mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    sum += amp * noise(p);
    p = turn * p * 2.03 + 11.0;
    amp *= 0.5;
  }
  return sum;
}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.y * 2.4;
  float t = time * 0.045;
  vec2 q = vec2(fbm(uv + vec2(0.0, t)), fbm(uv + vec2(5.2, 1.3 - t)));
  vec2 r = vec2(fbm(uv + 3.2 * q + vec2(1.7 + t * 1.3, 9.2)),
    fbm(uv + 3.2 * q + vec2(8.3, 2.8 - t)));
  float density = fbm(uv + 3.4 * r);
  float smoke = smoothstep(0.36, 0.82, density);
  smoke = pow(smoke, 1.6);
  float core = smoothstep(0.55, 1.0, density + 0.35 * length(r - 0.5));
  float hue = clamp(r.x * 1.4, 0.0, 1.0);
  vec3 tint = mix(mix(tintA, tintB, hue), tintC, clamp(q.y * 1.2 - 0.2, 0.0, 1.0));
  vec3 lit = tint * (0.55 + 0.9 * core);
  color = vec4(base + (lit - base) * smoke * 0.95, 1.0);
}`

const AURORA = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec3 base;
uniform vec3 tintA;
uniform vec3 tintB;
uniform vec3 tintC;
out vec4 color;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
    mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * noise(p);
    p = p * 2.02 + 7.0;
    amp *= 0.5;
  }
  return sum;
}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float ax = uv.x * resolution.x / resolution.y;
  float t = time * 0.05;
  vec3 glow = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = ax * (1.1 + 0.35 * fi) + fi * 9.0;
    float sway = fbm(vec2(x * 0.9, t * (1.0 + 0.3 * fi) + fi * 3.0));
    float edge = 0.08 + 0.42 * sway + 0.12 * fi;
    float d = uv.y - edge;
    float shape = d > 0.0 ? exp(-d * (2.4 - 0.3 * fi)) : exp(d * 16.0);
    float xr = x + uv.y * (sway - 0.5) * 0.5 * (1.0 + fi * 0.3);
    float rays = smoothstep(0.15, 0.95, 0.65 * noise(vec2(xr * 11.0, t * 2.0 + fi * 5.0)) + 0.35 * noise(vec2(xr * 30.0, t * 3.0 + fi)));
    float soft = 0.55 + 0.45 * fbm(vec2(x * 2.5, uv.y * 1.6 - t * 3.0));
    float k = shape * (0.35 + 0.9 * rays) * soft;
    vec3 tint = i == 0 ? tintA : (i == 1 ? tintB : tintC);
    glow += tint * k;
    total += k;
  }
  vec3 lit = base + glow * 0.85;
  color = vec4(min(lit, vec3(1.0)), 1.0);
}`

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const SCALE = 0.4

function parse(value, fallback) {
  const parts = String(value || '').match(/[\d.]+/g)
  return parts && parts.length >= 3 ? parts.slice(0, 3).map(Number) : fallback
}

// Drifting smoke lit in the background effect colours
export default function PhantomSmoke({ variant = 'smoke' }) {
  const canvasRef = useRef(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false })
    if (!gl) {
      setUnavailable(true)
      return undefined
    }
    const program = gl.createProgram()
    const shaders = [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, variant === 'aurora' ? AURORA : FRAGMENT]].map(([type, source]) => {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      gl.attachShader(program, shader)
      return shader
    })
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Background shader failed:', gl.getProgramInfoLog(program))
      shaders.forEach((shader) => gl.deleteShader(shader))
      gl.deleteProgram(program)
      setUnavailable(true)
      return undefined
    }
    gl.useProgram(program)
    const loc = (name) => gl.getUniformLocation(program, name)
    const uniforms = { resolution: loc('resolution'), time: loc('time'), base: loc('base'),
      a: loc('tintA'), b: loc('tintB'), c: loc('tintC') }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame
    let lastPaint = -Infinity
    let lastColors = -Infinity
    let visible = false

    const readColors = () => {
      canvas.style.backgroundColor = 'var(--atmosphere-base, #050505)'
      const style = getComputedStyle(canvas)
      const base = parse(style.backgroundColor, [5, 5, 5])
      const tint = (key, fallback) => parse(`rgb(${style.getPropertyValue(`--atmosphere-effect-${key}-rgb`)})`, fallback)
      const norm = (rgb) => rgb.map((v) => v / 255)
      gl.uniform3fv(uniforms.base, norm(base))
      gl.uniform3fv(uniforms.a, norm(tint('a', [190, 190, 190])))
      gl.uniform3fv(uniforms.b, norm(tint('b', [150, 150, 150])))
      gl.uniform3fv(uniforms.c, norm(tint('c', [170, 170, 170])))
    }
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      if (!width || !height) return
      canvas.width = Math.ceil(width * SCALE)
      canvas.height = Math.ceil(height * SCALE)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
      paint(motion.matches ? 0 : performance.now())
    }
    function paint(now) {
      if (now - lastColors > 500) {
        readColors()
        lastColors = now
      }
      gl.uniform1f(uniforms.time, now / 1000)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    const tick = (now) => {
      if (now - lastPaint >= 1000 / 30 - 1e-6) {
        paint(now)
        lastPaint = now
      }
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      if (motion.matches) paint(0)
      else if (visible && !document.hidden) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    observer.observe(canvas)
    const resizer = new ResizeObserver(resize)
    resizer.observe(canvas)
    document.addEventListener('visibilitychange', sync)
    motion.addEventListener('change', sync)
    resize()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      resizer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      motion.removeEventListener('change', sync)
      shaders.forEach((shader) => gl.deleteShader(shader))
      gl.deleteProgram(program)
    }
  }, [variant])

  if (unavailable) return <div className="atmosphere-phantom" aria-hidden="true" />
  return <canvas ref={canvasRef} className="atmosphere-smoke" aria-hidden="true" />
}
