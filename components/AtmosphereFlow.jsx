import { useEffect, useId, useRef, useState } from 'react'
import { readBackgroundEffectStyle } from '../appAppearance.js'
import { createWaveRenderer } from '../waveRenderer.js'

const WAVE_POINTS = [120, 610, 440, 620, 720, 490, 1180, 400]
const FLOW_PERIOD_MS = 18000
// A bright leading crest leaves a long, softly rippling luminous wake.
const LIGHT_STOPS = [[0, 0], [.16, 0], [.3, .18], [.38, .08], [.48, .4],
  [.55, .3], [.64, 1], [.7, .12], [.78, 0], [1, 0]]

function cubic(start, first, second, end, t) {
  const u = 1 - t
  return u ** 3 * start + 3 * u ** 2 * t * first + 3 * u * t ** 2 * second + t ** 3 * end
}

export default function AtmosphereFlow() {
  const [style, setStyle] = useState(readBackgroundEffectStyle)

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setStyle(root.dataset.bgEffectStyle || readBackgroundEffectStyle())
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['data-bg-effect-style'] })
    sync()
    return () => observer.disconnect()
  }, [])

  return style === 'phantom'
    ? <div className="atmosphere-phantom" aria-hidden="true" />
    : <WaveFlow />
}

function WaveFlow() {
  const [unavailable, setUnavailable] = useState(false)
  const id = useId()
  const canvasRef = useRef(null)
  const edgeRef = useRef(null)
  const lightRef = useRef(null)

  useEffect(() => {
    if (unavailable) return undefined
    const canvas = canvasRef.current
    const edge = edgeRef.current
    const light = lightRef.current
    const edgeStops = [...light.querySelectorAll('stop')]
    let renderer
    try {
      renderer = createWaveRenderer(canvas)
    } catch (error) {
      console.error('Could not render the 4K wave background:', error)
      setUnavailable(true)
      return undefined
    }
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame
    let startedAt
    let lastPaint = -Infinity
    let visible = false
    let colors
    let stops
    let profile
    let portrait = false
    let contextLost = false

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
      if (!profile || contextLost) return
      const phase = (1 - Math.cos(elapsed / FLOW_PERIOD_MS * Math.PI * 2)) / 2
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
      const { width, height } = canvas
      const length = portrait ? height : width
      const breadth = portrait ? width : height
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
        profile[x * 4] = cubic(...ys, (low + high) / 2) / 900 * breadth
      }
      const shift = phase
      light.setAttribute('gradientTransform', portrait
        ? `translate(0 ${shift * 1440})`
        : `translate(${shift * 1440} 0)`)
      for (let x = 0; x < length; x += 1) {
        const position = ((x + .5) / length - shift + 1) % 1
        let stop = 0
        while (stop < stops.length - 2 && position > stops[stop + 1][0]) stop += 1
        const amount = (position - stops[stop][0]) / (stops[stop + 1][0] - stops[stop][0])
        const pixel = (length + x) * 4
        for (let channel = 0; channel < 3; channel += 1) {
          profile[pixel + channel] = (stops[stop][1][channel] +
            (stops[stop + 1][1][channel] - stops[stop][1][channel]) * amount) / 255
        }
        profile[pixel + 3] = stops[stop][2] + (stops[stop + 1][2] - stops[stop][2]) * amount
      }
      renderer.paint(profile, colors)
    }
    const tick = (now) => {
      if (startedAt === undefined) startedAt = now
      if (now - lastPaint >= 1000 / 30 - 1e-6) {
        paint(now - startedAt)
        lastPaint = now
      }
      frame = requestAnimationFrame(tick)
    }
    const syncMotion = () => {
      cancelAnimationFrame(frame)
      if (contextLost) return
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
      if (contextLost) return
      profile = renderer.resize(width, height)
      paint(0)
    }
    const onContextLost = (event) => {
      event.preventDefault()
      contextLost = true
      cancelAnimationFrame(frame)
    }
    const onContextRestored = () => {
      try {
        renderer = createWaveRenderer(canvas)
        contextLost = false
        resize()
        syncMotion()
      } catch (error) {
        console.error('Could not restore the 4K wave background:', error)
        setUnavailable(true)
      }
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
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
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      renderer.dispose()
      motion.removeEventListener('change', syncMotion)
      document.removeEventListener('visibilitychange', syncMotion)
    }
  }, [unavailable])

  if (unavailable) return <div className="atmosphere-phantom" aria-hidden="true" />
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
