import { useEffect, useRef } from 'react'

const WAVE_POINTS = [
  [210, 350, 350, 390, 720, 485, 1450, 590],
  [80, 630, 500, 170, 850, 420, 1370, 720],
  [300, 140, 400, 650, 690, 520, 1550, 220],
]

const UPPER_GLOW = Float32Array.from({ length: 1801 }, (_, distance) =>
  .7 * Math.exp(-((distance / 65) ** 2)) + .3 * Math.exp(-((distance / 3) ** 2)))
const LOWER_GLOW = Float32Array.from({ length: 1801 }, (_, distance) =>
  .12 * Math.exp(-((distance / 55) ** 2)) + .6 * Math.exp(-((distance / 3) ** 2)))

function cubic(start, first, second, end, t) {
  const u = 1 - t
  return u ** 3 * start + 3 * u ** 2 * t * first + 3 * u * t ** 2 * second + t ** 3 * end
}

export default function AtmosphereFlow() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      console.error('The animated atmosphere requires a 2D canvas context.')
      return undefined
    }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame
    let startedAt
    let lastPaint = -Infinity
    let visible = false
    let colors
    let image

    const readColors = () => {
      const style = getComputedStyle(canvas)
      const rgb = (property, fallback) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = style.getPropertyValue(property).trim() || fallback
        context.fillRect(0, 0, 1, 1)
        return context.getImageData(0, 0, 1, 1).data.slice(0, 3)
      }
      colors = {
        a: rgb('--atmosphere-effect-a', '#ffe2a3'),
        b: rgb('--atmosphere-effect-b', '#d6a467'),
        c: rgb('--atmosphere-effect-c', '#856344'),
        base: rgb('--atmosphere-base', '#050505'),
      }
    }
    const paint = (elapsed) => {
      if (!image) return
      const phase = (elapsed / 14000 % 1) * WAVE_POINTS.length
      const index = Math.floor(phase)
      const blend = (1 - Math.cos((phase - index) * Math.PI)) / 2
      const points = WAVE_POINTS[index].map((value, i) =>
        value + (WAVE_POINTS[(index + 1) % WAVE_POINTS.length][i] - value) * blend)
      const { width, height, data } = image
      const rows = new Float32Array(width)
      for (let x = 0; x < width; x += 1) {
        const target = x / width * 1440
        const left = target < points[4]
        const xs = left ? [-180, points[0], points[2], points[4]]
          : [points[4], 2 * points[4] - points[2], points[6], 1480]
        const ys = left ? [930, points[1], points[3], points[5]]
          : [points[5], 2 * points[5] - points[3], points[7], -160]
        let low = 0
        let high = 1
        for (let step = 0; step < 14; step += 1) {
          const t = (low + high) / 2
          if (cubic(...xs, t) < target) low = t
          else high = t
        }
        rows[x] = cubic(...ys, (low + high) / 2) / 900 * height
      }
      const shift = Math.sin(elapsed / 10000 * Math.PI * 2) * .18
      const stops = [[0, colors.b], [.28, colors.a], [.52, colors.b], [.84, colors.a], [1, colors.c]]
      for (let x = 0; x < width; x += 1) {
        const position = Math.max(0, Math.min(1, x / width - shift))
        let stop = 0
        while (stop < stops.length - 2 && position > stops[stop + 1][0]) stop += 1
        const amount = (position - stops[stop][0]) / (stops[stop + 1][0] - stops[stop][0])
        const light = stops[stop][1].map((value, channel) =>
          value + (stops[stop + 1][1][channel] - value) * amount)
        const slope = (rows[Math.min(width - 1, x + 1)] - rows[Math.max(0, x - 1)]) / 2
        const normal = 900 / height / Math.sqrt(1 + slope * slope)
        for (let y = 0; y < height; y += 1) {
          const distance = y - rows[x]
          const offset = Math.min(1800, Math.round(Math.abs(distance) * normal))
          const glow = distance < 0 ? UPPER_GLOW[offset] : LOWER_GLOW[offset]
          const shade = distance < 0 ? .18 * Math.max(0, 1 - (x / width + y / height) * .7) : 0
          const pixel = (y * width + x) * 4
          for (let channel = 0; channel < 3; channel += 1) {
            const base = colors.base[channel] + (128 - colors.base[channel]) * shade
            data[pixel + channel] = base + (light[channel] - base) * glow
          }
          data[pixel + 3] = 255
        }
      }
      context.putImageData(image, 0, 0)
    }
    const tick = (now) => {
      if (startedAt === undefined) startedAt = now
      if (now - lastPaint >= 1000 / 24) {
        paint(now - startedAt)
        lastPaint = now
      }
      frame = requestAnimationFrame(tick)
    }
    const syncMotion = () => {
      cancelAnimationFrame(frame)
      if (motion.matches) {
        paint(0)
      } else if (visible && !document.hidden) {
        startedAt = undefined
        lastPaint = -Infinity
        frame = requestAnimationFrame(tick)
      }
    }
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      if (!width || !height) return
      // The soft glow does not need a device-pixel-resolution drawing surface.
      const scale = Math.min(1, 180 / width, 360 / height)
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      image = context.createImageData(canvas.width, canvas.height)
      paint(0)
    }
    readColors()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      syncMotion()
    })
    observer.observe(canvas)
    const colorObserver = new MutationObserver(() => {
      readColors()
      if (motion.matches) paint(0)
    })
    for (let ancestor = canvas.parentElement; ancestor; ancestor = ancestor.parentElement) {
      colorObserver.observe(ancestor, { attributes: true })
    }
    resize()
    syncMotion()
    motion.addEventListener('change', syncMotion)
    document.addEventListener('visibilitychange', syncMotion)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      resizeObserver.disconnect()
      colorObserver.disconnect()
      motion.removeEventListener('change', syncMotion)
      document.removeEventListener('visibilitychange', syncMotion)
    }
  }, [])

  return <canvas ref={canvasRef} className="atmosphere-flow" aria-hidden="true" />
}
