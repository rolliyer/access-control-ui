export type ApiMode = 'mock' | 'http'

export interface AppConfig {
  /** `mock` keeps data in the browser; `http` calls the REST backend. */
  apiMode: ApiMode
  apiBaseUrl: string
  /** Admin email used by the mock backend for created_by / revoked_by. */
  actorEmail: string
}

const env = import.meta.env

export const appConfig: Readonly<AppConfig> = Object.freeze({
  apiMode: env.VITE_API_MODE === 'http' ? 'http' : 'mock',
  apiBaseUrl: env.VITE_API_BASE_URL || '/api',
  actorEmail: env.VITE_ACTOR_EMAIL || 'admin@rollerdigital.com',
})
