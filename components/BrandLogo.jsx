import { useState } from 'react'
import { brandLogoUrl, squareLogoBackground } from '../brandLogos.js'

export default function BrandLogo({ name, logoOnly = false, onError, onBackground }) {
  const [failedSource, setFailedSource] = useState(null)
  const src = brandLogoUrl(name)
  return (
    <span className={`brand-logo-label${logoOnly ? ' is-logo-only' : ''}`} title={name}>
      {src && failedSource !== src && <img
        className="brand-logo"
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={(event) => {
          if (!onBackground) return
          const image = event.currentTarget
          const canvas = document.createElement('canvas')
          canvas.width = image.naturalWidth
          canvas.height = image.naturalHeight
          const context = canvas.getContext('2d', { willReadFrequently: true })
          if (!context) {
            console.warn(`Unable to inspect the logo background for ${name}.`)
            return
          }
          context.drawImage(image, 0, 0)
          try {
            onBackground(squareLogoBackground(
              context.getImageData(0, 0, canvas.width, canvas.height).data,
              canvas.width,
              canvas.height,
            ))
          } catch (error) {
            if (error.name !== 'SecurityError') throw error
            console.warn(`Unable to inspect the cross-origin logo background for ${name}.`, error)
          }
        }}
        onError={() => {
          console.warn(`Unable to load the logo for ${name}.`)
          setFailedSource(src)
          onError?.()
        }}
      />}
      {(!logoOnly || !src || failedSource === src) && <span>{name}</span>}
    </span>
  )
}
