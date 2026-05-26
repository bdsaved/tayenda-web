import { defineConfig } from '@tanstack/react-start/config'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  vite: {
    plugins: [
      tailwindcss(),
      tsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
    ],
    server: {
      allowedHosts: ['tayenda.renai-labs.com'],
    },
  },
})
