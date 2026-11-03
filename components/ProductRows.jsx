import { useEffect, useMemo, useRef, useState } from 'react'
import { BRAND_ROWS } from '../brandsCatalog.js'
import { fetchSaved } from '../api.js'
import {
  buildPersonalizedRows,
  PERSONALIZED_PRODUCTS_PER_ROW,
  PERSONALIZED_ROW_COUNT,
} from '../forYou.js'
import {
  fetchAvailableListings,
  filterListingsByBrand,
  filterListingsByClothingType,
} from '../listings.js'
import { isSupabaseConfigured } from '../supabase.js'

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

  useEffect(() => {
    const wrap = wrapRef.current
    const seq = seqRef.current
    if (!wrap || !seq || !products.length) return undefined

    const measure = () => {
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
          className={`brand-row-track ${goesRight ? 'crawl-right' : 'crawl-left'}`}
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
 * Home product feed — 10 continuous marquees × 20 boxes, ranked from the
 * signed-in user's search history and likes.
 */
export default function ProductRows({
  onOpenProduct,
  clothingType = 'all',
  brandId = '',
  brandName = '',
  forYouRefresh = 0,
  feedRefresh = 0,
  favoredBrands = [],
  clothingSizes = {},
  brandSizes = {},
  savedProductIds = [],
}) {
  const [listings, setListings] = useState([])
  const [savedItems, setSavedItems] = useState([])
  const [status, setStatus] = useState('loading')

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
    if (!isSupabaseConfigured()) {
      setStatus('ready')
      setListings([])
      return undefined
    }
    setStatus('loading')
    fetchAvailableListings({ limit: 240 })
      .then((rows) => {
        if (!alive) return
        setListings(rows)
        setStatus('ready')
      })
      .catch(() => {
        if (!alive) return
        setListings([])
        setStatus('ready')
      })
    return () => {
      alive = false
    }
  }, [feedRefresh, forYouRefresh])

  const filteredCatalog = useMemo(() => {
    const live = Array.isArray(listings) ? listings : []
    const mock = BRAND_ROWS.flatMap((b) => b.products)
    const base = live.length ? live : mock
    const byType = filterListingsByClothingType(base, clothingType)
    return filterListingsByBrand(byType, { brandId, brandName })
  }, [listings, clothingType, brandId, brandName])

  const pool = useMemo(() => {
    // Personalization pool stays broad so likes/search still fill rows even
    // when a home filter is active; filter only soft-biases via affinity.
    const live = Array.isArray(listings) ? listings : []
    const mock = BRAND_ROWS.flatMap((b) => b.products)
    return live.length ? [...live, ...mock] : mock
  }, [listings])

  const rows = useMemo(() => {
    const savedIds = [
      ...savedProductIds,
      ...savedItems.map((item) => item?.id).filter(Boolean),
    ]
    return buildPersonalizedRows({
      catalog: pool.length ? pool : filteredCatalog,
      favoredBrands,
      savedProducts: savedItems,
      savedProductIds: savedIds,
      clothingSizes,
      brandSizes,
      rowCount: PERSONALIZED_ROW_COUNT,
      productsPerRow: PERSONALIZED_PRODUCTS_PER_ROW,
    })
  }, [
    pool,
    filteredCatalog,
    favoredBrands,
    savedItems,
    savedProductIds,
    clothingSizes,
    brandSizes,
    forYouRefresh,
  ])

  if (status === 'loading' && !rows.length) {
    return (
      <section className="product-feed" aria-label="Personalized product rows" aria-busy="true" />
    )
  }

  return (
    <section className="product-feed" aria-label="Personalized product rows">
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
