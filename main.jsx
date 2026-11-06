import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { BagProvider } from './BagContext.jsx'
import { initAppearance } from './appAppearance.js'
import './index.css'
import './liquidGlass.css'

initAppearance()

let maxHeight = 0
let lastLandscape = null

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
  const height = standalone ? maxHeight : measured
  // Never follow the visual viewport's offset: the keyboard must not slide the page.
  const top = 0
  const left = 0
  if (window.scrollY || window.scrollX) window.scrollTo(0, 0)
  const root = document.documentElement
  root.style.setProperty('--app-height', `${height}px`)
  root.style.setProperty('--app-width', `${width}px`)
  root.style.setProperty('--app-top', `${top}px`)
  root.style.setProperty('--app-left', `${left}px`)
}

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
