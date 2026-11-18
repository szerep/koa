import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import App from './app/App.tsx'
import { connectFeatures } from './app/connect'

connectFeatures()

// Local development only: the Dev Tools (src/dev/). Vite turns this into `if (false)` in
// production builds, so the module isn't even emitted; scripts/check-build.mjs checks that.
if (import.meta.env.DEV) {
  void import('./dev/mountDevTools').then(({ mountDevTools }) => mountDevTools())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
