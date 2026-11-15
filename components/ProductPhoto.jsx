import { useEffect, useRef, useState } from 'react'
import { acquireMockupCutout } from '../mockupCutouts.js'

export default function ProductPhoto({ src, cutout = false, ...props }) {
  const ref = useRef(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!src || !cutout || !ref.current) return undefined
    let active = true
    let request
    function start() {
      if (request) return
      request = acquireMockupCutout(src)
      request.promise.then((image) => {
        if (active && image) setResult({ src, image })
      }).catch((error) => {
        console.error('Could not remove product photo background:', error)
        if (active) setResult({ src, error: true })
      })
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect()
        start()
      }
    })
    if (observer) observer.observe(ref.current)
    else start()
    return () => { active = false; observer?.disconnect(); request?.release() }
  }, [src, cutout])

  const current = cutout && result?.src === src ? result : null
  return <img {...props} ref={ref} src={current?.image || src}
    title={current?.error ? 'Background removal failed; showing original photo' : props.title}
    className={`${props.className || ''}${current?.image ? ' is-product-cutout' : ''}`.trim()} />
}
