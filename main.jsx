import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { BagProvider } from './BagContext.jsx'
import { initAppearance } from './appAppearance.js'
import { viewportOffset } from './viewportOffset.js'
import './index.css'
import './liquidGlass.css'

initAppearance()

let maxHeight = 0
let lastLandscape = null

const DOCKED = '.chat-compose, .chat-bottom-dock, .chat-users-dock, .saved-search-dock, .brand-globe-search-row, .closet-number-brand-search, .settings-assistant-dock, .settings-size-add-dock'
let lastKb = 0
let kbShift = 0

function fitScreen() {
  const vv = window.visualViewport
  const width = Math.round(vv?.width || window.innerWidth)
  const landscape = window.innerWidth > window.innerHeight
  // New orientation: forget the old maximum
  if (landscape !== lastLandscape) {
    lastLandscape = landscape
    maxHeight = 0
  }
  // iOS can leave visualViewport / innerHeight short after the keyboard or toolbar
  // closes (empty band at the bottom).
  const measured = Math.round(
    Math.max(vv?.height || 0, window.innerHeight, document.documentElement.clientHeight),
  )
  const standalone =
    window.navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches
  const screenH = landscape
    ? Math.min(window.screen.width, window.screen.height)
    : Math.max(window.screen.width, window.screen.height)
  maxHeight = Math.max(maxHeight, measured, standalone ? screenH : 0)
  // In a browser tab the toolbar legitimately changes the height; only the
  // installed app keeps the largest value.
  // The keyboard shrinks the viewport; keep the full-height background behind it.
  const kbOpen = vv ? window.innerHeight - vv.height > 120 || measured < maxHeight - 120 : false
  const height = standalone || kbOpen ? maxHeight : measured
  // Never follow the visual viewport's offset: the keyboard must not slide the page.
  const top = 0
  const left = 0
  if (window.scrollY || window.scrollX || (vv && vv.offsetTop > 0)) window.scrollTo(0, 0)
  const root = document.documentElement
  // Keyboard height: the page stays put and docked bars ride above the keyboard.
  const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height)) : 0
  // iOS pans the visual viewport to reveal the field; pin the app to it so nothing appears to move.
  const app = document.getElementById('root')
  const dy = viewportOffset({
    editing: isTextField(document.activeElement),
    keyboardHeight: kb,
    offsetTop: vv?.offsetTop,
    keyboardShift: kbShift,
  })
  if (app) app.style.transform = dy ? `translateY(${dy}px)` : ''
  if (kb > 120) lastKb = kb
  const focusedField = document.activeElement?.closest?.(DOCKED)
  root.style.setProperty('--kb-height', `${kb > 120 ? kb : focusedField && lastKb ? lastKb : 0}px`)
  root.style.setProperty('--app-height', `${height}px`)
  root.style.setProperty('--app-width', `${width}px`)
  root.style.setProperty('--app-top', `${top}px`)
  root.style.setProperty('--app-left', `${left}px`)
}

// iOS leaves the page scrolled up after the keyboard closes; snap it back down
// while the keyboard animation finishes.
function resetPage() {
  ;[0, 100, 250, 450, 700].forEach((ms) =>
    setTimeout(() => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      fitScreen()
    }, ms),
  )
}
function isTextField(t) {
  return (
    t instanceof HTMLTextAreaElement ||
    (t instanceof HTMLInputElement && /^(text|search|email|password|url|tel|number)$/i.test(t.type))
  )
}

// Fields outside the chat bar: lift the page just enough to keep the field above the keyboard.
function liftForKeyboard(el) {
  const vv = window.visualViewport
  const keyboardVisible = vv && window.innerHeight - vv.height > 120
  // Only anticipate a software keyboard on touch-primary devices.
  if (
    !el ||
    el.closest(DOCKED) ||
    (!window.matchMedia('(pointer: coarse)').matches && !keyboardVisible)
  ) {
    kbShift = 0
    return
  }
  const r = el.getBoundingClientRect()
  const visibleBottom = window.innerHeight - (lastKb || 346)
  const need = r.bottom + kbShift + 16 - visibleBottom
  const room = r.top + kbShift - 70
  kbShift = Math.max(0, Math.round(Math.min(need, room)))
  fitScreen()
}

// Move things above the keyboard *before* focusing so iOS sees the field as
// already visible and never pans the page.
document.addEventListener(
  'touchstart',
  (e) => {
    const t = e.target
    if (!isTextField(t) || document.activeElement === t) return
    e.preventDefault()
    if (t.closest(DOCKED)) {
      document.documentElement.style.setProperty('--kb-height', `${lastKb || 346}px`)
    } else {
      liftForKeyboard(t)
    }
    t.focus({ preventScroll: true })
    setTimeout(fitScreen, 350)
  },
  { passive: false },
)
document.addEventListener('focusin', (e) => {
  const t = e.target
  if (isTextField(t) && !t.closest(DOCKED)) liftForKeyboard(t)
})
document.addEventListener('focusout', (e) => {
  const t = e.target
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
    kbShift = 0
    resetPage()
  }
})

fitScreen()
window.addEventListener('resize', fitScreen)
window.addEventListener('orientationchange', fitScreen)
window.visualViewport?.addEventListener('resize', fitScreen)
window.visualViewport?.addEventListener('scroll', fitScreen)
window.addEventListener('pageshow', fitScreen)
window.addEventListener('touchend', () => setTimeout(fitScreen, 250), { passive: true })
window.addEventListener('load', fitScreen)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BagProvider>
      <App />
    </BagProvider>
  </StrictMode>,
)

// Safari paints its status/toolbar areas from theme-color: match it to the top of the page as it is drawn
{
  const root = document.documentElement
  // Resolve the page colour through the cascade: moonlight overrides the inline tokens with !important
  const probe = document.createElement('i')
  probe.hidden = true
  document.body.appendChild(probe)
  const syncThemeColor = () => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta || root.dataset.bgPhoto) return
    probe.style.color = 'var(--atmosphere-base, #050505)'
    const base = getComputedStyle(probe).color.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [5, 5, 5]
    // The stage dims its wash 20%, and the brightness overlay (body::after) dims everything above it
    const dim = Number(root.style.getPropertyValue('--app-dim-opacity')) || 0
    const mixed = base.map((c) => Math.round(c * 0.8 * (1 - dim)))
    const color = `rgb(${mixed.join(', ')})`
    meta.setAttribute('content', color)
    root.style.setProperty('--safari-top', color)
    // Safari fills the strip above the page from the html background
    if (root.style.backgroundColor !== color) root.style.backgroundColor = color
  }
  syncThemeColor()
  new MutationObserver(syncThemeColor).observe(root, {
    attributes: true,
    attributeFilter: ['data-theme', 'style', 'data-bg-photo'],
  })
}
