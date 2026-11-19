import { useEffect, useRef, useState } from 'react'
import { acquireMockupCutout } from '../mockupCutouts.js'

// Temporary on-screen badge so a device without a console can see why removal failed.
function showCutoutError(message) {
  let badge = document.getElementById('cutout-debug-badge')
  if (!badge) {
    badge = document.createElement('div')
    badge.id = 'cutout-debug-badge'
    badge.style.cssText = 'position:fixed;left:8px;right:8px;bottom:90px;z-index:99999;padding:8px 10px;border-radius:10px;background:#b00020;color:#fff;font:12px/1.3 system-ui;word-break:break-word'
    badge.onclick = () => badge.remove()
    document.body.appendChild(badge)
  }
  badge.textContent = `Background removal failed: ${message} (tap to dismiss)`
}

export default function ProductPhoto({ src, cutout = false, ...props }) {
  const ref = useRef(null)
  const [result, setResult] = useState(null)
  const [failedSrc, setFailedSrc] = useState(null)

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
        showCutoutError(error?.message || String(error))
        setResult({ src, error: error?.message || String(error) })
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
  const displaySrc = current?.image || src
  if (!displaySrc || displaySrc === 'placeholder' || failedSrc === displaySrc) {
    return <span className={`${props.className || ''} product-photo-unavailable`.trim()}
      role="img" aria-label="Product photo unavailable">Photo unavailable</span>
  }
  return <img {...props} ref={ref} src={current?.image || src}
    onError={(event) => {
      setFailedSrc(displaySrc)
      props.onError?.(event)
    }}
    title={current?.error ? `Background removal failed: ${current.error}` : props.title}
    className={`${props.className || ''}${current?.image ? ' is-product-cutout' : ''}`.trim()} />
}
