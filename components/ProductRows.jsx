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
import { STORE_BRAND_ROWS } from '../brandsCatalog.js'

const MARKET_ROW_COUNT = 50
const MARKET_PRODUCTS_PER_ROW = 20

// Preview content: 50 rows x 20, cycling through every brand so each row is a mixed bag.
const MARKET_SAMPLES = Array.from({ length: MARKET_ROW_COUNT * MARKET_PRODUCTS_PER_ROW }, (_, i) => {
  const brand = STORE_BRAND_ROWS[(i * 7) % STORE_BRAND_ROWS.length]
  const product = brand.products[Math.floor(i / STORE_BRAND_ROWS.length) % brand.products.length]
  return {
    ...product,
    id: `market-demo-${i}-${product.id}`,
    title: `Sample · ${product.title}`,
    category: TYPE_TO_CATEGORIES[product.clothingType]?.[0] || product.clothingType,
    description: `Sample Market product for preview. ${product.description}`,
    isMock: true,
  }
})

const PLACEHOLDER_ROWS = Array.from({ length: PERSONALIZED_ROW_COUNT }, (_, r) => ({
  id: `loading-row-${r}`,
  name: 'Store',
  products: Array.from({ length: PERSONALIZED_PRODUCTS_PER_ROW }, (_, i) => ({ id: `loading-${r}-${i}` })),
}))

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

const EXTRA_CATEGORY_LABELS = [
  'Dresses', 'Skirts', 'Jeans', 'Shorts', 'Pants', 'Joggers', 'Leggings', 'Sweatpants',
  'T-Shirts', 'Polos', 'Tank Tops', 'Button-Downs', 'Blouses', 'Hoodies', 'Sweatshirts', 'Sweaters',
  'Cardigans', 'Vests', 'Jackets', 'Coats', 'Blazers', 'Puffers', 'Denim Jackets', 'Leather Jackets',
  'Windbreakers', 'Rompers', 'Jumpsuits', 'Suits', 'Swimwear', 'Activewear', 'Loungewear', 'Pajamas',
  'Underwear', 'Socks', 'Sneakers', 'Boots', 'Sandals', 'Heels', 'Flats', 'Loafers',
  'Slides', 'Hats', 'Caps', 'Beanies', 'Scarves', 'Gloves', 'Belts', 'Sunglasses',
  'Watches', 'Jewelry', 'Necklaces', 'Bracelets', 'Rings', 'Earrings', 'Backpacks', 'Handbags',
  'Totes', 'Crossbody', 'Wallets', 'Ties', 'Vintage', 'Streetwear', 'Designer', 'Y2K',
  'Athleisure', 'Formal', 'Casual', 'Workwear', 'Outdoor', 'Western', 'Boho', 'Preppy',
  'Grunge', 'Minimalist', 'Gym', 'Kids', 'Baby', 'Unisex', 'Costumes', 'Jerseys',
]

// Extra chips match a listing's category, title or brand text (plural trimmed: Boots -> boot).
const EXTRA_CHIPS = EXTRA_CATEGORY_LABELS.map((label) => {
  const lower = label.toLowerCase()
  return {
    id: `cat-${lower.replace(/[^a-z0-9]+/g, '-')}`,
    label,
    key: lower.length > 4 && lower.endsWith('s') && !lower.endsWith('ss') ? lower.slice(0, -1) : lower,
  }
})
const ALL_CHIPS = [...MARKET_CHIPS, ...EXTRA_CHIPS]

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

const HOLD_MS = 480
const HOLD_SLOP_PX = 10

function CrawlRow({ row, rowIndex, onOpenProduct, onHoldRow, market = false, likedIds, onToggleLike }) {
  const articleRef = useRef(null)
  const wrapRef = useRef(null)
  const seqRef = useRef(null)
  const holdRef = useRef({ timer: 0, x: 0, y: 0, fired: false })
  const [loopPx, setLoopPx] = useState(0)
  const [visible, setVisible] = useState(rowIndex < 6)
  const products = row.products || []

  // 40 rows x 40 tiles is heavy, so only rows near the screen are mounted.
  useEffect(() => {
    const el = articleRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '500px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const seq = seqRef.current
    if (!visible || !wrap || !seq || !products.length) return undefined

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
  }, [products, visible])

  useEffect(() => () => window.clearTimeout(holdRef.current.timer), [])

  const cancelHold = () => {
    window.clearTimeout(holdRef.current.timer)
    holdRef.current.timer = 0
  }
  const onPointerDown = (e) => {
    if (!onHoldRow || (e.pointerType === 'mouse' && e.button !== 0)) return
    const hold = holdRef.current
    hold.fired = false
    hold.x = e.clientX
    hold.y = e.clientY
    cancelHold()
    hold.timer = window.setTimeout(() => {
      hold.timer = 0
      hold.fired = true
      onHoldRow?.(row)
    }, HOLD_MS)
  }
  const onPointerMove = (e) => {
    const hold = holdRef.current
    if (!hold.timer) return
    if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD_SLOP_PX) cancelHold()
  }
  // A hold must not also count as a tap on the tile underneath.
  const onClickCapture = (e) => {
    if (!holdRef.current.fired) return
    holdRef.current.fired = false
    e.preventDefault()
    e.stopPropagation()
  }

  const goesRight = rowIndex % 2 === 1
  const estimated =
    products.length * (BOX_W + BOX_GAP) || PERSONALIZED_PRODUCTS_PER_ROW * (BOX_W + BOX_GAP)
  const loop = loopPx > 0 ? loopPx : estimated
  const durationSec = Math.max(18, loop / PX_PER_SEC)
  const open = (item) => onOpenProduct?.({ ...item, detailVariant: market ? 'market' : 'store' })
  const renderCard = (p, key) =>
    market ? (
      <MarketCard key={key} product={p} liked={likedIds?.has(String(p.id))} onToggleLike={onToggleLike} onOpen={open} />
    ) : (
      <ProductCard key={key} product={p} onOpen={open} />
    )

  return (
    <article
      ref={articleRef}
      className={`brand-row${market ? ' is-market' : ''}${visible ? '' : ' is-idle'}`}
      aria-label={onHoldRow ? `${row.name} row. Hold to see all.` : row.name}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      onClickCapture={onClickCapture}
      onContextMenu={(e) => e.preventDefault()}
    >
      {visible && (
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
              {products.map((p, i) => renderCard(p, `${row.id}-${p.id}-${i}`))}
            </div>
            <div className="brand-row-seq" aria-hidden>
              {products.map((p, i) => renderCard(p, `${row.id}-${p.id}-${i}-b`))}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

/** Full page for one Store row: 8 rows of 5 products, each a manually scrolled strip like the Store rows. */
function StoreRowPage({ row, onBack, onOpenProduct }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const page = ref.current?.closest('.home-scroll')
    if (page) page.scrollTop = 0
    // Alternate rows start from the far end so neighbouring rows read in opposite directions.
    ref.current?.querySelectorAll('.store-row-strip').forEach((el, i) => {
      el.scrollLeft = i % 2 === 1 ? el.scrollWidth : 0
    })
  }, [])
  return (
    <section ref={ref} className="product-feed store-row-page" id="home-product-panel" role="tabpanel" aria-label={row.name}>
      <header className="store-row-page-head">
        <button type="button" className="store-row-page-back is-bare" onClick={onBack} aria-label="Back to Store">
          <svg viewBox="0 0 24 24" aria-hidden><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="store-row-page-title">
          <h2>{row.name}</h2>
          {row.category ? <p>{row.category}</p> : null}
        </div>
        <span className="store-row-page-spacer" aria-hidden />
      </header>
      <div className="store-row-list">
        {Array.from({ length: 8 }, (_, i) => (row.products || []).slice(i * 5, i * 5 + 5)).map((chunk, i) => (
          <div key={i} className="store-row-strip">
            {chunk.map((p) => (
              <ProductCard key={`${row.id}-${p.id}`} product={p} onOpen={(item) => onOpenProduct?.({ ...item, detailVariant: 'store' })} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Market uses a growing three-column grid; Store retains personalized marquees.
 */
export default function ProductRows({
  segment = 'store',
  onOpenProduct,
  onRowPageChange,
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
  const [openRow, setOpenRow] = useState(null)

  useEffect(() => {
    onRowPageChange?.(Boolean(openRow))
  }, [openRow, onRowPageChange])
  useEffect(() => () => onRowPageChange?.(false), [onRowPageChange])

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
    const extra = EXTRA_CHIPS.find((c) => c.id === chip)
    if (extra) {
      return filteredCatalog.filter((p) =>
        `${p.category || ''} ${p.title || ''} ${p.brandName || ''}`.toLowerCase().includes(extra.key),
      )
    }
    if (chip === 'under10') return filteredCatalog.filter((p) => parseListingPrice(p.price) < 10)
    return filterListingsByClothingType(filteredCatalog, chip)
  }, [filteredCatalog, chip])

  const marketRows = useMemo(() => {
    const out = []
    for (let i = 0; i < marketItems.length; i += MARKET_PRODUCTS_PER_ROW) {
      let products = marketItems.slice(i, i + MARKET_PRODUCTS_PER_ROW)
      // A short row (few matches) repeats its items so the crawl still fills the screen.
      while (products.length < 8) products = [...products, ...products]
      out.push({ id: `market-row-${i / MARKET_PRODUCTS_PER_ROW}`, name: 'Market', products })
    }
    return out
  }, [marketItems])

  if (segment === 'market') {
    return (
      <section className="product-feed market-product-feed" id="home-product-panel" role="tabpanel" aria-labelledby="home-market-tab" aria-busy={status === 'loading'}>
        {!marketItems.length && <p role="status">{status === 'loading' ? 'Loading products...' : 'No Market products found.'}</p>}
        <div className="market-chips" role="tablist" aria-label="Market filters">
          {ALL_CHIPS.map((c) => (
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
        <div className="market-rows">
          {marketRows.map((row, rowIndex) => (
            <CrawlRow
              key={row.id}
              row={row}
              rowIndex={rowIndex}
              market
              likedIds={savedIdSet}
              onToggleLike={toggleLike}
              onOpenProduct={onOpenProduct}
            />
          ))}
        </div>
      </section>
    )
  }

  if (openRow) {
    return <StoreRowPage row={openRow} onBack={() => setOpenRow(null)} onOpenProduct={onOpenProduct} />
  }

  if (status === 'loading' && !rows.length) {
    // Empty tiles stand in for the rows while listings load, so the page is never blank
    return (
      <section className="product-feed" id="home-product-panel" role="tabpanel" aria-labelledby={`home-${segment}-tab`} aria-busy="true">
        {PLACEHOLDER_ROWS.map((row, rowIndex) => (
          <CrawlRow key={row.id} row={row} rowIndex={rowIndex} />
        ))}
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
          onHoldRow={setOpenRow}
        />
      ))}
    </section>
  )
}
