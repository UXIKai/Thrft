import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { BagProvider } from './BagContext.jsx'
import { initAppearance } from './appAppearance.js'
import './index.css'

initAppearance()

function fitScreen() {
  const vv = window.visualViewport
  const height = Math.round(vv?.height || window.innerHeight)
  const width = Math.round(vv?.width || window.innerWidth)
  const top = Math.round(vv?.offsetTop || 0)
  const left = Math.round(vv?.offsetLeft || 0)
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BagProvider>
      <App />
    </BagProvider>
  </StrictMode>,
)
