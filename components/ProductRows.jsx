import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fetchSaved, fetchStoreProducts } from '../api.js'
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
  TYPE_TO_CATEGORIES,
} from '../listings.js'
import { isSupabaseConfigured } from '../supabase.js'
import { BRAND_ROWS } from '../brandsCatalog.js'

const MARKET_SAMPLES = BRAND_ROWS.flatMap((brand) =>
  brand.products.slice(0, 3).map((product) => ({
    ...product,
    id: `market-demo-${product.id}`,
    title: `Sample · ${product.title}`,
    category: TYPE_TO_CATEGORIES[product.clothingType]?.[0] || product.clothingType,
    description: `Sample Market product for preview. ${product.description}`,
    isMock: true,
  })),
)

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
              <ProductCard key={`${row.id}-${p.id}`} product={p} onOpen={onOpenProduct} />
            ))}
          </div>
          <div className="brand-row-seq" aria-hidden>
            {products.map((p) => (
              <ProductCard
                key={`${row.id}-${p.id}-b`}
                product={p}
                onOpen={onOpenProduct}
              />
            ))}
          </div>
          <div className="brand-row-seq" aria-hidden>
            {products.map((p) => (
              <ProductCard
                key={`${row.id}-${p.id}-c`}
                product={p}
                onOpen={onOpenProduct}
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

  if (segment === 'market') {
    return (
      <section className="product-feed market-product-feed" id="home-product-panel" role="tabpanel" aria-labelledby="home-market-tab" aria-busy={status === 'loading'}>
        {error && <p role="alert">{error}</p>}
        {!filteredCatalog.length && <p role="status">{status === 'loading' ? 'Loading products...' : 'No Market products found.'}</p>}
        <div className="market-product-grid">
          {filteredCatalog.map((product) => (
            <ProductCard key={product.id} product={product} onOpen={onOpenProduct} />
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
      {error ? <p role="alert">{error}</p> : !rows.length && <p role="status">No {segment === 'market' ? 'Market' : 'Store'} products found.</p>}
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
