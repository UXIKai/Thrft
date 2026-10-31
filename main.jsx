import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { BagProvider } from './BagContext.jsx'
import { initAppearance } from './appAppearance.js'
import './index.css'

initAppearance()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BagProvider>
      <App />
    </BagProvider>
  </StrictMode>,
)
