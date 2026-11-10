import { useState } from 'react'
import { brandLogoUrl } from '../brandLogos.js'

export default function BrandLogo({ name, logoOnly = false, onError }) {
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
