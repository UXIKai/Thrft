import { createPortal } from 'react-dom'
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
} from '../listings.js'
import { acquireMockupCutout, hasProductCutout, isBypassUrl } from '../mockupCutouts.js'
import ProductPhoto from './ProductPhoto.jsx'
import AtmosphereFlow from './AtmosphereFlow.jsx'

const MARKET_PRODUCTS_PER_ROW = 20

const MARKET_CHIPS = [
  { id: 'all', label: 'All' },
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
          <ProductPhoto src={photo} cutout={hasProductCutout(product)}
            alt="" loading="lazy" draggable="false" />
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
  const photo = product.photoUrl || product.image_url
  const label =
    [product?.brandName, product?.title, product?.price]
      .filter(Boolean)
      .join(' · ') || product?.code || 'Product'
  return (
    <button
      type="button"
      className={`product-box tone-${product.tone || '1'}${photo ? ' has-product-photo' : ''}`}
      aria-label={label}
      title={label}
      onClick={() => onOpen?.(product)}
    >
        <ProductPhoto className="product-box-photo" src={photo}
          cutout={hasProductCutout(product)}
          alt="" loading="lazy" draggable="false" />
      {product.brandLogoUrl && <img className="product-box-brand-logo" src={product.brandLogoUrl} alt="" draggable="false" />}
    </button>
  )
}

// Every row's crawl is timed from here, so a row that remounts (back to Home, scrolled back in) picks up where it would be.
const CRAWL_EPOCH = performance.now()

const HOLD_MS = 480
const HOLD_SLOP_PX = 10

function CrawlRow({ row, rowIndex, onOpenProduct, onHoldRow, market = false, likedIds, onToggleLike }) {
  const articleRef = useRef(null)
  const wrapRef = useRef(null)
  const seqRef = useRef(null)
  const holdRef = useRef({ timer: 0, x: 0, y: 0, fired: false })
  const [loopPx, setLoopPx] = useState(0)
  const [fits, setFits] = useState(false)
  const [visible, setVisible] = useState(rowIndex < 6)
  const products = row.products || []
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const crawlDelay = useMemo(() => `-${((performance.now() - CRAWL_EPOCH) / 1000).toFixed(3)}s`, [visible])

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
    if (!visible || !wrap || !seq || (!products.length && !row.empty)) return undefined

    const measure = () => {
      if (!seq.getBoundingClientRect().width) return
      const width = seq.getBoundingClientRect().width
      const gap = Number.parseFloat(getComputedStyle(seq.parentElement).columnGap || '0') || 0
      setFits(width < wrap.clientWidth)
      setLoopPx(market || row.empty ? width + gap : Math.abs(width - wrap.clientWidth))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    ro.observe(seq)
    return () => ro.disconnect()
  }, [products, visible, market, row.empty])

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
  const emptyTiles = () => Array.from({ length: PERSONALIZED_PRODUCTS_PER_ROW }, (_, i) =>
    <span className="product-box" key={i} aria-hidden="true" />)

  return (
    <article
      ref={articleRef}
      className={`brand-row${market ? ' is-market' : ''}${visible ? '' : ' is-idle'}`}
      aria-label={row.empty ? 'Empty Store display' : onHoldRow ? `${row.name} row. Hold to see all.` : row.name}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      onClickCapture={onClickCapture}
      onContextMenu={(e) => e.preventDefault()}
    >
      {visible && (
        <div ref={wrapRef} className={`brand-row-track-wrap${market ? '' : ' is-store-row'}`}>
          <div
            className={`brand-row-track ${loopPx > 0 ? market && fits ? '' : market || row.empty
              ? (goesRight ? 'crawl-right' : 'crawl-left')
              : fits ? (goesRight ? 'store-fits-left' : 'store-fits-right')
                : (goesRight ? 'store-crawl-right' : 'store-crawl-left') : ''}`}
            style={{
              '--loop': `${loop}px`,
              '--crawl-duration': `${durationSec}s`,
              animationDelay: crawlDelay,
              animationPlayState: 'running',
            }}
          >
            <div className="brand-row-seq" ref={seqRef}>
              {row.empty
                ? emptyTiles()
                : products.map((p, i) => renderCard(p, `${row.id}-${p.id}-${i}`))}
            </div>
            {((market && !fits) || row.empty) && <div className="brand-row-seq" aria-hidden>
              {row.empty ? emptyTiles() : products.map((p, i) => renderCard(p, `${row.id}-${p.id}-${i}-b`))}
            </div>}
          </div>
        </div>
      )}
    </article>
  )
}

/** Full page for one Store brand, with each live listing shown once. */
function StoreRowPage({ row, onBack, onOpenProduct, favoredBrands = [], onFavoredBrandsChange }) {
  const ref = useRef(null)
  const products = [...new Map((row.products || []).map((product) => [product.id, product])).values()]
  const brandId = row.brandId || products[0]?.brandId || ''
  const liked = Boolean(brandId) && favoredBrands.map(String).includes(String(brandId))
  const showCategory = row.category && !/^(from your|for you|liked brand)/i.test(row.category)
  function toggleBrandLike() {
    if (!brandId || !onFavoredBrandsChange) return
    const rest = favoredBrands.filter((id) => String(id) !== String(brandId))
    onFavoredBrandsChange(liked ? rest : [brandId, ...rest])
  }
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
          {products[0]?.brandLogoUrl && <img className="store-row-page-logo" src={products[0].brandLogoUrl} alt="" />}
          <h2>{row.name}</h2>
          {showCategory ? <p>{row.category}</p> : null}
        </div>
        {brandId ? (
          <button type="button" className={`store-row-page-heart is-bare${liked ? ' is-on' : ''}`} aria-pressed={liked} aria-label={liked ? 'Remove from favorite brands' : 'Add to favorite brands'} onClick={toggleBrandLike}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M12 20.5s-7.5-4.6-7.5-10A4.4 4.4 0 0 1 12 7.8a4.4 4.4 0 0 1 7.5 2.7c0 5.4-7.5 10-7.5 10Z" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
          </button>
        ) : <span className="store-row-page-spacer" aria-hidden />}
      </header>
      <div className="store-row-list">
        {Array.from({ length: Math.ceil(products.length / 5) }, (_, i) => products.slice(i * 5, i * 5 + 5)).map((chunk, i) => (
          <div key={i} className="store-row-strip">
            {chunk.map((p, index) => (
              <ProductCard key={`${row.id}-${p.id}-${index}`} product={p} onOpen={(item) => onOpenProduct?.({ ...item, detailVariant: 'store' })} />
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
// The first product load is covered by the logo over the chosen background
let splashClaimed = false
function LogoSplash() {
  const stage = document.querySelector('.stage')
  if (!stage) return null
  return createPortal(
    <div className="logo-splash" role="status" aria-label="Loading">
      <div className="atmosphere" aria-hidden="true"><AtmosphereFlow /></div>
      <h1 className="wordmark">Thrft<span className="dot" aria-hidden="true">●</span></h1>
    </div>,
    stage,
  )
}

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
  onFavoredBrandsChange,
  clothingSizes = {},
  brandSizes = {},
  savedProductIds = [],
}) {
  const [listings, setListings] = useState([])
  const [savedItems, setSavedItems] = useState([])
  const [savedError, setSavedError] = useState('')
  const savingSaved = useRef(false)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [chip, setChip] = useState('all')
  // Only the very first feed of an app launch gets the splash, never a segment switch or return to Home
  const [launchSplash] = useState(() => !splashClaimed)
  useEffect(() => {
    splashClaimed = true
  }, [])
  // Hold the splash until the first screenful of photos (and their cutouts) is ready, so everything appears together
  const [photosReady, setPhotosReady] = useState(!launchSplash)
  useEffect(() => {
    if (!launchSplash || status === 'loading') return undefined
    let alive = true
    const work = (Array.isArray(listings) ? listings : []).slice(0, 30).map((product) => {
      const src = product.photoUrl || product.image_url
      if (!src || src === 'placeholder') return Promise.resolve()
      if (hasProductCutout(product) && !isBypassUrl(src)) {
        const request = acquireMockupCutout(src)
        return request.promise.catch(() => {}).finally(() => request.release())
      }
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = resolve
        img.onerror = resolve
        img.src = src
      })
    })
    const limit = new Promise((resolve) => setTimeout(resolve, 5000))
    Promise.race([Promise.all(work), limit]).then(() => { if (alive) setPhotosReady(true) })
    return () => { alive = false }
  }, [status, launchSplash, listings])
  const splashOn = launchSplash && (status === 'loading' || !photosReady)
  const [chipsOpen, setChipsOpen] = useState(false)
  const [chipQuery, setChipQuery] = useState('')
  const [chipHoldDown, setChipHoldDown] = useState(false)
  const chipsRef = useRef(null)
  const chipsSlotRef = useRef(null)
  const [chipsSlotH, setChipsSlotH] = useState(null)
  const chipProxyRef = useRef(null)
  const chipHold = useRef({ timer: 0, x: 0, y: 0, fired: false })
  const chipDrag = useRef({ active: false, base: 0, id: 0 })
  const [chipsH, setChipsH] = useState(null)
  const [chipsDragging, setChipsDragging] = useState(false)
  const [openRow, setOpenRow] = useState(null)

  useEffect(() => {
    if (!chipsOpen) return undefined
    const away = (e) => { if (!chipsRef.current?.contains(e.target)) setChipsOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setChipsOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [chipsOpen])

  useEffect(() => {
    if (!chipHoldDown) return undefined
    const up = () => setChipHoldDown(false)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [chipHoldDown])

  // Keep the closed bar's footprint so the open panel floats over the page instead of pushing it
  useLayoutEffect(() => {
    setChipsSlotH(chipsOpen ? (h) => h : chipsSlotRef.current?.offsetHeight ?? null)
  }, [chipsOpen])

  useEffect(() => {
    if (!chipsOpen) {
      setChipQuery('')
      setChipsH(null)
    }
  }, [chipsOpen])

  function chipsPointerDown(e) {
    if (chipsOpen || (e.pointerType === 'mouse' && e.button !== 0)) return
    chipDrag.current = { active: false, base: e.currentTarget.offsetHeight, id: e.pointerId }
    const h = chipHold.current
    h.x = e.clientX
    h.y = e.clientY
    h.fired = false
    window.clearTimeout(h.timer)
    chipProxyRef.current?.focus({ preventScroll: true })
    h.timer = window.setTimeout(() => {
      h.fired = true
      setChipHoldDown(true)
      chipProxyRef.current?.setAttribute('inputmode', 'search')
      setChipsOpen(true)
    }, 420)
  }
  function chipsPointerMove(e) {
    const h = chipHold.current
    const d = chipDrag.current
    const dy = e.clientY - h.y
    if (!d.active && !chipsOpen && h.timer && e.pointerId === d.id && dy > 8 && dy > Math.abs(e.clientX - h.x)) {
      d.active = true
      window.clearTimeout(h.timer)
      h.timer = 0
      chipProxyRef.current?.blur()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setChipsDragging(true)
      setChipsOpen(true)
    }
    if (d.active) {
      const max = Math.min(window.innerHeight * 0.62, 520)
      d.h = Math.round(Math.max(d.base, Math.min(max, d.base + dy)))
      setChipsH(d.h)
      return
    }
    if (h.timer && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 8) {
      window.clearTimeout(h.timer)
      h.timer = 0
      chipProxyRef.current?.blur(); chipProxyRef.current?.setAttribute('inputmode', 'none')
    }
  }
  function chipsPointerEnd() {
    const d = chipDrag.current
    if (d.active) {
      d.active = false
      setChipsDragging(false)
      // Settle on a row edge so no label is ever cut in half
      const box = chipsRef.current
      const max = Math.min(window.innerHeight * 0.62, 520)
      const edges = [d.base]
      if (box) {
        const pad = parseFloat(getComputedStyle(box).paddingBottom) || 0
        box.querySelectorAll('.market-chips-search, .market-chip').forEach((el) => {
          const edge = Math.round(el.offsetTop + el.offsetHeight + pad)
          if (edge <= max + 1 && !edges.includes(edge)) edges.push(edge)
        })
      }
      const snapped = edges.reduce((a, b) => (Math.abs(b - d.h) < Math.abs(a - d.h) ? b : a))
      if (snapped === d.base) setChipsOpen(false)
      else setChipsH(snapped)
      return
    }
    window.clearTimeout(chipHold.current.timer)
    chipHold.current.timer = 0
    if (!chipHold.current.fired) chipProxyRef.current?.blur(); chipProxyRef.current?.setAttribute('inputmode', 'none')
  }

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
        setSavedError('')
      })
      .catch((error) => {
        if (alive) {
          setSavedItems([])
          setSavedError(`Could not load saved products: ${error.message || 'Please try again.'}`)
        }
      })
    return () => {
      alive = false
    }
  }, [forYouRefresh, feedRefresh])

  useEffect(() => {
    let alive = true
    setStatus('loading')
    setError('')
    setOpenRow(null)
    const request = segment === 'market'
      ? fetchAvailableListings({ limit: 240 })
      : fetchStoreProducts()
    request
      .then((rows) => {
        if (!alive) return
        setListings(rows)
        setStatus('ready')
      })
      .catch((err) => {
        if (!alive) return
        setListings([])
        setError(`Could not load products: ${err.message || 'Please try again.'}`)
        setStatus('error')
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

  const toggleLike = async (product) => {
    if (savingSaved.current) return
    const id = String(product.id)
    const next = savedIdSet.has(id)
      ? savedItems.filter((item) => String(item?.id) !== id)
      : [...savedItems, product]
    setSavedItems(next)
    savingSaved.current = true
    setSavedError('')
    try {
      const result = await saveSavedItems(next)
      setSavedItems(result.items)
    } catch (error) {
      setSavedItems(savedItems)
      setSavedError(error.message || 'Could not save this product')
    } finally {
      savingSaved.current = false
    }
  }

  const marketItems = useMemo(() => {
    if (chip === 'all') return filteredCatalog
    const extra = EXTRA_CHIPS.find((c) => c.id === chip)
    if (extra) {
      return filteredCatalog.filter((p) =>
        `${p.category || ''} ${p.title || ''} ${p.brandName || ''}`.toLowerCase().includes(extra.key),
      )
    }
    if (chip === 'under10') return filteredCatalog.filter((p) =>
      p.priceRaw != null && Number.isFinite(Number(p.priceRaw)) && Number(p.priceRaw) < 10)
    return filterListingsByClothingType(filteredCatalog, chip)
  }, [filteredCatalog, chip])

  const marketRows = useMemo(() => {
    const out = []
    for (let i = 0; i < marketItems.length; i += MARKET_PRODUCTS_PER_ROW) {
      const products = marketItems.slice(i, i + MARKET_PRODUCTS_PER_ROW)
      out.push({ id: `market-row-${i / MARKET_PRODUCTS_PER_ROW}`, name: 'Market', products })
    }
    return out
  }, [marketItems])

  if (segment === 'market') {
    return (
      <section className="product-feed market-product-feed" id="home-product-panel" role="tabpanel" aria-labelledby="home-market-tab" aria-busy={status === 'loading'}>
        {splashOn && <LogoSplash />}
        {error && <p role="alert">{error}</p>}
        {savedError && <p role="alert">{savedError}</p>}
        {!marketItems.length && status === 'ready' && <p role="status" className="feed-empty">No Market products found.</p>}
        <div ref={chipsSlotRef} className="market-chips-slot" style={chipsOpen && chipsSlotH ? { height: chipsSlotH } : undefined}>
        <div
          ref={chipsRef}
          className={`market-chips${chipsOpen ? ' is-open' : ''}${chipHoldDown ? ' is-holding' : ''}`}
          style={chipsH === null ? undefined : { maxHeight: chipsH, height: chipsH, animation: 'none', transition: chipsDragging ? 'none' : 'height 0.2s ease, max-height 0.2s ease' }}
          role="tablist"
          aria-label="Market filters"
          onPointerDown={chipsPointerDown}
          onPointerMove={chipsPointerMove}
          onPointerUp={chipsPointerEnd}
          onPointerCancel={chipsPointerEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
          <input ref={chipProxyRef} className="hold-focus-proxy" type="text" inputMode="none" aria-hidden="true" tabIndex={-1} readOnly={false} autoComplete="off" autoCorrect="off" />
          {chipsOpen && (
            <input
              className="market-chips-search"
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name="thrft_filter_search"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              autoFocus={chipsH === null}
              placeholder="Search"
              aria-label="Search filters"
              value={chipQuery}
              onChange={(e) => setChipQuery(e.target.value)}
            />
          )}
          {!chipsOpen && (
            <button
              type="button"
              className="market-chip market-chip-search"
              aria-label="Search filters"
              onClick={() => {
                if (chipHold.current.fired) { chipHold.current.fired = false; return }
                setChipsOpen(true)
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
            </button>
          )}
          {(chipsOpen && chipQuery.trim()
            ? ALL_CHIPS.filter((c) => c.label.toLowerCase().includes(chipQuery.trim().toLowerCase()))
            : ALL_CHIPS
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={chip === c.id}
              className={`market-chip${chip === c.id ? ' is-active' : ''}`}
              onClick={() => {
                if (chipHold.current.fired) {
                  chipHold.current.fired = false
                  return
                }
                setChip(c.id)
                setChipsOpen(false)
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
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
    return <StoreRowPage row={openRow} onBack={() => setOpenRow(null)} onOpenProduct={onOpenProduct} favoredBrands={favoredBrands} onFavoredBrandsChange={onFavoredBrandsChange} />
  }

  if (status === 'loading' && !rows.length) {
    return (
      <section className="product-feed" id="home-product-panel" role="tabpanel" aria-labelledby={`home-${segment}-tab`} aria-busy="true">
        {splashOn && <LogoSplash />}
      </section>
    )
  }

  return (
    <section className="product-feed" id="home-product-panel" role="tabpanel" aria-labelledby={`home-${segment}-tab`}>
      {splashOn && <LogoSplash />}
      {error && <p role="alert">{error}</p>}
      {savedError && <p role="alert">{savedError}</p>}
      {!rows.length && status === 'ready' && <p role="status" className="feed-empty">No Store products found.</p>}
      {rows.map((row, rowIndex) => (
        <CrawlRow
          key={row.id}
          row={row}
          rowIndex={rowIndex}
          onOpenProduct={onOpenProduct}
          onHoldRow={row.empty ? undefined : setOpenRow}
        />
      ))}
    </section>
  )
}
