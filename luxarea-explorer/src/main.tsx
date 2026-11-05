import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import App from './App'
import { getStore } from './data/store'
import { setProperties } from './data/listings'

// Load the published register, then draw. If the store can't be reached,
// the Finder falls back to the built-in sample listings.
getStore()
  .then((s) => s.listPublished())
  .then((list) => setProperties(list))
  .catch((e) => console.warn('[luxarea] Using built-in listings:', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
