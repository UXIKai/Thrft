import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addClosetItem, removeImageBackground, scaleCutout } from '../closet.js'
import {
  addCustomBrand,
  addCustomCategory,
  getCustomBrands,
  getCustomCategories,
} from '../customCatalog.js'
import { createListingProduct } from '../api.js'
import { isCreateStepFilled } from '../createWalkthrough.js'
import { createListing } from '../listings.js'
import { isSupabaseConfigured } from '../supabase.js'
import {
  LISTING_BRANDS,
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_SEGMENTS,
} from '../listingCatalog.js'
import BrandGlobe from './BrandGlobe.jsx'
import ClosetNumberLookup from './ClosetNumberLookup.jsx'
import { ClosetIcon, MarketIcon, StoreIcon } from './SegmentIcons.jsx'
import './CreateListing.css'

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

function GalleryChoiceIcon() {
  return (
    <svg className="listing-choice-ico" viewBox="0 0 24 24" aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10.5" r="1.3" fill="currentColor" />
      <path d="m6.5 16.5 3.6-3.6 2.6 2.4 3-3.2 2.3 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CameraChoiceIcon() {
  return (
    <svg className="listing-choice-ico" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 8.5A1.5 1.5 0 015.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
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
  if (icon === 'store') return <StoreIcon className="listing-seg-icon" />
  if (icon === 'closet') return <ClosetIcon className="listing-seg-icon" />
  return <MarketIcon className="listing-seg-icon" />
}

function segmentLabel(id) {
  if (id === 'store') return 'Store'
  if (id === 'closet') return 'Closet'
  return 'Market'
}

const NOW = new Date()
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1))
const YEARS = Array.from({ length: NOW.getFullYear() - 1950 + 1 }, (_, i) => 1950 + i)

const WHEEL_ROW = 34

function DateWheel({ label, items, value, onChange }) {
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef(null)
  const timer = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (el && Math.round(el.scrollTop / WHEEL_ROW) !== value) el.scrollTop = value * WHEEL_ROW
  }, [value])

  // One row per wheel notch (native scrolling jumps several rows)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      const cur = Math.round(el.scrollTop / WHEEL_ROW)
      const next = Math.min(items.length - 1, Math.max(0, cur + Math.sign(e.deltaY)))
      el.scrollTo({ top: next * WHEEL_ROW, behavior: 'smooth' })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [items.length])

  const commit = () => {
    const t = draft.trim().toLowerCase()
    setTyping(false)
    if (!t) return
    let idx = items.findIndex((it) => String(it).toLowerCase().startsWith(t))
    if (idx < 0 && /^\d+$/.test(t) && label === 'Month') idx = Number(t) - 1
    if (idx >= 0 && idx < items.length) {
      onChange(idx)
      ref.current?.scrollTo({ top: idx * WHEEL_ROW })
    }
  }

  const onScroll = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const i = Math.min(items.length - 1, Math.max(0, Math.round(ref.current.scrollTop / WHEEL_ROW)))
      if (i !== value) onChange(i)
    }, 80)
  }

  return (
    <div className="listing-wheel" ref={ref} role="listbox" aria-label={label} onScroll={onScroll}>
      {items.map((it, i) => (
        i === value && typing ? (
          <input
            key={it}
            className="listing-wheel-input"
            autoFocus
            value={draft}
            aria-label={label}
            onChange={(e) => {
              const v = e.target.value.toLowerCase()
              const ok =
                v === '' ||
                items.some((it) => String(it).toLowerCase().startsWith(v)) ||
                (label === 'Month' && /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 12)
              if (ok) setDraft(v)
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setDraft('')
                e.currentTarget.blur()
              }
            }}
          />
        ) : (
        <button
          key={it}
          type="button"
          role="option"
          aria-selected={i === value}
          className={`listing-wheel-item${i === value ? ' is-on' : ''}`}
          onClick={() => {
            if (i === value) {
              setDraft('')
              setTyping(true)
            } else {
              ref.current.scrollTo({ top: i * WHEEL_ROW, behavior: 'smooth' })
            }
          }}
        >
          {it}
        </button>
        )
      ))}
    </div>
  )
}

export default function CreateListing({ onPosted } = {}) {
  const [segment, setSegment] = useState('store')
  const [step, setStep] = useState('destination')
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState("Levi's")
  const [category, setCategory] = useState('Tees')
  const [price, setPrice] = useState('')
  const [condition, setCondition] = useState('Good')
  const [description, setDescription] = useState('')
  const [materials, setMaterials] = useState('')
  const [dateM, setDateM] = useState(NOW.getMonth() + 1)
  const [dateD, setDateD] = useState(NOW.getDate())
  const [dateY, setDateY] = useState(NOW.getFullYear())
  const daysInMonth = new Date(dateY, dateM, 0).getDate()
  useEffect(() => {
    setDateD((d) => Math.min(d, daysInMonth))
  }, [daysInMonth])
  const [posted, setPosted] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [postedProduct, setPostedProduct] = useState(null)
  const [scanPreview, setScanPreview] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanZoom, setScanZoom] = useState(1)
  const [scanAngle, setScanAngle] = useState(0)
  const [scanImage, setScanImage] = useState('')
  useEffect(() => {
    let active = true
    if (!scanPreview) {
      setScanImage('')
      return undefined
    }
    scaleCutout(scanPreview, scanZoom, scanAngle)
      .then((image) => { if (active) setScanImage(image) })
      .catch((err) => { if (active) setPostError(String(err?.message || 'Could not straighten photo')) })
    return () => { active = false }
  }, [scanPreview, scanZoom, scanAngle])
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
  const scanGalleryRef = useRef(null)
  const photoCameraRef = useRef(null)
  const photoGalleryRef = useRef(null)
  const [photoChoice, setPhotoChoice] = useState(false)
  const [marketPhotos, setMarketPhotos] = useState([])

  const isMarket = segment === 'market'
  const isStore = segment === 'store'
  const isCloset = segment === 'closet'
  const steps = [
    'photo', 'title', 'details', 'price',
    ...(isMarket ? ['condition'] : []),
    'description',
    ...(isCloset ? ['date'] : isStore ? ['materials'] : []),
  ]
  const currentStep = posted ? 'complete' : step
  const stepHeadingRef = useRef(null)
  const stepIndex = steps.indexOf(step)
  const lastStep = stepIndex === steps.length - 1
  const stepFilled = isCreateStepFilled(step, {
    isCloset, scanPreview, marketPhotos, title, brand, category, price,
    condition, description, materials, dateM, dateD, dateY,
  })
  const stepTitles = {
    destination: 'Where would you like to add this item?',
    photo: isCloset ? 'Scan your clothing' : 'Add photos',
    title: 'Title',
    details: 'Brand and Category',
    price: 'Price',
    condition: 'Condition',
    description: 'Description',
    date: 'Date',
    materials: 'Materials',
    complete: 'Complete',
  }

  useEffect(() => {
    stepHeadingRef.current?.focus({ preventScroll: true })
  }, [currentStep])

  function navigateStep(direction) {
    if (direction > 0 && !stepFilled) return
    setPostError('')
    setPhotoChoice(false)
    setStep(steps[stepIndex + direction] || 'destination')
  }
  const [numberLookupOpen, setNumberLookupOpen] = useState(false)
  const closeNumberLookup = useCallback(() => setNumberLookupOpen(false), [])

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
    const hideNav = addSheetOpen || pickerPhase !== 'closed' || numberLookupOpen
    stage.classList.toggle('is-create-adding', hideNav)
    return () => stage.classList.remove('is-create-adding')
  }, [addSheetOpen, pickerPhase, numberLookupOpen])

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

  function onMarketPhoto(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    setPhotoChoice(false)
    files.slice(0, 6).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => setMarketPhotos((prev) => [...prev, String(reader.result)].slice(0, 6))
      reader.readAsDataURL(file)
    })
  }

  async function onScanFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setPhotoChoice(false)
    if (!file) return
    setScanning(true)
    setScanPreview('')
    setScanImage('')
    setPostError('')
    try {
      const cutout = await removeImageBackground(file)
      setScanPreview(cutout)
      setScanZoom(1)
      setScanAngle(0)
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
        const sizedImage = await scaleCutout(scanPreview, scanZoom, scanAngle)
        const item = addClosetItem({
          brand,
          category,
          title: title.trim() || `${brand} ${category}`.trim(),
          price: price.trim(),
          description: description.trim(),
          date: `${dateY}-${String(dateM).padStart(2, '0')}-${String(dateD).padStart(2, '0')}`,
          imageUrl: sizedImage,
          scanned: true,
          backgroundRemoved: true,
        })
        setPostedProduct({ ...item, segment: 'closet' })
        setPosted(true)
        setScanPreview('')
        setPrice('')
        setDescription('')
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
    if (isStore) {
      setPosting(true)
      try {
        const product = await createListingProduct({
          materials: materials.trim(),
          title: cleanTitle,
          brand,
          category,
          price: price.trim(),
          condition: 'New',
          description: description.trim(),
          segment: 'store',
          photoUrl: marketPhotos[0] || '',
        })
        setPostedProduct({ ...product, segment: 'store' })
        setPosted(true)
        setMarketPhotos([])
        onPosted?.(product)
      } catch (err) {
        setPostError(String(err?.message || 'Could not post to Store'))
      } finally {
        setPosting(false)
      }
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
      className={`create-listing is-walkthrough${addSheetOpen ? ' is-adding' : ''}`}
      aria-label="Create listing"
    >
      <header className="listing-walkthrough-header">
        <h1 tabIndex={-1} ref={stepHeadingRef}>{stepTitles[currentStep]}</h1>
        {currentStep !== 'destination' && currentStep !== 'complete' && (
          <p>{segmentLabel(segment)} · {stepIndex + 1} of {steps.length}</p>
        )}
      </header>
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
      {currentStep === 'destination' && <div
        className="listing-segment"
        role="group"
        aria-label="Listing destination"
      >
        {LISTING_SEGMENTS.map((seg) => {
          const active = segment === seg.id
          return (
            <button
              key={seg.id}
              type="button"
              aria-label={seg.label}
              className={`listing-seg-btn ${active ? 'is-active' : ''}`}
              onClick={() => {
                setSegment(seg.id)
                setStep('photo')
                setPhotoChoice(false)
                setPosted(false)
                setPostError('')
              }}
            >
              {segmentIcon(seg.icon)}
              <span>{seg.label}</span>
            </button>
          )
        })}
      </div>}

      {currentStep === 'photo' && (isMarket || isStore) && (
        <div className="listing-photo-drop" role="group" aria-label="Add photos">
          <input ref={photoCameraRef} type="file" accept="image/*" capture="environment" className="listing-scan-input" aria-hidden tabIndex={-1} onChange={onMarketPhoto} />
          <input ref={photoGalleryRef} type="file" accept="image/*" multiple className="listing-scan-input" aria-hidden tabIndex={-1} onChange={onMarketPhoto} />
          {photoChoice ? (
            <div className="listing-photo-choice">
              <button type="button" className="listing-photo-choice-btn" aria-label="Take a photo" onClick={() => photoCameraRef.current?.click()}>
                <CameraChoiceIcon />
              </button>
              <button type="button" className="listing-photo-choice-btn" aria-label="Choose from gallery" onClick={() => photoGalleryRef.current?.click()}>
                <GalleryChoiceIcon />
              </button>
            </div>
          ) : (
            <button type="button" className="listing-photo-hit is-bare" aria-label="Add photos" title="Add photos" onClick={() => setPhotoChoice(true)}>
              {marketPhotos.length ? (
                <span className="listing-photo-thumbs">
                  {marketPhotos.map((src, i) => (
                    <img key={i} src={src} alt="" />
                  ))}
                </span>
              ) : (
                <CameraIcon />
              )}
            </button>
          )}
        </div>
      )}

      {currentStep === 'photo' && isCloset && (
        <>
          <input ref={scanInputRef} type="file" accept="image/*" capture="environment" className="listing-scan-input" aria-hidden tabIndex={-1} onChange={onScanFile} />
          <input ref={scanGalleryRef} type="file" accept="image/*" className="listing-scan-input" aria-hidden tabIndex={-1} onChange={onScanFile} />
          <div className={`listing-scanner-btn${scanPreview ? ' has-preview' : ''}`} role="group" aria-label="Clothing scanner">
            {photoChoice && !scanning ? (
              <div className="listing-photo-choice">
                <button type="button" className="listing-photo-choice-btn is-bare" aria-label="Take a photo" onClick={() => scanInputRef.current?.click()}>
                  <CameraChoiceIcon />
                </button>
                <button type="button" className="listing-photo-choice-btn is-bare" aria-label="Add by product number" onClick={() => setNumberLookupOpen(true)}>
                  <PostIcon />
                </button>
                <button type="button" className="listing-photo-choice-btn is-bare" aria-label="Choose from gallery" onClick={() => scanGalleryRef.current?.click()}>
                  <GalleryChoiceIcon />
                </button>
              </div>
            ) : (
              <button type="button" className="listing-photo-hit is-bare" aria-label="Clothing scanner" title="Clothing scanner" disabled={scanning} onClick={() => setPhotoChoice(true)}>
                {scanning ? <span role="status">Removing background...</span> : scanPreview ? (
                  <img className="listing-scanner-preview" src={scanImage || scanPreview} alt="Scanned clothing cutout" />
                ) : (
                  <ScannerIcon />
                )}
              </button>
            )}
          </div>
          {scanPreview ? (
            <>
            <label className="listing-field">
              <span>Zoom</span>
              <input
                className="listing-slider"
                type="range"
                min="0.4"
                max="1"
                step="0.05"
                aria-label="Zoom"
                value={scanZoom}
                onChange={(e) => setScanZoom(Number(e.target.value))}
              />
            </label>
            <label className="listing-field">
              <span>Straighten</span>
              <input
                className="listing-slider"
                type="range"
                min="-180"
                max="180"
                step="1"
                aria-label="Straighten clothing"
                value={scanAngle}
                onChange={(event) => setScanAngle(Number(event.target.value))}
              />
            </label>
            </>
          ) : null}
        </>
      )}

      {currentStep === 'title' && <label className="listing-field listing-title-field">
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
      </label>}

      {currentStep === 'details' && <div className={`listing-wheels-row${addSheetOpen ? ' is-adding' : ''}`}>
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
      </div>}

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

      {currentStep === 'price' && <label className="listing-field listing-price-field">
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
      </label>}

      {isCloset && (
        <>
      {currentStep === 'description' && <label className="listing-field">
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
      </label>}

      {currentStep === 'date' && <div className="listing-field listing-date-field">
        <div className="listing-date-wheels">
          <DateWheel label="Month" items={MONTHS} value={dateM - 1} onChange={(i) => setDateM(i + 1)} />
          <DateWheel label="Day" items={DAYS.slice(0, daysInMonth)} value={Math.min(dateD, daysInMonth) - 1} onChange={(i) => setDateD(i + 1)} />
          <DateWheel label="Year" items={YEARS} value={dateY - YEARS[0]} onChange={(i) => setDateY(YEARS[0] + i)} />
        </div>
      </div>}
        </>
      )}

      {!isCloset && (
        <>
          {currentStep === 'condition' && isMarket && <div className="listing-field">
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
          </div>}

          {currentStep === 'description' && <label className="listing-field">
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
          </label>}
          {currentStep === 'materials' && !isMarket && <label className="listing-field">
            <span className={`listing-box${materials ? ' is-filled' : ''}`}>
              <span className="listing-label">Materials</span>
              <textarea
                className="listing-input listing-textarea is-inset"
                placeholder=" "
                aria-label="Materials"
                rows={3}
                maxLength={2000}
                value={materials}
                onChange={(event) => setMaterials(event.target.value)}
              />
            </span>
          </label>}
        </>
      )}

      {currentStep !== 'destination' && currentStep !== 'complete' && (
      <nav className={`listing-walkthrough-actions${step === 'photo' ? ` is-photo${stepFilled ? ' is-ready' : ''}` : ''}`} aria-label="Create listing steps">
        {step === 'photo' && (
          <button type="button" className="is-bare listing-photo-close" aria-label="Close photo step" aria-hidden={stepFilled} tabIndex={stepFilled ? -1 : undefined} disabled={stepFilled || scanning} onClick={() => navigateStep(-1)}>
            <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        )}
        <button type="button" className="is-bare listing-walkthrough-back" aria-label="Previous step" aria-hidden={step === 'photo' && !stepFilled} tabIndex={step === 'photo' && !stepFilled ? -1 : undefined} disabled={posting || scanning || (step === 'photo' && !stepFilled)} onClick={() => navigateStep(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden><path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      {(stepFilled || step === 'photo') && <button
        type="button"
        className="is-bare listing-walkthrough-forward"
        aria-label={lastStep ? isCloset ? 'Add to closet' : `Post to ${segmentLabel(segment)}` : 'Next step'}
        aria-hidden={step === 'photo' && !stepFilled}
        tabIndex={step === 'photo' && !stepFilled ? -1 : undefined}
        disabled={posting || scanning || !stepFilled}
        onClick={lastStep ? submitListing : () => navigateStep(1)}
      >
        {posting ? <span role="status">Saving...</span> : <svg viewBox="0 0 24 24" aria-hidden>
          <path d={lastStep ? 'M5 12.5l4.5 4.5L19 7.5' : 'm9 6 6 6-6 6'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>}
      </button>}
      </nav>)}
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
      {posted && <button type="button" className="listing-walkthrough-restart" onClick={() => {
        setPosted(false)
        setStep('destination')
        setTitle('')
        setPrice('')
        setDescription('')
        setMaterials('')
        setMarketPhotos([])
        setScanPreview('')
        setPostError('')
      }}>Add another item</button>}
      {numberLookupOpen && <ClosetNumberLookup
        brands={[...new Set([...LISTING_BRANDS, ...customBrands])]}
        initialBrand={brand}
        onClose={closeNumberLookup}
        onAdded={(item) => {
          setNumberLookupOpen(false)
          setPhotoChoice(false)
          setPostedProduct({ ...item, segment: 'closet' })
          setPosted(true)
          onPosted?.(item)
        }}
      />}
    </section>
  )
}
