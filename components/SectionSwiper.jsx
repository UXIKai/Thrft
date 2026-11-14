import useSectionSwipe from './useSectionSwipe.js'
import './SectionSwiper.css'

/**
 * A section picker without a wheel: the current section's icon over a row of dots,
 * and the content below swaps when it is swiped left or right (or a dot is tapped).
 * `controls` is the id of the panel the dots label, when the content already has one.
 */
export default function SectionSwiper({
  sections,
  value,
  onChange,
  label,
  idPrefix,
  controls,
  className = '',
  showPager = true,
  children,
}) {
  const index = Math.max(0, sections.findIndex((s) => s.id === value))
  const { ref, go } = useSectionSwipe({
    index,
    count: sections.length,
    onChange: (i) => onChange(sections[i].id),
  })
  const { Icon } = sections[index]

  const onKeyDown = (e) => {
    let next
    if (e.key === 'ArrowLeft') next = index - 1
    else if (e.key === 'ArrowRight') next = index + 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = sections.length - 1
    else return
    e.preventDefault()
    if (next < 0 || next >= sections.length) return
    go(next)
    e.currentTarget.querySelector(`#${idPrefix}-${sections[next].id}-tab`)?.focus()
  }

  return (
    <>
      {showPager && <div className="section-pager" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        <span className="section-pager-icon" aria-hidden="true">
          <Icon />
        </span>
        <div className="section-pager-dots">
          {sections.map(({ id, label: name }, i) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${idPrefix}-${id}-tab`}
              aria-label={name}
              aria-selected={i === index}
              aria-controls={controls}
              tabIndex={i === index ? 0 : -1}
              className={`section-pager-dot is-bare${i === index ? ' is-active' : ''}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
      </div>}
      <div ref={ref} className={`section-swipe ${className}`.trim()}>
        {children}
      </div>
    </>
  )
}
