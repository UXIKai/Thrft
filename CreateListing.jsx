import { useEffect, useMemo, useRef, useState } from 'react'
import { addClosetItem, removeImageBackground } from '../closet.js'
import {
  addCustomBrand,
  addCustomCategory,
  getCustomBrands,
  getCustomCategories,
} from '../customCatalog.js'
import { createListing } from '../listings.js'
import { isSupabaseConfigured } from '../supabase.js'
import {
  LISTING_BRANDS,
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_SEGMENTS,
} from '../listingCatalog.js'
import BrandGlobe from './BrandGlobe.jsx'
import './CreateListing.css'

function ClosetIcon() {
  return (
    <svg className="listing-seg-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M6 3.5h12A1.5 1.5 0 0 1 19.5 5v14a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5zm5.25 1.5v14h1.5v-14h-1.5zM7.2 10.2h2.2v1.5H7.2v-1.5zm7.4 0h2.2v1.5h-2.2v-1.5z"
      />
    </svg>
  )
}

function MarketIcon() {
  return (
    <svg className="listing-seg-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M4.2 8.2 5.4 4.8h13.2l1.2 3.4c.2.6-.2 1.2-.8 1.2h-.6c-.7 0-1.2.5-1.2 1.2V19a1 1 0 0 1-1 1H7.8a1 1 0 0 1-1-1v-8.4c0-.7-.5-1.2-1.2-1.2h-.6c-.6 0-1-.6-.8-1.2zM8.2 10.4V18h7.6v-7.6H8.2zm1.4 1.4h4.8v1.4H9.6v-1.4zm0 2.8h4.8V16H9.6v-1.4z"
      />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg className="listing-photo-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M9.2 5.2h5.6l1.2 1.6H19A1.8 1.8 0 0 1 20.8 8.6v9A1.8 1.8 0 0 1 19 19.4H5A1.8 1.8 0 0 1 3.2 17.6v-9A1.8 1.8 0 0 1 5 6.8h2.9L9.2 5.2zM12 9.4A3.6 3.6 0 1 0 12 16.6 3.6 3.6 0 0 0 12 9.4zm0 1.6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"
      />
    </svg>
  )
}

function ScannerIcon() {
  return (
    <svg className="listing-scanner-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M5 8V5.8A1.8 1.8 0 0 1 6.8 4H9M19 8V5.8A1.8 1.8 0 0 0 17.2 4H15M5 16v2.2A1.8 1.8 0 0 0 6.8 20H9M19 16v2.2A1.8 1.8 0 0 1 17.2 20H15M4.5 12h15"
      />
    </svg>
  )
}

function PostIcon() {
  return (
    <svg className="listing-action-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M11 4.5h2v6.5H19.5v2H13V19.5h-2V13H4.5v-2H11V4.5z"
      />
    </svg>
  )
}

function segmentIcon(icon) {
  if (icon === 'closet') return <ClosetIcon />
  return <MarketIcon />
}

function segmentLabel(id) {
  if (id === 'closet') return 'Closet'
  return 'Market'
}

export default function CreateListing({ onPosted } = {}) {
  const [segment, setSegment] = useState('market')
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState("Levi's")
  const [category, setCategory] = useState('Tees')
  const [price, setPrice] = useState('')
  const [condition, setCondition] = useState('Good')
  const [description, setDescription] = useState('')
  const [posted, setPosted] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [postedProduct, setPostedProduct] = useState(null)
  const [scanPreview, setScanPreview] = useState('')
  const [scanning, setScanning] = useState(false)
  const [customCategories, setCustomCategories] = useState(() =>
    getCustomCategories(),
  )
  const [customBrands, setCustomBrands] = useState(() => getCustomBrands())
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [addSheetKind, setAddSheetKind] = useState('type') // 'brand' | 'type'
  const [addDraft, setAddDraft] = useState('')
  const [picker, setPicker] = useState(null) // null | 'brand' | 'type'
  const [pickerPhase, setPickerPhase] = useState('closed')
  const [pickerQuery, setPickerQuery] = useState('')
  const scanInputRef = useRef(null)

  const isMarket = segment === 'market'
  const isCloset = segment === 'closet'

  useEffect(() => {
    setCustomCategories(getCustomCategories())
    setCustomBrands(getCustomBrands())
  }, [])

  useEffect(() => {
    setAddSheetOpen(false)
    setAddDraft('')
    setPicker(null)
    setPickerPhase('closed')
  }, [segment])

  // Hide nav while the add sheet or Brand/Type globe is open.
  useEffect(() => {
    const stage = document.querySelector('.stage')
    if (!stage) return undefined
    const hideNav = addSheetOpen || pickerPhase !== 'closed'
    stage.classList.toggle('is-create-adding', hideNav)
    return () => stage.classList.remove('is-create-adding')
  }, [addSheetOpen, pickerPhase])

  function openPicker(kind) {
    setAddSheetOpen(false)
    setPickerQuery('')
    setPicker(kind)
    setPickerPhase('enter')
    window.requestAnimationFrame(() => setPickerPhase('open'))
  }

  function closePicker() {
    setPickerPhase('exit')
  }

  function onPickerExitComplete() {
    setPicker(null)
    setPickerPhase('closed')
    setPickerQuery('')
  }

  function onPickerSelect(id) {
    if (picker === 'brand') setBrand(id)
    else if (picker === 'type') setCategory(id)
    closePicker()
  }

  function onPickerPlus() {
    const kind = picker === 'brand' ? 'brand' : 'type'
    // Instant switch: drop the globe and show the add page in one step
    // (no exit animation → blank → open delay).
    setPicker(null)
    setPickerPhase('closed')
    setPickerQuery('')
    openAddSheet(kind)
  }

  const brandItems = useMemo(() => {
    const seen = new Set()
    const list = []
    for (const name of [...LISTING_BRANDS, ...customBrands]) {
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      list.push({ id: name, label: name })
    }
    return list
  }, [customBrands])

  const categoryItems = useMemo(() => {
    const seen = new Set()
    const list = []
    for (const name of [...LISTING_CATEGORIES, ...customCategories]) {
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      list.push({ id: name, label: name })
    }
    return list
  }, [customCategories])

  const filteredPickerItems = useMemo(() => {
    const source = picker === 'brand' ? brandItems : categoryItems
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return source
    return source.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q),
    )
  }, [picker, brandItems, categoryItems, pickerQuery])

  function openAddSheet(kind = 'type') {
    setAddSheetKind(kind)
    setAddDraft('')
    setAddSheetOpen(true)
  }

  function closeAddSheet() {
    setAddSheetOpen(false)
    setAddDraft('')
  }

  function saveAddSheet() {
    const name = addDraft.trim()
    if (!name) return
    if (addSheetKind === 'brand') {
      const next = addCustomBrand(name)
      setCustomBrands(next)
      setBrand(name)
    } else {
      const next = addCustomCategory(name)
      setCustomCategories(next)
      setCategory(name)
    }
    closeAddSheet()
  }

  async function onScanFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setScanning(true)
    setPostError('')
    try {
      const cutout = await removeImageBackground(file)
      setScanPreview(cutout)
    } catch (err) {
      setPostError(String(err?.message || 'Could not scan clothing'))
    } finally {
      setScanning(false)
    }
  }

  async function submitListing() {
    if (posting) return
    setPostError('')

    if (isCloset) {
      if (!scanPreview) {
        setPostError('Scan a clothing item first.')
        return
      }
      setPosting(true)
      try {
        const item = addClosetItem({
          brand,
          category,
          title: title.trim() || `${brand} ${category}`.trim(),
          price: price.trim(),
          imageUrl: scanPreview,
          scanned: true,
          backgroundRemoved: true,
        })
        setPostedProduct({ ...item, segment: 'closet' })
        setPosted(true)
        setScanPreview('')
        setPrice('')
        onPosted?.(item)
      } catch (err) {
        setPostError(String(err?.message || 'Could not add to closet'))
      } finally {
        setPosting(false)
      }
      return
    }

    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setPostError('Add a title before posting.')
      return
    }
    if (!isSupabaseConfigured()) {
      setPostError('Connect Supabase (VITE_SUPABASE_URL + publishable key) to post.')
      return
    }
    setPosting(true)
    try {
      const product = await createListing({
        title: cleanTitle,
        brand,
        category,
        price: price.trim(),
        condition,
        description: description.trim(),
        imageUrl: 'placeholder',
      })
      setPostedProduct({ ...product, segment })
      setPosted(true)
      onPosted?.(product)
    } catch (err) {
      const msg = String(err?.message || 'Could not post listing')
      if (/relation .*listings.* does not exist|Could not find the table/i.test(msg)) {
        setPostError('Run docs/listings-schema.sql in the Supabase SQL Editor, then retry.')
      } else {
        setPostError(msg)
      }
    } finally {
      setPosting(false)
    }
  }

  return (
    <section
      className={`create-listing${addSheetOpen ? ' is-adding' : ''}`}
      aria-label="Create listing"
    >
      {addSheetOpen ? (
        <button
          type="button"
          className="listing-add-scrim"
          aria-label={
            addSheetKind === 'brand' ? 'Close add brand' : 'Close add type'
          }
          onClick={closeAddSheet}
        />
      ) : null}
      <div
        className="listing-segment"
        role="tablist"
        aria-label="Listing destination"
      >
        {LISTING_SEGMENTS.map((seg) => {
          const active = segment === seg.id
          return (
            <button
              key={seg.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={seg.label}
              title={seg.label}
              className={`listing-seg-btn ${active ? 'is-active' : ''}`}
              onClick={() => {
                setSegment(seg.id)
                setPosted(false)
                setPostError('')
              }}
            >
              {segmentIcon(seg.icon)}
            </button>
          )
        })}
      </div>

      {isMarket && (
        <button
          type="button"
          className="listing-photo-drop"
          aria-label="Add photos"
          title="Add photos"
        >
          <CameraIcon />
        </button>
      )}

      {isCloset && (
        <>
          <input
            ref={scanInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="listing-scan-input"
            aria-hidden
            tabIndex={-1}
            onChange={onScanFile}
          />
          <button
            type="button"
            className={`listing-scanner-btn${scanPreview ? ' has-preview' : ''}`}
            aria-label="Clothing scanner"
            title="Clothing scanner"
            disabled={scanning}
            onClick={() => scanInputRef.current?.click()}
          >
            {scanPreview ? (
              <img
                className="listing-scanner-preview"
                src={scanPreview}
                alt="Scanned clothing cutout"
              />
            ) : (
              <ScannerIcon />
            )}
          </button>
        </>
      )}

      <label className="listing-field listing-title-field">
        <span className={`listing-box${title ? ' is-filled' : ''}`}>
          <span className="listing-label">Title</span>
          <input
            className="listing-input is-inset"
            type="text"
            placeholder=" "
            aria-label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </span>
      </label>

      <div className={`listing-wheels-row${addSheetOpen ? ' is-adding' : ''}`}>
        {addSheetOpen ? (
          <div
            className="listing-add-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={addSheetKind === 'brand' ? 'Add brand' : 'Add type'}
          >
            <div className="listing-add-card is-field-open">
              {/* Locked to the kind that opened this page — no Brand/Type switch */}
              <div className="listing-add-kind" aria-hidden>
                {addSheetKind === 'brand' ? 'Brand' : 'Type'}
              </div>
              <label className="listing-field listing-add-field">
                <span className={`listing-box${addDraft ? ' is-filled' : ''}`}>
                  <span className="listing-label">
                    {addSheetKind === 'brand' ? 'Brand name' : 'Type name'}
                  </span>
                  <input
                    className="listing-input is-inset listing-add-input"
                    type="text"
                    value={addDraft}
                    placeholder=" "
                    maxLength={32}
                    autoFocus
                    aria-label={
                      addSheetKind === 'brand' ? 'Brand name' : 'Type name'
                    }
                    onChange={(e) => setAddDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveAddSheet()
                    }}
                  />
                </span>
              </label>
              <button
                type="button"
                className="listing-add-save"
                aria-label={
                  addSheetKind === 'brand' ? 'Add brand' : 'Add type'
                }
                onClick={saveAddSheet}
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <div
            className="listing-wheels"
            role="group"
            aria-label="Brand and type"
          >
            <div className="listing-wheel-col">
              <button
                type="button"
                className="listing-globe-trigger"
                aria-label={`Brand ${brand}. Open brand globe`}
                onClick={() => openPicker('brand')}
              >
                {brand}
              </button>
            </div>
            <div className="listing-wheel-col listing-wheel-col-type">
              <button
                type="button"
                className="listing-globe-trigger"
                aria-label={`Type ${category}. Open type globe`}
                onClick={() => openPicker('type')}
              >
                {category}
              </button>
            </div>
          </div>
        )}
      </div>

      {pickerPhase !== 'closed' && picker && (
        <BrandGlobe
          variant="dock"
          phase={
            pickerPhase === 'enter'
              ? 'enter'
              : pickerPhase === 'exit'
                ? 'exit'
                : 'open'
          }
          brands={filteredPickerItems}
          activeId={picker === 'brand' ? brand : category}
          title={picker === 'brand' ? 'Brands' : 'Category'}
          snug={picker === 'type'}
          searchValue={pickerQuery}
          onSearchChange={setPickerQuery}
          searchPlaceholder=""
          onSearchPlus={onPickerPlus}
          searchPlusLabel={
            picker === 'brand' ? 'Add brand' : 'Add type'
          }
          onSelect={onPickerSelect}
          onClose={closePicker}
          onExitComplete={onPickerExitComplete}
        />
      )}

      <label className="listing-field listing-price-field">
        <span className={`listing-box${price ? ' is-filled' : ''}`}>
          <span className="listing-label">Price</span>
          <input
            className="listing-input is-inset"
            type="text"
            inputMode="decimal"
            placeholder=" "
            aria-label="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </span>
      </label>

      {!isCloset && (
        <>
          <div className="listing-field">
            <div className="listing-conditions" role="group" aria-label="Condition">
              {LISTING_CONDITIONS.map((c) => {
                const active = condition === c
                return (
                  <button
                    key={c}
                    type="button"
                    className={`listing-condition ${active ? 'is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => setCondition(c)}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="listing-field">
            <span className={`listing-box${description ? ' is-filled' : ''}`}>
              <span className="listing-label">Description</span>
              <textarea
                className="listing-input listing-textarea is-inset"
                placeholder=" "
                aria-label="Description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </span>
          </label>
        </>
      )}

      <button
        type="button"
        className={`listing-post${isCloset ? ' is-closet' : ''}`}
        aria-label={isCloset ? 'Add to closet' : 'Post listing'}
        title={isCloset ? 'Add to closet' : 'Post listing'}
        disabled={posting || scanning}
        onClick={submitListing}
      >
        <PostIcon />
      </button>
      {postError ? (
        <p className="listing-posted-note" role="alert">
          {postError}
        </p>
      ) : null}
      {posted && postedProduct && (
        <p className="listing-posted-note" role="status">
          {isCloset
            ? `Added to Closet · ${postedProduct.title || ''}`
            : `Posted to your ${segmentLabel(postedProduct.segment)}${
                postedProduct.title ? ` · ${postedProduct.title}` : ''
              }`}
        </p>
      )}
    </section>
  )
}
