import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const search = new URLSearchParams(window.location.search)
const isE2e = search.has('e2e')

createRoot(document.getElementById('root')!).render(
  // React.StrictMode intentionally double-invokes effects in development.
  // Our e2e suite runs against the dev server, so disabling StrictMode in
  // e2e mode avoids double-initializing the WASM+worker backend (which can
  // be slow/flaky in CI and delay the rendered-scene readiness signal).
  isE2e ? (
    <App />
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  ),
)
