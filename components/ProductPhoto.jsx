import { useEffect, useRef, useState } from 'react'
import { acquireMockupCutout } from '../mockupCutouts.js'

export default function ProductPhoto({ src, cutout = false, ...props }) {
  const ref = useRef(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!src || !cutout || !ref.current) return undefined
    let active = true
    let request
    let failed = false
    function start() {
      if (request || failed) return
      const currentRequest = acquireMockupCutout(src)
      request = currentRequest
      currentRequest.promise.then((image) => {
        if (active && request === currentRequest && image) {
          setResult({ src, image })
          observer?.disconnect()
          currentRequest.release()
        }
      }).catch((error) => {
        if (!active || request !== currentRequest) return
        console.error('Could not remove product photo background:', error)
        failed = true
        setResult({ src, error: true })
      })
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        start()
      } else {
        request?.release()
        request = null
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
