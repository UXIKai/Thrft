import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchSaved, recordInterest } from '../api.js'
import { recordProductInterest, recordSearchHistory } from '../forYou.js'
import { LISTING_BRANDS } from '../listingCatalog.js'
import { SIZE_BRANDS } from '../sizeOptions.js'
import BrandGlobe from './BrandGlobe.jsx'
import './GlassOverlay.css'
import './SavedScreen.css'

function PlusIcon() {
  return (
    <svg className="saved-dock-ico" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg className="saved-dock-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 5.5 8.5 12 15 18.5"
      />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg className="saved-filter-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M4 7h16M7 12h10M10 17h4"
      />
    </svg>
  )
}

function FilterCheckIcon() {
  return (
    <svg className="saved-filter-menu-check" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12.5 4.2 4.2L19 7"
      />
    </svg>
  )
}

function FilterMessagesIcon() {
  return (
    <svg className="saved-filter-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M4.2 5.5h9.1c1.1 0 2 .9 2 2v5.2c0 1.1-.9 2-2 2H9.1L5.8 17.8V14.7H4.2c-1.1 0-2-.9-2-2V7.5c0-1.1.9-2 2-2z"
      />
      <path
        fill="currentColor"
        d="M10.8 9.2h9c1.1 0 2 .9 2 2v5.2c0 1.1-.9 2-2 2h-1.5v3.1l-3.3-3.1H10.8c-1.1 0-2-.9-2-2v-5.2c0-1.1.9-2 2-2z"
        opacity="0.92"
      />
    </svg>
  )
}

function FilterUnknownIcon() {
  return (
    <svg className="saved-filter-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8.2" r="3.2" fill="currentColor" />
      <path
        fill="currentColor"
        d="M5.6 19.2c.9-3.1 3.2-4.7 6.4-4.7s5.5 1.6 6.4 4.7"
      />
      <circle cx="7.2" cy="16.6" r="3.3" fill="currentColor" />
      <text
        x="7.2"
        y="17.15"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#1a1a1a"
        fontSize="4.6"
        fontWeight="700"
        fontFamily="SF Pro Text, SF Pro Display, SF Pro, -apple-system, BlinkMacSystemFont, sans-serif"
      >
        ?
      </text>
    </svg>
  )
}

function FilterSpamIcon() {
  return (
    <svg className="saved-filter-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M4.5 8.2h15v10.3a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8.2z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M4.5 8.2 12 3.8l7.5 4.4"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="m9.2 12.2 5.6 5.6M14.8 12.2l-5.6 5.6"
      />
    </svg>
  )
}

function FilterTrashIcon() {
  return (
    <svg className="saved-filter-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.5 7.5h13M9.2 7.5V5.8a1 1 0 0 1 1-1h3.6a1 1 0 0 1 1 1v1.7M8 7.5l.7 11.2a1.4 1.4 0 0 0 1.4 1.3h4a1.4 1.4 0 0 0 1.4-1.3L16 7.5"
      />
    </svg>
  )
}

const LIKED_FILTER_OPTIONS = [
  { id: 'messages', label: 'Messages', Icon: FilterMessagesIcon },
  { id: 'unknown', label: 'Unknown Senders', Icon: FilterUnknownIcon },
  { id: 'spam', label: 'Spam', Icon: FilterSpamIcon },
  { id: 'deleted', label: 'Recently Deleted', Icon: FilterTrashIcon },
]

function PencilIcon() {
  return (
    <svg className="saved-pencil-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M4.5 16.8 15.2 6.1a1.5 1.5 0 0 1 2.1 0l1.6 1.6a1.5 1.5 0 0 1 0 2.1L8.2 20.5H4.5v-3.7z"
      />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg className="saved-edit-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.2 12.2 2.4 2.4 5.2-5.3"
      />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg className="saved-edit-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M14.5 3.2c-.4-.4-1-.4-1.4 0L9.8 6.5 8.2 5.9a1 1 0 0 0-1.2.3L5.8 8.1a1 1 0 0 0 .3 1.3l1.8 1.2-3.4 3.4a1 1 0 1 0 1.4 1.4l3.4-3.4 1.2 1.8a1 1 0 0 0 1.3.3l1.9-1.2a1 1 0 0 0 .3-1.2l-.6-1.6 3.3-3.3c.4-.4.4-1 0-1.4L14.5 3.2z"
      />
    </svg>
  )
}

function PersonCircleIcon() {
  return (
    <svg className="saved-edit-menu-ico" viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="10" r="2.4" fill="currentColor" />
      <path
        fill="currentColor"
        d="M7.6 17.2c.9-2 2.5-3 4.4-3s3.5 1 4.4 3a6.8 6.8 0 0 1-8.8 0z"
      />
    </svg>
  )
}

/** Registered trademark ® — circle with R. */
function TrademarkIcon() {
  return (
    <svg className="saved-top-ico" viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9.15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
      />
      <text
        x="12"
        y="12.35"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="currentColor"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="11.5"
        fontWeight="700"
      >
        R
      </text>
    </svg>
  )
}

/** Clothing / shirt */
function ShirtIcon() {
  return (
    <svg className="saved-top-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M16.2 4.2 12 6.6 7.8 4.2 3.5 6.3l2.2 3.4V19c0 .9.7 1.6 1.6 1.6h9.4c.9 0 1.6-.7 1.6-1.6V9.7l2.2-3.4-4.3-2.1zM8.4 5.7l2.5 1.4-.7 1.5H7.2L8.4 5.7zm7.2 0 1.2 2.9h-3l-.7-1.5 2.5-1.4zM16.7 19H7.3V10.2h9.4V19z"
      />
    </svg>
  )
}

function slugBrand(name) {
  return (
    String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 40) || 'brand'
  )
}

function brandIdForName(name) {
  const n = String(name || '').toLowerCase()
  const known = SIZE_BRANDS.find(
    (b) =>
      b.name.toLowerCase() === n ||
      b.id === n ||
      b.name.toLowerCase().replace(/^the\s+/, '') === n.replace(/^the\s+/, ''),
  )
  if (known) return known.id
  if (n === 'vuitton' || n === 'louis vuitton') return 'lv'
  if (n === 'north face' || n === 'thenorthface') return 'northface'
  if (n === "levi's" || n === 'levis') return 'levis'
  return slugBrand(name)
}

/** Catalog of brands users can favorite (always searchable). */
function buildBrandCatalog() {
  const byId = new Map()
  for (const b of SIZE_BRANDS) {
    byId.set(b.id, { id: b.id, name: b.name })
  }
  for (const name of LISTING_BRANDS) {
    if (name === 'Other') continue
    const id = brandIdForName(name)
    if (!byId.has(id)) byId.set(id, { id, name })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const BRAND_CATALOG = buildBrandCatalog()

/**
 * Favorites tab — saved products + favorite brands (feeds Home For You).
 * Dock + rotates open; brand globe emerges from the plus and sucks back on close.
 */
export default function SavedScreen({
  onBack,
  onOpenProduct,
  favoredBrands = [],
  onFavoredBrandsChange,
  onForYouRefresh,
}) {
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [favoriteBrands, setFavoriteBrands] = useState(() =>
    Array.isArray(favoredBrands) ? [...favoredBrands] : [],
  )
  const [browseMode, setBrowseMode] = useState('brands') // brands | items
  const [globePhase, setGlobePhase] = useState('closed') // closed | enter | open | exit
  const [globeOrigin, setGlobeOrigin] = useState({ dx: 0, dy: 120 })
  const [filterOpen, setFilterOpen] = useState(false)
  const [listFilter, setListFilter] = useState('messages')
  const [editMenuOpen, setEditMenuOpen] = useState(false)
  const plusRef = useRef(null)
  const editMenuRef = useRef(null)
  const filterRef = useRef(null)

  useEffect(() => {
    let alive = true
    fetchSaved().then((remote) => {
      if (!alive) return
      setItems(Array.isArray(remote) ? remote : [])
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (Array.isArray(favoredBrands)) setFavoriteBrands([...favoredBrands])
  }, [favoredBrands])

  useEffect(() => {
    if (!editMenuOpen) return undefined
    function onDocPointerDown(e) {
      const wrap = editMenuRef.current
      if (wrap && !wrap.contains(e.target)) setEditMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [editMenuOpen])

  useEffect(() => {
    if (!filterOpen) return undefined
    function onDocPointerDown(e) {
      const wrap = filterRef.current
      if (wrap && !wrap.contains(e.target)) setFilterOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [filterOpen])

  const globeOpen = globePhase === 'enter' || globePhase === 'open' || globePhase === 'exit'

  const brandGlobeItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? BRAND_CATALOG.filter(
          (b) =>
            b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q),
        )
      : BRAND_CATALOG
    return list.map((b) => ({ id: b.id, label: b.name }))
  }, [query])

  const favoriteBrandCards = useMemo(() => {
    return favoriteBrands
      .map((id) => {
        const meta =
          BRAND_CATALOG.find((b) => b.id === id) ||
          SIZE_BRANDS.find((b) => b.id === id)
        return meta ? { id: meta.id, name: meta.name } : { id, name: id }
      })
      .filter(Boolean)
  }, [favoriteBrands])

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || globeOpen) return items
    return items.filter((item) => {
      const hay =
        `${item.title || ''} ${item.brandName || ''} ${item.code || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query, globeOpen])

  async function persistFavored(nextIds) {
    setFavoriteBrands(nextIds)
    await onFavoredBrandsChange?.(nextIds)
    onForYouRefresh?.()
  }

  function measurePlusOrigin() {
    const el = plusRef.current
    if (!el) return { dx: 0, dy: 140 }
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const midX = window.innerWidth / 2
    const midY = window.innerHeight * 0.46
    return { dx: cx - midX, dy: cy - midY }
  }

  function openGlobe() {
    setGlobeOrigin(measurePlusOrigin())
    setGlobePhase('enter')
    window.setTimeout(() => {
      setGlobePhase((p) => (p === 'enter' ? 'open' : p))
    }, 480)
  }

  function closeGlobe() {
    if (globePhase === 'exit' || globePhase === 'closed') return
    setGlobeOrigin(measurePlusOrigin())
    setGlobePhase('exit')
  }

  function onGlobeExitComplete() {
    setGlobePhase('closed')
    setQuery('')
  }

  function addBrandFromGlobe(brandId) {
    const brand =
      BRAND_CATALOG.find((b) => b.id === brandId) ||
      SIZE_BRANDS.find((b) => b.id === brandId)
    if (!brand) return

    const next = favoriteBrands.includes(brand.id)
      ? favoriteBrands
      : [brand.id, ...favoriteBrands]

    recordInterest({ kind: 'brand', brandId: brand.id, query: brand.name })
    recordSearchHistory({
      kind: 'like',
      brandId: brand.id,
      brandName: brand.name,
      query: brand.name,
    })
    recordProductInterest(
      { id: `brand:${brand.id}`, brandId: brand.id, clothingType: '' },
      5,
    )

    persistFavored(next)
    closeGlobe()
  }

  function removeFavoriteBrand(brandId) {
    persistFavored(favoriteBrands.filter((id) => id !== brandId))
  }

  function onPlusClick() {
    if (globeOpen) {
      closeGlobe()
      return
    }
    openGlobe()
  }

  function setMode(next) {
    if (next === browseMode) return
    if (globeOpen) closeGlobe()
    setBrowseMode(next)
    setQuery('')
  }

  const showBrands = browseMode === 'brands'
  const showItems = browseMode === 'items'

  return (
    <section className="saved-screen" aria-label="Liked">
      <div className="saved-list-toolbar" ref={editMenuRef}>
        <div className={`saved-edit-row${editMenuOpen ? ' is-open' : ''}`}>
          {editMenuOpen ? (
            <div className="saved-edit-menu" role="menu" aria-label="Liked edit actions">
              <button
                type="button"
                role="menuitem"
                className="saved-edit-menu-btn"
                aria-label="Select"
                onClick={() => setEditMenuOpen(false)}
              >
                <CheckCircleIcon />
                <span className="saved-edit-menu-label">Select</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="saved-edit-menu-btn"
                aria-label="Edit"
                onClick={() => setEditMenuOpen(false)}
              >
                <PinIcon />
                <span className="saved-edit-menu-label">Edit</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="saved-pencil-btn"
              aria-label="Edit"
              aria-expanded={false}
              aria-haspopup="menu"
              onClick={() => setEditMenuOpen(true)}
            >
              <PencilIcon />
            </button>
          )}
        </div>
        <h1 className="saved-list-title">Liked</h1>
        <div className="saved-filter-wrap" ref={filterRef}>
          <button
            type="button"
            className={`saved-filter-btn${filterOpen ? ' is-on' : ''}`}
            aria-label="Filter liked"
            aria-expanded={filterOpen}
            aria-haspopup="menu"
            onClick={() => setFilterOpen((open) => !open)}
          >
            <FilterIcon />
          </button>
          {filterOpen ? (
            <div
              className="saved-filter-menu"
              role="menu"
              aria-label="Liked filters"
            >
              {LIKED_FILTER_OPTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={listFilter === id}
                  className={`saved-filter-menu-item${
                    listFilter === id ? ' is-on' : ''
                  }`}
                  onClick={() => {
                    setListFilter(id)
                    setFilterOpen(false)
                  }}
                >
                  <span className="saved-filter-menu-check-slot" aria-hidden>
                    {listFilter === id ? <FilterCheckIcon /> : null}
                  </span>
                  <Icon />
                  <span className="saved-filter-menu-label">{label}</span>
                </button>
              ))}
              <div className="saved-filter-menu-sep" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="saved-filter-menu-item is-manage"
                onClick={() => setFilterOpen(false)}
              >
                <span className="saved-filter-menu-label">Manage Filtering</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="saved-mode-switch"
        role="tablist"
        aria-label="Favorites view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={showBrands}
          aria-label="Brands"
          title="Brands"
          className={`saved-mode-btn${showBrands ? ' is-active' : ''}`}
          onClick={() => setMode('brands')}
        >
          <TrademarkIcon />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={showItems}
          aria-label="Clothing items"
          title="Clothing items"
          className={`saved-mode-btn${showItems ? ' is-active' : ''}`}
          onClick={() => setMode('items')}
        >
          <ShirtIcon />
        </button>
      </div>

      <div className="saved-grid">
        {showBrands
          ? favoriteBrandCards.map((brand) => (
              <button
                key={`brand-${brand.id}`}
                type="button"
                className="saved-item"
                onClick={() => removeFavoriteBrand(brand.id)}
                aria-label={`${brand.name} favorite brand. Tap to remove.`}
              >
                <span className="saved-item-media" aria-hidden>
                  <span className="saved-item-mark">
                    {brand.name.slice(0, 2).toUpperCase()}
                  </span>
                </span>
                <span className="saved-item-name">{brand.name}</span>
              </button>
            ))
          : null}
        {showItems
          ? visibleItems.map((item) => {
              const photo =
                item.photoUrl || item.imageUrl || item.image_url || ''
              const showPhoto =
                photo &&
                photo !== 'placeholder' &&
                !/^placeholder$/i.test(photo)
              return (
                <button
                  key={item.id}
                  type="button"
                  className="saved-item"
                  onClick={() => onOpenProduct?.(item)}
                  aria-label={item.title || item.brandName || 'Saved item'}
                >
                  <span className="saved-item-media" aria-hidden>
                    {showPhoto ? (
                      <img
                        className="saved-item-photo"
                        src={photo}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <span className="saved-item-mark">
                        {String(item.code || item.title || '?')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="saved-item-name">
                    {item.brandName || item.title || item.code}
                  </span>
                </button>
              )
            })
          : null}
      </div>

      <div className={`saved-search-dock${globeOpen ? ' is-open' : ''}`}>
        <div className="saved-search-bar">
          <button
            type="button"
            className="saved-dock-back"
            aria-label="Back"
            onClick={() => onBack?.()}
          >
            <BackIcon />
          </button>
          <input
            id="saved-search-input"
            className="saved-search-input"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            name="thrft_saved_search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            placeholder=""
            aria-label={
              globeOpen
                ? 'Filter brands on globe'
                : showBrands
                  ? 'Search brands'
                  : 'Search clothing items'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            ref={plusRef}
            type="button"
            className={`saved-search-add${globeOpen ? ' is-globe-open' : ''}`}
            aria-label={globeOpen ? 'Close brand globe' : 'Open brand globe'}
            aria-pressed={globeOpen}
            onClick={onPlusClick}
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {globePhase !== 'closed' && (
        <BrandGlobe
          variant="dock"
          phase={globePhase === 'enter' ? 'enter' : globePhase === 'exit' ? 'exit' : 'open'}
          origin={globeOrigin}
          brands={brandGlobeItems}
          activeId=""
          onSelect={addBrandFromGlobe}
          onClose={closeGlobe}
          onExitComplete={onGlobeExitComplete}
          title="Brands"
        />
      )}
    </section>
  )
}
