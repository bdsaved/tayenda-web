import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start'
import { createRouter } from './router'

const router = createRouter()

export default function hydrateApp() {
  hydrateRoot(document, <StartClient router={router} />)
}

// The server streams the router's dehydrated state in script tags after the
// app shell, while this module can load sooner. Hydrating before those scripts
// have run fails with "Expected to find a dehydrated data", so wait for the
// whole document to be parsed.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrateApp, { once: true })
} else {
  hydrateApp()
}
