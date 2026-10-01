/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin. "" = same origin (production behind Caddy). Unset = http://localhost:8000. */
  readonly VITE_API_URL?: string
  /** Optional XYZ tile URL template; defaults to OpenStreetMap. */
  readonly VITE_TILE_URL?: string
  readonly VITE_TILE_ATTRIBUTION?: string
  readonly VITE_MAPBOX_TOKEN?: string
  readonly VITE_MAPBOX_STYLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css?url' {
  const content: string
  export default content
}
