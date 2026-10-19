/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'mock' | 'http'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ACTOR_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Written by /config.js at container start (see docker/40-runtime-config.sh). */
interface Window {
  __APP_CONFIG__?: {
    apiMode?: string
    apiBaseUrl?: string
    actorEmail?: string
  }
}
