import './index.css'
import './liquidGlass.css'
import './App.css'
import { createRoot } from 'react-dom/client'
import ProductRows from './components/ProductRows.jsx'
createRoot(document.getElementById('root')).render(
  <div className="stage"><div className="app-column is-home-wide"><div className="home-scroll"><ProductRows segment="market" /></div></div></div>)
