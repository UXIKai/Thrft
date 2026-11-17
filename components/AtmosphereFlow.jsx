import { useEffect, useId, useRef } from 'react'

const WAVE_POINTS = [120, 610, 440, 620, 720, 490, 1180, 400]
const FLOW_PERIOD_MS = 18000
// A bright leading crest leaves a long, softly rippling luminous wake.
const LIGHT_STOPS = [[0, 0], [.16, 0], [.3, .18], [.38, .08], [.48, .4],
  [.55, .3], [.64, 1], [.7, .12], [.78, 0], [1, 0]]

const BROAD_GLOW = Float32Array.from({ length: 1801 }, (_, distance) =>
  .82 * Math.exp(-((distance / 145) ** 2)) + .16 * Math.exp(-((distance / 20) ** 2)))
const RIM_GLOW = Float32Array.from({ length: 1801 }, (_, distance) =>
  .24 * Math.exp(-((distance / 22) ** 2)) + .74 * Math.exp(-((distance / 7) ** 2)))

function cubic(start, first, second, end, t) {
  const u = 1 - t
  return u ** 3 * start + 3 * u ** 2 * t * first + 3 * u * t ** 2 * second + t ** 3 * end
}

export default function AtmosphereFlow() {
  const id = useId()
  const canvasRef = useRef(null)
  const edgeRef = useRef(null)
  const lightRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const edge = edgeRef.current
    const light = lightRef.current
    const edgeStops = [...light.querySelectorAll('stop')]
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
    let stops
    let image
    let portrait = false

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
      const ambient = colors.a.map((channel, i) => channel * .75 + colors.c[i] * .25)
      const crest = colors.a.map((channel) => channel + (255 - channel) * .4)
      stops = LIGHT_STOPS.map(([offset, energy], index) => {
        const color = ambient.map((channel, i) => channel + (crest[i] - channel) * energy)
        edgeStops[index].setAttribute('stop-color', `rgb(${color.join(', ')})`)
        return [offset, color, energy]
      })
    }
    const paint = (elapsed) => {
      if (!image) return
      const phase = elapsed / FLOW_PERIOD_MS % 1
      const points = WAVE_POINTS.map((value, i) => {
        const along = WAVE_POINTS[i - i % 2] / 1440
        const ripple = Math.sin((along - phase) * Math.PI * 2)
        return value + ripple * (i % 2 === 0 ? 48 : 20)
      })
      const edgePoints = portrait
        ? points.map((_, i) => points[i % 2 === 0 ? i + 1 : i - 1])
        : points
      edge.setAttribute('d', portrait
        ? `M-600 -180C${edgePoints.slice(0, 6).join(' ')}S${edgePoints.slice(6).join(' ')} 1020 1620`
        : `M-180 -600C${edgePoints.slice(0, 6).join(' ')}S${edgePoints.slice(6).join(' ')} 1620 1020`)
      const { width, height, data } = image
      const length = portrait ? height : width
      const breadth = portrait ? width : height
      const rows = new Float32Array(length)
      for (let x = 0; x < length; x += 1) {
        const target = (x + .5) / length * 1440
        const left = target < points[4]
        const xs = left ? [-180, points[0], points[2], points[4]]
          : [points[4], 2 * points[4] - points[2], points[6], 1620]
        const ys = left ? [-600, points[1], points[3], points[5]]
          : [points[5], 2 * points[5] - points[3], points[7], 1020]
        let low = 0
        let high = 1
        for (let step = 0; step < 14; step += 1) {
          const t = (low + high) / 2
          if (cubic(...xs, t) < target) low = t
          else high = t
        }
        rows[x] = cubic(...ys, (low + high) / 2) / 900 * breadth
      }
      const shift = phase * 2 % 1
      light.setAttribute('gradientTransform', portrait
        ? `translate(0 ${shift * 1440})`
        : `translate(${shift * 1440} 0)`)
      for (let x = 0; x < length; x += 1) {
        const position = ((x + .5) / length - shift + 1) % 1
        let stop = 0
        while (stop < stops.length - 2 && position > stops[stop + 1][0]) stop += 1
        const amount = (position - stops[stop][0]) / (stops[stop + 1][0] - stops[stop][0])
        const light = stops[stop][1].map((value, channel) =>
          value + (stops[stop + 1][1][channel] - value) * amount)
        const energy = stops[stop][2] + (stops[stop + 1][2] - stops[stop][2]) * amount
        const reflected = light.map((value, channel) => value * .35 + colors.b[channel] * .65)
        const slope = (rows[Math.min(length - 1, x + 1)] - rows[Math.max(0, x - 1)]) / 2
        const normal = 900 / breadth / Math.sqrt(1 + slope * slope)
        const progress = (x + .5) / length
        const transition = Math.max(0, Math.min(1, (progress - .35) / .3))
        const litSide = transition * transition * (3 - 2 * transition)
        const spread = (.35 + .65 * Math.abs(Math.cos(progress * Math.PI))) * (1 + energy * .28)
        for (let y = 0; y < breadth; y += 1) {
          const distance = y + .5 - rows[x]
          const offset = Math.min(1800, Math.round(Math.abs(distance) * normal))
          const surfaceSide = distance < 0 ? 1 - litSide : litSide
          const rim = RIM_GLOW[offset]
          const diffuse = (BROAD_GLOW[offset] - rim) * surfaceSide * spread
          const shade = .18 * surfaceSide * Math.min(1, Math.abs(distance) * normal / 24)
          const pixel = (portrait ? x * width + y : y * width + x) * 4
          for (let channel = 0; channel < 3; channel += 1) {
            const base = colors.base[channel] + (128 - colors.base[channel]) * shade
            data[pixel + channel] = base + (light[channel] - base) * rim + (reflected[channel] - base) * diffuse
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
      portrait = height > width
      edge.ownerSVGElement.setAttribute('viewBox', portrait ? '0 0 900 1440' : '0 0 1440 900')
      light.setAttribute('x2', portrait ? '0' : '1440')
      light.setAttribute('y2', portrait ? '1440' : '0')
      // Only the soft glow is low resolution; the separate vector edge stays sharp.
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

  return (
    <div className="atmosphere-flow" aria-hidden="true">
      <canvas ref={canvasRef} className="atmosphere-flow-glow" />
      <svg className="atmosphere-flow-edge" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <defs>
          <linearGradient ref={lightRef} id={`${id}-edge-light`} gradientUnits="userSpaceOnUse" x2="1440" spreadMethod="repeat">
            {LIGHT_STOPS.map(([offset]) => (
              <stop key={offset} offset={offset} stopColor="var(--atmosphere-effect-a, #ffe2a3)" />
            ))}
          </linearGradient>
        </defs>
        <path ref={edgeRef} fill="none" stroke={`url(#${id}-edge-light)`} strokeWidth="1"
          strokeOpacity="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
