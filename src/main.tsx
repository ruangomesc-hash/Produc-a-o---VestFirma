import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { capturePwaInstallPrompt } from './pwaInstall'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

capturePwaInstallPrompt()

const tree = (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

createRoot(document.getElementById('root')!).render(
  import.meta.env.DEV ? <StrictMode>{tree}</StrictMode> : tree,
)
