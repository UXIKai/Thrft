import { useEffect, useMemo, useState } from 'react'
import {
  addCustomCategory,
  getCustomCategories,
} from '../customCatalog.js'
import { CLOTHING_TYPES } from '../clothingTypes.js'
import { LISTING_CATEGORIES } from '../listingCatalog.js'
import OrbitCarousel from './OrbitCarousel.jsx'

function slugType(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Home clothing-type timer wheel — same scroll drum as Create Type. */
export default function ClothingTypeStrip({ activeId, onSelect, onOpen }) {
  const [customCategories, setCustomCategories] = useState(() =>
    getCustomCategories(),
  )
  const [addOpen, setAddOpen] = useState(false)
  const [fieldOpen, setFieldOpen] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setCustomCategories(getCustomCategories())
  }, [])

  const items = useMemo(() => {
    const base = CLOTHING_TYPES.map((type) => ({
      id: type.id,
      label: type.label,
    }))
    const seen = new Set(base.map((t) => t.label.toLowerCase()))
    for (const name of customCategories) {
      if (!name || seen.has(name.toLowerCase())) continue
      if (LISTING_CATEGORIES.some((c) => c.toLowerCase() === name.toLowerCase())) {
        continue
      }
      seen.add(name.toLowerCase())
      base.push({ id: slugType(name), label: name })
    }
    return base
  }, [customCategories])

  function closeSheet() {
    setAddOpen(false)
    setFieldOpen(false)
    setDraft('')
  }

  function save() {
    const name = draft.trim()
    if (!name) return
    const next = addCustomCategory(name)
    setCustomCategories(next)
    const id = slugType(name)
    onSelect?.(id)
    closeSheet()
  }

  function onSheetPlus() {
    if (!fieldOpen) {
      setFieldOpen(true)
      return
    }
    if (draft.trim()) save()
  }

  return (
    <div className="home-type-wheel">
      <button
        type="button"
        className="home-type-wheel-add"
        aria-label="Add category"
        title="Add category"
        onClick={() => {
          setDraft('')
          setFieldOpen(false)
          setAddOpen(true)
        }}
      >
        +
      </button>
      <OrbitCarousel
        variant="wheel"
        items={items}
        activeId={activeId}
        onSelect={onSelect}
        onActivate={onOpen}
        ariaLabel="Clothing types"
        prevLabel="Previous clothing type"
        nextLabel="Next clothing type"
      />
      {addOpen && (
        <div className="home-type-add-sheet" role="dialog" aria-modal="true">
          <button
            type="button"
            className="home-type-add-scrim"
            aria-label="Dismiss"
            onClick={closeSheet}
          />
          <div className={`home-type-add-card${fieldOpen ? ' is-field-open' : ''}`}>
            {fieldOpen && (
              <input
                className="home-type-add-input"
                type="text"
                value={draft}
                placeholder=""
                maxLength={32}
                autoFocus
                aria-label="Category name"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                }}
              />
            )}
            <button
              type="button"
              className={`home-type-add-save${fieldOpen ? ' is-open' : ''}`}
              aria-label={fieldOpen ? 'Add category to wheel' : 'Open category field'}
              onClick={onSheetPlus}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
