import './HomeFilterLinks.css'

/**
 * Home filter entry — two word-links side by side.
 * Brands / Category open the circular picker; labels show the pick when set.
 */
export default function HomeFilterLinks({
  brandLabel = null,
  categoryLabel = null,
  onOpenBrands,
  onOpenCategory,
}) {
  return (
    <nav className="home-filter-links" aria-label="Browse filters">
      <button
        type="button"
        className={`home-filter-link${brandLabel ? ' is-set' : ''}`}
        aria-label={brandLabel ? `Brand filter: ${brandLabel}` : 'Open brands'}
        onClick={onOpenBrands}
      >
        {brandLabel || 'Brands'}
      </button>
      <button
        type="button"
        className={`home-filter-link${categoryLabel ? ' is-set' : ''}`}
        aria-label={
          categoryLabel ? `Category filter: ${categoryLabel}` : 'Open category'
        }
        onClick={onOpenCategory}
      >
        {categoryLabel || 'Category'}
      </button>
    </nav>
  )
}
