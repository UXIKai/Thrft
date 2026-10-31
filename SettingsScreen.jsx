import { useEffect, useMemo, useRef, useState } from 'react'
import {
  applyAppColor,
  applyBackgroundImage,
  applyBarTransparency,
  applyBgColor,
  applyCustomBgColor,
  applyCustomColor,
  getPaletteColors,
  getPaletteHexes,
  readAppColor,
  readBgColor,
  readCustomBgColorHex,
  readCustomColorHex,
  readBarTransparency,
  readPalette,
  resetPalette,
  setPaletteSlot,
} from '../appAppearance.js'
import {
  initialsFromName,
  fetchIdmeConfig,
  startIdmeAuthorize,
} from '../api.js'
import { LISTING_BRANDS } from '../listingCatalog.js'
import {
  SIZE_GARMENTS,
  SIZE_BRANDS,
  sizesForCategory,
  garmentsForBrand,
  sizesForBrandGarment,
  brandById,
  brandDisplayName,
} from '../sizeOptions.js'
import './SettingsScreen.css'
import './GlassOverlay.css'

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function hexToHsv(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return { h: 210, s: 0.28, v: 0.48 }
  const n = Number.parseInt(m[1], 16)
  let r = ((n >> 16) & 255) / 255
  let g = ((n >> 8) & 255) / 255
  let b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

function hsvToHex(h, s, v) {
  const hh = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (hh < 60) [r, g, b] = [c, x, 0]
  else if (hh < 120) [r, g, b] = [x, c, 0]
  else if (hh < 180) [r, g, b] = [0, c, x]
  else if (hh < 240) [r, g, b] = [0, x, c]
  else if (hh < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to = (n) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function BackIcon() {
  return (
    <svg className="settings-back-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 5.5 8.5 12 15 18.5"
      />
    </svg>
  )
}

/** Open doorway — same mark used previously on Profile. */
function DoorIcon() {
  return (
    <svg className="settings-signout-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M3.8 20.5V4.2A1.2 1.2 0 0 1 5 3h7.5v17.5M3.8 20.5H20"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M12.5 3 20.2 5.4v12.8L12.5 20.5"
      />
      <circle cx="17.4" cy="12.2" r="0.95" fill="currentColor" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg className="settings-chevron" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 6.5 15.5 12 9 17.5"
      />
    </svg>
  )
}

function SlidersIcon() {
  return (
    <svg className="settings-row-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6"
      />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg className="settings-row-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"
      />
      <circle cx="12" cy="11" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function BagIcon() {
  return (
    <svg className="settings-row-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M6.2 8.4h11.6l.9 11.2H5.3L6.2 8.4z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M9 8.4V7a3 3 0 0 1 6 0v1.4"
      />
    </svg>
  )
}

function AtIcon() {
  return (
    <span className="settings-at-glyph" aria-hidden>
      @
    </span>
  )
}

function BoxIcon() {
  return (
    <svg className="settings-row-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M4 8.5 12 4l8 4.5v9L12 22l-8-4.5v-9zM4 8.5l8 4.5 8-4.5M12 13v9"
      />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="settings-row-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M12 3.5 5.5 6.2v5.2c0 4.2 2.8 7.4 6.5 8.8 3.7-1.4 6.5-4.6 6.5-8.8V6.2L12 3.5z"
      />
    </svg>
  )
}


function HeartIcon() {
  return (
    <svg className="settings-heart-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M12 19.2s-6.2-3.8-6.2-8A3.6 3.6 0 0 1 12 8.2 3.6 3.6 0 0 1 18.2 11.2c0 4.2-6.2 8-6.2 8z"
      />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg className="settings-row-ico" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path fill="currentColor" d="M10.2 8.8v6.4L15.6 12z" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg className="settings-row-ico" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M9.6 9.4a2.4 2.4 0 1 1 3.5 2.1c-.7.4-1.1 1-.1 1.7"
      />
      <circle cx="12" cy="16.2" r="0.9" fill="currentColor" />
    </svg>
  )
}

/** Single person — assistant header mark */
function PersonIcon() {
  return (
    <svg className="settings-assistant-person" viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="12"
        cy="8.2"
        r="3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M5.2 19.2c.7-3.4 3.2-5.2 6.8-5.2s6.1 1.8 6.8 5.2"
      />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg className="settings-row-ico" viewBox="0 0 24 24" aria-hidden>
      <rect
        x="3.8"
        y="6.2"
        width="16.4"
        height="11.6"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="m4.4 7.2 7.6 5.4 7.6-5.4"
      />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg className="settings-choose-ico" viewBox="0 0 24 24" aria-hidden>
      <rect
        x="3.5"
        y="5"
        width="17"
        height="14"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="m5.5 17 4.2-4.2 2.8 2.8 2.4-2.4L18.5 17"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="settings-check-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6.5 12.2 3.4 3.3 7.6-7.5"
      />
    </svg>
  )
}

function Section({ label, children }) {
  return (
    <section className="settings-section" aria-label={label}>
      <div className="settings-card">{children}</div>
    </section>
  )
}

function Row({
  icon,
  title,
  subtitle,
  meta,
  badge,
  onClick,
  trailing,
}) {
  return (
    <button type="button" className="settings-row" onClick={onClick}>
      {icon && <span className="settings-row-leading">{icon}</span>}
      <span className="settings-row-copy">
        <span className="settings-row-title">{title}</span>
        {subtitle && <span className="settings-row-sub">{subtitle}</span>}
      </span>
      {meta && <span className="settings-row-meta">{meta}</span>}
      {badge}
      {trailing}
      <Chevron />
    </button>
  )
}


const HELP_PAGES = {
  started: {
    title: 'Getting Started',
    groups: [
      {
        label: 'Bottom bar',
        sections: [
          {
            heading: 'Home',
            body: 'Scroll the type wheel to filter. Brand rows show listings. For You suggests pieces from your sizes and favorite brands.',
          },
          {
            heading: 'Chat',
            body: 'Message buyers and sellers. Pin chats, start a group, rename a contact, or delete and block a thread.',
          },
          {
            heading: 'Create',
            body: 'Tap + then pick Market or Closet at the top.',
          },
          {
            heading: 'Market',
            body: 'Sell clothes you own. Add photos with the camera, set Brand and Type on the wheels, then price and post.',
          },
          {
            heading: 'Closet',
            body: 'Scan a piece: photo in, background removed. Set Brand and Type, then save it. No title or description here—browse and Post to Market later from Profile.',
          },
          {
            heading: 'Favorites',
            body: 'Search a brand, select it, then + to save. Saved brands feed For You on Home. Liked products stay on this tab too.',
          },
          {
            heading: 'Profile',
            body: 'Photo, name, shipping, and social Links (TikTok, X, Instagram, Snapchat, RedNote). The book opens Store (Active/Sold listings) and Closet. Closet browse uses Brand and Type wheels; open a piece to Post to Market.',
          },
          {
            heading: 'Money',
            body: 'On Profile, open the bank icon for Bank, Points, Wallet, and Sales.',
          },
          {
            heading: 'Bag',
            body: 'Cart icon on Home. Review items and check out with Stripe.',
          },
        ],
      },
      {
        label: 'Account',
        sections: [
          {
            heading: 'Settings',
            body: 'Gear on Profile. App color and glass clarity, clothing sizes (including per-brand sizes), shop email, and shipping address.',
          },
          {
            heading: 'ID.me',
            body: 'Optional identity check for selling or payouts. Thrft only stores that you finished—not your ID photos.',
          },
          {
            heading: 'Give back',
            body: 'Optional Dlaita Group Initiative: a monthly dollar amount or a percent of earnings.',
          },
          {
            heading: 'Points',
            body: 'Fifty cents equals one point. Donate points or move them to Wallet, then withdraw to a linked bank.',
          },
          {
            heading: 'Sign in',
            body: 'Email and password, or Apple or Google. Sign out from the bottom of Settings.',
          },
        ],
      },
    ],
  },
  help: {
    title: 'Help',
  },
  support: {
    title: 'Support',
    body: 'Live support is not available yet. Use Getting Started for how each screen works.',
  },
}

/** Local FAQ knowledge for the Help assistant (keyword match). */
const ASSISTANT_FAQ = [
  {
    keys: ['home', 'browse', 'for you', 'type wheel', 'brand row'],
    answer:
      'Home scrolls the type wheel to filter. Brand rows show listings, and For You suggests pieces from your sizes and favorite brands.',
  },
  {
    keys: ['chat', 'message', 'dm', 'group'],
    answer:
      'Chat is for messaging buyers and sellers. You can pin chats, start a group, rename a contact, or delete and block a thread.',
  },
  {
    keys: ['create', 'list', 'post', 'sell', 'market'],
    answer:
      'On Create, pick Market or Closet. Market is for clothes you own—add photos, set Brand and Type, then price and post.',
  },
  {
    keys: ['closet', 'scan'],
    answer:
      'Closet scans a piece with the background removed. Set Brand and Type, save it, then Post to Market later from Profile.',
  },
  {
    keys: ['favorite', 'favourites', 'liked', 'brands'],
    answer:
      'Favorites: search a brand, select it, then + to save. Saved brands feed For You on Home. Liked products stay on that tab too.',
  },
  {
    keys: ['profile', 'store', 'active', 'sold', 'book'],
    answer:
      'Profile holds your photo, shipping, and Links. The book opens Store (Active / Sold listings) and Closet.',
  },
  {
    keys: ['settings', 'gear', 'color', 'size', 'shipping'],
    answer:
      'Open the gear on Profile for Settings—app color, glass clarity, clothing sizes, shop email, shipping, and Store API.',
  },
  {
    keys: ['sign out', 'logout', 'log out'],
    answer:
      'Sign out is the open-door button at the bottom of Settings.',
  },
  {
    keys: ['id.me', 'idme', 'verify', 'identity'],
    answer:
      'ID.me is an optional identity check for selling or payouts. Thrft only stores that you finished—not your ID photos.',
  },
  {
    keys: ['money', 'wallet', 'points', 'bank', 'sales'],
    answer:
      'On Profile, open the bank icon for Bank, Points, Wallet, and Sales. Fifty cents equals one point.',
  },
  {
    keys: ['bag', 'cart', 'checkout', 'stripe'],
    answer: 'The cart icon on Home opens your bag. Review items and check out with Stripe.',
  },
  {
    keys: ['give', 'donate', 'dlaita', 'pledge'],
    answer:
      'In Settings under Give Back you can pledge a monthly dollar amount or a percent of earnings to the Dlaita Group Initiative.',
  },
]

const ASSISTANT_GREETING =
  'Hi — I’m your Thrft helper. Ask about Home, Chat, Create, Favorites, Profile, Settings, or checkout.'

const ASSISTANT_FALLBACK =
  'I’m not sure on that yet. Try asking about Home, Create, Closet, Favorites, Store, Settings, or Sign out — or open Getting Started for the full walkthrough.'

function answerAssistant(question) {
  const q = String(question || '').toLowerCase().trim()
  if (!q) return ASSISTANT_FALLBACK
  let best = null
  let bestScore = 0
  for (const entry of ASSISTANT_FAQ) {
    let score = 0
    for (const key of entry.keys) {
      if (q.includes(key)) score += key.length
    }
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }
  return best ? best.answer : ASSISTANT_FALLBACK
}

const SHEET_COPY = {
  size: { title: '', fields: [] },
  shipping: { title: '', fields: [{ key: 'address', label: 'Address' }] },
  shop: { title: '', fields: [{ key: 'shop', label: 'Shop email' }] },
  sync: { title: '', fields: [{ key: 'sync', label: 'Catalog' }] },
  storeApi: {
    title: 'Store API',
    fields: [{ key: 'storeApiKey', label: 'API key' }],
  },
  displayName: { title: 'Name', fields: [{ key: 'name', label: 'Name' }] },
  password: { title: 'Password', fields: [{ key: 'password', label: 'New password' }] },
}

function CloseIcon() {
  return (
    <svg className="settings-back-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M6.4 5.2 12 10.8l5.6-5.6 1.2 1.2L13.2 12l5.6 5.6-1.2 1.2L12 13.2l-5.6 5.6-1.2-1.2L10.8 12 5.2 6.4l1.2-1.2z"
      />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg className="settings-pencil-ico" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M4.5 16.8 15.2 6.1a1.5 1.5 0 0 1 2.1 0l1.6 1.6a1.5 1.5 0 0 1 0 2.1L8.2 20.5H4.5v-3.7z"
      />
    </svg>
  )
}

/**
 * Settings — continuous scroll; row popups + Help pages; color wheel.
 */
export default function SettingsScreen({
  onBack,
  userProfile,
  onSaveProfile,
  onSignOut,
}) {
  const [appColor, setAppColor] = useState(() => readAppColor())
  const [customHex, setCustomHex] = useState(() => readCustomColorHex())
  const [bgColor, setBgColor] = useState(() => readBgColor())
  const [customBgHex, setCustomBgHex] = useState(() => readCustomBgColorHex())
  const [paletteColors, setPaletteColors] = useState(() => {
    readPalette()
    return getPaletteColors()
  })
  const [paletteEditorOpen, setPaletteEditorOpen] = useState(false)
  const [barTransparency, setBarTransparency] = useState(() =>
    readBarTransparency(),
  )
  const [pledgeMode, setPledgeMode] = useState('flat')
  const [pledgeAmount, setPledgeAmount] = useState('')
  const [pledgePercent, setPledgePercent] = useState('')
  const [pledged, setPledged] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [sheetDraft, setSheetDraft] = useState({})
  const [helpPage, setHelpPage] = useState(null)
  const [assistantDraft, setAssistantDraft] = useState('')
  const [assistantMessages, setAssistantMessages] = useState(() => [
    { id: 'greet', role: 'assistant', text: ASSISTANT_GREETING },
  ])
  const assistantListRef = useRef(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveNote, setSaveNote] = useState('')
  const [wheelOpen, setWheelOpen] = useState(false)
  /** 'app' | 'bg' | 'palette' — palette edits a slot via wheel */
  const [wheelTarget, setWheelTarget] = useState('app')
  const wheelTargetRef = useRef('app')
  const paletteSlotRef = useRef(0)
  const [wheelHsv, setWheelHsv] = useState(() => hexToHsv(readCustomColorHex()))
  const wheelPadRef = useRef(null)
  const draggingWheel = useRef(false)
  const [idmeOpen, setIdmeOpen] = useState(false)
  const [idmeStep, setIdmeStep] = useState('intro') // intro | connecting | done | error
  const [idmeCfg, setIdmeCfg] = useState(null)
  const [idmeError, setIdmeError] = useState('')
  const [idBusy, setIdBusy] = useState(false)
  /** null = garment + brand list; brand id = brand-specific size drill-down */
  const [sizeBrandFocus, setSizeBrandFocus] = useState(null)
  const sizeCatsRef = useRef(null)
  const sizeSheetCardRef = useRef(null)

  const displayName = userProfile?.displayName || 'Member'
  const email = userProfile?.email || ''
  const identityStatus = userProfile?.identityStatus || 'unverified'
  const identityRef = userProfile?.identityRef || ''
  const wheelHex = hsvToHex(wheelHsv.h, wheelHsv.s, wheelHsv.v)

  useEffect(() => {
    if (!idmeOpen) return undefined
    let alive = true
    fetchIdmeConfig().then((cfg) => {
      if (alive) setIdmeCfg(cfg)
    })
    return () => {
      alive = false
    }
  }, [idmeOpen])

  async function beginIdmeOAuth() {
    setIdBusy(true)
    setIdmeError('')
    setIdmeStep('connecting')
    try {
      const auth = await startIdmeAuthorize()
      if (auth?.url) {
        window.location.assign(auth.url)
        return
      }
      throw new Error('No authorize URL returned')
    } catch (err) {
      setIdmeError(
        err?.message ||
          'ID.me is not configured. Add IDME_CLIENT_ID and IDME_CLIENT_SECRET to the API environment.',
      )
      setIdmeStep('error')
    } finally {
      setIdBusy(false)
    }
  }

  const percentLabel = pledgePercent === '' ? null : `${pledgePercent}%`
  const amountLabel = pledgeAmount === '' ? null : `$${pledgeAmount}`

  const pledgeCta = useMemo(() => {
    if (pledgeMode === 'flat') {
      if (!amountLabel) return pledged ? 'PLEDGED / MONTH' : 'PLEDGE / MONTH'
      return pledged ? `PLEDGED ${amountLabel} / MONTH` : `PLEDGE ${amountLabel} / MONTH`
    }
    if (!percentLabel) return pledged ? 'PLEDGED OF EARNINGS' : 'PLEDGE OF EARNINGS'
    return pledged ? `PLEDGED ${percentLabel} OF EARNINGS` : `PLEDGE ${percentLabel} OF EARNINGS`
  }, [pledgeMode, pledged, percentLabel, amountLabel])

  const canPledge =
    pledgeMode === 'flat'
      ? pledgeAmount !== '' && Number(pledgeAmount) > 0
      : pledgePercent !== '' && Number(pledgePercent) > 0

  function onPledgePercentChange(raw) {
    setPledgePercent(raw.replace(/\D/g, '').slice(0, 3))
    setPledged(false)
  }

  function onPledgeAmountChange(raw) {
    setPledgeAmount(raw.replace(/\D/g, '').slice(0, 4))
    setPledged(false)
  }

  useEffect(() => {
    if (helpPage !== 'help') return undefined
    const el = assistantListRef.current
    if (!el) return undefined
    el.scrollTop = el.scrollHeight
    return undefined
  }, [helpPage, assistantMessages])

  // Sizes → favorite brand: start at the top (don't keep the list's bottom scroll).
  useEffect(() => {
    if (sheet !== 'size') return undefined
    const reset = () => {
      if (sizeCatsRef.current) sizeCatsRef.current.scrollTop = 0
      if (sizeSheetCardRef.current) sizeSheetCardRef.current.scrollTop = 0
    }
    reset()
    const id = window.requestAnimationFrame(reset)
    return () => window.cancelAnimationFrame(id)
  }, [sheet, sizeBrandFocus])

  function openHelpAssistant() {
    setAssistantDraft('')
    setAssistantMessages([
      { id: 'greet', role: 'assistant', text: ASSISTANT_GREETING },
    ])
    setHelpPage('help')
  }

  function sendAssistant() {
    const text = assistantDraft.trim()
    if (!text) return
    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    }
    const reply = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: answerAssistant(text),
    }
    setAssistantMessages((prev) => [...prev, userMsg, reply])
    setAssistantDraft('')
  }

  function openSheet(id) {
    const conf = SHEET_COPY[id]
    if (!conf) return
    const draft = {}
    if (id === 'size') {
      draft.clothingSizes = { ...(userProfile?.clothingSizes || {}) }
      draft.favoredBrands = [...(userProfile?.favoredBrands || [])]
      draft.brandSizes = JSON.parse(
        JSON.stringify(userProfile?.brandSizes || {}),
      )
      setSizeBrandFocus(null)
    } else {
      conf.fields.forEach((f) => {
        if (id === 'displayName' && f.key === 'name') draft[f.key] = displayName
        else if (id === 'shop' && f.key === 'shop') draft[f.key] = email
        else if (id === 'shipping' && f.key === 'address') {
          draft[f.key] = userProfile?.shippingAddress || ''
        } else if (id === 'storeApi' && f.key === 'storeApiKey') {
          draft[f.key] = userProfile?.storeApiKey || ''
        } else draft[f.key] = ''
      })
    }
    setSaveNote('')
    setSheetDraft(draft)
    setSheet(id)
  }

  function setCategorySize(categoryId, size) {
    setSheetDraft((d) => {
      const cur = d.clothingSizes?.[categoryId]
      const next = { ...(d.clothingSizes || {}) }
      if (cur === size) delete next[categoryId]
      else next[categoryId] = size
      return { ...d, clothingSizes: next }
    })
  }

  const likedSizeBrands = useMemo(() => {
    const ids = sheetDraft.favoredBrands || userProfile?.favoredBrands || []
    const nameById = new Map()
    for (const b of SIZE_BRANDS) nameById.set(b.id, b.name)
    for (const name of LISTING_BRANDS) {
      if (name === 'Other') continue
      const slug =
        String(name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '')
          .slice(0, 40) || 'brand'
      const known = SIZE_BRANDS.find(
        (b) =>
          b.name.toLowerCase() === name.toLowerCase() ||
          b.id === slug ||
          b.name.toLowerCase().replace(/^the\s+/, '') ===
            name.toLowerCase().replace(/^the\s+/, ''),
      )
      const id = known?.id || slug
      if (!nameById.has(id)) nameById.set(id, name)
    }
    return ids.map((id) => ({
      id,
      name: nameById.get(id) || brandDisplayName(id),
    }))
  }, [sheetDraft.favoredBrands, userProfile?.favoredBrands])

  function setBrandGarmentSize(brandId, garmentId, size) {
    setSheetDraft((d) => {
      const brandMap = { ...(d.brandSizes?.[brandId] || {}) }
      if (brandMap[garmentId] === size) delete brandMap[garmentId]
      else brandMap[garmentId] = size
      const brandSizes = { ...(d.brandSizes || {}) }
      if (Object.keys(brandMap).length === 0) delete brandSizes[brandId]
      else brandSizes[brandId] = brandMap
      return {
        ...d,
        brandSizes,
      }
    })
  }

  async function saveSheet() {
    if (!sheet) return
    setSaveBusy(true)
    setSaveNote('')
    try {
      if (sheet === 'displayName') {
        const name = (sheetDraft.name || '').trim()
        if (!name) {
          setSaveNote('Enter a display name')
          return
        }
        const result = await onSaveProfile?.({ displayName: name })
        setSaveNote(
          result ? `Saved${result.source === 'database' ? ' to database' : ''}` : 'Saved',
        )
      } else if (sheet === 'shop') {
        const shopEmail = (sheetDraft.shop || '').trim()
        if (shopEmail) await onSaveProfile?.({ email: shopEmail })
        setSaveNote('Saved')
      } else if (sheet === 'shipping') {
        await onSaveProfile?.({
          shippingAddress: (sheetDraft.address || '').trim(),
        })
        setSaveNote('Saved')
      } else if (sheet === 'storeApi') {
        await onSaveProfile?.({
          storeApiKey: (sheetDraft.storeApiKey || '').trim(),
        })
        setSaveNote('Saved')
      } else if (sheet === 'size') {
        await onSaveProfile?.({
          clothingSizes: { ...(sheetDraft.clothingSizes || {}) },
          favoredBrands: [...(sheetDraft.favoredBrands || [])],
          brandSizes: { ...(sheetDraft.brandSizes || {}) },
        })
        setSaveNote('Saved to profile')
      } else {
        setSaveNote('Saved')
      }
      setTimeout(() => {
        setSheet(null)
        setSizeBrandFocus(null)
      }, 350)
    } finally {
      setSaveBusy(false)
    }
  }

  function chooseAppColor(id) {
    setAppColor(applyAppColor(id))
  }

  function chooseBgColor(id) {
    setBgColor(applyBgColor(id))
  }

  function refreshPalette() {
    setPaletteColors(getPaletteColors())
  }

  function openWheel(target = 'app', slotIndex = 0) {
    let hex = customHex
    if (target === 'bg') hex = customBgHex
    if (target === 'palette') {
      paletteSlotRef.current = slotIndex
      hex = getPaletteHexes()[slotIndex] || customHex
    }
    wheelTargetRef.current = target
    setWheelTarget(target)
    setWheelHsv(hexToHsv(hex))
    setWheelOpen(true)
  }

  function applyWheelHex(hex) {
    if (wheelTargetRef.current === 'palette') {
      setPaletteSlot(paletteSlotRef.current, hex)
      refreshPalette()
      return
    }
    if (wheelTargetRef.current === 'bg') {
      setCustomBgHex(hex)
      setBgColor(applyCustomBgColor(hex))
      return
    }
    setCustomHex(hex)
    setAppColor(applyCustomColor(hex))
  }

  function pickFromPad(clientX, clientY) {
    const el = wheelPadRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = clientX - cx
    const dy = clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxR = rect.width / 2 - 6
    const minR = maxR * 0.34
    if (dist < minR * 0.55) return
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const h = (angle + 360) % 360
    const s = clamp((dist - minR) / (maxR - minR), 0.12, 1)
    setWheelHsv((prev) => {
      const next = { ...prev, h, s }
      applyWheelHex(hsvToHex(next.h, next.s, next.v))
      return next
    })
  }

  useEffect(() => {
    if (!wheelOpen) return undefined
    function onMove(e) {
      if (!draggingWheel.current) return
      pickFromPad(e.clientX, e.clientY)
    }
    function onUp() {
      draggingWheel.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [wheelOpen])

  return (
    <div
      className={`settings-screen${helpPage === 'help' ? ' is-assistant-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <header className="settings-top">
        <button
          type="button"
          className="settings-back"
          aria-label="Back to profile"
          onClick={onBack}
        >
          <BackIcon />
        </button>
        <h1 className="settings-title" aria-label="Settings" />
        <span className="settings-top-spacer" aria-hidden />
      </header>

      <div className="settings-scroll">
        <Section label="Appearance">
          <div className="settings-block settings-palette-block">
            <button
              type="button"
              className="settings-palette-edit"
              aria-label="Edit color palette"
              title="Edit palette"
              onClick={() => setPaletteEditorOpen(true)}
            >
              <PencilIcon />
            </button>
            <div className="settings-color-stack">
              <div className="settings-color-group">
                <p className="settings-color-caption">Containers</p>
                <div
                  className="settings-color-row"
                  aria-label="Container color — nav, pins, chat rows, and info boxes"
                >
                  <button
                    type="button"
                    className="settings-color-wheel"
                    title="Container color wheel"
                    aria-label="Open container color wheel"
                    onClick={() => openWheel('app')}
                  >
                    <span
                      className={`settings-color-wheel-face ${appColor === 'custom' ? 'is-selected' : ''}`}
                      style={
                        appColor === 'custom' ? { background: customHex } : undefined
                      }
                    />
                  </button>
                  <div
                    className="settings-swatches is-full-palette"
                    role="listbox"
                    aria-label="Container color"
                  >
                    {paletteColors.map((c) => {
                      const selected = appColor === c.id
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          aria-label={c.label}
                          className={`settings-swatch ${selected ? 'is-selected' : ''}`}
                          onClick={() => chooseAppColor(c.id)}
                        >
                          <span
                            className={`settings-swatch-dot ${c.id === 'none' ? 'is-none' : ''}`}
                            style={
                              c.id === 'none' ? undefined : { background: c.swatch }
                            }
                          >
                            {selected && <CheckIcon />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="settings-color-group">
                <p className="settings-color-caption">Background</p>
                <div
                  className="settings-color-row"
                  aria-label="Background color — flowing atmosphere wash"
                >
                  <button
                    type="button"
                    className="settings-color-wheel"
                    title="Background color wheel"
                    aria-label="Open background color wheel"
                    onClick={() => openWheel('bg')}
                  >
                    <span
                      className={`settings-color-wheel-face ${bgColor === 'custom' ? 'is-selected' : ''}`}
                      style={
                        bgColor === 'custom'
                          ? { background: customBgHex }
                          : undefined
                      }
                    />
                  </button>
                  <div
                    className="settings-swatches is-full-palette"
                    role="listbox"
                    aria-label="Background color"
                  >
                    {paletteColors.map((c) => {
                      const selected = bgColor === c.id
                      return (
                        <button
                          key={`bg-${c.id}`}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          aria-label={c.label}
                          className={`settings-swatch ${selected ? 'is-selected' : ''}`}
                          onClick={() => chooseBgColor(c.id)}
                        >
                          <span
                            className={`settings-swatch-dot ${c.id === 'none' ? 'is-none' : ''}`}
                            style={
                              c.id === 'none' ? undefined : { background: c.swatch }
                            }
                          >
                            {selected && <CheckIcon />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    className="settings-choose is-color-side"
                    aria-label="Background flow image"
                    title="Background flow"
                    onClick={() => applyBackgroundImage('atmosphere')}
                  >
                    <ImageIcon />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-divider" aria-hidden />

          <div className="settings-block">
            <div className="settings-slider-head is-value-only">
              <span className="settings-slider-value">{barTransparency}%</span>
            </div>
            <input
              className="settings-slider"
              type="range"
              min={0}
              max={100}
              value={barTransparency}
              onChange={(e) => {
                const next = Number(e.target.value)
                setBarTransparency(next)
                applyBarTransparency(next)
              }}
              aria-label="Display from Opaque to Clear"
              style={{ '--pct': `${barTransparency}%` }}
            />
            <div className="settings-slider-ends">
              <span>Opaque</span>
              <span>Clear</span>
            </div>
          </div>
        </Section>

        <section className="settings-section is-icon-tools" aria-label="Shop tools">
          <div className="settings-icon-row" role="toolbar" aria-label="Shop tools">
            <button
              type="button"
              className="settings-icon-tile"
              aria-label="Size"
              onClick={() => openSheet('size')}
            >
              <SlidersIcon />
            </button>
            <button
              type="button"
              className="settings-icon-tile"
              aria-label="Shipping address"
              onClick={() => openSheet('shipping')}
            >
              <PinIcon />
            </button>
            <button
              type="button"
              className="settings-icon-tile"
              aria-label="Shop email"
              onClick={() => openSheet('shop')}
            >
              <AtIcon />
            </button>
            <button
              type="button"
              className="settings-icon-tile"
              aria-label="Sync products"
              onClick={() => openSheet('sync')}
            >
              <BoxIcon />
            </button>
          </div>
        </section>

        <Section label="Accounts">
          <div className="settings-account-active">
            <span className="settings-account-avatar" aria-hidden>
              {initialsFromName(displayName)}
            </span>
            <span className="settings-row-copy">
              <span className="settings-row-title">{displayName}</span>
              {email ? (
                <span className="settings-row-sub">{email}</span>
              ) : null}
            </span>
            <span className="settings-pill is-active">Active</span>
          </div>
        </Section>

        <Section label="Account Settings">
          <Row
            title="Name"
            meta={displayName}
            onClick={() => openSheet('displayName')}
          />
          <div className="settings-divider" aria-hidden />
          <Row title="Password" onClick={() => openSheet('password')} />
        </Section>

        <Section label="Store API">
          <Row
            title="Store API"
            subtitle="Connect your store catalog key"
            meta={userProfile?.storeApiKey ? 'Connected' : 'Not set'}
            onClick={() => openSheet('storeApi')}
          />
        </Section>

        <Section label="ID Verification">
          <Row
            icon={<ShieldIcon />}
            title="Verify with ID.me"
            meta={
              identityStatus === 'verified'
                ? 'Verified'
                : identityStatus === 'pending'
                  ? 'Pending'
                  : 'Not verified'
            }
            badge={
              identityStatus === 'verified' ? (
                <span className="settings-pill is-connected">● Verified</span>
              ) : null
            }
            onClick={() => {
              setIdmeError('')
              setIdmeStep(identityStatus === 'verified' ? 'done' : 'intro')
              setIdmeOpen(true)
            }}
          />
        </Section>

        <Section label="Give Back">
          <div className="settings-giveback">
            <div className="settings-giveback-head">
              <p className="settings-giveback-title">Dlaita Group Initiative</p>
            </div>
            <div className="settings-pledge-modes" role="group" aria-label="Pledge type">
              <div
                className={`settings-pledge-mode is-input ${pledgeMode === 'flat' ? 'is-active' : ''}`}
                onClick={() => {
                  setPledgeMode('flat')
                  setPledged(false)
                }}
              >
                <label className="settings-pledge-pct" htmlFor="pledge-amount">
                  <span className="settings-pledge-pct-suffix" aria-hidden>
                    $
                  </span>
                  <input
                    id="pledge-amount"
                    className="settings-pledge-pct-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    name="thrft_pledge_flat"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    aria-label="Pledge dollars per month"
                    value={pledgeAmount}
                    onFocus={() => {
                      setPledgeMode('flat')
                      setPledged(false)
                    }}
                    onChange={(e) => onPledgeAmountChange(e.target.value)}
                  />
                </label>
                <span className="settings-pledge-small">flat / month</span>
              </div>
              <div
                className={`settings-pledge-mode is-input ${pledgeMode === 'percent' ? 'is-active' : ''}`}
                onClick={() => {
                  setPledgeMode('percent')
                  setPledged(false)
                }}
              >
                <label className="settings-pledge-pct" htmlFor="pledge-percent">
                  <input
                    id="pledge-percent"
                    className="settings-pledge-pct-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    name="thrft_pledge_pct"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    aria-label="Pledge percent of earnings"
                    value={pledgePercent}
                    onFocus={() => {
                      setPledgeMode('percent')
                      setPledged(false)
                    }}
                    onChange={(e) => onPledgePercentChange(e.target.value)}
                  />
                  <span className="settings-pledge-pct-suffix" aria-hidden>
                    %
                  </span>
                </label>
                <span className="settings-pledge-small">of earnings</span>
              </div>
            </div>
            <button
              type="button"
              className={`settings-pledge-cta ${pledged ? 'is-on' : ''}`}
              disabled={!canPledge}
              onClick={() => {
                if (!canPledge) return
                setPledged((v) => !v)
              }}
            >
              <HeartIcon />
              {pledgeCta}
            </button>
          </div>
        </Section>

        <Section label="Help & Support">
          <Row icon={<PlayIcon />} title="Getting Started" onClick={() => setHelpPage('started')} />
          <div className="settings-divider" aria-hidden />
          <Row icon={<HelpIcon />} title="Help" onClick={openHelpAssistant} />
          <div className="settings-divider" aria-hidden />
          <Row icon={<MailIcon />} title="Support" onClick={() => setHelpPage('support')} />
        </Section>

        <p className="settings-footer">ThrfT. v1.0.0</p>

        <button
          type="button"
          className="settings-signout"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => onSignOut?.()}
        >
          <DoorIcon />
        </button>
      </div>

      {sheet && SHEET_COPY[sheet] && (
        <div
          className="glass-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={
            sheet === 'size'
              ? 'Clothing sizes'
              : sheet === 'shipping'
                ? 'Address'
                : sheet === 'shop'
                  ? 'Shop email'
                  : sheet === 'sync'
                    ? 'Catalog'
                    : sheet === 'storeApi'
                      ? 'Store API'
                      : SHEET_COPY[sheet].title || 'Settings'
          }
        >
          <button
            type="button"
            className="glass-sheet-scrim"
            aria-label="Dismiss"
            onClick={() => setSheet(null)}
          />
          <div
            className="glass-sheet-card"
            ref={sheet === 'size' ? sizeSheetCardRef : undefined}
          >
            <div className="glass-sheet-head">
              {SHEET_COPY[sheet].title ? (
                <h2 className="glass-sheet-title">{SHEET_COPY[sheet].title}</h2>
              ) : (
                <h2 className="glass-sheet-title" aria-hidden="true" />
              )}
              <button
                type="button"
                className="glass-overlay-icon-btn"
                aria-label="Close"
                onClick={() => setSheet(null)}
              >
                <CloseIcon />
              </button>
            </div>
            {sheet === 'size' ? (
              <div className="settings-size-cats" ref={sizeCatsRef}>
                {sizeBrandFocus ? (
                  <>
                    <button
                      type="button"
                      className="settings-size-back"
                      onClick={() => setSizeBrandFocus(null)}
                    >
                      <BackIcon />
                      <span>
                        {likedSizeBrands.find((b) => b.id === sizeBrandFocus)
                          ?.name ||
                          brandById(sizeBrandFocus)?.name ||
                          brandDisplayName(sizeBrandFocus)}
                      </span>
                    </button>
                    <p className="settings-size-section-label">
                      Your sizes at{' '}
                      {likedSizeBrands.find((b) => b.id === sizeBrandFocus)
                        ?.name ||
                        brandById(sizeBrandFocus)?.name ||
                        brandDisplayName(sizeBrandFocus)}
                    </p>
                    {garmentsForBrand(sizeBrandFocus).map((garment) => {
                      const options = sizesForBrandGarment(
                        sizeBrandFocus,
                        garment.id,
                      )
                      const selected =
                        sheetDraft.brandSizes?.[sizeBrandFocus]?.[garment.id] ||
                        ''
                      const focusName =
                        likedSizeBrands.find((b) => b.id === sizeBrandFocus)
                          ?.name ||
                        brandById(sizeBrandFocus)?.name ||
                        brandDisplayName(sizeBrandFocus)
                      return (
                        <div key={garment.id} className="settings-size-cat">
                          <div className="settings-size-cat-head">
                            <p className="settings-size-cat-label">
                              {garment.label}
                            </p>
                            {garment.hint ? (
                              <span className="settings-size-cat-hint">
                                {garment.hint}
                              </span>
                            ) : null}
                          </div>
                          <div
                            className="settings-size-chips"
                            role="listbox"
                            aria-label={`${focusName} ${garment.label} size`}
                          >
                            {options.map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                role="option"
                                aria-selected={selected === sz}
                                className={`settings-size-chip${selected === sz ? ' is-on' : ''}`}
                                onClick={() =>
                                  setBrandGarmentSize(
                                    sizeBrandFocus,
                                    garment.id,
                                    sz,
                                  )
                                }
                              >
                                {sz}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </>
                ) : (
                  <>
                    <p className="settings-size-section-label">Garments</p>
                    {SIZE_GARMENTS.map((cat) => {
                      const options = sizesForCategory(cat.id)
                      const selected = sheetDraft.clothingSizes?.[cat.id] || ''
                      return (
                        <div key={cat.id} className="settings-size-cat">
                          <div className="settings-size-cat-head">
                            <p className="settings-size-cat-label">
                              {cat.label}
                            </p>
                            {cat.hint ? (
                              <span className="settings-size-cat-hint">
                                {cat.hint}
                              </span>
                            ) : null}
                          </div>
                          <div
                            className="settings-size-chips"
                            role="listbox"
                            aria-label={`${cat.label} size`}
                          >
                            {options.map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                role="option"
                                aria-selected={selected === sz}
                                className={`settings-size-chip${selected === sz ? ' is-on' : ''}`}
                                onClick={() => setCategorySize(cat.id, sz)}
                              >
                                {sz}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    <div className="settings-size-brands" role="list">
                      {likedSizeBrands.length === 0 ? (
                        <p className="settings-size-empty">
                          Liked brands from Favorites will show here so you can
                          set their sizes.
                        </p>
                      ) : (
                        likedSizeBrands.map((brand) => {
                          const brandMap =
                            sheetDraft.brandSizes?.[brand.id] || {}
                          const filled = Object.keys(brandMap).length
                          return (
                            <div
                              key={brand.id}
                              className="settings-size-brand"
                              role="listitem"
                            >
                              <button
                                type="button"
                                className="settings-size-brand-main"
                                aria-label={`${brand.name} sizes`}
                                onClick={() => setSizeBrandFocus(brand.id)}
                              >
                                <span className="settings-size-brand-name">
                                  {brand.name}
                                </span>
                                <span className="settings-size-brand-meta">
                                  {filled
                                    ? `${filled} size${filled === 1 ? '' : 's'}`
                                    : 'Set sizes'}
                                </span>
                                <Chevron />
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              SHEET_COPY[sheet].fields.map((f) => (
                <label key={f.key} className="glass-field">
                  <span className="glass-field-label">{f.label}</span>
                  <input
                    className="glass-input"
                    type={f.key === 'storeApiKey' || f.key === 'password' ? 'password' : 'text'}
                    name={`thrft_settings_${f.key}`}
                    autoComplete={
                      f.key === 'password'
                        ? 'new-password'
                        : f.key === 'storeApiKey'
                          ? 'off'
                          : 'off'
                    }
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    placeholder=""
                    value={sheetDraft[f.key] || ''}
                    onChange={(e) =>
                      setSheetDraft((d) => ({ ...d, [f.key]: e.target.value }))
                    }
                  />
                </label>
              ))
            )}
            <button
              type="button"
              className="glass-cta"
              disabled={saveBusy}
              onClick={saveSheet}
            >
              {saveBusy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {helpPage === 'help' && (
        <div
          className="glass-overlay settings-help-page is-assistant"
          role="dialog"
          aria-modal="true"
          aria-label="Help assistant"
        >
          <header className="glass-overlay-top settings-assistant-top">
            <button
              type="button"
              className="glass-overlay-back"
              aria-label="Back"
              onClick={() => setHelpPage(null)}
            >
              <BackIcon />
            </button>
            <div className="settings-assistant-mark" aria-hidden>
              <PersonIcon />
            </div>
            <span className="glass-overlay-spacer" aria-hidden />
          </header>
          <div
            ref={assistantListRef}
            className="settings-assistant-thread"
            role="log"
            aria-live="polite"
          >
            {assistantMessages.map((msg) => (
              <div
                key={msg.id}
                className={`settings-assistant-bubble is-${msg.role}`}
              >
                {msg.text}
              </div>
            ))}
          </div>
          <div className="settings-assistant-dock">
            <label
              className="settings-assistant-bar"
              htmlFor="settings-assistant-input"
            >
              <input
                id="settings-assistant-input"
                className="settings-assistant-input"
                type="text"
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder=""
                aria-label="Ask the help assistant"
                value={assistantDraft}
                onChange={(e) => setAssistantDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    sendAssistant()
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}

      {helpPage && helpPage !== 'help' && HELP_PAGES[helpPage] && (
        <div
          className={`glass-overlay settings-help-page${helpPage === 'started' ? ' is-started' : ''}`}
          role="dialog"
          aria-modal="true"
        >
          {helpPage === 'started' && (
            <div className="settings-started-atmosphere" aria-hidden>
              <span className="settings-started-bloom settings-started-bloom-a" />
              <span className="settings-started-bloom settings-started-bloom-b" />
              <span className="settings-started-bloom settings-started-bloom-c" />
              <span className="settings-started-bloom settings-started-bloom-d" />
            </div>
          )}
          <header className="glass-overlay-top">
            <button
              type="button"
              className="glass-overlay-back"
              aria-label="Back"
              onClick={() => setHelpPage(null)}
            >
              <BackIcon />
            </button>
            <h2 className="glass-overlay-title">{HELP_PAGES[helpPage].title}</h2>
            <span className="glass-overlay-spacer" aria-hidden />
          </header>
          <div className="glass-overlay-body settings-help-body">
            {helpPage === 'started' ? (
              <article className="settings-started">
                {HELP_PAGES.started.groups.map((group) => (
                  <div key={group.label} className="settings-started-group">
                    <p className="settings-started-group-label">{group.label}</p>
                    <div className="settings-started-list">
                      {group.sections.map((section) => (
                        <section key={section.heading} className="settings-started-row">
                          <h3 className="settings-started-heading">{section.heading}</h3>
                          <p className="settings-started-copy">{section.body}</p>
                        </section>
                      ))}
                    </div>
                  </div>
                ))}
              </article>
            ) : (
              <div className="glass-pane-card settings-help-card">
                <p className="glass-muted">{HELP_PAGES[helpPage].body}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {idmeOpen && (
        <div className="glass-overlay settings-idme-page" role="dialog" aria-modal="true" aria-label="ID.me verification">
          <header className="glass-overlay-top">
            <button
              type="button"
              className="glass-overlay-back"
              aria-label="Back"
              onClick={() => setIdmeOpen(false)}
            >
              <BackIcon />
            </button>
            <h2 className="glass-overlay-title">Identity</h2>
            <span className="glass-overlay-spacer" aria-hidden />
          </header>
          <div className="glass-overlay-body">
            <div className="settings-idme-card glass-pane-card">
              <div className="settings-idme-brand">
                <span className="settings-idme-mark" aria-hidden>
                  ID
                </span>
                <div>
                  <p className="settings-idme-title">ID.me</p>
                </div>
              </div>

              {idmeStep === 'intro' && (
                <>
                  {idmeCfg?.configured ? (
                    <button
                      type="button"
                      className="glass-cta settings-idme-cta"
                      disabled={idBusy}
                      onClick={beginIdmeOAuth}
                    >
                      {idBusy ? 'Starting…' : 'Continue with ID.me'}
                    </button>
                  ) : (
                    <p className="settings-idme-status">
                      ID.me is not configured. Add IDME_CLIENT_ID and IDME_CLIENT_SECRET
                      to the API environment.
                    </p>
                  )}
                </>
              )}

              {idmeStep === 'connecting' && (
                <p className="settings-idme-status" aria-live="polite">
                  …
                </p>
              )}

              {idmeStep === 'error' && (
                <>
                  <p className="settings-idme-status">Could not start ID.me</p>
                  <button
                    type="button"
                    className="glass-cta settings-idme-cta"
                    onClick={() => setIdmeStep('intro')}
                  >
                    Back
                  </button>
                </>
              )}

              {idmeStep === 'done' && (
                <>
                  <p className="settings-idme-status is-verified">Identity verified</p>
                  <button
                    type="button"
                    className="glass-cta settings-idme-cta"
                    onClick={() => setIdmeOpen(false)}
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {paletteEditorOpen && (
        <div
          className="glass-sheet settings-palette-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Edit color palette"
        >
          <button
            type="button"
            className="glass-sheet-scrim"
            aria-label="Dismiss"
            onClick={() => setPaletteEditorOpen(false)}
          />
          <div className="glass-sheet-card settings-palette-card">
            <div className="glass-sheet-head">
              <h2 className="glass-sheet-title">Palette</h2>
              <button
                type="button"
                className="glass-overlay-icon-btn"
                aria-label="Close"
                onClick={() => setPaletteEditorOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <p className="settings-palette-hint">
              Tap a color to replace it. None stays first on both rows.
            </p>
            <div
              className="settings-palette-edit-grid"
              role="list"
              aria-label="Editable palette colors"
            >
              {paletteColors
                .filter((c) => c.id !== 'none')
                .map((c, index) => (
                  <button
                    key={c.id}
                    type="button"
                    className="settings-palette-edit-swatch"
                    aria-label={`Replace ${c.label}`}
                    onClick={() => openWheel('palette', index)}
                  >
                    <span
                      className="settings-palette-edit-dot"
                      style={{ background: c.swatch }}
                    />
                  </button>
                ))}
            </div>
            <button
              type="button"
              className="settings-palette-reset"
              onClick={() => {
                resetPalette()
                refreshPalette()
              }}
            >
              Reset palette
            </button>
            <button
              type="button"
              className="glass-cta"
              onClick={() => setPaletteEditorOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {wheelOpen && (
        <div
          className="glass-sheet settings-wheel-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={
            wheelTarget === 'bg'
              ? 'Background color wheel'
              : wheelTarget === 'palette'
                ? 'Replace palette color'
                : 'Container color wheel'
          }
        >
          <button
            type="button"
            className="glass-sheet-scrim"
            aria-label="Dismiss"
            onClick={() => setWheelOpen(false)}
          />
          <div className="glass-sheet-card settings-wheel-card">
            <div className="glass-sheet-head">
              <h2 className="glass-sheet-title" aria-hidden="true" />
              <button
                type="button"
                className="glass-overlay-icon-btn"
                aria-label="Close"
                onClick={() => setWheelOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <div
              ref={wheelPadRef}
              className="settings-wheel-pad"
              onPointerDown={(e) => {
                draggingWheel.current = true
                e.currentTarget.setPointerCapture?.(e.pointerId)
                pickFromPad(e.clientX, e.clientY)
              }}
            >
              <span className="settings-wheel-ring" aria-hidden />
              <span className="settings-wheel-core" aria-hidden style={{ background: wheelHex }} />
              <span
                className="settings-wheel-knob"
                aria-hidden
                style={{
                  transform: `translate(-50%, -50%) rotate(${wheelHsv.h}deg) translate(${42 + wheelHsv.s * 38}px) rotate(${-wheelHsv.h}deg)`,
                }}
              />
            </div>

            <label className="settings-wheel-tone">
              <input
                type="range"
                min="18"
                max="72"
                value={Math.round(wheelHsv.v * 100)}
                aria-label="Tone"
                onChange={(e) => {
                  const v = Number(e.target.value) / 100
                  setWheelHsv((prev) => {
                    const next = { ...prev, v }
                    applyWheelHex(hsvToHex(next.h, next.s, next.v))
                    return next
                  })
                }}
              />
            </label>

            <div className="settings-wheel-preview-row">
              <span className="settings-wheel-preview" style={{ background: wheelHex }} />
              <span className="settings-wheel-hex">{wheelHex}</span>
            </div>

            <button type="button" className="glass-cta" onClick={() => setWheelOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
