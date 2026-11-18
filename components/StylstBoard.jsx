import { useEffect, useRef, useState } from 'react'
import { addClosetItem, fetchClosetItems } from '../closet.js'
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
export default function StylstBoard() {
  const [items, setItems] = useState(() => fetchClosetItems())
  const tracks = useRef({})
  const fileInputs = useRef({})

  useEffect(() => {
    // Start each row on its first piece, not the add tile.
    ROWS.forEach((row) => {
      centerSlide(tracks.current[row.id], 0, false)
      if (tracks.current[row.id]) updateDrum(tracks.current[row.id], () => {})
    })
  }, [items])

  function rowItems(row) {
    return items.filter((item) => row.categories.includes(item.category))
  }

  function shuffle() {
    ROWS.forEach((row) => {
      const list = rowItems(row)
      if (list.length) centerSlide(tracks.current[row.id], Math.floor(Math.random() * list.length))
    })
  }

  async function onPicked(row, file) {
    if (!file || !file.type?.startsWith('image/')) return
    try {
      const imageUrl = await compressImage(file)
      addClosetItem({ category: row.add, title: row.label, imageUrl })
      setItems(fetchClosetItems())
    } catch (error) {
      window.alert(error?.message || 'Could not add that piece')
    }
  }

  return (
    <div className="stylst" data-no-section-swipe>
      <button type="button" className="stylst-shuffle is-bare" aria-label="Pick an outfit for me" onClick={shuffle}>
        <RefreshIcon />
      </button>
      {ROWS.map((row) => {
        const list = rowItems(row)
        return (
          <div className="stylst-row" key={row.id} role="group" aria-label={row.label}>
            <div className="stylst-track" ref={(el) => { tracks.current[row.id] = el }}
              onScroll={(e) => updateDrum(e.currentTarget, () => navigator.vibrate?.(8))}>
              {list.map((item) => (
                <div className="stylst-piece" key={item.id}>
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt={item.title || row.label} draggable={false} />
                    : <span>{item.title || item.category}</span>}
                </div>
              ))}
              <button
                type="button"
                className="stylst-piece stylst-add is-bare"
                aria-label={`Add ${row.label.toLowerCase()}`}
                onClick={() => fileInputs.current[row.id]?.click()}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
            <input
              ref={(el) => { fileInputs.current[row.id] = el }}
              className="profile-photo-file"
              type="file"
              accept="image/*"
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                onPicked(row, file)
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
