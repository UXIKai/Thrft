import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  applyDisplayMode,
  readTheme,
  applyBrightness,
  readBrightness,
  applyAppColor,
  applyBackgroundImage,
  exitMoonlight,
  readMoonlight,
  readBackgroundImage,
  applyBackgroundPhoto,
  readBackgroundPhoto,
  applyBarTransparency,
  applyUiScale,
  applyContainerEdge,
  readContainerEdge,
  readUiScale,
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
  rememberRecentColor,
  setPaletteSlot,
  readRecentColors,
} from '../appAppearance.js'
import {
  initialsFromName,
  fetchIdmeConfig,
  startIdmeAuthorize,
} from '../api.js'
import OrbitCarousel from './OrbitCarousel.jsx'
import StageSlot from './StageSlot.jsx'
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

function Section({ label, children, className = '' }) {
  return (
    <section className={`settings-section ${className}`.trim()} aria-label={label}>
      <div className="settings-card">{children}</div>
    </section>
  )
}

function Row({
  icon,
  title,
  iconOnly = false,
  subtitle,
  meta,
  badge,
  onClick,
  trailing,
}) {
  return (
    <button
      type="button"
      className="settings-row"
      aria-label={iconOnly ? title : undefined}
      onClick={onClick}
    >
      {icon && <span className="settings-row-leading">{icon}</span>}
      {!iconOnly && (
        <span className="settings-row-copy">
          <span className="settings-row-title">{title}</span>
          {subtitle && <span className="settings-row-sub">{subtitle}</span>}
        </span>
      )}
      {meta && <span className="settings-row-meta">{meta}</span>}
      {badge}
      {trailing}
      <Chevron />
    </button>
  )
}


const HELP_PAGES = {
  started: {
    title: 'Introduction',
    intro: 'The bottom bar runs left to right. Selling, money, and account live on those screens.',
    groups: [
      {
        label: 'Tabs',
        sections: [
          {
            heading: 'Home',
            body: 'Scroll the type wheel to filter. Brand rows show listings. For You suggests pieces from your sizes and saved brands. The cart icon opens your bag to review and check out.',
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
            heading: 'Saved',
            body: 'Search a brand, select it, then + to save. Saved brands feed For You on Home. Liked products stay on this tab too.',
          },
          {
            heading: 'Profile',
            body: 'Photo, name, and shipping. The book opens Store and Closet. The gear opens Settings, where the Profile pencil edits account, Money, Music, and Media.',
          },
        ],
      },
      {
        label: 'Selling',
        sections: [
          {
            heading: 'Market',
            body: 'Sell clothes you own. Add photos with the camera, set Brand and Type on the wheels, then price and post.',
          },
          {
            heading: 'Closet',
            body: 'Scan a piece: photo in, background removed. Set Brand and Type, then save it. No title or description here.',
          },
          {
            heading: 'Store',
            body: 'On Profile, the book lists Active and Sold. Browse Closet with Brand and Type wheels, then open a piece to Post to Market.',
          },
        ],
      },
      {
        label: 'Money',
        sections: [
          {
            heading: 'Payouts',
            body: 'Payouts use a linked account. Open Money from the Profile pencil in Settings.',
          },
          {
            heading: 'Points',
            body: 'Fifty cents equals one point. Donate points or move them to Wallet.',
          },
          {
            heading: 'Wallet',
            body: 'Withdraw moved points to a linked bank.',
          },
          {
            heading: 'Sales',
            body: 'Listing earnings, next to Points and Wallet on the Money screen.',
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
            heading: 'Give back',
            body: 'In Settings → Money. Optional Diaita Group Initiative: a monthly dollar amount or a percent of earnings.',
          },
          {
            heading: 'ID.me',
            body: 'Optional identity check for selling or payouts. Thrft only stores that you finished—not your ID photos.',
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
    keys: ['favorite', 'favourites', 'saved', 'liked', 'brands'],
    answer:
      'Saved: search a brand, select it, then + to save. Saved brands feed For You on Home. Liked products stay on that tab too.',
  },
  {
    keys: ['profile', 'store', 'active', 'sold', 'book'],
    answer:
      'Profile holds your photo and shipping. Edit account, Money, Music, and Media from the Profile pencil in Settings.',
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
      'Open Settings, then the Profile pencil, for account, Money, Music, and Media. Fifty cents equals one point.',
  },
  {
    keys: ['bag', 'cart', 'checkout', 'stripe'],
    answer: 'The cart icon on Home opens your bag. Review items and check out with Stripe.',
  },
  {
    keys: ['give', 'donate', 'dlaita', 'pledge'],
    answer:
      'In Settings → Money, below the other controls, you can pledge a monthly dollar amount or a percent of earnings to the Diaita Group Initiative.',
  },
  {
    keys: ['order', 'tracking', 'delivery', 'refund', 'support'],
    answer:
      'Open the ship tracker from Profile to follow an order. Checkout is the bag icon on Home. Ask another question here and I will walk you through it.',
  },
]

const ASSISTANT_ASK = 'What do you need help with?'

const ASSISTANT_PROMPTS = [
  'How do I sell on Market?',
  'How does Closet work?',
  'How do I message someone?',
  'Where is my bag?',
  'How do Saved brands work?',
  'How do payouts and points work?',
  'How do I verify with ID.me?',
  'How do I change sizes or shipping?',
  'How do I sign out?',
  'I need help with an order',
]

const ASSISTANT_FALLBACK =
  'I’m not sure on that yet. Try asking about Home, Create, Closet, Saved, Store, Settings, or Sign out — or open Introduction for the full walkthrough.'

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
  shipping: {
    title: '',
    fields: [
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'zip', label: 'Zip code' },
    ],
  },
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

function ProfileIcon() {
  return (
    <svg className="settings-pencil-ico" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8.2" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M5.5 19.2c.6-3.3 3.2-5.2 6.5-5.2s5.9 1.9 6.5 5.2"
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
const GENDER_OPTIONS = [
  'Agender',
  'Androgynous',
  'Bigender',
  'Cisgender Man',
  'Cisgender Woman',
  'Demiboy',
  'Demigirl',
  'Genderfluid',
  'Genderqueer',
  'Non-Binary',
  'Pangender',
  'Polygender',
  'Transgender Man',
  'Transgender Woman',
  'Two-Spirit',
]
const PRESET_SEX = ['Male', 'Female', 'Intersex']
const PRESET_AGES = Array.from({ length: 99 }, (_, i) => String(i + 1))
const PRESET_HEIGHTS = (() => {
  const out = []
  for (let ft = 3; ft <= 7; ft += 1) {
    for (let inch = 0; inch < 12; inch += 1) out.push(`${ft}'${inch}"`)
  }
  return out
})()
const ADD_KINDS = [
  ['age', 'Age'],
  ['sex', 'Sex'],
  ['gender', 'Gender'],
  ['height', 'Height'],
  ['category', 'Category'],
]
const PRESET_GENDERS = []
const PRESET_CATEGORIES = [
  'Dresses', 'Skirts', 'Leggings', 'Coats', 'Cardigans', 'Overalls',
  'Jumpsuits', 'Rompers', 'Pajamas', 'Underwear', 'Bras', 'Swimwear',
  'Activewear', 'Gloves', 'Scarves', 'Ties', 'Watches', 'Sunglasses',
  'Bags', 'Jewelry', 'Sneakers', 'Heels', 'Flats', 'Slippers', 'Cleats',
  'Raincoats', 'Parkas', 'Windbreakers', 'Crop tops', 'Bodysuits', 'Tracksuits',
  'Capris', 'Chinos', 'Cargo pants', 'Beanies', 'Caps', 'Wallets', 'Robes',
  'Tuxedos', 'Gowns', 'Kimonos', 'Ponchos', 'Leotards', 'Wetsuits',
]

function GenderDrum({ value, onPick, options = GENDER_OPTIONS }) {
  const ref = useRef(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const optsKey = options.join('|')
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const idx = Math.max(0, options.indexOf(value))
    const rowH = el.firstElementChild?.offsetHeight || 44
    el.scrollTop = idx * rowH
    const update = () => {
      const center = el.scrollTop + el.clientHeight / 2
      el.querySelectorAll('.gender-drum-row').forEach((row) => {
        const d = (row.offsetTop + row.offsetHeight / 2 - center) / row.offsetHeight
        const a = Math.min(Math.abs(d), 4.5)
        row.style.transform = `rotateX(${(-d * 7).toFixed(1)}deg) scale(${(1 - a * 0.06).toFixed(3)})`
        row.style.opacity = String(Math.max(0.18, 1 - a * 0.19).toFixed(2))
        row.classList.toggle('is-hot', Math.abs(d) < 0.5)
      })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const st = { timer: null, on: false, startY: 0, startScroll: 0, moved: false, swallow: false, held: null }
    const down = (e) => {
      st.swallow = false
      st.moved = false
      st.held = e.target.closest?.('[data-opt]')?.dataset.opt || null
      st.startY = e.clientY
      window.clearTimeout(st.timer)
      st.timer = window.setTimeout(() => {
        if (!st.held) return
        st.on = true
        st.swallow = true
        st.startScroll = el.scrollTop
        el.style.scrollSnapType = 'none'
        navigator.vibrate?.(8)
      }, 300)
    }
    const move = (e) => {
      if (st.on) {
        if (Math.abs(e.clientY - st.startY) > 6) st.moved = true
        if (st.moved) {
          const r = el.getBoundingClientRect()
          const k = (el.scrollHeight - el.clientHeight) / (r.height * 0.76)
          el.scrollTop = st.startScroll + (e.clientY - st.startY) * k
        }
      } else if (Math.abs(e.clientY - st.startY) > 8) window.clearTimeout(st.timer)
    }
    const end = (e) => {
      window.clearTimeout(st.timer)
      if (!st.on) return
      st.on = false
      el.style.scrollSnapType = ''
      if (e.type === 'pointercancel') return
      const id = st.moved
        ? el.querySelector('.gender-drum-row.is-hot')?.dataset.opt
        : st.held
      if (id) window.setTimeout(() => pickRef.current?.(id), 60)
    }
    const touch = (e) => {
      if (st.on && e.cancelable) e.preventDefault()
    }
    const click = (e) => {
      if (st.swallow) {
        st.swallow = false
        e.stopPropagation()
        e.preventDefault()
      }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    el.addEventListener('touchmove', touch, { passive: false })
    el.addEventListener('click', click, true)
    return () => {
      window.clearTimeout(st.timer)
      el.removeEventListener('scroll', update)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      el.removeEventListener('touchmove', touch)
      el.removeEventListener('click', click, true)
    }
  }, [value, optsKey])
  return (
    <div className="gender-drum" ref={ref}>
      {options.map((g) => (
        <div key={g} data-opt={g} className="gender-drum-row">
          <button type="button" className="is-bare" onClick={() => pickRef.current?.(g)}>
            {g}
          </button>
        </div>
      ))}
    </div>
  )
}

export default function SettingsScreen({
  onBack,
  userProfile,
  onSaveProfile,
  onSignOut,
  onEditProfile,
  onEditLinks,
  onEditMoney,
  onOpenOrders,
}) {
  const [theme, setTheme] = useState(() => readTheme())
  const [moonlightOn, setMoonlightOn] = useState(() => readMoonlight())
  const [appColor, setAppColor] = useState(() => readAppColor())
  const [customHex, setCustomHex] = useState(() => readCustomColorHex())
  const [bgColor, setBgColor] = useState(() => readBgColor())
  const [customBgHex, setCustomBgHex] = useState(() => readCustomBgColorHex())
  const [paletteColors, setPaletteColors] = useState(() => {
    readPalette()
    return getPaletteColors()
  })
  const [paletteEditorOpen, setPaletteEditorOpen] = useState(false)
  const [bgEffectOn, setBgEffectOn] = useState(() => readBackgroundImage() === 'atmosphere')
  const [uiScale, setUiScale] = useState(() => readUiScale())
  const [containerEdge, setContainerEdge] = useState(() => readContainerEdge())
  const [brightness, setBrightness] = useState(() => readBrightness())
  const [barTransparency, setBarTransparency] = useState(() =>
    readBarTransparency(),
  )
  const [sheet, setSheet] = useState(null)
  const [sheetDraft, setSheetDraft] = useState({})
  const [helpPage, setHelpPage] = useState(null)
  const [assistantDraft, setAssistantDraft] = useState('')
  const [assistantMessages, setAssistantMessages] = useState([])
  const assistantListRef = useRef(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveNote, setSaveNote] = useState('')
  const [wheelOpen, setWheelOpen] = useState(false)
  /** 'app' | 'bg' | 'palette' — palette edits a slot via wheel */
  const [wheelTarget, setWheelTarget] = useState('app')
  const wheelTargetRef = useRef('app')
  const paletteSlotRef = useRef(0)
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
  const [hasPhoto, setHasPhoto] = useState(() => Boolean(readBackgroundPhoto()))
  const galleryInputRef = useRef(null)
  const [paletteTarget, setPaletteTarget] = useState('app')
  const [paletteResetPending, setPaletteResetPending] = useState(false)
  const [hiddenSlots, setHiddenSlots] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('thrft-hidden-slots-v1') || '{}')
      return { app: new Set(raw.app || []), bg: new Set(raw.bg || []) }
    } catch {
      return { app: new Set(), bg: new Set() }
    }
  })
  const [blankSlots, setBlankSlots] = useState(() => new Set())
  function saveHiddenSlots(target, set) {
    setHiddenSlots((prev) => {
      const next = { ...prev, [target]: new Set(set) }
      try {
        localStorage.setItem(
          'thrft-hidden-slots-v1',
          JSON.stringify({ app: [...next.app], bg: [...next.bg] }),
        )
      } catch {
        /* ignore */
      }
      return next
    })
  }
  useEffect(() => {
    setBlankSlots(new Set(hiddenSlots[paletteTarget]))
    setPaletteResetPending(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteEditorOpen, paletteTarget])
  const [wheelHsv, setWheelHsv] = useState(() => hexToHsv(readCustomColorHex()))
  const [recentColors, setRecentColors] = useState(() => readRecentColors())
  const wheelPadRef = useRef(null)
  const [hexDraft, setHexDraft] = useState(null)
  const draggingWheel = useRef(false)
  const [idmeOpen, setIdmeOpen] = useState(false)
  const [idmeStep, setIdmeStep] = useState('intro') // intro | connecting | done | error
  const [idmeCfg, setIdmeCfg] = useState(null)
  const [idmeError, setIdmeError] = useState('')
  const [idBusy, setIdBusy] = useState(false)
  /** null = garment + brand list; brand id = brand-specific size drill-down */
  const [sizeBrandFocus, setSizeBrandFocus] = useState(null)
  const [sizeGarment, setSizeGarment] = useState(null)
  const [customSize, setCustomSize] = useState(null)
  const [sizePicked, setSizePicked] = useState(null)
  const [sizePeek, setSizePeek] = useState(null)
  const [, setSizeSummary] = useState(false)
  const [genderOpen, setGenderOpen] = useState(false)
  const [addNew, setAddNew] = useState(null)
  const [wizStep, setWizStep] = useState(null)
  const [addrStep, setAddrStep] = useState(0)
  const [addrEditing, setAddrEditing] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [confirmSizeReset, setConfirmSizeReset] = useState(false)
  const genderTimerRef = useRef(null)
  const [sizeFromSummary, setSizeFromSummary] = useState(false)
  const [sizeScrub, setSizeScrub] = useState(null)
  const scrubRef = useRef(null)
  const [scrubOn, setScrubOn] = useState(false)
  const scrubYRef = useRef(0)
  const scrubXRef = useRef(0)
  const scrubActiveRef = useRef(false)
  const summaryListRef = useRef(null)
  const summaryPressRef = useRef({ timer: null, x: 0, y: 0, fired: false })
  const peekTimerRef = useRef(null)

  useEffect(() => {
    if (!confirmSizeReset) return undefined
    const dismiss = (event) => {
      if (event.key === 'Escape') setConfirmSizeReset(false)
    }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [confirmSizeReset])

  function resetSizes() {
    setSheetDraft((d) => ({
      ...d,
      clothingSizes: {},
      sizesByGender: {},
      gender: '',
      age: '',
      sex: '',
      height: '',
      customGenders: [],
      customCategories: [],
      hiddenCategories: [],
    }))
    setConfirmSizeReset(false)
    setWizStep(0)
  }
  const peekFiredRef = useRef(false)
  const [sizeWheelId, setSizeWheelId] = useState(SIZE_GARMENTS[0]?.id)
  const sizeCatsRef = useRef(null)
  const sizeSheetCardRef = useRef(null)

  const displayName = userProfile?.displayName || 'Member'
  const email = userProfile?.email || ''
  const identityStatus = userProfile?.identityStatus || 'unverified'
  const identityRef = userProfile?.identityRef || ''
  const identityEmail = userProfile?.identityEmail || ''
  const legalName = userProfile?.legalName || ''
  const wheelHex = hsvToHex(wheelHsv.h, wheelHsv.s, wheelHsv.v)
  const wheelHexRef = useRef(wheelHex)
  wheelHexRef.current = wheelHex

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
        err?.payload?.error === 'idme_not_configured'
          ? 'ID.me linking is not connected on this server yet.'
          : err?.message || 'Could not open ID.me. Try again.',
      )
      setIdmeStep('error')
    } finally {
      setIdBusy(false)
    }
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

  useEffect(() => {
    if (sheet !== 'size') {
      setSizeGarment(null)
      setSizeSummary(false)
      setSizeFromSummary(false)
    }
  }, [sheet])

  const sizeSummary = sheet === 'size' && !sizeGarment && !sizeBrandFocus
  const allGarments = [
    ...SIZE_GARMENTS,
    ...(sheetDraft.customCategories || []),
  ].filter((g) => !(sheetDraft.hiddenCategories || []).includes(g.id))
  const allGenders = [...GENDER_OPTIONS, ...(sheetDraft.customGenders || [])]
  const commitAddNew = (picked) => {
    const text = (typeof picked === 'string' ? picked : addNew?.text || '').trim().slice(0, 20)
    if (text && addNew?.kind === 'gender') {
      setSheetDraft((d) => {
        const by = { ...(d.sizesByGender || {}) }
        if (d.gender) by[d.gender] = d.clothingSizes || {}
        return {
          ...d,
          gender: text,
          sizesByGender: by,
          clothingSizes: by[text] ? { ...by[text] } : d.gender ? {} : d.clothingSizes || {},
        }
      })
    } else if (text && ['age', 'sex', 'height'].includes(addNew?.kind)) {
      const key = addNew.kind
      setSheetDraft((d) => ({ ...d, [key]: text }))
    } else if (text) {
      if (addNew.kind === 'gender') {
        if (!allGenders.some((x) => x.toLowerCase() === text.toLowerCase())) {
          setSheetDraft((d) => ({
            ...d,
            customGenders: [...(d.customGenders || []), text],
          }))
        }
      } else if (!allGarments.some((x) => x.label.toLowerCase() === text.toLowerCase())) {
        setSheetDraft((d) => ({
          ...d,
          customCategories: [
            ...(d.customCategories || []),
            { id: `custom-${Date.now().toString(36)}`, label: text },
          ],
        }))
      }
    }
    setAddNew(null)
  }

  useEffect(() => {
    if (!sizeSummary) return undefined
    const el = summaryListRef.current
    if (!el) return undefined
    const update = () => {
      const center = el.scrollTop + el.clientHeight / 2
      el.querySelectorAll('.settings-size-summary-row').forEach((row) => {
        const d = (row.offsetTop + row.offsetHeight / 2 - center) / row.offsetHeight
        const a = Math.min(Math.abs(d), 4.5)
        row.style.transform = `rotateX(${(-d * 7).toFixed(1)}deg) scale(${(1 - a * 0.06).toFixed(3)})`
        row.style.opacity = String(Math.max(0.18, 1 - a * 0.19).toFixed(2))
        row.classList.toggle('is-hot', Math.abs(d) < 0.5)
      })
    }
    const rows = el.querySelectorAll('.settings-size-summary-row')
    if (el.scrollTop < 2 && rows.length) {
      const mid = rows[Math.floor((rows.length - 1) / 2)]
      el.scrollTop = mid.offsetTop + mid.offsetHeight / 2 - el.clientHeight / 2
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [sizeSummary, sheetDraft.gender, sheetDraft.customCategories, sheetDraft.hiddenCategories])

  // Hold a word: the finger becomes the scroll bar; release opens the centered word.
  useEffect(() => {
    if (!sizeSummary) return undefined
    const el = summaryListRef.current
    if (!el) return undefined
    const st = { timer: null, on: false, x: 0, y: 0, swallow: false, startY: 0, startScroll: 0, held: null, moved: false, heldRow: null }
    const scrubTo = (y) => {
      const r = el.getBoundingClientRect()
      const k = (el.scrollHeight - el.clientHeight) / (r.height * 0.76)
      el.scrollTop = st.startScroll + (y - st.startY) * k
    }
    const down = (e) => {
      st.x = e.clientX
      st.y = e.clientY
      st.swallow = false
      st.moved = false
      st.held = e.target.closest?.('[data-gid]')?.dataset.gid || null
      st.heldRow = e.target.closest?.('.settings-size-summary-row') || null
      window.clearTimeout(st.timer)
      st.timer = window.setTimeout(() => {
        if (!st.held) return
        st.on = true
        st.swallow = true
        st.startY = st.y
        st.startScroll = el.scrollTop
        el.style.scrollSnapType = 'none'
        st.heldRow?.classList.add('is-held')
        navigator.vibrate?.(8)
      }, 300)
    }
    const move = (e) => {
      if (st.on) {
        if (Math.abs(e.clientY - st.startY) > 6) {
          st.moved = true
          st.heldRow?.classList.remove('is-held')
        }
        if (st.moved) scrubTo(e.clientY)
        return
      }
      if (Math.abs(e.clientX - st.x) > 8 || Math.abs(e.clientY - st.y) > 8)
        window.clearTimeout(st.timer)
    }
    const end = (e) => {
      window.clearTimeout(st.timer)
      if (!st.on) return
      st.on = false
      el.style.scrollSnapType = ''
      st.heldRow?.classList.remove('is-held')
      if (e.type === 'pointercancel') return
      const id = st.moved
        ? el.querySelector('.settings-size-summary-row.is-hot [data-gid]')?.dataset.gid
        : st.held
      if (!id) return
      window.setTimeout(() => {
        setSizeSummary(false)
        setSizeFromSummary(true)
        setSizeGarment(id)
      }, 60)
    }
    const touch = (e) => {
      if (st.on && e.cancelable) e.preventDefault()
    }
    const click = (e) => {
      if (st.swallow) {
        st.swallow = false
        e.stopPropagation()
        e.preventDefault()
      }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    el.addEventListener('touchmove', touch, { passive: false })
    el.addEventListener('click', click, true)
    return () => {
      window.clearTimeout(st.timer)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      el.removeEventListener('touchmove', touch)
      el.removeEventListener('click', click, true)
    }
  }, [sizeSummary])

  useEffect(() => {
    if (!scrubOn) return undefined
    const id = window.setInterval(() => {
      if (!scrubActiveRef.current) return
      let card = summaryListRef.current
      while (card && card.scrollHeight <= card.clientHeight + 1)
        card = card.parentElement
      if (!card) return
      const r = card.getBoundingClientRect()
      const y = scrubYRef.current
      let dy = 0
      if (y < r.top + 56) dy = -6
      else if (y > r.bottom - 56) dy = 6
      if (!dy) return
      card.scrollTop += dy
      const hit = document
        .elementFromPoint(scrubXRef.current, y)
        ?.closest?.('[data-gid]')
      const gid = hit?.dataset.gid || null
      if (gid !== scrubRef.current) {
        scrubRef.current = gid
        setSizeScrub(gid)
      }
    }, 16)
    return () => window.clearInterval(id)
  }, [scrubOn])

  useEffect(() => {
    setCustomSize(null)
    setSizePicked(null)
  }, [sizeGarment])

  function openHelpAssistant() {
    setAssistantDraft('')
    setAssistantMessages([])
    setHelpPage('help')
  }

  function askAssistant(text) {
    const question = String(text || '').trim()
    if (!question) return
    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: question,
    }
    const reply = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: answerAssistant(question),
    }
    setAssistantMessages((prev) => [...prev, userMsg, reply])
    setAssistantDraft('')
  }

  function sendAssistant() {
    askAssistant(assistantDraft)
  }

  async function unlinkIdmeAccount() {
    setIdBusy(true)
    setIdmeError('')
    try {
      await onSaveProfile?.({
        identityStatus: 'unverified',
        identityProvider: '',
        identityRef: '',
        legalName: '',
        identityEmail: '',
        identityScope: '',
        identityVerifiedAt: '',
        identityGroups: [],
      })
      setIdmeStep('intro')
    } catch (err) {
      setIdmeError(err?.message || 'Could not unlink ID.me')
    } finally {
      setIdBusy(false)
    }
  }

  function openSheet(id) {
    const conf = SHEET_COPY[id]
    if (!conf) return
    const draft = {}
    if (id === 'size') {
      draft.clothingSizes = { ...(userProfile?.clothingSizes || {}) }
      draft.gender = userProfile?.gender || ''
      draft.sizesByGender = { ...(userProfile?.sizesByGender || {}) }
      draft.customGenders = [...(userProfile?.customGenders || [])]
      draft.hiddenCategories = [...(userProfile?.hiddenCategories || [])]
      draft.age = userProfile?.age || ''
      draft.sex = userProfile?.sex || ''
      draft.height = userProfile?.height || ''
      draft.customCategories = [...(userProfile?.customCategories || [])]
      if (draft.gender && draft.sizesByGender[draft.gender]) {
        draft.clothingSizes = { ...draft.sizesByGender[draft.gender] }
      }
      draft.favoredBrands = [...(userProfile?.favoredBrands || [])]
      draft.brandSizes = JSON.parse(
        JSON.stringify(userProfile?.brandSizes || {}),
      )
      setSizeBrandFocus(null)
      setWizStep(userProfile?.gender ? null : 0)
    } else {
      conf.fields.forEach((f) => {
        if (id === 'displayName' && f.key === 'name') draft[f.key] = displayName
        else if (id === 'shop' && f.key === 'shop') draft[f.key] = email
        else if (id === 'shipping') {
          const [a = '', c = '', rest = ''] = (
            userProfile?.shippingAddress || ''
          ).split(', ')
          const [st = '', ...z] = rest.split(' ')
          draft[f.key] = { address: a, city: c, state: st, zip: z.join(' ') }[f.key] || ''
        } else if (id === 'storeApi' && f.key === 'storeApiKey') {
          draft[f.key] = userProfile?.storeApiKey || ''
        } else draft[f.key] = ''
      })
    }
    setSaveNote('')
    setAddrStep(0)
    setAddrEditing(!(id === 'shipping' && userProfile?.shippingAddress))
    setSheetDraft(draft)
    if (id === 'shipping' && !userProfile?.shippingAddress) locateAddress()
    setSheet(id)
  }

  function setCategorySize(categoryId, size) {
    setSheetDraft((d) => {
      const raw = d.clothingSizes?.[categoryId]
      const cur = Array.isArray(raw) ? raw : raw ? [raw] : []
      const next = { ...(d.clothingSizes || {}) }
      const list = cur.includes(size)
        ? cur.filter((x) => x !== size)
        : [...cur, size]
      if (!list.length) delete next[categoryId]
      else next[categoryId] = list.length === 1 ? list[0] : list
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

  async function locateAddress() {
    if (!navigator.geolocation) return
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        }),
      )
      const { latitude, longitude } = pos.coords
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`,
      )
      if (!res.ok) return
      const a = (await res.json())?.address || {}
      const street = [a.house_number, a.road].filter(Boolean).join(' ')
      const city = a.city || a.town || a.village || a.hamlet || ''
      const state = (a['ISO3166-2-lvl4'] || '').split('-')[1] || a.state || ''
      const zip = a.postcode || ''
      if (!street || !city) return
      const full = [street, city, [state, zip].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
      await onSaveProfile?.({ shippingAddress: full })
      setSheetDraft((d) => ({ ...d, address: street, city, state, zip }))
      setAddrEditing(false)
    } catch {
      // Denied or unavailable: the manual steps stay available
    }
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
          shippingAddress: [
            (sheetDraft.address || '').trim(),
            (sheetDraft.city || '').trim(),
            [(sheetDraft.state || '').trim(), (sheetDraft.zip || '').trim()]
              .filter(Boolean)
              .join(' '),
          ]
            .filter(Boolean)
            .join(', '),
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
          gender: sheetDraft.gender || '',
          customGenders: [...(sheetDraft.customGenders || [])],
          hiddenCategories: [...(sheetDraft.hiddenCategories || [])],
          age: sheetDraft.age || '',
          sex: sheetDraft.sex || '',
          height: sheetDraft.height || '',
          customCategories: [...(sheetDraft.customCategories || [])],
          sizesByGender: {
            ...(sheetDraft.sizesByGender || {}),
            ...(sheetDraft.gender
              ? { [sheetDraft.gender]: { ...(sheetDraft.clothingSizes || {}) } }
              : {}),
          },
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

  function rememberColor(hex) {
    if (!hex || hex === 'transparent') return
    setRecentColors(rememberRecentColor(hex))
  }

  function rememberPaletteId(id) {
    if (!id || id === 'none' || id === 'custom') return
    const color = getPaletteColors().find((c) => c.id === id)
    if (color?.swatch) rememberColor(color.swatch)
  }

  function chooseAppColor(id) {
    setAppColor(applyAppColor(id))
    rememberPaletteId(id)
  }

  function chooseBgColor(id) {
    if (hasPhoto) clearPhoto()
    setBgColor(applyBgColor(id))
    setTheme(readTheme())
    rememberPaletteId(id)
  }

  function toggleDisplayMode() {
    // Flip from the live theme, not React state, which other background pickers can leave stale.
    if (readMoonlight()) {
      setTheme(applyDisplayMode(readTheme() === 'light' ? 'dark' : 'light'))
    } else {
      setTheme(applyDisplayMode('light'))
    }
    setMoonlightOn(readMoonlight())
    setAppColor(readAppColor())
    setBgColor(readBgColor())
    setHasPhoto(Boolean(readBackgroundPhoto()))
    setBgEffectOn(readBackgroundImage() === 'atmosphere')
  }

  function onPhotoFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    setPhotoMenuOpen(false)
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const max = 1600
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const ok = applyBackgroundPhoto(canvas.toDataURL('image/jpeg', 0.82))
      setHasPhoto(ok)
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  function clearPhoto() {
    applyBackgroundPhoto(null)
    setHasPhoto(false)
    setPhotoMenuOpen(false)
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
      setBlankSlots((prev) => {
        if (!prev.has(paletteSlotRef.current)) return prev
        const next = new Set(prev)
        next.delete(paletteSlotRef.current)
        return next
      })
      refreshPalette()
      return
    }
    if (wheelTargetRef.current === 'bg') {
      setCustomBgHex(hex)
      setBgColor(applyCustomBgColor(hex))
      setTheme(readTheme())
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
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const h = (angle + 360) % 360
    const s = clamp(dist / maxR, 0, 1)
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
      if (draggingWheel.current) rememberColor(wheelHexRef.current)
      draggingWheel.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [wheelOpen])

  const customizationSections = (
    <>
        <Section label="Appearance">
          <div className={`settings-block settings-palette-block${photoMenuOpen ? ' is-photo-open' : ''}`}>
            <button
              type="button"
              role="switch"
              aria-checked={bgEffectOn}
              aria-label="Background effect"
              className={`settings-effect-switch is-bare is-in-block${bgEffectOn ? ' is-on' : ''}`}
              ref={(el) => {
                // Inline !important so no theme/glass rule can turn the track gray.
                if (!el) return
                const track = bgEffectOn ? '#000' : '#fff'
                el.style.setProperty('background', track, 'important')
                el.style.setProperty('background-color', track, 'important')
                el.style.setProperty('opacity', '1', 'important')
                el.style.setProperty('filter', 'none', 'important')
                el.style.setProperty('box-shadow', 'none', 'important')
                el.style.setProperty(
                  'border',
                  `2px solid var(--effect-switch-outline, ${bgEffectOn ? '#fff' : '#000'})`,
                  'important',
                )
                el.style.setProperty('forced-color-adjust', 'none', 'important')
                const knob = el.firstElementChild
                knob?.style.setProperty(
                  'background',
                  bgEffectOn ? '#fff' : '#000',
                  'important',
                )
              }}
              onClick={() => {
                const next = bgEffectOn ? 'none' : 'atmosphere'
                if (next === 'atmosphere' && exitMoonlight()) {
                  setTheme(readTheme())
                  setMoonlightOn(false)
                }
                applyBackgroundImage(next)
                setBgEffectOn(next === 'atmosphere')
              }}
            >
              <span className="settings-effect-knob" />
            </button>
            <div className="settings-color-stack">
              <div className="settings-color-group">
                <p className="settings-color-caption">Containers</p>
                <div
                  className="settings-color-row"
                  aria-label="Container color — nav, pins, chat rows, and info boxes"
                >
                  <div
                    className="settings-swatches is-full-palette"
                    role="listbox"
                    aria-label="Container color"
                  >
                    {paletteColors.map((c, ci) => {
                      if (ci > 0 && hiddenSlots.app.has(ci - 1)) return null
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
                    <button
                      type="button"
                      className="settings-palette-edit"
                      aria-label="Edit color palette"
                      title="Edit palette"
                      onClick={() => setPaletteEditorOpen(true)}
                    >
                      <PencilIcon />
                    </button>
                </div>
              </div>

              <div className="settings-color-group">
                <p className="settings-color-caption">Background</p>
                <div
                  className="settings-color-row"
                  aria-label="Background color — flowing atmosphere wash"
                >
                  <div
                    className="settings-swatches is-full-palette"
                    role="listbox"
                    aria-label="Background color"
                  >
                    {paletteColors.map((c, ci) => {
                      if (ci > 0 && hiddenSlots.bg.has(ci - 1)) return null
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
                  <span className="settings-photo-wrap">
                    <button
                      type="button"
                      className="settings-palette-edit"
                      aria-label="Background photo"
                      title="Background photo"
                      onClick={() => galleryInputRef.current?.click()}
                    >
                      <ImageIcon />
                    </button>
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={onPhotoFile}
                    />
                  </span>
                </div>
              </div>

            </div>
          </div>


        </Section>

        <Section label="Size and glass" className="is-sliders">
          <div className="settings-block settings-slider-block">
                <div
                  className="settings-glass-slider"
                  style={{ '--pull': barTransparency / 100 }}
                >
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
                    aria-label="Container glass from Opaque to Clear"
                  />
                  <div className="settings-slider-ends">
                    <span>Opaque</span>
                    <span>Clear</span>
                  </div>
                </div>
                <div
                  className="settings-glass-slider"
                  style={{ '--pull': (uiScale - 85) / 45 }}
                >
                  <input
                    className="settings-slider"
                    type="range"
                    min={85}
                    max={130}
                    value={uiScale}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      setUiScale(next)
                      applyUiScale(next)
                    }}
                    aria-label="Text and button size"
                  />
                  <div className="settings-slider-ends">
                    <span>Small</span>
                    <span>Large</span>
                  </div>
                </div>
                <div
                  className="settings-glass-slider"
                  style={{ '--pull': containerEdge / 100 }}
                >
                  <input
                    className="settings-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={containerEdge}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      setContainerEdge(next)
                      applyContainerEdge(next)
                    }}
                    aria-label="Container height from Short to Tall"
                  />
                  <div className="settings-slider-ends">
                    <span>Short</span>
                    <span>Tall</span>
                  </div>
                </div>
                <div
                  className="settings-glass-slider"
                  style={{ '--pull': brightness / 100 }}
                >
                  <input
                    className="settings-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={brightness}
                    onChange={(event) => {
                      const next = applyBrightness(Number(event.target.value))
                      setBrightness(next)
                    }}
                    aria-label="App brightness from Dim to Bright"
                  />
                  <div className="settings-slider-ends">
                    <span>Dim</span>
                    <span>Bright</span>
                  </div>
                </div>
          </div>
        </Section>

    </>
  )

  const shopTools = (
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

  )

  return (
    <div
      className={`settings-screen${helpPage === 'help' ? ' is-assistant-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="settings-scroll">
      <header className="settings-top">
        <button
          type="button"
          className="settings-back is-bare"
          aria-label="Back to profile"
          onClick={onBack}
        >
          <BackIcon />
        </button>
        <h1 className="settings-title">Settings</h1>
        <span className="settings-top-spacer" aria-hidden />
      </header>
      <div className="settings-columns">
      <div className="settings-column">
        <Section label="Account Settings" className="is-profile-controls">
          <Row
            icon={<ProfileIcon />}
            title="Profile"
            onClick={onEditProfile}
          />
          <button
            type="button"
            className="settings-theme-toggle is-bare"
            aria-label={moonlightOn ? 'Switch to normal mode' : 'Switch to moon mode'}
            aria-pressed={moonlightOn}
            onClick={toggleDisplayMode}
          >
            <svg className="settings-row-ico" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" />
            </svg>
          </button>
        </Section>

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

        <Section label="Links">
          <Row icon={<AtIcon />} title="Links" onClick={onEditLinks} />
        </Section>

        <Section label="Money" className="is-side-by-side">
          <Row icon={<svg className="settings-row-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" d="M4 10h16M5.5 10v7.5M9.5 10v7.5M14.5 10v7.5M18.5 10v7.5M3.5 18.5h17M12 4.2 20 9H4l8-4.8z" /></svg>} title="Money" onClick={onEditMoney} />
          <div className="settings-divider" aria-hidden />
          <Row
            icon={<svg className="settings-row-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" d="M3 6.5h10.5V16H3zM13.5 9.5h4l3 3V16h-7M7 18.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zM17 18.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z" /></svg>}
            title="Orders"
            iconOnly
            onClick={onOpenOrders}
          />
        </Section>

        <Section label="Help & Support" className="is-side-by-side">
          <Row icon={<PlayIcon />} title="Introduction" iconOnly onClick={() => setHelpPage('started')} />
          <div className="settings-divider" aria-hidden />
          <Row icon={<HelpIcon />} title="Q&A" iconOnly onClick={openHelpAssistant} />
        </Section>

      </div>
      <div className="settings-column is-customization">
        {customizationSections}
      </div>
      </div>

        {shopTools}

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
            className={`glass-sheet-card${sheet === 'size' ? ` is-size-sheet${sizeGarment ? '' : ' is-size-wheel'}${sizeSummary ? ' is-size-summary-page' : ''}${sizeSummary && !sheetDraft.gender ? ' is-gender-gate' : ''}` : ''}`}
            ref={sheet === 'size' ? sizeSheetCardRef : undefined}
          >
            <div className="glass-sheet-head">
              {SHEET_COPY[sheet].title ? (
                <h2 className="glass-sheet-title">{SHEET_COPY[sheet].title}</h2>
              ) : (
                <h2 className="glass-sheet-title" aria-hidden="true" />
              )}
              {!(sheet === 'shipping' && !addrEditing) && (
              <button
                type="button"
                className="glass-overlay-icon-btn"
                aria-label="Close"
                onClick={() =>
                  sheet === 'shipping' && addrStep > 0
                    ? setAddrStep(addrStep - 1)
                    : sheet === 'size' && sizeGarment
                    ? sizePicked
                      ? setSizePicked(null)
                      : (setSizeGarment(null),
                        sizeFromSummary && setSizeSummary(true),
                        setSizeFromSummary(false))
                    : setSheet(null)
                }
              >
                <BackIcon />
              </button>
              )}
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
                    {sizeGarment ? (
                      (() => {
                        const cat = allGarments.find((g) => g.id === sizeGarment)
                        if (!cat) return null
                        const rawSel = sheetDraft.clothingSizes?.[cat.id]
                        const selectedList = Array.isArray(rawSel)
                          ? rawSel
                          : rawSel
                            ? [rawSel]
                            : []
                        const base = sizesForCategory(cat.id)
                        const options = [
                          ...base,
                          ...selectedList.filter((x) => !base.includes(x)),
                        ]
                        const total = options.length
                        const longest = Math.max(
                          0,
                          ...options.map((o) => String(o).length),
                        )
                        const maxCols = longest > 4 ? 3 : 4
                        const sizeCols = Math.ceil(
                          total /
                            (total <= Math.min(4, maxCols)
                              ? 1
                              : Math.max(2, Math.ceil(total / maxCols))),
                        )
                        const commitCustom = () => {
                          const v = (customSize || '').trim()
                          if (v) setCategorySize(cat.id, v)
                          setCustomSize(null)
                        }
                        const peek = sizePeek ? (
                          <div className="settings-size-peek" aria-hidden>
                            {sizePeek}
                          </div>
                        ) : null
                        if (sizePicked) {
                          return (
                            <OrbitCarousel
                              variant="wheel"
                              compact
                              smooth
                              className={`settings-size-wheel is-picked${selectedList.includes(sizePicked) ? ' is-chosen' : ''}`}
                              items={options.map((o) => ({ id: o, label: String(o) }))}
                              activeId={sizePicked}
                              onSelect={setSizePicked}
                              onActivate={(id) => setCategorySize(cat.id, id)}
                              ariaLabel={`${cat.label} size`}
                              prevLabel="Previous size"
                              nextLabel="Next size"
                            />
                          )
                        }
                        return (
                          <div className="settings-size-cat">
                            {peek}
                            <p className="settings-size-section-label">
                              {cat.label}
                            </p>
                            <div
                              className="settings-size-chips is-even"
                              role="listbox"
                              aria-label={`${cat.label} size`}
                              style={{
                                '--size-cols': sizeCols,
                                '--size-len': longest,
                              }}
                            >
                              {options.map((sz) => (
                                <button
                                  key={sz}
                                  type="button"
                                  role="option"
                                  aria-selected={selectedList.includes(sz)}
                                  className={`settings-size-chip${selectedList.includes(sz) ? ' is-on' : ''}`}
                                  onPointerDown={() => {
                                    peekFiredRef.current = false
                                    window.clearTimeout(peekTimerRef.current)
                                    peekTimerRef.current = window.setTimeout(() => {
                                      peekFiredRef.current = true
                                      setSizePicked(sz)
                                    }, 350)
                                  }}
                                  onPointerUp={() => {
                                    window.clearTimeout(peekTimerRef.current)
                                    setSizePeek(null)
                                  }}
                                  onPointerCancel={() => {
                                    window.clearTimeout(peekTimerRef.current)
                                    setSizePeek(null)
                                  }}
                                  onPointerLeave={() => {
                                    window.clearTimeout(peekTimerRef.current)
                                    setSizePeek(null)
                                  }}
                                  onContextMenu={(e) => e.preventDefault()}
                                  onClick={() => {
                                    if (peekFiredRef.current) {
                                      peekFiredRef.current = false
                                      return
                                    }
                                    setCategorySize(cat.id, sz)
                                  }}
                                >
                                  {sz}
                                </button>
                              ))}
                              {customSize === null ? (
                                <button
                                  type="button"
                                  className="settings-size-chip settings-size-add"
                                  aria-label="Add size"
                                  style={
                                    options.length % sizeCols === 0
                                      ? { gridColumn: '1 / -1' }
                                      : undefined
                                  }
                                  onClick={() => setCustomSize('')}
                                >
                                  +
                                </button>
                              ) : (
                                <input
                                  className="settings-size-chip settings-size-add-input is-inline"
                                  autoFocus
                                  value={customSize}
                                  maxLength={12}
                                  enterKeyHint="done"
                                  style={
                                    options.length % sizeCols === 0
                                      ? { gridColumn: '1 / -1', justifySelf: 'center' }
                                      : undefined
                                  }
                                  onChange={(e) => setCustomSize(e.target.value)}
                                  onBlur={commitCustom}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur()
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        )
                      })()
                    ) : sizeSummary ? (
                      <div className="settings-size-drum-col">
                      <button
                        type="button"
                        className="settings-size-gender is-bare"
                        onPointerDown={(e) => {
                          const y0 = e.clientY
                          let drum = null
                          let base = 0
                          const stop = () => {
                            window.clearTimeout(genderTimerRef.current)
                            window.removeEventListener('pointermove', mv)
                            window.removeEventListener('pointerup', up)
                            window.removeEventListener('pointercancel', up)
                          }
                          const mv = (ev) => {
                            if (!drum) return
                            const k = (drum.scrollHeight - drum.clientHeight) / 160
                            drum.scrollTop = base + (ev.clientY - y0) * k
                          }
                          const up = (ev) => {
                            stop()
                            if (!drum) return
                            const g = ev.type === 'pointerup'
                              ? drum.querySelector('.gender-drum-row.is-hot')?.dataset.opt
                              : null
                            if (g) setSheetDraft((d) => {
                              const by = { ...(d.sizesByGender || {}) }
                              if (d.gender) by[d.gender] = d.clothingSizes || {}
                              return {
                                ...d,
                                gender: g,
                                sizesByGender: by,
                                clothingSizes: by[g]
                                  ? { ...by[g] }
                                  : d.gender
                                    ? {}
                                    : d.clothingSizes || {},
                              }
                            })
                            setGenderOpen(false)
                          }
                          window.addEventListener('pointermove', mv)
                          window.addEventListener('pointerup', up)
                          window.addEventListener('pointercancel', up)
                          genderTimerRef.current = window.setTimeout(() => {
                            setGenderOpen(true)
                            navigator.vibrate?.(8)
                            window.setTimeout(() => {
                              drum = document.querySelector('.gender-drum')
                              if (!drum) return
                              drum.style.scrollSnapType = 'none'
                              base = drum.scrollTop
                            }, 30)
                          }, 300)
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {sheetDraft.gender || 'Gender'}
                      </button>
                      {genderOpen && (
              <div className="gender-overlay">
                <GenderDrum
                  options={allGenders}
                  value={sheetDraft.gender || ''}
                  onPick={(g) => {
                    setSheetDraft((d) => {
                              const by = { ...(d.sizesByGender || {}) }
                              if (d.gender) by[d.gender] = d.clothingSizes || {}
                              return {
                                ...d,
                                gender: g,
                                sizesByGender: by,
                                clothingSizes: by[g]
                                  ? { ...by[g] }
                                  : d.gender
                                    ? {}
                                    : d.clothingSizes || {},
                              }
                            })
                    setGenderOpen(false)
                  }}
                />
              </div>
            )}
                      <div className="settings-size-wheelbox">
                      <div
                        className="settings-size-summary"
                        ref={summaryListRef}
                        onScroll={() => setConfirmRemove(null)}
                      >
                        {[...allGarments]
                          .sort((a, b) => a.label.length - b.label.length)
                          .map((g) => (
                          <div
                            key={g.id}
                            className="settings-size-summary-row"
                          >
                            <button
                              type="button"
                              data-gid={g.id}
                              className="settings-size-summary-label is-bare"
                              onClick={() => {
                                setSizeSummary(false)
                                setSizeFromSummary(true)
                                setSizeGarment(g.id)
                              }}
                            >
                              {g.label}
                            </button>
                            <strong data-gid={g.id} className="settings-size-summary-sizes">
                              {[].concat(sheetDraft.clothingSizes?.[g.id] || []).map((sz) => (
                                <span key={sz}>{sz}</span>
                              ))}
                            </strong>
                          </div>
                        ))}
                      </div>
                      </div>
                      </div>
                    ) : (
                      <div
                        className="settings-size-wheel-hold"
                        onPointerDown={(e) => {
                          const r = summaryPressRef.current
                          r.fired = false
                          r.x = e.clientX
                          r.y = e.clientY
                          window.clearTimeout(r.timer)
                          r.timer = window.setTimeout(() => {
                            r.fired = true
                            setSizeSummary(true)
                          }, 450)
                        }}
                        onPointerMove={(e) => {
                          const r = summaryPressRef.current
                          if (
                            Math.abs(e.clientX - r.x) > 8 ||
                            Math.abs(e.clientY - r.y) > 8
                          )
                            window.clearTimeout(r.timer)
                        }}
                        onPointerUp={() =>
                          window.clearTimeout(summaryPressRef.current.timer)
                        }
                        onPointerCancel={() =>
                          window.clearTimeout(summaryPressRef.current.timer)
                        }
                        onContextMenu={(e) => e.preventDefault()}
                        onClickCapture={(e) => {
                          if (summaryPressRef.current.fired) {
                            summaryPressRef.current.fired = false
                            e.stopPropagation()
                          }
                        }}
                      >
                      <OrbitCarousel
                        variant="wheel"
                        compact
                        smooth
                        className="settings-size-wheel"
                        items={SIZE_GARMENTS.map((g) => ({ id: g.id, label: g.label }))}
                        activeId={sizeWheelId}
                        onSelect={setSizeWheelId}
                        onActivate={setSizeGarment}
                        ariaLabel="Garments"
                        prevLabel="Previous garment"
                        nextLabel="Next garment"
                      />
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : sheet === 'shipping' && !addrEditing ? (
              <div className="settings-addr-wrap">
                <div className="settings-addr-card">
                  <span className="settings-addr-text">
                    {userProfile?.shippingAddress}
                  </span>
                </div>
                <button
                  type="button"
                  className="settings-addr-reset is-bare"
                  aria-label="Reset location"
                  onClick={() => {
                    setSheetDraft((d) => ({ ...d, address: '', city: '', state: '', zip: '' }))
                    setAddrStep(0)
                    setAddrEditing(true)
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M17.2 9A6.4 6.4 0 1 0 18.4 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M17.6 4.8V9h-4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ) : (
              SHEET_COPY[sheet].fields
                .filter((_, i) => sheet !== 'shipping' || i === addrStep)
                .map((f) => (
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
            {sheet === 'size' && sizeSummary && sheetDraft.gender && (
              <button
                type="button"
                className="glass-sheet-add is-bare"
                aria-label="Add gender or category"
                onClick={() => setAddNew({ kind: null, text: '' })}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
            {sheet === 'size' && wizStep !== null && sizeSummary && (() => {
              const steps = ['age', 'height', 'sex', 'gender']
              const kind = steps[wizStep]
              const label = ADD_KINDS.find(([k]) => k === kind)?.[1]
              const options =
                kind === 'age'
                  ? PRESET_AGES
                  : kind === 'height'
                    ? PRESET_HEIGHTS
                    : kind === 'sex'
                      ? PRESET_SEX
                      : kind === 'gender'
                        ? [...allGenders, ...PRESET_GENDERS.filter((x) => !allGenders.includes(x))]
                      : PRESET_CATEGORIES.filter(
                          (x) => !allGarments.some((g) => g.label === x),
                        )
              const next = () => {
                const hot = document.querySelector(
                  '.settings-new-page .gender-drum-row.is-hot',
                )?.dataset.opt
                if (!hot) return
                if (kind === 'age' || kind === 'height' || kind === 'sex') {
                  setSheetDraft((d) => ({ ...d, [kind]: hot }))
                } else if (kind === 'gender') {
                  setSheetDraft((d) => {
                    const by = { ...(d.sizesByGender || {}) }
                    if (d.gender) by[d.gender] = d.clothingSizes || {}
                    const custom = allGenders.includes(hot)
                      ? d.customGenders || []
                      : [...(d.customGenders || []), hot]
                    return {
                      ...d,
                      gender: hot,
                      customGenders: custom,
                      sizesByGender: by,
                      clothingSizes: by[hot] ? { ...by[hot] } : d.clothingSizes || {},
                    }
                  })
                } else if (!allGarments.some((g) => g.label === hot)) {
                  setSheetDraft((d) => ({
                    ...d,
                    customCategories: [
                      ...(d.customCategories || []),
                      { id: `custom-${Date.now().toString(36)}`, label: hot },
                    ],
                  }))
                }
                setWizStep(wizStep >= 3 ? null : wizStep + 1)
              }
              return (
                <div className="settings-new-page settings-wiz-page">
                  <div className="settings-new-kinds">
                    <span className="settings-wiz-title">{label}</span>
                  </div>
                  <div className="settings-new-drum">
                    <GenderDrum
                      key={kind}
                      value={sheetDraft[kind] || (kind === 'age' ? '25' : kind === 'height' ? '5\'9"' : '')}
                      options={options}
                      onPick={(x) =>
                        document
                          .querySelector(`.settings-new-page [data-opt="${CSS.escape(x)}"]`)
                          ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                      }
                    />
                  </div>
                  <div className="settings-new-actions">
                    <button
                      type="button"
                      className="is-bare"
                      aria-label="Back"
                      onClick={() => (wizStep === 0 ? setSheet(null) : setWizStep(wizStep - 1))}
                    >
                      <BackIcon />
                    </button>
                    <button type="button" className="is-bare" aria-label="Next" onClick={next}>
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })()}
            {sheet === 'size' && sizeSummary && sheetDraft.gender && wizStep === null && (
              <button
                type="button"
                className="glass-sheet-minus is-bare"
                aria-label="Remove"
                onClick={() => {
                  const gid = summaryListRef.current?.querySelector(
                    '.settings-size-summary-row.is-hot [data-gid]',
                  )?.dataset.gid
                  setConfirmRemove((c) => (c || !gid ? null : gid))
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
            {sheet === 'size' && sizeSummary && wizStep === null && !addNew && (
              <button
                type="button"
                className="settings-size-reset is-bare"
                aria-label="Reset"
                onClick={() => setConfirmSizeReset(true)}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M17.2 9A6.4 6.4 0 1 0 18.4 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M17.6 4.8V9h-4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            {confirmSizeReset && (
              <div
                className="settings-size-reset-confirm-pop"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="settings-size-reset-confirm-title"
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) setConfirmSizeReset(false)
                }}
              >
                <div className="settings-size-reset-confirm-card">
                  <p id="settings-size-reset-confirm-title">
                    Are you sure you want to reset the sizes?
                  </p>
                  <div className="settings-size-reset-confirm-actions">
                    <button
                      type="button"
                      className="is-bare"
                      aria-label="Cancel reset"
                      autoFocus
                      onClick={() => setConfirmSizeReset(false)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="is-bare"
                      aria-label="Confirm reset sizes"
                      onClick={resetSizes}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
            {confirmRemove && (
                        <div className="settings-remove-pop">
                        <div className="settings-remove-confirm">
                          <svg className="settings-remove-trash" viewBox="0 0 24 24" aria-hidden>
                            <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
                          </svg>
                          <span className="settings-remove-title">
                            {allGarments.find((g) => g.id === confirmRemove)?.label}
                          </span>
                          <div className="settings-remove-btns">
                          <button
                            type="button"
                            className="is-bare"
                            aria-label="Cancel"
                            onClick={() => setConfirmRemove(null)}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden>
                              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="is-bare"
                            aria-label="Remove category"
                            onClick={() => {
                              const gid = confirmRemove
                              setSheetDraft((d) => {
                                const cs = { ...(d.clothingSizes || {}) }
                                delete cs[gid]
                                return {
                                  ...d,
                                  clothingSizes: cs,
                                  customCategories: (d.customCategories || []).filter((c) => c.id !== gid),
                                  hiddenCategories: [...new Set([...(d.hiddenCategories || []), gid])],
                                }
                              })
                              setConfirmRemove(null)
                            }}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden>
                              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                          </div>
                        </div>
                      )}
            {sheet === 'size' && addNew && (
              <div className={`settings-new-page${addNew.kind ? ' has-kind' : ''}`}>
                <div className="settings-new-kinds">
                  {ADD_KINDS.map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      className={`is-bare${addNew.kind === k ? ' is-on' : ''}`}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => setAddNew((a) => ({ ...a, kind: k }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {addNew.kind && (
                  <div className="settings-new-drum">
                    <GenderDrum
                      key={addNew.kind}
                      value={sheetDraft[addNew.kind] || ''}
                      options={
                        addNew.kind === 'age'
                          ? PRESET_AGES
                          : addNew.kind === 'sex'
                            ? PRESET_SEX
                            : addNew.kind === 'height'
                              ? PRESET_HEIGHTS
                              : addNew.kind === 'gender'
                                ? allGenders
                                : PRESET_CATEGORIES.filter(
                                    (x) => !allGarments.some((g) => g.label === x),
                                  )
                      }
                      onPick={(x) =>
                        document
                          .querySelector(`.settings-new-page [data-opt="${CSS.escape(x)}"]`)
                          ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                      }
                    />
                  </div>
                )}
                <div className="settings-new-actions">
                  <button
                    type="button"
                    className="is-bare"
                    aria-label="Back"
                    onClick={() => setAddNew(null)}
                  >
                    <BackIcon />
                  </button>
                  {addNew.kind && (
                    <button
                      type="button"
                      className="is-bare"
                      aria-label="Add"
                      onClick={() => {
                        const hot = document.querySelector(
                          '.settings-new-page .gender-drum-row.is-hot',
                        )?.dataset.opt
                        if (hot) commitAddNew(hot)
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
            {sheet !== 'size' ||
            Object.values(sheetDraft.clothingSizes || {}).some(Boolean) ? (
            <button
              type="button"
              className="glass-sheet-plus is-bare"
              aria-label="Save"
              disabled={saveBusy}
              onClick={() =>
                sheet === 'shipping' && !addrEditing
                  ? setSheet(null)
                  : sheet === 'shipping' && addrStep < 3
                    ? setAddrStep(addrStep + 1)
                    : saveSheet()
              }
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            ) : null}
          </div>
        </div>
      )}

      {helpPage === 'help' && (
        <div
          className="glass-overlay settings-help-page is-assistant is-started"
          role="dialog"
          aria-modal="true"
          aria-label="Q&A"
        >
          <div className="settings-started-atmosphere" aria-hidden>
            <span className="settings-started-bloom settings-started-bloom-a" />
            <span className="settings-started-bloom settings-started-bloom-b" />
            <span className="settings-started-bloom settings-started-bloom-c" />
            <span className="settings-started-bloom settings-started-bloom-d" />
          </div>
          <header className="glass-overlay-top settings-assistant-top">
            <button
              type="button"
              className="glass-overlay-back is-bare"
              aria-label="Back"
              onClick={() => setHelpPage(null)}
            >
              <BackIcon />
            </button>
            <h2 className="glass-overlay-title">Q&A</h2>
            <span className="glass-overlay-spacer" aria-hidden />
          </header>
          <div
            ref={assistantListRef}
            className="settings-assistant-thread"
            role="log"
            aria-live="polite"
          >
            <div className="settings-assistant-bubble is-assistant settings-assistant-opener">
              <p className="settings-assistant-ask">{ASSISTANT_ASK}</p>
              <div className="settings-assistant-prompts">
                {ASSISTANT_PROMPTS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="settings-assistant-prompt is-bare"
                    onClick={() => askAssistant(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
            {assistantMessages.map((msg) => (
              <div
                key={msg.id}
                className={`settings-assistant-bubble is-${msg.role}`}
              >
                {msg.text}
              </div>
            ))}
          </div>
          <div
            className="settings-assistant-dock"
            onFocus={() =>
              [0, 120, 300, 600].forEach((ms) =>
                setTimeout(() => {
                  const el = assistantListRef.current
                  if (el) el.scrollTop = el.scrollHeight
                }, ms),
              )
            }
          >
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
          <div className="glass-overlay-body settings-help-body">
          <header className="glass-overlay-top">
            <button
              type="button"
              className="glass-overlay-back is-bare"
              aria-label="Back"
              onClick={() => setHelpPage(null)}
            >
              <BackIcon />
            </button>
            <h2 className="glass-overlay-title">{HELP_PAGES[helpPage].title}</h2>
            <span className="glass-overlay-spacer" aria-hidden />
          </header>
            {helpPage === 'started' ? (
              <article className="settings-started">
                {HELP_PAGES.started.intro ? (
                  <p className="settings-started-intro">{HELP_PAGES.started.intro}</p>
                ) : null}
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
        <StageSlot>
          <div className="settings-idme-popup" role="dialog" aria-modal="true" aria-label="Link ID.me">
            <button
              type="button"
              className="settings-idme-scrim"
              aria-label="Dismiss"
              onClick={() => setIdmeOpen(false)}
            />
            <div className="settings-idme-card">
              <button
                type="button"
                className="settings-idme-close"
                aria-label="Close"
                onClick={() => setIdmeOpen(false)}
              >
                <CloseIcon />
              </button>
              <div className="settings-idme-brand">
                <span className="settings-idme-mark" aria-hidden>
                  ID
                </span>
                <div>
                  <p className="settings-idme-title">ID.me</p>
                  <p className="settings-idme-sub">Link your ID.me account</p>
                </div>
              </div>
              <p className="settings-idme-copy">
                Thrft uses ID.me to confirm it is you. We store that the account is linked — not your ID photos.
              </p>

              {identityStatus === 'verified' || idmeStep === 'done' ? (
                <>
                  <p className="settings-idme-status is-verified">ID.me linked</p>
                  <p className="settings-idme-copy">
                    {legalName || identityEmail || 'Your ID.me account is linked to this Thrft account.'}
                  </p>
                  {legalName && identityEmail ? (
                    <p className="settings-idme-sub">{identityEmail}</p>
                  ) : null}
                  {identityRef ? (
                    <p className="settings-idme-code">{identityRef}</p>
                  ) : null}
                  <button
                    type="button"
                    className="settings-idme-unlink"
                    disabled={idBusy}
                    onClick={unlinkIdmeAccount}
                  >
                    {idBusy ? 'Unlinking…' : 'Unlink ID.me'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="settings-idme-official"
                    disabled={idBusy || idmeCfg?.configured === false}
                    onClick={beginIdmeOAuth}
                  >
                    {idBusy || idmeStep === 'connecting' ? 'Opening ID.me…' : 'Verify with ID.me'}
                  </button>
                  {idmeCfg?.configured === false ? (
                    <p className="settings-idme-sub">
                      ID.me linking is not connected on this server yet.
                    </p>
                  ) : null}
                  {idmeError ? (
                    <p className="settings-idme-sub" role="alert">{idmeError}</p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </StageSlot>
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
              <div className="settings-palette-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={paletteTarget === 'app'}
                  className={`settings-palette-tab${paletteTarget === 'app' ? ' is-active' : ''}`}
                  onClick={() => setPaletteTarget('app')}
                >
                  Container
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={paletteTarget === 'bg'}
                  className={`settings-palette-tab${paletteTarget === 'bg' ? ' is-active' : ''}`}
                  onClick={() => setPaletteTarget('bg')}
                >
                  Background
                </button>
              </div>
              <button
                type="button"
                className="glass-overlay-icon-btn"
                aria-label="Close"
                onClick={() => setPaletteEditorOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
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
                      className={`settings-palette-edit-dot${blankSlots.has(index) ? ' is-blank' : ''}`}
                      style={blankSlots.has(index) ? undefined : { background: c.swatch }}
                    />
                  </button>
                ))}
                  <button
                    type="button"
                    className="settings-palette-icon-btn is-grid-cell"
                    aria-label="Reset palette"
                    onClick={() => {
                      setBlankSlots(new Set(Array.from({ length: 11 }, (_, i) => i)))
                      setPaletteResetPending(true)
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path d="M19.5 12a7.5 7.5 0 11-2.4-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M19.8 3.8v4.4h-4.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
            </div>
            <div className="settings-palette-actions">
              <button
                type="button"
                className="settings-palette-icon-btn"
                aria-label="Done"
                onClick={() => {
                  saveHiddenSlots(paletteTarget, blankSlots)
                  if (paletteResetPending) {
                    if (paletteTarget === 'bg') chooseBgColor('none')
                    else chooseAppColor('none')
                  }
                  setPaletteEditorOpen(false)
                  setPaletteResetPending(false)
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {wheelOpen &&
        createPortal(
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
          <div
            className="home-search-blur settings-wheel-tint"
            aria-hidden
            style={{ '--search-tint': wheelHex }}
          />
          <button
            type="button"
            className="glass-sheet-scrim"
            aria-label="Dismiss"
            onClick={() => setWheelOpen(false)}
          />
          <div className="glass-sheet-card settings-wheel-card">
            <div className="glass-sheet-head">
              {wheelTarget !== 'palette' && (
                <div className="settings-palette-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={wheelTarget === 'app'}
                    className={`settings-palette-tab${wheelTarget === 'app' ? ' is-active' : ''}`}
                    onClick={() => openWheel('app')}
                  >
                    Container
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={wheelTarget === 'bg'}
                    className={`settings-palette-tab${wheelTarget === 'bg' ? ' is-active' : ''}`}
                    onClick={() => openWheel('bg')}
                  >
                    Background
                  </button>
                </div>
              )}
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
              <span
                className="settings-wheel-knob"
                aria-hidden
                style={{
                  left: `calc(50% + (50% - 6px) * ${Math.cos((wheelHsv.h * Math.PI) / 180) * wheelHsv.s})`,
                  top: `calc(50% + (50% - 6px) * ${Math.sin((wheelHsv.h * Math.PI) / 180) * wheelHsv.s})`,
                  background: wheelHex,
                }}
              />
            </div>

            <label
              className="settings-wheel-tone"
              style={{ '--tone-hi': hsvToHex(wheelHsv.h, wheelHsv.s, 1) }}
            >
              <input
                type="range"
                min="0"
                max="100"
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
                onPointerUp={() => rememberColor(wheelHexRef.current)}
              />
            </label>

            <div className="settings-wheel-preview-row">
              <span className="settings-wheel-preview" style={{ background: wheelHex }} />
              <input
                className="settings-wheel-hex"
                aria-label="Hex color"
                maxLength={7}
                spellCheck={false}
                autoCapitalize="characters"
                autoCorrect="off"
                value={hexDraft ?? wheelHex}
                onChange={(e) => {
                  let t = e.target.value.trim()
                  if (t && !t.startsWith('#')) t = `#${t}`
                  setHexDraft(t.toUpperCase())
                  if (/^#[0-9a-f]{6}$/i.test(t)) {
                    setWheelHsv(hexToHsv(t))
                    applyWheelHex(t.toLowerCase())
                  }
                }}
                onBlur={() => {
                  setHexDraft(null)
                  rememberColor(wheelHexRef.current)
                }}
              />
            </div>

            <div className="settings-recent" aria-label="Recent colors">
              <p className="settings-recent-caption">Recent</p>
              <div className="settings-recent-row" role="listbox" aria-label="8 most recent colors">
                {Array.from({ length: 8 }, (_, i) => {
                  const hex = recentColors[i]
                  const selected = Boolean(hex) && hex === wheelHex
                  return (
                    <button
                      key={hex || `recent-empty-${i}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`settings-recent-swatch${hex ? '' : ' is-empty'}${selected ? ' is-selected' : ''}`}
                      style={hex ? { background: hex } : undefined}
                      disabled={!hex}
                      aria-label={hex ? `Recent color ${hex}` : 'Empty recent color'}
                      onClick={() => {
                        if (!hex) return
                        setWheelHsv(hexToHsv(hex))
                        applyWheelHex(hex)
                        rememberColor(hex)
                      }}
                    />
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              className="home-search-done settings-wheel-done"
              aria-label="Done"
              onClick={() => {
                if (wheelTargetRef.current === 'palette') applyWheelHex(wheelHex)
                rememberColor(wheelHex)
                setWheelOpen(false)
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>,
        document.body,
        )}
    </div>
  )
}
