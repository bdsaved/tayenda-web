import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start'
import { createRouter } from './router'

const router = createRouter()

export default function hydrateApp() {
  hydrateRoot(document, <StartClient router={router} />)
}

hydrateApp()
