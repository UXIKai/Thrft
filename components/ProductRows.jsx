import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fetchSaved, fetchStoreProducts, saveSavedItems } from '../api.js'
import {
  buildPersonalizedRows,
  PERSONALIZED_PRODUCTS_PER_ROW,
  PERSONALIZED_ROW_COUNT,
} from '../forYou.js'
import {
  fetchAvailableListings,
  filterListingsByBrand,
  filterListingsByColor,
  filterListingsByClothingType,
  parseListingPrice,
  TYPE_TO_CATEGORIES,
} from '../listings.js'
import { isSupabaseConfigured } from '../supabase.js'
import { BRAND_ROWS } from '../brandsCatalog.js'

const MARKET_SAMPLES = BRAND_ROWS.flatMap((brand) =>
  brand.products.slice(0, 10).map((product) => ({
    ...product,
    id: `market-demo-${product.id}`,
    title: `Sample · ${product.title}`,
    category: TYPE_TO_CATEGORIES[product.clothingType]?.[0] || product.clothingType,
    description: `Sample Market product for preview. ${product.description}`,
    isMock: true,
  })),
)

const MARKET_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'under10', label: 'Under $10' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'shoes', label: 'Footwear' },
  { id: 'bags', label: 'Bags' },
  { id: 'tops', label: 'Tops' },
  { id: 'bottoms', label: 'Bottoms' },
  { id: 'outerwear', label: 'Outerwear' },
]

function MarketCard({ product, onOpen, liked, onToggleLike }) {
  const photo = product.photoUrl || product.image_url
  const likes = Math.max(0, Number(product.likes ?? product.likeCount ?? 0)) + (liked ? 1 : 0)
  const name = product.brandName || product.title || 'Item'
  return (
    <div className="market-card">
      <button type="button" className="market-card-open" onClick={() => onOpen?.(product)} aria-label={`${name} ${product.price || ''}`}>
        <span className="market-card-photo">
          {photo ? <img src={photo} alt="" loading="lazy" draggable="false" /> : null}
        </span>
        <span className="market-card-name">{name}</span>
        {product.price ? <span className="market-card-price">{product.price}</span> : null}
      </button>
      <button
        type="button"
        className={`market-card-like${liked ? ' is-liked' : ''}`}
        aria-pressed={liked}
        aria-label={liked ? 'Remove from favorites' : 'Add to favorites'}
        onClick={() => onToggleLike?.(product)}
      >
        <svg viewBox="0 0 24 24" aria-hidden><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        {likes > 0 ? <span>{likes}</span> : null}
      </button>
    </div>
  )
}

/** Slow seamless crawl — never stops while the row is mounted. */
const PX_PER_SEC = 18
const BOX_W = 118
const BOX_GAP = 10

function ProductCard({ product, onOpen }) {
  const label =
    [product?.brandName, product?.title, product?.price]
      .filter(Boolean)
      .join(' · ') || product?.code || 'Product'
  return (
    <button
      type="button"
      className={`product-box is-empty tone-${product.tone || '1'}`}
      aria-label={label}
      title={label}
      onClick={() => onOpen?.(product)}
    />
  )
}

function CrawlRow({ row, rowIndex, onOpenProduct }) {
  const wrapRef = useRef(null)
  const seqRef = useRef(null)
  const [loopPx, setLoopPx] = useState(0)
  const products = row.products || []

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const seq = seqRef.current
    if (!wrap || !seq || !products.length) return undefined

    const measure = () => {
      if (!seq.getBoundingClientRect().width) return
      const styles = getComputedStyle(seq.parentElement)
      const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 0
      const width = seq.getBoundingClientRect().width
      setLoopPx(width + gap)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    ro.observe(seq)
    return () => ro.disconnect()
  }, [products])

  const goesRight = rowIndex % 2 === 0
  const estimated =
    products.length * (BOX_W + BOX_GAP) || PERSONALIZED_PRODUCTS_PER_ROW * (BOX_W + BOX_GAP)
  const loop = loopPx > 0 ? loopPx : estimated
  const durationSec = Math.max(18, loop / PX_PER_SEC)

  return (
    <article className="brand-row">
      <div ref={wrapRef} className="brand-row-track-wrap">
        <div
          className={`brand-row-track ${loopPx > 0 ? (goesRight ? 'crawl-right' : 'crawl-left') : ''}`}
          style={{
            '--loop': `${loop}px`,
            '--crawl-duration': `${durationSec}s`,
            animationPlayState: 'running',
          }}
        >
          <div className="brand-row-seq" ref={seqRef}>
            {products.map((p) => (
              <ProductCard key={`${row.id}-${p.id}`} product={p} onOpen={(item) => onOpenProduct?.({ ...item, detailVariant: 'store' })} />
            ))}
          </div>
          <div className="brand-row-seq" aria-hidden>
            {products.map((p) => (
              <ProductCard
                key={`${row.id}-${p.id}-b`}
                product={p}
                onOpen={(item) => onOpenProduct?.({ ...item, detailVariant: 'store' })}
              />
            ))}
          </div>
          <div className="brand-row-seq" aria-hidden>
            {products.map((p) => (
              <ProductCard
                key={`${row.id}-${p.id}-c`}
                product={p}
                onOpen={(item) => onOpenProduct?.({ ...item, detailVariant: 'store' })}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}

/**
 * Market uses a growing three-column grid; Store retains personalized marquees.
 */
export default function ProductRows({
  segment = 'store',
  onOpenProduct,
  clothingType = 'all',
  brandId = '',
  colorId = '',
  brandName = '',
  forYouRefresh = 0,
  feedRefresh = 0,
  favoredBrands = [],
  clothingSizes = {},
  brandSizes = {},
  savedProductIds = [],
}) {
  const [listings, setListings] = useState(() => segment === 'market' ? MARKET_SAMPLES : [])
  const [savedItems, setSavedItems] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [chip, setChip] = useState('all')

  useEffect(() => {
    let alive = true
    fetchSaved()
      .then((rows) => {
        if (!alive) return
        setSavedItems(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (alive) setSavedItems([])
      })
    return () => {
      alive = false
    }
  }, [forYouRefresh, feedRefresh])

  useEffect(() => {
    let alive = true
    if (segment === 'store' && !isSupabaseConfigured()) {
      setStatus('ready')
      setListings([])
      return undefined
    }
    setStatus('loading')
    setError('')
    const request = segment === 'store'
      ? fetchAvailableListings({ limit: 240 })
      : fetchStoreProducts()
    request
      .then((rows) => {
        if (!alive) return
        setListings(segment === 'market' ? [...rows, ...MARKET_SAMPLES] : rows)
        setStatus('ready')
      })
      .catch((err) => {
        if (!alive) return
        setListings(segment === 'market' ? MARKET_SAMPLES : [])
        setError(err.message || 'Could not load products.')
        setStatus('ready')
      })
    return () => {
      alive = false
    }
  }, [feedRefresh, forYouRefresh, segment])

  const filteredCatalog = useMemo(() => {
    const live = Array.isArray(listings) ? listings : []
    const byType = filterListingsByClothingType(live, clothingType)
    return filterListingsByColor(
      filterListingsByBrand(byType, { brandId, brandName }),
      colorId,
    )
  }, [listings, clothingType, brandId, brandName, colorId])

  const rows = useMemo(() => {
    if (segment === 'market') return []
    if (!filteredCatalog.length) return []
    const catalogIds = new Set(filteredCatalog.map((product) => product.id))
    const savedIds = [
      ...savedProductIds,
      ...savedItems.map((item) => item?.id).filter(Boolean),
    ]
    return buildPersonalizedRows({
      catalog: filteredCatalog,
      favoredBrands,
      savedProducts: savedItems.filter((product) => catalogIds.has(product.id)),
      savedProductIds: savedIds,
      clothingSizes,
      brandSizes,
      rowCount: PERSONALIZED_ROW_COUNT,
      productsPerRow: PERSONALIZED_PRODUCTS_PER_ROW,
    })
  }, [
    filteredCatalog,
    favoredBrands,
    savedItems,
    savedProductIds,
    clothingSizes,
    brandSizes,
    forYouRefresh,
    segment,
  ])

  const savedIdSet = useMemo(() => new Set(savedItems.map((item) => String(item?.id))), [savedItems])

  const toggleLike = (product) => {
    const id = String(product.id)
    const next = savedIdSet.has(id)
      ? savedItems.filter((item) => String(item?.id) !== id)
      : [...savedItems, product]
    setSavedItems(next)
    saveSavedItems(next)
  }

  const marketItems = useMemo(() => {
    if (chip === 'all') return filteredCatalog
    if (chip === 'under10') return filteredCatalog.filter((p) => parseListingPrice(p.price) < 10)
    return filterListingsByClothingType(filteredCatalog, chip)
  }, [filteredCatalog, chip])

  if (segment === 'market') {
    return (
      <section className="product-feed market-product-feed" id="home-product-panel" role="tabpanel" aria-labelledby="home-market-tab" aria-busy={status === 'loading'}>
        {!marketItems.length && <p role="status">{status === 'loading' ? 'Loading products...' : 'No Market products found.'}</p>}
        <div className="market-chips" role="tablist" aria-label="Market filters">
          {MARKET_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={chip === c.id}
              className={`market-chip${chip === c.id ? ' is-active' : ''}`}
              onClick={() => setChip(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="market-product-grid">
          {marketItems.map((product) => (
            <MarketCard key={product.id} product={product} liked={savedIdSet.has(String(product.id))} onToggleLike={toggleLike} onOpen={(item) => onOpenProduct?.({ ...item, detailVariant: 'market' })} />
          ))}
        </div>
      </section>
    )
  }

  if (status === 'loading' && !rows.length) {
    return (
      <section className="product-feed" id="home-product-panel" role="tabpanel" aria-labelledby={`home-${segment}-tab`} aria-busy="true">
        <p role="status">Loading products...</p>
      </section>
    )
  }

  return (
    <section className="product-feed" id="home-product-panel" role="tabpanel" aria-labelledby={`home-${segment}-tab`}>
      {!rows.length && <p role="status">No {segment === 'market' ? 'Market' : 'Store'} products found.</p>}
      {rows.map((row, rowIndex) => (
        <CrawlRow
          key={row.id}
          row={row}
          rowIndex={rowIndex}
          onOpenProduct={onOpenProduct}
        />
      ))}
    </section>
  )
}
