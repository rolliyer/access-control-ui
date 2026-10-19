export type ApiMode = 'mock' | 'http'

export interface AppConfig {
  /** `mock` keeps data in the browser; `http` calls the REST backend. */
  apiMode: ApiMode
  apiBaseUrl: string
  /** Admin email used by the mock backend for created_by / revoked_by. */
  actorEmail: string
}

/**
 * Settings come from two places, highest priority first:
 *  1. `window.__APP_CONFIG__`, set by /config.js. The Docker image writes it from
 *     environment variables at container start, so one image runs in every environment.
 *  2. `VITE_*` variables baked in at build time (.env files) — used by `npm run dev`.
 */
const runtime = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {}
const env = import.meta.env

function pick(...values: (string | undefined)[]): string | undefined {
  return values.find((v) => typeof v === 'string' && v.trim() !== '')?.trim()
}

export const appConfig: Readonly<AppConfig> = Object.freeze({
  apiMode: pick(runtime.apiMode, env.VITE_API_MODE) === 'http' ? 'http' : 'mock',
  apiBaseUrl: pick(runtime.apiBaseUrl, env.VITE_API_BASE_URL) ?? '/api',
  actorEmail: pick(runtime.actorEmail, env.VITE_ACTOR_EMAIL) ?? 'admin@rollerdigital.com',
})
