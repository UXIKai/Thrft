import { useEffect, useMemo, useRef, useState } from 'react'
import { addClosetItem, fetchClosetItems } from '../closet.js'
import { fetchStoreProducts } from '../api.js'
import ProductPhoto from './ProductPhoto.jsx'
import { compressImage } from '../profileMedia.js'
import './StylstBoard.css'

const ROWS = [
  { id: 'hat', label: 'Hat', add: 'Hats', categories: ['Hats'] },
  {
    id: 'top',
    label: 'Top',
    add: 'Tees',
    categories: ['Tees', 'Shirts', 'Polos', 'Tanks', 'Hoodies', 'Sweaters', 'Jackets', 'Coats', 'Blazers'],
  },
  { id: 'pants', label: 'Pants', add: 'Pants', categories: ['Pants', 'Jeans', 'Shorts', 'Skirts'] },
  { id: 'shoes', label: 'Shoes', add: 'Sneakers', categories: ['Shoes', 'Sneakers', 'Boots'] },
]

const CATALOGS_KEY = 'thrft-stylst-catalogs'
const catalogKey = (p) => String(p.creatorId || p.accountId || p.brandId || p.brandName || '')

function loadCatalogs() {
  try {
    const list = JSON.parse(localStorage.getItem(CATALOGS_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function RefreshIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v4.5h-4.5" />
    </svg>
  )
}

function centerSlide(track, index, smooth = true) {
  const slide = track?.children[index]
  if (!slide) return
  track.scrollTo({
    left: slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2,
    behavior: smooth ? 'smooth' : 'auto',
  })
}

const DRUM_STEP = 124 // piece width + gap
const DRUM_MAX_DEG = 62

// Curves pieces around a sideways drum: tilt, shrink and fade with distance from centre.
function updateDrum(track, tick) {
  const mid = track.scrollLeft + track.clientWidth / 2
  let nearest = -1
  let nearestDist = Infinity
  Array.from(track.children).forEach((el, i) => {
    const dist = el.offsetLeft + el.clientWidth / 2 - mid
    const t = Math.max(-1, Math.min(1, dist / (DRUM_STEP * 2.2)))
    el.style.transform = `perspective(500px) rotateY(${-t * DRUM_MAX_DEG}deg) scale(${1 - Math.abs(t) * 0.22})`
    el.style.opacity = String(1 - Math.abs(t) * 0.55)
    if (Math.abs(dist) < nearestDist) { nearestDist = Math.abs(dist); nearest = i }
  })
  if (nearest !== track.dataset.centered) {
    const first = track.dataset.centered === undefined
    track.dataset.centered = String(nearest)
    if (!first) tick()
  }
}

/** Outfit builder: swipe each row to try pieces together, or shuffle for a random outfit. */
export default function StylstBoard({ onOpenProduct }) {
  const [closet, setCloset] = useState(() => fetchClosetItems())
  const [store, setStore] = useState([])
  const tracks = useRef({})
  const fileInput = useRef(null)
  const [pending, setPending] = useState(null)
  const [menu, setMenu] = useState(null) // null | 'add' | 'catalogs'
  const [catalogs, setCatalogs] = useState(loadCatalogs)

  const root = useRef(null)
  useEffect(() => {
    const open = (e) => {
      if (!root.current || root.current.offsetParent === null) return
      e.detail.handled = true
      setMenu('add')
    }
    window.addEventListener('thrft:stylst-add', open)
    return () => window.removeEventListener('thrft:stylst-add', open)
  }, [])

  useEffect(() => {
    let active = true
    fetchStoreProducts().then((products) => { if (active) setStore(products) }).catch(() => {})
    return () => { active = false }
  }, [])

  // Closet pieces are already cutouts; store listings get their background removed on display.
  const items = useMemo(() => [
    ...closet.map((item) => ({ ...item, key: `c-${item.id}`, label: item.brand || '', cutout: false })),
    ...store.filter((p) => catalogs.includes(catalogKey(p))).map((p) => ({
      key: `s-${p.id}`,
      product: p,
      category: p.clothingType,
      title: p.title,
      label: p.brandName || '',
      imageUrl: p.mockupUrls?.[0] || p.photoUrl,
      cutout: true,
    })),
  ], [closet, store, catalogs])

  const brands = useMemo(() => {
    const map = new Map()
    store.forEach((p) => {
      const key = catalogKey(p)
      if (!key) return
      const entry = map.get(key) || { key, name: p.brandName || p.sellerName || 'Brand', count: 0 }
      entry.count += 1
      map.set(key, entry)
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [store])

  function toggleCatalog(key) {
    setCatalogs((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      try { localStorage.setItem(CATALOGS_KEY, JSON.stringify(next)) } catch { /* storage full */ }
      return next
    })
  }

  useEffect(() => {
    // Start each row on its first piece, not the add tile.
    ROWS.forEach((row) => {
      centerSlide(tracks.current[row.id], 0, false)
      if (tracks.current[row.id]) updateDrum(tracks.current[row.id], () => {})
    })
  }, [items])

  function rowItems(row) {
    const wanted = row.categories.map((c) => c.toLowerCase())
    return items.filter((item) => item.imageUrl && wanted.includes(String(item.category).toLowerCase()))
  }

  function shuffle() {
    ROWS.forEach((row) => {
      const list = rowItems(row)
      if (list.length) centerSlide(tracks.current[row.id], Math.floor(Math.random() * list.length))
    })
  }

  async function onPicked(file) {
    if (!file || !file.type?.startsWith('image/')) return
    try {
      setPending(await compressImage(file))
    } catch (error) {
      window.alert(error?.message || 'Could not add that piece')
    }
  }

  function savePending(row) {
    addClosetItem({ category: row.add, title: row.label, imageUrl: pending })
    setCloset(fetchClosetItems())
    setPending(null)
  }

  return (
    <div className="stylst" ref={root} data-no-section-swipe>
      <div className="stylst-bar">
        <button type="button" className="stylst-shuffle is-bare" aria-label="Add a clothing item or brand catalog" onClick={() => setMenu((m) => (m ? null : 'add'))}>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button type="button" className="stylst-shuffle is-bare" aria-label="Pick an outfit for me" onClick={shuffle}>
          <RefreshIcon />
        </button>
        <input
          ref={fileInput}
          className="profile-photo-file"
          type="file"
          accept="image/*"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            onPicked(file)
          }}
        />
      </div>
      {menu === 'add' && (
        <div className="stylst-pick" role="group" aria-label="Add to Stylst">
          <button type="button" className="stylst-pick-btn is-bare" onClick={() => { setMenu(null); fileInput.current?.click() }}>Add photo</button>
          <button type="button" className="stylst-pick-btn is-bare" onClick={() => setMenu('catalogs')}>Add brand catalog</button>
          <button type="button" className="stylst-pick-btn is-bare" onClick={() => setMenu(null)}>Cancel</button>
        </div>
      )}
      {menu === 'catalogs' && (
        <div className="stylst-pick" role="group" aria-label="Brand catalogs">
          {brands.length === 0 && <span className="stylst-pick-empty">No brand catalogs yet</span>}
          {brands.map((b) => (
            <button
              key={b.key}
              type="button"
              className={`stylst-pick-btn is-bare${catalogs.includes(b.key) ? ' is-on' : ''}`}
              aria-pressed={catalogs.includes(b.key)}
              onClick={() => toggleCatalog(b.key)}
            >
              {catalogs.includes(b.key) ? '✓ ' : ''}{b.name} · {b.count}
            </button>
          ))}
          <button type="button" className="stylst-pick-btn is-bare" onClick={() => setMenu(null)}>Done</button>
        </div>
      )}
      {pending && (
        <div className="stylst-pick" role="group" aria-label="What is this piece?">
          <img src={pending} alt="" />
          {ROWS.map((row) => (
            <button key={row.id} type="button" className="stylst-pick-btn is-bare" onClick={() => savePending(row)}>{row.label}</button>
          ))}
          <button type="button" className="stylst-pick-btn is-bare" onClick={() => setPending(null)}>Cancel</button>
        </div>
      )}
      {ROWS.map((row) => {
        const list = rowItems(row)
        return (
          <div className="stylst-row" key={row.id} role="group" aria-label={row.label}>
            <div className="stylst-track" ref={(el) => { tracks.current[row.id] = el }}
              onScroll={(e) => updateDrum(e.currentTarget, () => navigator.vibrate?.(8))}>
              {list.map((item) => (
                <button
                  type="button"
                  className="stylst-piece is-bare"
                  key={item.key}
                  aria-label={item.title || row.label}
                  onClick={() => item.product && onOpenProduct?.({ ...item.product, detailVariant: 'store' })}
                >
                  <ProductPhoto src={item.imageUrl} cutout={item.cutout} alt={item.title || row.label} draggable={false} />
                  {item.label ? <span className="stylst-brand">{item.label}</span> : null}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
