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
      </defs>
    </svg>
  )
}
