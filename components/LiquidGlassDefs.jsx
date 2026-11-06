/**
 * SVG filter for Apple-style Liquid Glass refraction.
 * Chromium: used via backdrop-filter: url(#lg-refract).
 * Elsewhere: frosted Clear glass fallback in CSS.
 */
export default function LiquidGlassDefs() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      style={{ position: 'absolute', overflow: 'hidden' }}
    >
      <defs>
        <filter
          id="lg-refract"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.012"
            numOctaves="2"
            seed="9"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.4" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="36"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id="lg-btn" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" seed="3" result="n" />
          <feGaussianBlur in="n" stdDeviation="0.8" result="s" />
          <feDisplacementMap in="SourceGraphic" in2="s" scale="10" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="lg-nav" x="-5%" y="-30%" width="110%" height="160%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="1" seed="5" result="n" />
          <feGaussianBlur in="n" stdDeviation="1.2" result="s" />
          <feDisplacementMap in="SourceGraphic" in2="s" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="lg-nav-edge" x="-5%" y="-30%" width="110%" height="160%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.03" numOctaves="1" seed="8" result="n" />
          <feGaussianBlur in="n" stdDeviation="1" result="s" />
          <feDisplacementMap in="SourceGraphic" in2="s" scale="48" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="lg-lens" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.02" numOctaves="2" seed="11" result="n" />
          <feGaussianBlur in="n" stdDeviation="1.5" result="s" />
          <feDisplacementMap in="SourceGraphic" in2="s" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="lg-lens-bg" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="4" result="n" />
          <feGaussianBlur in="n" stdDeviation="1.5" result="s" />
          <feDisplacementMap in="SourceGraphic" in2="s" scale="40" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}
