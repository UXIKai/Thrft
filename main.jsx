import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { BagProvider } from './BagContext.jsx'
import { initAppearance } from './appAppearance.js'
import './index.css'

initAppearance()

function fitScreen() {
  const vv = window.visualViewport
  // iOS can leave visualViewport stale after the toolbar collapses; take the largest.
  const height = Math.round(
    Math.max(vv?.height || 0, window.innerHeight, document.documentElement.clientHeight),
  )
  const width = Math.round(vv?.width || window.innerWidth)
  // Never follow the visual viewport's offset: the keyboard must not slide the page.
  const top = 0
  const left = 0
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
